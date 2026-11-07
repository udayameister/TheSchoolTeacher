'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KindDef, MetaField } from '@/lib/masterData/kinds';
import type { MasterItem, MetaValue } from '@/types';
import { api } from '@/lib/clientApi';
import { toCsvRow } from '@/lib/csv';

/*
 * Generic editor for one master-data list, generated from its KindDef: search and filters, add/edit,
 * activate/deactivate, CSV import (all-or-nothing) and CSV export.
 */

type Draft = { id?: string; code: string; name: string; nameHi: string; parentId: string; sortOrder: string; active: boolean; verify: boolean; meta: Record<string, MetaValue> };
const PAGE = 200;

const emptyDraft = (def: KindDef): Draft => ({
  code: '', name: '', nameHi: '', parentId: '', sortOrder: '', active: true, verify: false,
  meta: Object.fromEntries(def.meta.map(f => [f.key, f.type === 'boolean' ? false : null])),
});

const toDraft = (i: MasterItem): Draft => ({ id: i.id, code: i.code, name: i.name, nameHi: i.nameHi || '', parentId: i.parentId || '', sortOrder: String(i.sortOrder), active: i.active, verify: i.verify, meta: { ...i.meta } });

function metaSummary(def: KindDef, item: MasterItem): string {
  return def.meta.map(f => {
    const v = item.meta[f.key];
    if (v === null || v === undefined || v === '' || v === false) return null;
    const shown = f.type === 'select' ? f.options?.find(o => o.value === v)?.label ?? v : v === true ? 'yes' : v;
    return `${f.label}: ${shown}`;
  }).filter(Boolean).join(' · ');
}

