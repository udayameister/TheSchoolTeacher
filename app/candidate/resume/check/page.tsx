import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { checkBuilt } from '@/lib/server/cvService';
import { cleanHidden } from '@/lib/resume/model';
import CvTools from '@/components/candidate/CvTools';

export const metadata = { title: 'Resume checker and CV import', robots: { index: false } };

export default async function ResumeCheckPage({ searchParams }: { searchParams: Promise<{ hide?: string; job?: string }> }) {
  const q = await searchParams;
  const user = await requireRole(['candidate'], '/candidate/resume/check');
  const { t, locale } = await getT();
  const d = await withDb(db => {
    const mine = new Set([...db.applications.filter(a => a.candidateId === user.id).map(a => a.jobId), ...db.savedJobs.filter(s => s.userId === user.id).map(s => s.jobId)]);
    const jobs = db.jobs.filter(j => mine.has(j.id) && j.status === 'published').slice(0, 50).map(j => ({ id: j.id, label: `${j.title} — ${j.orgName}` }));
    const jobId = jobs.some(j => j.id === q.job) ? q.job! : null;
    return { jobs, jobId, built: checkBuilt(db, user, locale, cleanHidden(q.hide), jobId) };
  });
  return (
    <div className="container-page max-w-4xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('checker.title')}</h1>
        <p className="text-ink-soft">{t('checker.intro')}</p>
      </div>
      <CvTools built={d.built} jobs={d.jobs} jobId={d.jobId} hide={q.hide || ''} />
    </div>
  );
}
