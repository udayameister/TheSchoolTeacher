import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import TrackerManager from '@/components/candidate/TrackerManager';

export const metadata = { title: 'Deadline tracker' };

export default async function TrackerPage() {
  const user = await requireRole(['candidate'], '/candidate/tracker');
  const { t } = await getT();
  const items = await withDb(db => db.tracked.filter(x => x.userId === user.id).map(x => {
    // Vacancies from this site follow the latest last date (the school may extend it).
    const job = x.jobId ? db.jobs.find(j => j.id === x.jobId) : undefined;
    return job ? { ...x, title: job.title, organisation: job.orgName, lastDate: job.lastDate } : x;
  }));
  return (
    <div className="container-page max-w-4xl py-6">
      <h1 className="text-2xl font-bold">{t('tracker.title')}</h1>
      <p className="mb-4 mt-1 text-ink-soft">{t('tracker.intro')}</p>
      <TrackerManager initial={items} />
    </div>
  );
}
