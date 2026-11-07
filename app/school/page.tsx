import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { PIPELINE } from '@/lib/server/pipeline';
import { isPast } from '@/lib/jobs/dates';
import VerificationStatus from '@/components/school/VerificationStatus';

export default async function SchoolHome({ searchParams }: { searchParams: Promise<{ registered?: string; email?: string }> }) {
  const user = await requireRole(['school_admin', 'school_staff'], '/school');
  const [{ t, locale }, q] = await Promise.all([getT(), searchParams]);
  const d = await withDb(db => {
    const school = currentSchool(db, user);
    if (!school) return null;
    const jobs = db.jobs.filter(j => j.schoolId === school.id);
    const apps = db.applications.filter(a => a.schoolId === school.id && a.stage !== 'withdrawn');
    return {
      school,
      open: jobs.filter(j => j.status === 'published' && !isPast(j.lastDate)).length,
      drafts: jobs.filter(j => j.status === 'draft').length,
      views: jobs.reduce((s, j) => s + (db.jobViews[j.id] || 0), 0),
      byStage: Object.fromEntries(PIPELINE.map(s => [s, apps.filter(a => a.stage === s).length])),
      total: apps.length,
      recent: apps.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, 6).map(a => ({ a, name: db.users.find(u => u.id === a.candidateId)?.name || '', job: jobs.find(j => j.id === a.jobId)?.title || '' })),
    };
  });

  if (!d) return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="text-2xl font-bold">{t('console.schoolTitle')}</h1>
      {user.role === 'school_admin'
        ? <div className="card mt-6 space-y-3"><p>{t('school.registerFirst')}</p><Link href="/school/register" className="btn-primary">{t('school.registerTitle')}</Link></div>
        : <p className="card mt-6">{t('school.staffNoSchool')}</p>}
    </div>
  );

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const tile = (label: string, value: number, href: string) => <Link href={href} className="card block no-underline hover:shadow-md"><span className="block text-2xl font-bold text-brand-900">{value}</span><span className="text-sm text-ink-soft">{label}</span></Link>;

  return (
    <div className="container-page space-y-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{d.school.name}</h1>
          <p className="text-sm text-ink-muted">{t('console.schoolTitle')} · UDISE+ {d.school.udiseCode}</p>
        </div>
        <Link href="/school/jobs/new" className="btn-primary">{t('post.newVacancy')}</Link>
      </div>
      {q.registered && <p className="alert-ok" role="status">{t('school.registeredThanks')}</p>}
      {q.email === 'ok' && <p className="alert-ok" role="status">{t('school.emailConfirmed')}</p>}
      {q.email === 'invalid' && <p className="alert-error" role="status">{t('school.emailLinkInvalid')}</p>}
      <VerificationStatus school={d.school} t={t} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tile(t('school.openVacancies'), d.open, '/school/jobs')}
        {tile(t('school.drafts'), d.drafts, '/school/jobs?status=draft')}
        {tile(t('school.applicants'), d.total, '/school/applicants')}
        {tile(t('school.views'), d.views, '/school/jobs')}
      </div>

      <section className="card" aria-labelledby="funnel-h">
        <h2 id="funnel-h" className="text-lg font-bold">{t('school.pipeline')}</h2>
        <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9">
          {PIPELINE.map(s => (
            <li key={s}><Link href={`/school/applicants?stage=${s}`} className="block rounded-lg border border-line p-2 text-center no-underline hover:bg-brand-50">
              <span className="block text-xl font-bold text-brand-900">{d.byStage[s]}</span><span className="text-xs text-ink-soft">{t(`stages.${s}`)}</span></Link></li>
          ))}
        </ol>
      </section>

      <section className="card" aria-labelledby="recent-h">
        <h2 id="recent-h" className="text-lg font-bold">{t('school.recentApplicants')}</h2>
        {d.recent.length ? (
          <ul className="mt-2 divide-y divide-line">{d.recent.map(({ a, name, job }) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span><Link href={`/school/applicants/${a.id}`} className="font-semibold">{name}</Link> · {job}</span>
              <span className="text-ink-muted">{t(`stages.${a.stage}`)} · {fmt(a.appliedAt)}</span>
            </li>
          ))}</ul>
        ) : <p className="mt-2 text-ink-soft">{t('school.noApplicants')}</p>}
      </section>
    </div>
  );
}
