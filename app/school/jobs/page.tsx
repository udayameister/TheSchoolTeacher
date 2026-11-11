import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireSchoolPerm } from '@/lib/server/schoolPage';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { lookupOf } from '@/lib/server/catalog';
import { deadlineLabel, nameOf } from '@/lib/jobs/display';
import { isPast } from '@/lib/jobs/dates';
import JobActions from '@/components/school/JobActions';

export const metadata = { title: 'Vacancies' };

export default async function SchoolJobs({ searchParams }: { searchParams: Promise<{ status?: string; saved?: string }> }) {
  const user = await requireSchoolPerm('jobs', '/school/jobs');
  const [{ t, locale }, q] = await Promise.all([getT(), searchParams]);
  const d = await withDb(db => {
    const school = currentSchool(db, user);
    if (!school) return null;
    const jobs = db.jobs.filter(j => j.schoolId === school.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return {
      school, lookup: lookupOf(db),
      rows: jobs.map(j => {
        const apps = db.applications.filter(a => a.jobId === j.id && a.stage !== 'withdrawn');
        return { j, views: db.jobViews[j.id] || 0, apps: apps.length, fresh: apps.filter(a => a.stage === 'applied').length, everApplied: db.applications.some(a => a.jobId === j.id) };
      }),
    };
  });
  if (!d) redirect('/school');
  const verified = d.school.verification === 'verified';
  const statusOf = (s: string, past: boolean) => (s === 'published' && past ? 'expired' : s);
  const rows = d.rows.filter(r => !q.status || statusOf(r.j.status, isPast(r.j.lastDate)) === q.status);
  const tone: Record<string, string> = { published: 'border-success-600/30 bg-success-50 text-success-700', draft: 'border-line bg-ivory text-ink', closed: 'border-line bg-ivory text-ink-muted', expired: 'border-marigold-400 bg-marigold-50 text-marigold-800' };

  return (
    <div className="container-page space-y-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t('school.nav_jobs')}</h1>
        <Link href="/school/jobs/new" className="btn-primary">{t('post.newVacancy')}</Link>
      </div>
      {q.saved && <p className="alert-ok" role="status">{q.saved === 'published' ? t('post.publishedOk') : t('post.savedOk')}</p>}
      {!verified && <p className="alert-error">{t('post.draftOnly')}</p>}
      <nav aria-label={t('jobs.filters')} className="flex flex-wrap gap-1 text-sm">
        {['', 'published', 'draft', 'expired', 'closed'].map(s => (
          <Link key={s} href={s ? `/school/jobs?status=${s}` : '/school/jobs'} aria-current={(q.status || '') === s ? 'true' : undefined}
            className={`rounded-lg px-3 py-1.5 no-underline ${(q.status || '') === s ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50'}`}>{s ? t(`post.status_${s}`) : t('jobs.typeAll')}</Link>
        ))}
      </nav>
      {!rows.length ? <p className="card text-ink-soft">{t('post.none')}</p> : (
        <ul className="space-y-3">
          {rows.map(({ j, views, apps, fresh, everApplied }) => {
            const st = statusOf(j.status, isPast(j.lastDate));
            return (
              <li key={j.id} className="card space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{j.status === 'published' && verified ? <Link href={`/jobs/${j.id}`}>{j.title}</Link> : j.title}</h2>
                    <p className="text-sm text-ink-soft">{nameOf(d.lookup, j.postId, locale)} · {deadlineLabel(j.lastDate, t, locale).text}</p>
                  </div>
                  <span className={`badge self-start ${tone[st]}`}>{t(`post.status_${st}`)}</span>
                </div>
                <p className="text-sm">{t('post.stats', { views, apps, fresh })}{j.status !== 'draft' && <> · <Link href={`/school/jobs/${j.id}/panel`}>{t('panel.panelAndRanking')}</Link>{(j.panel?.length || 0) > 0 && <span className="text-ink-muted"> ({t('panel.members', { n: j.panel!.length })})</span>}</>}</p>
                <JobActions id={j.id} status={j.status} canPublish={verified} canDelete={j.status === 'draft' && !everApplied} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
