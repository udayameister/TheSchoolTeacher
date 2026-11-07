import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { canManageSchool } from '@/lib/server/schools';
import { vacancyFormLists } from '@/lib/server/schoolLists';
import VacancyForm from '@/components/school/VacancyForm';

export const metadata = { title: 'Edit vacancy' };

export default async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(['school_admin', 'school_staff'], `/school/jobs/${id}/edit`);
  const { t } = await getT();
  const d = await withDb(db => {
    const job = db.jobs.find(j => j.id === id);
    if (!job || job.kind !== 'school' || !canManageSchool(db, user, job.schoolId)) return null;
    return { job, school: db.schools.find(s => s.id === job.schoolId)!, lists: vacancyFormLists(db) };
  });
  if (!d) notFound();
  return (
    <div className="container-page max-w-4xl py-6">
      <h1 className="mb-1 text-2xl font-bold">{t('post.editVacancy')}</h1>
      <p className="mb-4 text-ink-soft">{d.school.name}</p>
      <VacancyForm schoolId={d.school.id} job={d.job} lists={d.lists} defaults={{ mediumIds: d.school.mediumIds, lastDate: d.job.lastDate }} verified={d.school.verification === 'verified'} />
    </div>
  );
}
