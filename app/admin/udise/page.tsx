'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/clientApi';

/** Import the UDISE+ school directory (CSV) used to check school registrations. */
export default function UdiseAdmin() {
  const [size, setSize] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; list?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ size: number }>('/api/admin/udise').then(r => r.ok && setSize(r.size)); }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">UDISE+ directory</h1>
      <p className="text-ink-soft">Reference list of schools (UDISE+ code, name, state, district, block, management, category). Registrations are matched against it; it is never shown publicly. {size !== null && <strong>{size.toLocaleString('en-IN')} schools loaded.</strong>}</p>
      <div className="card space-y-3">
        <label className="block"><span className="label">CSV file (up to 8 MB; split big states by district)</span>
          <input type="file" accept=".csv,text/csv" className="input py-2" disabled={busy} onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 8_000_000) { setMsg({ ok: false, text: 'The file is larger than 8 MB.' }); return; }
            setBusy(true); setMsg(null);
            const r = await api<{ added: number; updated: number; skipped: number; problems: string[]; size: number }>('/api/admin/udise', { csv: await file.text() });
            setBusy(false); e.target.value = '';
            if (r.ok) { setSize(r.size); setMsg({ ok: true, text: `${r.added} added, ${r.updated} updated, ${r.skipped} skipped.`, list: r.problems }); }
            else setMsg({ ok: false, text: r.error || 'Import failed.' });
          }} /></label>
        <p className="hint">Columns are recognised by name: “UDISE Code”, “School Name”, “State”, “District”, “Block”, “Management”, “Category”. Rows are matched by code: newer files update existing rows.</p>
        {busy && <p role="status">Importing…</p>}
        {msg && <div role="status" className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}{msg.list?.length ? <ul className="mt-2 list-disc pl-5">{msg.list.map(p => <li key={p}>{p}</li>)}</ul> : null}</div>}
      </div>
    </div>
  );
}
