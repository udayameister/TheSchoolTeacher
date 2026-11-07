import { requireRole } from '@/lib/server/http';
import VerifyEmailBanner from '@/components/account/VerifyEmailBanner';
import CandidateNav from '@/components/candidate/CandidateNav';

export const metadata = { robots: { index: false } };

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['candidate'], '/candidate');
  return <><CandidateNav /><VerifyEmailBanner user={user} />{children}</>;
}
