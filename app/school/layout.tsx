import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { managedSchools } from '@/lib/server/schools';
import VerifyEmailBanner from '@/components/account/VerifyEmailBanner';
import SchoolNav from '@/components/school/SchoolNav';

export const metadata = { robots: { index: false } };

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['school_admin', 'school_staff'], '/school');
  const schools = await withDb(db => managedSchools(db, user).map(s => ({ id: s.id, name: s.name })));
  return (
    <>
      <SchoolNav schools={schools} currentId={user.schoolId ?? null} canAddBranch={user.role === 'school_admin' && !!user.groupId} />
      <VerifyEmailBanner user={user} />
      {children}
    </>
  );
}
