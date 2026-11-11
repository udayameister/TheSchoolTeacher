import Link from 'next/link';
import { withDb } from '@/lib/server/db';
import { lookupOf } from '@/lib/server/catalog';
import ImportQueue from '@/components/admin/ImportQueue';
import type { ImportStatus } from '@/types';

export const metadata = { title: 'Job import queue' };
const TABS: ImportStatus[] = ['new', 'published', 'duplicate', 'rejected'];

export default async function ImportQueuePage({ searchParams }: { searchParams: Promise<{ status?: string; source?: string }> }) {
  const q = await searchParams;
  const status = (TABS as string[]).includes(q.status || '') ? (q.status as ImportStatus) : 'new';
  const d = await withDb(db => {
    const lookup = lookupOf(db);
    const sources = new Map(db.importSources.map(s => [s.id, s]));
    const items = db.importItems.filter(i => i.status === status && (!q.source || i.sourceId === q.source))
      .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt)).slice(0, 300)
      .map(i => ({ ...i, sourceName: sources.get(i.sourceId)?.name || '(deleted source)', posts: i.detectedPostIds.map(p => lookup.get(p)?.name || p) }));
    const counts = Object.fromEntries(TABS.map(s => [s, db.importItems.filter(i => i.status === s).length]));
    return { items, counts, sources: db.importSources.map(s => ({ id: s.id, name: s.name })), active: db.importSources.filter(s => s.active).length };
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Job import queue</h1>
        <p className="text-ink-soft">Links that look like teacher vacancies or recruitment notices, found on your <Link href="/admin/imports/sources">import sources</Link> ({d.active} active, checked automatically). Open the original, then create a listing with your own short summary, or reject it. Nothing is published without you.</p>
      </div>
      <nav aria-label="Status" className="flex flex-wrap gap-1 text-sm">
        {TABS.map(s => <Link key={s} href={`/admin/imports?status=${s}${q.source ? `&source=${q.source}` : ''}`} aria-current={status === s ? 'true' : undefined} className={`rounded-lg px-3 py-1.5 no-underline ${status === s ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50'}`}>{s[0].toUpperCase() + s.slice(1)} ({d.counts[s]})</Link>)}
      </nav>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="status" value={status} />
        <label><span className="label">Source</span><select name="source" className="input" defaultValue={q.source || ''}><option value="">All sources</option>{d.sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <button className="btn-ghost">Filter</button>
      </form>
      <ImportQueue items={d.items} status={status} />
    </div>
  );
}