export default function MasterEditor({ def }: { def: KindDef }) {
  const [items, setItems] = useState<MasterItem[] | null>(null);
  const [parents, setParents] = useState<MasterItem[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive' | 'verify'>('all');
  const [parentFilter, setParentFilter] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; list?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ items: MasterItem[] }>(`/api/admin/master?kind=${def.kind}`);
    setItems(r.ok ? r.items : []);
    if (!r.ok) setMsg({ ok: false, text: r.error || 'Could not load the list.' });
  }, [def.kind]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!def.parent) return;
    api<{ items: MasterItem[] }>(`/api/admin/master?kind=${def.parent.kind}`).then(r => r.ok && setParents(r.items));
  }, [def.parent]);

  const parentName = useMemo(() => new Map(parents.map(p => [p.id, p.name])), [parents]);
  const parentCode = useMemo(() => new Map(parents.map(p => [p.id, p.code])), [parents]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items || []).filter(i =>
      (status === 'all' || (status === 'active' && i.active) || (status === 'inactive' && !i.active) || (status === 'verify' && i.verify))
      && (!parentFilter || i.parentId === parentFilter)
      && (!s || i.code.toLowerCase().includes(s) || i.name.toLowerCase().includes(s) || (i.nameHi || '').includes(s)));
  }, [items, q, status, parentFilter]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    const r = await api<{ item: MasterItem }>('/api/admin/master', { kind: def.kind, item: draft });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error || 'Could not save.' }); return; }
    setMsg({ ok: true, text: `Saved ${r.item.name}.` });
    setDraft(null);
    load();
  }

  async function toggle(i: MasterItem) {
    const r = await api('/api/admin/master', { kind: def.kind, id: i.id, active: !i.active }, 'PATCH');
    setMsg(r.ok ? { ok: true, text: `${i.name} ${i.active ? 'deactivated' : 'activated'}.` } : { ok: false, text: r.error || 'Could not change it.' });
    load();
  }

  async function importFile(file: File) {
    if (file.size > 5_000_000) { setMsg({ ok: false, text: 'The file is larger than 5 MB. Split it into smaller files.' }); return; }
    setBusy(true);
    const r = await api<{ added?: number; updated?: number; errors?: string[] }>('/api/admin/master/import', { kind: def.kind, csv: await file.text() });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Imported: ${r.added} added, ${r.updated} updated.` } : { ok: false, text: r.error || 'Import failed.', list: r.errors });
    load();
  }

  function exportCsv() {
    const header = ['code', 'name', 'nameHi', ...(def.parent ? ['parentCode'] : []), 'sortOrder', 'active', 'verify', ...def.meta.map(f => f.key)];
    const rows = (items || []).map(i => toCsvRow([i.code, i.name, i.nameHi || '', ...(def.parent ? [parentCode.get(i.parentId || '') || ''] : []), i.sortOrder, i.active, i.verify, ...def.meta.map(f => i.meta[f.key] ?? '')]));
    const blob = new Blob([`﻿${[toCsvRow(header), ...rows].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${def.kind}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const metaInput = (f: MetaField) => {
    if (!draft) return null;
    const v = draft.meta[f.key];
    const set = (val: MetaValue) => setDraft({ ...draft, meta: { ...draft.meta, [f.key]: val } });
    const id = `meta-${f.key}`;
    if (f.type === 'boolean') return <label key={f.key} className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-5 w-5" checked={v === true} onChange={e => set(e.target.checked)} />{f.label}</label>;
    return (
      <div key={f.key}>
        <label htmlFor={id} className="label">{f.label}</label>
        {f.type === 'select'
          ? <select id={id} className="input" value={String(v ?? '')} onChange={e => set(e.target.value || null)}><option value="">—</option>{f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          : <input id={id} className="input" type={f.type === 'number' ? 'number' : 'text'} min={f.min} max={f.max} value={v === null || v === undefined ? '' : String(v)} onChange={e => set(e.target.value === '' ? null : f.type === 'number' ? Number(e.target.value) : e.target.value)} />}
        {f.hint && <p className="hint">{f.hint}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div role="status" className={msg.ok ? 'alert-ok' : 'alert-error'}>
          {msg.text}
          {msg.list && <ul className="mt-2 list-disc pl-5">{msg.list.map(e => <li key={e}>{e}</li>)}</ul>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => { setDraft(emptyDraft(def)); setMsg(null); }}>Add item</button>
        <label className="btn-ghost cursor-pointer">
          Import CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
        </label>
        <button type="button" className="btn-ghost" onClick={exportCsv} disabled={!items?.length}>Export CSV</button>
      </div>
      <p className="hint">CSV columns: code, name, nameHi{def.parent ? ', parentCode' : ''}, sortOrder, active{def.meta.length ? `, ${def.meta.map(f => f.key).join(', ')}` : ''}. Existing codes are updated; new codes are added. If any row has an error, nothing is imported.</p>

      {draft && (
        <form onSubmit={save} className="card grid gap-3 sm:grid-cols-2" aria-label={draft.id ? 'Edit item' : 'Add item'}>
          <h2 className="text-lg font-bold sm:col-span-2">{draft.id ? `Edit ${draft.name}` : 'Add item'}</h2>
          <div><label htmlFor="m-code" className="label">Code</label>
            <input id="m-code" className="input uppercase" required disabled={!!draft.id} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} />
            <p className="hint">{draft.id ? 'Codes cannot change (other records point at them).' : 'Letters, digits and _ only.'}</p></div>
          <div><label htmlFor="m-sort" className="label">Sort order</label>
            <input id="m-sort" className="input" type="number" value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: e.target.value })} /></div>
          <div><label htmlFor="m-name" className="label">Name (English)</label>
            <input id="m-name" className="input" required maxLength={200} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
          <div><label htmlFor="m-namehi" className="label">Name (Hindi)</label>
            <input id="m-namehi" className="input" lang="hi" maxLength={200} value={draft.nameHi} onChange={e => setDraft({ ...draft, nameHi: e.target.value })} /></div>
          {def.parent && (
            <div className="sm:col-span-2"><label htmlFor="m-parent" className="label">{def.parent.label}{def.parent.required ? '' : ' (optional)'}</label>
              <select id="m-parent" className="input" required={def.parent.required} value={draft.parentId} onChange={e => setDraft({ ...draft, parentId: e.target.value })}>
                <option value="">—</option>{parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          )}
          {def.meta.map(metaInput)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />Active (shown in forms and filters)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={draft.verify} onChange={e => setDraft({ ...draft, verify: e.target.checked })} />Needs verification (VERIFY)</label>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={busy}>Save</button>
            <button type="button" className="btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <label className="min-w-[200px] flex-1"><span className="sr-only">Search</span><input className="input" type="search" placeholder="Search code or name" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label><span className="sr-only">Status</span>
          <select className="input" value={status} onChange={e => setStatus(e.target.value as typeof status)}>
            <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="verify">Needs verification</option>
          </select></label>
        {def.parent && (
          <label><span className="sr-only">{def.parent.label}</span>
            <select className="input" value={parentFilter} onChange={e => setParentFilter(e.target.value)}>
              <option value="">Any {def.parent.label.toLowerCase()}</option>{parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
        )}
      </div>

      {items === null ? <p>Loading…</p> : filtered.length === 0 ? <p className="card text-ink-soft">No items{items.length ? ' match these filters' : ' yet'}.{def.kind === 'districts' || def.kind === 'blocks' ? ' Import them as CSV from the Local Government Directory.' : ''}</p> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="table">
            <thead><tr><th scope="col">Code</th><th scope="col">Name</th>{def.parent && <th scope="col">{def.parent.label}</th>}<th scope="col">Details</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filtered.slice(0, PAGE).map(i => (
                <tr key={i.id} className={i.active ? '' : 'text-ink-muted'}>
                  <td className="font-mono text-xs">{i.code}</td>
                  <td><span className="font-semibold">{i.name}</span>{i.nameHi && <span lang="hi" className="block text-ink-soft">{i.nameHi}</span>}</td>
                  {def.parent && <td>{parentName.get(i.parentId || '') || '—'}</td>}
                  <td className="text-xs">{metaSummary(def, i)}</td>
                  <td className="whitespace-nowrap">
                    {!i.active && <span className="badge border-line bg-ivory">Inactive</span>}
                    {i.verify && <span className="badge ml-1 border-marigold-400 bg-marigold-50 text-marigold-800">VERIFY</span>}
                  </td>
                  <td className="whitespace-nowrap">
                    <button type="button" className="font-semibold text-brand-700 underline" onClick={() => { setDraft(toDraft(i)); setMsg(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit<span className="sr-only"> {i.name}</span></button>
                    <button type="button" className="ml-3 font-semibold text-brand-700 underline" onClick={() => toggle(i)}>{i.active ? 'Deactivate' : 'Activate'}<span className="sr-only"> {i.name}</span></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > PAGE && <p className="p-3 text-sm text-ink-muted">Showing the first {PAGE} of {filtered.length}. Use search or filters to narrow the list.</p>}
        </div>
      )}
    </div>
  );
}
