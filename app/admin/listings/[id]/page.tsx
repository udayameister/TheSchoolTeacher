import { notFound } from 'next/navigation';
import { withDb } from '@/lib/server/db';
import { listingLists } from '@/lib/server/listingLists';
import ListingForm from '@/components/admin/ListingForm';

export const metadata = { title: 'Edit listing' };

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await withDb(db => {
    const job = db.jobs.find(j => j.id === id && j.kind !== 'school');
    return job ? { job: structuredClone(job), lists: listingLists(db) } : null;
  });
  if (!d) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit listing</h1>
      <ListingForm lists={d.lists} initial={d.job as unknown as Record<string, unknown>} />
    </div>
  );
}
