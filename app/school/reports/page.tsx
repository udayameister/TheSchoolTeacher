import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { requireSchoolPerm } from '@/lib/server/schoolPage';
import { withDb } from '@/lib/server/db';
import { RANGES, schoolReport } from '@/lib/server/reports';

export const metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireSchoolPerm('reports', '/school/reports');
  const [{ t, locale }, q] = await Promise.all([getT(), searchParams]);
  const range = Number(q.range ?? 90);
  const r = await withDb(db => schoolReport(db, user, range));
  if (!r) redirect('/school');
  const max = Math.max(1, r.funnel[0].count);
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
  const tile = (label: string, value: string | number, sub?: string) => <div className="card"><span className="block text-2xl font-bold text-brand-900">{value}</span><span className="text-sm text-ink-soft">{label}</span>{sub && <span className="block text-xs text-ink-muted">{sub}</span>}</div>;
  return (
    <div className="container-page space-y-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-ink-soft">{r.schoolName} · {r.rangeDays ? t('reports.lastDays', { n: r.rangeDays }) : t('reports.allTime')}</p>
        </div>
        <nav aria-label={t('reports.range')} className="flex flex-wrap gap-1 text-sm">
          {RANGES.map(n => <Link key={n} href={`/school/reports?range=${n}`} aria-current={r.rangeDays === n ? 'true' : undefined} className={`rounded-lg px-3 py-1.5 no-underline ${r.rangeDays === n ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50'}`}>{n ? t('reports.days', { n }) : t('reports.allTime')}</Link>)}
        </nav>
      </div>
      <p className="hint">{t('reports.basis')}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tile(t('reports.applications'), r.total, r.withdrawn ? t('reports.withdrawnN', { n: r.withdrawn }) : undefined)}
        {tile(t('reports.hires'), r.timeToHire.hires)}
        {tile(t('reports.medianTimeToHire'), r.timeToHire.median === null ? '—' : t('reports.daysValue', { n: r.timeToHire.median }), r.timeToHire.average === null ? undefined : t('reports.averageValue', { n: r.timeToHire.average }))}
        {tile(t('reports.offerAcceptance'), r.offers.acceptanceRate === null ? '—' : `${r.offers.acceptanceRate}%`, t('reports.offersSummary', { issued: r.offers.issued, accepted: r.offers.accepted, declined: r.offers.declined, pending: r.offers.pending }))}
      </div>

      <section className="card" aria-labelledby="fun-h">
        <h2 id="fun-h" className="text-lg font-bold">{t('reports.funnel')}</h2>
        <p className="text-sm text-ink-soft">{t('reports.funnelHint')}</p>
        <ol className="mt-3 space-y-2">
          {r.funnel.map((f, i) => {
            const pct = Math.round((f.count / max) * 100);
            const prev = i ? r.funnel[i - 1].count : null;
            return (
              <li key={f.stage} className="grid grid-cols-[8rem_1fr_auto] items-center gap-2 text-sm sm:grid-cols-[11rem_1fr_7rem]">
                <span className="font-semibold">{t(`stages.${f.stage}`)}</span>
                <span className="h-5 rounded bg-brand-50" aria-hidden="true"><span className="block h-5 rounded bg-brand-600" style={{ width: `${Math.max(pct, f.count ? 2 : 0)}%` }} /></span>
                <span className="text-right tabular-nums">{f.count}{prev ? <span className="text-xs text-ink-muted"> ({Math.round((f.count / prev) * 100)}%)</span> : null}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-ink-soft">{t('reports.notSelectedN', { n: r.notSelected })} · {t('reports.interviewsSummary', { invited: r.interviews.invited, completed: r.interviews.completed, noShow: r.interviews.noShow })}</p>
      </section>

      <section className="card" aria-labelledby="vac-h">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="vac-h" className="text-lg font-bold">{t('reports.byVacancy')}</h2>
          <div className="flex flex-wrap gap-2">
            <a className="btn-ghost min-h-[40px] py-1 text-sm" href={`/api/school/reports?type=vacancies&range=${r.rangeDays}`}><Download size={16} aria-hidden="true" />{t('reports.csvVacancies')}</a>
            <a className="btn-ghost min-h-[40px] py-1 text-sm" href={`/api/school/reports?type=applications&range=${r.rangeDays}`}><Download size={16} aria-hidden="true" />{t('reports.csvApplications')}</a>
          </div>
        </div>
        {r.vacancies.length ? (
          <div className="relative mt-3 overflow-x-auto">
            <table className="table">
              <thead><tr>
                <th scope="col">{t('jobs.post')}</th><th scope="col">{t('reports.published')}</th><th scope="col">{t('reports.views')}</th><th scope="col">{t('reports.applications')}</th>
                <th scope="col">{t('stages.shortlisted')}</th><th scope="col">{t('stages.interview')}</th><th scope="col">{t('reports.offers')}</th><th scope="col">{t('stages.joined')}</th><th scope="col">{t('reports.avgMatch')}</th><th scope="col">{t('reports.daysToHire')}</th>
              </tr></thead>
              <tbody>{r.vacancies.map(v => (
                <tr key={v.jobId}>
                  <td><span className="font-semibold">{v.title}</span><span className="block text-xs text-ink-muted">{t(`post.status_${v.status}`)}</span></td>
                  <td className="whitespace-nowrap">{fmt(v.publishedAt)}</td><td>{v.views}</td><td>{v.applications}</td><td>{v.shortlisted}</td><td>{v.interviewed}</td>
                  <td>{v.offers}{v.accepted ? <span className="text-xs text-ink-muted"> ({t('reports.acceptedN', { n: v.accepted })})</span> : null}</td><td>{v.joined}</td>
                  <td>{v.avgMatch === null ? '—' : `${v.avgMatch}%`}</td><td>{v.daysToFirstHire ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="mt-2 text-ink-soft">{t('reports.noVacancies')}</p>}
        <p className="hint mt-2">{t('reports.csvHint')}</p>
      </section>
    </div>
  );
}
