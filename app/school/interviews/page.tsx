import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireSchoolPerm } from '@/lib/server/schoolPage';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { schoolSchedule } from '@/lib/server/interviews';
import { SlotForm, SlotList, InterviewList } from '@/components/school/InterviewTools';

export const metadata = { title: 'Interviews and demo classes' };

export default async function SchoolInterviews({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const user = await requireSchoolPerm('interviews', '/school/interviews');
  const [{ t }, q] = await Promise.all([getT(), searchParams]);
  const d = await withDb(db => {
    const school = currentSchool(db, user);
    if (!school) return null;
    const jobs = db.jobs.filter(j => j.schoolId === school.id && j.status !== 'draft').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const jobId = jobs.some(j => j.id === q.job) ? q.job! : '';
    const s = schoolSchedule(db, user, jobId || null);
    return { jobs: jobs.map(j => ({ id: j.id, title: j.title, status: j.status })), jobId, ...s, now: Date.now() };
  });
  if (!d) redirect('/school');
  const upcomingSlots = d.slots.filter(s => Date.parse(s.start) >= d.now - 4 * 3600_000);
  return (
    <div className="container-page space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('interviews.title')}</h1>
        <p className="text-ink-soft">{t('interviews.schoolIntro')}</p>
      </div>
      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="sm:w-96"><span className="label">{t('jobs.post')}</span>
          <select name="job" className="input" defaultValue={d.jobId}><option value="">{t('ats.allVacancies')}</option>{d.jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></label>
        <button className="btn-ghost">{t('ats.filter')}</button>
      </form>
      {!d.jobs.length ? <p className="card text-ink-soft">{t('interviews.noVacancies')}</p> : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="iv-h" className="space-y-2">
              <h2 id="iv-h" className="text-lg font-bold">{t('interviews.invitations')}</h2>
              <p className="hint">{t('interviews.howToInvite')} <Link href={`/school/applicants${d.jobId ? `?job=${d.jobId}` : ''}`}>{t('school.nav_applicants')}</Link></p>
              <InterviewList rows={d.interviews} />
            </section>
            <section aria-labelledby="slots-h" className="space-y-2">
              <h2 id="slots-h" className="text-lg font-bold">{t('interviews.slots')}</h2>
              <SlotList slots={upcomingSlots} jobs={d.jobs} />
            </section>
          </div>
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <SlotForm jobs={d.jobs.filter(j => j.status === 'published' || j.status === 'closed')} jobId={d.jobId} />
          </aside>
        </div>
      )}
    </div>
  );
}
