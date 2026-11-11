import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireSchoolPerm } from '@/lib/server/schoolPage';
import { withDb } from '@/lib/server/db';
import { listTeam } from '@/lib/server/team';
import TeamManager from '@/components/school/TeamManager';
import { STAFF_ROLES } from '@/types';

export const metadata = { title: 'Team' };

export default async function TeamPage() {
  const user = await requireSchoolPerm('team', '/school/team');
  const { t } = await getT();
  const d = await withDb(db => listTeam(db, user));
  if (!d) redirect('/school');
  return (
    <div className="container-page max-w-4xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('team.title')}</h1>
        <p className="text-ink-soft">{t('team.intro')}</p>
      </div>
      <section className="card" aria-labelledby="roles-h">
        <h2 id="roles-h" className="text-lg font-bold">{t('team.rolesTitle')}</h2>
        <dl className="mt-2 space-y-2 text-sm">
          <div><dt className="inline font-semibold">{t('team.role_school_admin')}: </dt><dd className="inline">{t('team.roleHint_school_admin')}</dd></div>
          {STAFF_ROLES.map(r => <div key={r}><dt className="inline font-semibold">{t(`team.role_${r}`)}: </dt><dd className="inline">{t(`team.roleHint_${r}`)}</dd></div>)}
        </dl>
      </section>
      <TeamManager members={d.members} invites={d.invites} />
    </div>
  );
}
