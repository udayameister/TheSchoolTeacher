'use client';
import { useCallback, useEffect, useState } from 'react';
import type { AuditEntry } from '@/types';
import { api } from '@/lib/clientApi';

export default function AuditLog() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<{ total: number; rows: AuditEntry[] } | null>(null);
  const params = new URLSearchParams({ q, action, from, to }).toString();

  const load = useCallback(async () => {
    const r = await api<{ total: number; rows: AuditEntry[] }>(`/api/admin/audit?${params}`);
    setData(r.ok ? { total: r.total, rows: r.rows } : { total: 0, rows: [] });
  }, [params]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <div className="grid gap-2 sm:grid-cols-5">
        <label className="sm:col-span-2"><span className="label">Search</span><input className="input" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Email, target, detail" /></label>
        <label><span className="label">Action starts with</span><input className="input" value={action} onChange={e => setAction(e.target.value)} placeholder="e.g. auth. or master." /></label>
        <label><span className="label">From</span><input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label><span className="label">To</span><input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      </div>
      <a className="btn-ghost" href={`/api/admin/audit?${params}&format=csv`}>Download CSV</a>
      {data === null ? <p>Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="table">
            <thead><tr><th scope="col">Time (UTC)</th><th scope="col">Action</th><th scope="col">By</th><th scope="col">Target</th><th scope="col">Detail</th></tr></thead>
            <tbody>{data.rows.map(a => (
              <tr key={a.id}><td className="whitespace-nowrap text-xs">{a.at.replace('T', ' ').slice(0, 19)}</td><td className="font-mono text-xs">{a.action}</td><td>{a.actorEmail || a.actorId || 'system'}</td><td className="text-xs">{a.target}</td><td className="text-xs">{a.detail}{a.ip ? ` · ${a.ip}` : ''}</td></tr>
            ))}</tbody>
          </table>
          <p className="p-3 text-sm text-ink-muted">{data.total > data.rows.length ? `Showing ${data.rows.length} of ${data.total}. Download the CSV for all rows.` : `${data.total} entries.`}</p>
        </div>
      )}
    </div>
  );
}
