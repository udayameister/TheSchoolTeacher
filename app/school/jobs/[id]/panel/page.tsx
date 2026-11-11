import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { requireSchoolPerm } from '@/lib/server/schoolPage';
import { withDb } from '@/lib/server/db';
import { canManageSchool } from '@/lib/server/schools';
import { can, panelCandidates } from '@/lib/server/team';
import { dimensions, ranking, RECOMMENDATIONS } from '@/lib/server/panel';
import { nameOf } from '@/lib/jobs/display';
import { lookupOf } from '@/lib/server/catalog';
import PanelEditor from '@/components/school/PanelEditor';

export const metadata = { title: 'Selection panel' };

export default async function PanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSchoolPerm('pipeline', `/school/jobs/${id}/panel`);
  const { t, locale } = await getT();
  const d = await withDb(db => {
    const job = db.jobs.find(j => j.id === id);
    if (!job || job.kind !== 'school' || !canManageSchool(db, user, job.schoolId)) return null;
    const lookup = lookupOf(db);
    return {
      job, team: panelCandidates(db, job.schoolId!), rank: ranking(db, user, job.id),
      dims: dimensions(db).map(x => ({ name: nameOf(lookup, x.id, locale), weight: Number(x.meta.weight) || 0 })),
    };
  });
  if (!d) notFound();
  const totalW = d.dims.reduce((s, x) => s + x.weight, 0) || 1;
  return (
    <div className="container-page max-w-4xl space-y-6 py-6">
      <p className="text-sm"><Link href="/school/jobs" className="inline-flex items-center gap-1"><ArrowLeft size={16} aria-hidden="true" />{t('school.nav_jobs')}</Link></p>
      <div>
        <h1 className="text-2xl font-bold">{t('panel.title')}</h1>
        <p className="text-ink-soft">{d.job.title}</p>
      </div>
      <section className="card space-y-3" aria-labelledby="pm-h">
        <h2 id="pm-h" className="text-lg font-bold">{t('panel.members_title')}</h2>
        <p className="text-sm text-ink-soft">{t('panel.membersIntro')}</p>
        <PanelEditor jobId={d.job.id} team={d.team} initial={d.job.panel || []} />
        <p className="hint">{t('panel.dimensionsNote', { list: d.dims.map(x => `${x.name} ${Math.round((x.weight / totalW) * 100)}%`).join(', ') })}</p>
      </section>
      {can(user, 'scoresAll') && d.rank && (
        <section className="card" aria-labelledby="rank-h">
          <h2 id="rank-h" className="text-lg font-bold">{t('panel.ranking')}</h2>
          <p className="text-sm text-ink-soft">{t('panel.rankingIntro')}</p>
          {d.rank.length ? (
            <div className="relative mt-3 overflow-x-auto">
              <table className="table">
                <thead><tr><th scope="col">#</th><th scope="col">{t('common.name')}</th><th scope="col">{t('panel.average')}</th><th scope="col">{t('panel.scores')}</th><th scope="col">{t('panel.recommendations')}</th><th scope="col">{t('ats.stage')}</th></tr></thead>
                <tbody>{d.rank.map((r, i) => (
                  <tr key={r.applicationId}>
                    <td>{i + 1}</td>
                    <td><Link href={`/school/applicants/${r.applicationId}`} className="font-semibold">{r.candidateName}</Link></td>
                    <td className="font-bold">{r.average}</td>
                    <td>{r.count} / {d.job.panel?.length || 0}</td>
                    <td className="text-xs">{RECOMMENDATIONS.filter(x => r.recommendations[x]).map(x => `${t(`panel.rec_${x}`)}: ${r.recommendations[x]}`).join(' · ')}</td>
                    <td className="whitespace-nowrap">{t(`stages.${r.stage}`)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-ink-soft">{t('panel.noScores')}</p>}
        </section>
      )}
    </div>
  );
}
