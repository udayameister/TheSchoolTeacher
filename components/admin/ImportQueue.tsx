'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import type { ImportItem, ImportStatus } from '@/types';
import { api } from '@/lib/clientApi';

type Row = ImportItem & { sourceName: string; posts: string[] };

export default function ImportQueue({ items, status }: { items: Row[]; status: ImportStatus }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const act = async (body: Record<string, unknown>, ok: string) => {
    const r = await api<{ changed?: number }>('/api/admin/imports', body);
    setMsg(r.ok ? { ok: true, text: ok.replace('{n}', String(r.changed ?? 1)) } : { ok: false, text: r.error || 'Something went wrong.' });
    setSel(new Set());
    router.refresh();
  };
  const toggle = (id: string) => setSel(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  if (!items.length) return <p className="card text-ink-soft">Nothing here.</p>;
  return (
    <div className="space-y-3">
      {status === 'new' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={sel.size === items.length} onChange={e => setSel(new Set(e.target.checked ? items.map(i => i.id) : []))} />Select all</label>
          {sel.size > 0 && <>
            <button type="button" className="btn-ghost min-h-[36px] py-1 text-sm" onClick={() => act({ action: 'bulk', ids: [...sel], status: 'rejected' }, 'Rejected {n}.')}>Reject {sel.size}</button>
            <button type="button" className="btn-ghost min-h-[36px] py-1 text-sm" onClick={() => act({ action: 'bulk', ids: [...sel], status: 'duplicate' }, 'Marked {n} as duplicates.')}>Mark {sel.size} duplicate</button>
          </>}
        </div>
      )}
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
      <ul className="space-y-2">{items.map(i => (
        <li key={i.id} className="card space-y-1 p-4 text-sm">
          <div className="flex items-start gap-2">
            {status === 'new' && <input type="checkbox" aria-label={`Select ${i.title}`} className="mt-1 h-4 w-4 shrink-0" checked={sel.has(i.id)} onChange={() => toggle(i.id)} />}
            <div className="min-w-0 flex-1">
              <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-start gap-1 font-semibold">{i.pdf ? <FileText size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <ExternalLink size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}<span className="break-words">{i.title}</span></a>
              <p className="text-xs text-ink-muted">{i.sourceName} · found {new Date(i.firstSeenAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}{i.detectedDate ? ` · date in text: ${i.detectedDate}` : ''}{i.posts.length ? ` · posts: ${i.posts.join(', ')}` : ''}{i.pdf ? ' · PDF' : ''}</p>
              {i.excerpt && <details className="mt-1"><summary className="cursor-pointer text-xs text-brand-700">Text around the link</summary><p className="mt-1 text-xs text-ink-soft">{i.excerpt}</p></details>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            {status === 'new' && <>
              <Link href={`/admin/listings/new?item=${i.id}`} className="font-semibold">Create listing</Link>
              <button type="button" className="font-semibold text-ink-soft underline" onClick={() => act({ action: 'item', id: i.id, status: 'duplicate' }, 'Marked as duplicate.')}>Duplicate</button>
              <button type="button" className="font-semibold text-danger-700 underline" onClick={() => act({ action: 'item', id: i.id, status: 'rejected' }, 'Rejected.')}>Reject</button>
            </>}
            {status === 'published' && i.jobId && <><Link href={`/jobs/${i.jobId}`}>View listing</Link><Link href={`/admin/listings/${i.jobId}`}>Edit listing</Link></>}
            {(status === 'rejected' || status === 'duplicate') && <button type="button" className="font-semibold underline" onClick={() => act({ action: 'item', id: i.id, status: 'new' }, 'Moved back to the queue.')}>Back to queue</button>}
          </div>
        </li>
      ))}</ul>
    </div>
  );
}
