import Link from 'next/link';
import { withDb } from '@/lib/server/db';
import { isPast } from '@/lib/jobs/dates';

export const metadata = { title: 'Notices & listings' };

export default async function ListingsPage() {
  const rows = await withDb(db => db.jobs.filter(j => j.kind !== 'school').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(j => ({ ...j, views: db.jobViews[j.id] ?? j.views ?? 0 })));
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Government notices & external listings</h1>
          <p className="text-ink-soft">&ldquo;Apply on official site&rdquo; listings written by the admin, from the import queue or by hand. Schools&apos; own vacancies are not listed here.</p>
        </div>
        <Link href="/admin/listings/new" className="btn-primary">New listing</Link>
      </div>
      {!rows.length ? <p className="card text-ink-soft">No listings yet.</p> : (
        <div className="relative overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="table">
            <thead><tr><th scope="col">Title</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Last date</th><th scope="col">Views</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{rows.map(j => (
              <tr key={j.id}>
                <td><span className="font-semibold">{j.title}</span><span className="block text-xs text-ink-muted">{j.orgName}{j.importItemId ? ' · from import' : ''}</span></td>
                <td>{j.kind === 'government' ? 'Government notice' : 'External vacancy'}</td>
                <td>{j.status}{j.status === 'published' && isPast(j.lastDate) ? ' (expired)' : ''}</td>
                <td className="whitespace-nowrap">{j.lastDate}</td>
                <td>{j.views}</td>
                <td className="whitespace-nowrap"><Link href={`/admin/listings/${j.id}`}>Edit</Link>{j.status === 'published' && <> · <Link href={`/jobs/${j.id}`}>View</Link></>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
