import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireSchoolPerm } from '@/lib/server/schoolPage';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { vacancyFormLists } from '@/lib/server/schoolLists';
import VacancyForm from '@/components/school/VacancyForm';

export const metadata = { title: 'Post a vacancy' };

export default async function NewJob() {
  const user = await requireSchoolPerm('jobs', '/school/jobs/new');
  const { t } = await getT();
  const d = await withDb(db => ({ school: currentSchool(db, user), lists: vacancyFormLists(db) }));
  if (!d.school) redirect('/school');
  const lastDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return (
    <div className="container-page max-w-4xl py-6">
      <h1 className="mb-1 text-2xl font-bold">{t('post.newVacancy')}</h1>
      <p className="mb-4 text-ink-soft">{d.school.name}</p>
      <VacancyForm schoolId={d.school.id} lists={d.lists} defaults={{ mediumIds: d.school.mediumIds, lastDate }} verified={d.school.verification === 'verified'} />
    </div>
  );
}
