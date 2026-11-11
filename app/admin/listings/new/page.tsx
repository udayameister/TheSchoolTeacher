import { withDb } from '@/lib/server/db';
import { draftFromItem } from '@/lib/server/importer';
import { listingLists } from '@/lib/server/listingLists';
import ListingForm from '@/components/admin/ListingForm';

export const metadata = { title: 'New listing' };

export default async function NewListing({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const q = await searchParams;
  const d = await withDb(db => {
    const draft = q.item ? draftFromItem(db, q.item) : null;
    const item = q.item ? db.importItems.find(i => i.id === q.item) : undefined;
    return { lists: listingLists(db), draft, item: item ? { title: item.title, url: item.url, excerpt: item.excerpt || '', source: db.importSources.find(s => s.id === item.sourceId)?.name || '' } : null };
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New listing</h1>
      {d.item && (
        <section className="card text-sm">
          <h2 className="font-bold">From the import queue</h2>
          <p className="mt-1"><a href={d.item.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold">{d.item.title}</a> <span className="text-ink-muted">({d.item.source})</span></p>
          {d.item.excerpt && <p className="mt-1 text-ink-soft">{d.item.excerpt}</p>}
          <p className="hint mt-2">Open the original and check every field. Write the description in your own words (posts, eligibility in brief, how to apply); do not paste the notice.</p>
        </section>
      )}
      <ListingForm lists={d.lists} initial={d.draft || {}} />
    </div>
  );
}
