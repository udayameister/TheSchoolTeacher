import { requireRole } from '@/lib/server/http';
import VerifyEmailBanner from '@/components/account/VerifyEmailBanner';

export const metadata = { robots: { index: false } };

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['school_admin', 'school_staff'], '/school');
  return <><VerifyEmailBanner user={user} />{children}</>;
}
