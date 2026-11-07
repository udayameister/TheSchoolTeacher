import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { schoolFormLists } from '@/lib/server/schoolLists';
import SchoolForm from '@/components/school/SchoolForm';

export const metadata = { title: 'Register your school' };

export default async function RegisterSchool({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const user = await requireRole(['school_admin'], '/school/register');
  const { t } = await getT();
  const branch = (await searchParams).branch === '1';
  const d = await withDb(db => ({ lists: schoolFormLists(db), school: currentSchool(db, user) }));
  // One school per account, unless the account manages a group (then each branch is registered here).
  if (d.school && !(branch && user.groupId)) redirect(d.school.verification === 'rejected' ? '/school/profile' : '/school');
  return (
    <div className="container-page max-w-4xl py-6">
      <h1 className="text-2xl font-bold">{branch ? t('school.addBranch') : t('school.registerTitle')}</h1>
      <p className="mb-4 mt-1 text-ink-soft">{t('school.registerIntro')}</p>
      <SchoolForm mode="register" lists={d.lists} identityLocked={false} canCreateGroup={!user.groupId} />
    </div>
  );
}
