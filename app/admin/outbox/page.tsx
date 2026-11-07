'use client';
import { useCallback, useEffect, useState } from 'react';
import type { OutboxItem } from '@/types';
import { api } from '@/lib/clientApi';

const STATUS: Record<string, string> = { sent: 'border-success-600/30 bg-success-50 text-success-700', logged: 'border-line bg-ivory', queued: 'border-marigold-400 bg-marigold-50 text-marigold-800', failed: 'border-danger-600/30 bg-danger-50 text-danger-700' };

export default function Outbox() {
  const [data, setData] = useState<{ configured: boolean; items: OutboxItem[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api<{ configured: boolean; items: OutboxItem[] }>('/api/admin/outbox');
    setData(r.ok ? r : { configured: false, items: [] });
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Email outbox</h1>
      {data && !data.configured && <p className="alert-error">Email sending is not configured. Messages are recorded here only. Set SMTP_* or EMAIL_API in .env.local (see env-settings-example.txt).</p>}
      {msg && <p role="status" className="alert-ok">{msg}</p>}
      <button type="button" className="btn-ghost" onClick={async () => { const r = await api<{ retried: number }>('/api/admin/outbox', {}); setMsg(`Retried ${r.retried ?? 0} message(s).`); load(); }}>Retry queued now</button>
      {data === null ? <p>Loading…</p> : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
          {data.items.map(o => (
            <li key={o.id} className="p-3">
              <button type="button" className="w-full text-left" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)}>
                <span className={`badge mr-2 ${STATUS[o.status]}`}>{o.status}</span>
                <span className="font-semibold">{o.subject}</span>
                <span className="block text-sm text-ink-soft">to {o.to} · {o.kind} · {o.createdAt.replace('T', ' ').slice(0, 16)} UTC{o.attempts > 1 ? ` · ${o.attempts} attempts` : ''}</span>
              </button>
              {open === o.id && (
                <div className="mt-2 space-y-2 text-sm">
                  {o.lastError && <p className="alert-error">{o.lastError}</p>}
                  <pre className="whitespace-pre-wrap rounded-lg bg-ivory p-3 font-sans">{o.text}</pre>
                </div>
              )}
            </li>
          ))}
          {!data.items.length && <li className="p-3 text-ink-soft">No emails yet.</li>}
        </ul>
      )}
    </div>
  );
}
