import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { withDb } from '@/lib/server/db';
import { listMaster } from '@/lib/server/masterData';
import { itemName } from '@/lib/i18n/translate';
import { inr, nameOf } from '@/lib/jobs/display';
import { MIN_SAMPLE, salaryInsights } from '@/lib/server/careerInsights';
import PayEstimator from '@/components/career/PayEstimator';

export const metadata: Metadata = {
  title: 'Teacher salary insights in India',
  description: 'What schools offer PRT, TGT, PGT and other teachers, from vacancies published on TheSchoolTeacher.in, plus 7th CPC pay levels and a take-home pay estimator.',
  alternates: { canonical: '/career/salary' },
};

export default async function SalaryPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const q = await searchParams;
  const { t, locale } = await getT();
  const d = await withDb(db => {
    const states = listMaster(db, 'states');
    const stateId = states.some(s => s.id === q.state) ? q.state! : null;
    return { states: states.map(s => ({ id: s.id, name: itemName(s, locale) })), stateId, ...salaryInsights(db, { stateId }) };
  });
  const sectorLabel = (s: string) => t(`career.sector_${s}`);
  return (
    <div className="container-page max-w-5xl space-y-8 py-8">
      <header>
        <h1 className="text-3xl font-bold">{t('career.salaryTitle')}</h1>
        <p className="mt-1 text-lg text-ink-soft">{t('career.salaryIntro')}</p>
      </header>

      <section aria-labelledby="mk-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="mk-h" className="text-xl font-bold">{t('career.marketTitle')}</h2>
          <form method="get" className="flex items-end gap-2">
            <div><label htmlFor="sal-state" className="label">{t('jobs.state')}</label>
              <select id="sal-state" name="state" className="input" defaultValue={d.stateId || ''}><option value="">{t('career.allIndia')}</option>{d.states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <button className="btn-ghost">{t('career.show')}</button>
          </form>
        </div>
        {d.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">{t('jobs.post')}</th><th className="py-2 pr-3">{t('career.sector')}</th><th className="py-2 pr-3 text-right">{t('career.typicalRange')}</th><th className="py-2 pr-3 text-right">{t('career.median')}</th><th className="py-2 text-right">{t('career.vacancies')}</th></tr></thead>
              <tbody>
                {d.rows.map(r => (
                  <tr key={`${r.postId}-${r.sector}`} className={`border-b border-line ${r.sector === 'all' ? 'font-semibold' : ''}`}>
                    <td className="py-2 pr-3">{r.sector === 'all' ? nameOf(d.lookup, r.postId, locale) : ''}</td>
                    <td className="py-2 pr-3">{sectorLabel(r.sector)}</td>
                    <td className="py-2 pr-3 text-right">{inr(r.low)} – {inr(r.high)}</td>
                    <td className="py-2 pr-3 text-right">{inr(r.median)}</td>
                    <td className="py-2 text-right">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="card text-ink-soft">{t('career.notEnoughData', { n: MIN_SAMPLE })} <Link href="/jobs">{t('nav.jobs')}</Link></p>}
        <p className="hint">{t('career.marketNote', { n: MIN_SAMPLE })}</p>
      </section>

      <section aria-labelledby="pl-h" className="space-y-3">
        <h2 id="pl-h" className="text-xl font-bold">{t('career.payLevelsTitle')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">{t('career.payLevel')}</th><th className="py-2 pr-3 text-right">{t('career.entryPay')}</th><th className="py-2">{t('career.typicalPosts')}</th></tr></thead>
            <tbody>{d.payLevels.map(p => <tr key={p.id} className="border-b border-line"><td className="py-2 pr-3">{itemName(p, locale)}</td><td className="py-2 pr-3 text-right">{inr(p.entryPay)}</td><td className="py-2">{p.postNames.map(x => itemName(x, locale)).join(', ')}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="hint">{t('career.payLevelsNote')}</p>
      </section>

      <section aria-labelledby="est-h" className="space-y-3">
        <h2 id="est-h" className="text-xl font-bold">{t('career.estimatorTitle')}</h2>
        <PayEstimator levels={d.payLevels.map(p => ({ id: p.id, label: `${itemName(p, locale)} (${inr(p.entryPay)})`, basic: p.entryPay }))} start={d.payLevels.find(p => p.posts.length)?.id} />
      </section>
    </div>
  );
}
