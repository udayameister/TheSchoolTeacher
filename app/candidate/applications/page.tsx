import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { lookupOf } from '@/lib/server/catalog';
import { STAGES, WITHDRAWABLE, deadlineLabel, placeLabel } from '@/lib/jobs/display';
import WithdrawButton from '@/components/candidate/WithdrawButton';

export const metadata = { title: 'My applications' };

export default async function ApplicationsPage() {
  const user = await requireRole(['candidate'], '/candidate/applications');
  const { t, locale } = await getT();
  const { apps, lookup } = await withDb(db => ({
    lookup: lookupOf(db),
    apps: db.applications.filter(a => a.candidateId === user.id).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).map(a => ({ a, job: db.jobs.find(j => j.id === a.jobId) })),
  }));
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <div className="container-page max-w-4xl py-6">
      <h1 className="text-2xl font-bold">{t('applications.title')}</h1>
      {!apps.length ? (
        <div className="card mt-4"><p>{t('applications.none')}</p><Link href="/jobs" className="btn-primary mt-3">{t('home.searchButton')}</Link></div>
      ) : (
        <ul className="mt-4 space-y-4">
          {apps.map(({ a, job }) => {
            const ended = a.stage === 'withdrawn' || a.stage === 'not_selected';
            const reached = STAGES.indexOf(a.stage);
            return (
              <li key={a.id} className="card space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold">{job ? <Link href={`/jobs/${job.id}`}>{job.title}</Link> : t('applications.jobRemoved')}</h2>
                    {job && <p className="text-sm text-ink-soft">{job.orgName} · {placeLabel(job, lookup, locale)}</p>}
                    <p className="text-sm text-ink-muted">{t('applications.appliedOn', { date: fmt(a.appliedAt) })}{a.matchScore != null ? ` · ${t('match.badge', { score: a.matchScore })}` : ''}</p>
                  </div>
                  <span className={`badge self-start px-3 py-1 text-sm ${ended ? 'border-line bg-ivory text-ink-soft' : 'border-brand-300 bg-brand-50 text-brand-800'}`}>{t(`stages.${a.stage}`)}</span>
                </div>
                {/* Stage timeline: the same stages the school uses in its pipeline. */}
                <ol className="flex gap-1 overflow-x-auto pb-1" aria-label={t('applications.timeline')}>
                  {STAGES.map((s, i) => {
                    const done = !ended && i <= reached;
                    const when = a.history.find(h => h.stage === s)?.at;
                    return (
                      <li key={s} className="min-w-[88px] flex-1" aria-current={a.stage === s ? 'step' : undefined}>
                        <div className={`h-1.5 rounded-full ${done ? 'bg-brand-600' : 'bg-line'}`} />
                        <p className={`mt-1 text-xs ${a.stage === s ? 'font-bold text-brand-900' : done ? 'text-ink' : 'text-ink-muted'}`}>{t(`stages.${s}`)}{done ? <span className="sr-only"> ✓</span> : ''}</p>
                        {when && <p className="text-[11px] text-ink-muted">{fmt(when)}</p>}
                      </li>
                    );
                  })}
                </ol>
                {ended && <p className="text-sm text-ink-soft">{t(`applications.ended_${a.stage}`)}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {job && <span className="text-sm text-ink-muted">{deadlineLabel(job.lastDate, t, locale).text}</span>}
                  {WITHDRAWABLE.includes(a.stage) && <WithdrawButton id={a.id} title={job?.title || ''} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
