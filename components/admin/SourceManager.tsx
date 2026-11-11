'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Play, Plus } from 'lucide-react';
import type { ImportSource, ImportSourceKind } from '@/types';
import { api } from '@/lib/clientApi';

type Src = ImportSource & { waiting: number };
type Sug = { index: number; name: string; url: string; kind: ImportSourceKind; orgName: string; note: string; added: boolean };
const KIND: Record<ImportSourceKind, string> = { govt_page: 'Government page', school_careers: 'School careers page', feed: 'Feed (RSS / Atom)' };
const blank = { id: '', name: '', url: '', kind: 'govt_page' as ImportSourceKind, orgName: '', stateId: '', everyHours: 24, active: true, note: '' };
const when = (iso?: string | null) => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : 'never';

export default function SourceManager({ sources, states, suggestions }: { sources: Src[]; states: { id: string; name: string }[]; suggestions: Sug[] }) {
  const router = useRouter();
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(String(body.id || body.action));
    const r = await api<{ found?: number; added?: number; status?: string }>('/api/admin/imports', body);
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: body.action === 'run' ? `Read the page: ${r.found} relevant link(s), ${r.added} new in the queue.` : ok } : { ok: false, text: r.error || 'Something went wrong.' });
    router.refresh();
    return r.ok;
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });
  return (
    <div className="space-y-6">
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
      <section className="card" aria-labelledby="src-h">
        <h2 id="src-h" className="text-lg font-bold">Sources ({sources.length})</h2>
        {!sources.length ? <p className="mt-2 text-ink-soft">No sources yet. Add one below, or start from a suggestion.</p> : (
          <ul className="mt-2 divide-y divide-line">{sources.map(s => (
            <li key={s.id} className="space-y-1 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{s.name} {s.verify && <span className="badge border-marigold-400 bg-marigold-50 text-marigold-800">VERIFY address</span>} {!s.active && <span className="badge border-line bg-ivory text-ink-muted">off</span>}</p>
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-xs">{s.url}</a>
                  <p className="text-xs text-ink-muted">{KIND[s.kind]} · {s.orgName} · every {s.everyHours} h · last run {when(s.lastRunAt)}{s.lastStatus ? ` (${s.lastStatus}${s.lastStatus === 'ok' ? `: ${s.lastFound ?? 0} found, ${s.lastNew ?? 0} new` : ''})` : ''} · {s.waiting} waiting for review</p>
                  {s.lastError && <p className="text-xs text-danger-700">{s.lastError}</p>}
                  {s.note && <p className="text-xs text-ink-soft">{s.note}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost min-h-[36px] py-1 text-sm" disabled={busy === s.id} onClick={() => call({ action: 'run', id: s.id }, '')}><Play size={14} aria-hidden="true" />{busy === s.id ? 'Reading…' : 'Run now'}</button>
                  <button type="button" className="btn-ghost min-h-[36px] py-1 text-sm" onClick={() => call({ action: 'toggle', id: s.id, active: !s.active }, s.active ? 'Switched off.' : 'Switched on.')}>{s.active ? 'Switch off' : 'Switch on'}</button>
                  <button type="button" className="btn-ghost min-h-[36px] py-1 text-sm" onClick={() => { setF({ id: s.id, name: s.name, url: s.url, kind: s.kind, orgName: s.orgName, stateId: s.stateId || '', everyHours: s.everyHours, active: s.active, note: s.note || '' }); document.getElementById('form-h')?.scrollIntoView(); }}>Edit</button>
                  <button type="button" className="min-h-[36px] text-sm font-semibold text-danger-700 underline" onClick={() => window.confirm(`Delete "${s.name}"? Items waiting for review from it are removed; published listings stay.`) && call({ action: 'deleteSource', id: s.id }, 'Deleted.')}>Delete</button>
                </div>
              </div>
            </li>
          ))}</ul>
        )}
      </section>

      <form className="card grid gap-3 sm:grid-cols-2" aria-labelledby="form-h" onSubmit={async e => { e.preventDefault(); if (await call({ action: 'saveSource', ...f, everyHours: Number(f.everyHours), id: f.id || undefined }, f.id ? 'Saved.' : 'Source added.')) setF(blank); }}>
        <h2 id="form-h" className="text-lg font-bold sm:col-span-2">{f.id ? 'Edit source' : 'Add a source'}</h2>
        <label><span className="label">Name</span><input className="input" required maxLength={120} value={f.name} onChange={set('name')} placeholder="e.g. Delhi Public School, Pune – careers" /></label>
        <label><span className="label">Kind</span><select className="input" value={f.kind} onChange={set('kind')}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="label">Web address</span><input className="input" type="url" required maxLength={600} placeholder="https://" value={f.url} onChange={set('url')} /></label>
        <label><span className="label">Employer / recruiting body (shown on listings)</span><input className="input" required maxLength={160} value={f.orgName} onChange={set('orgName')} /></label>
        <label><span className="label">State (optional)</span><select className="input" value={f.stateId} onChange={set('stateId')}><option value="">All India / not set</option>{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label><span className="label">Check every (hours)</span><input className="input" type="number" min={6} max={336} value={f.everyHours} onChange={set('everyHours')} /></label>
        <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" className="h-5 w-5" checked={f.active} onChange={set('active')} />Active (checked automatically)</label>
        <label className="sm:col-span-2"><span className="label">Note (optional)</span><input className="input" maxLength={500} value={f.note} onChange={set('note')} /></label>
        <div className="flex gap-2 sm:col-span-2"><button className="btn-primary">{f.id ? 'Save' : 'Add source'}</button>{f.id && <button type="button" className="btn-ghost" onClick={() => setF(blank)}>Cancel</button>}</div>
      </form>

      <section className="card" aria-labelledby="sug-h">
        <h2 id="sug-h" className="text-lg font-bold">Suggested official sources</h2>
        <p className="text-sm text-ink-soft">Added switched off and marked VERIFY: open the address, make sure it is the official page that lists teacher recruitment, correct it if needed, then switch it on.</p>
        <ul className="mt-2 divide-y divide-line">{suggestions.map(s => (
          <li key={s.index} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0"><span className="font-semibold">{s.name}</span> <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-xs">{s.url}</a><span className="block text-xs text-ink-muted">{s.note}</span></span>
            {s.added ? <span className="text-xs text-ink-muted">Added</span> : <button type="button" className="btn-ghost min-h-[36px] py-1 text-sm" onClick={() => call({ action: 'suggest', index: s.index }, `Added "${s.name}" (switched off).`)}><Plus size={14} aria-hidden="true" />Add</button>}
          </li>
        ))}</ul>
      </section>
    </div>
  );
}
