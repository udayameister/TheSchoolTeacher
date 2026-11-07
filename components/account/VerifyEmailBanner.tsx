import { getT } from '@/lib/i18n/server';
import type { UserAccount } from '@/types';
import ResendVerification from './ResendVerification';

export default async function VerifyEmailBanner({ user }: { user: UserAccount }) {
  if (user.emailVerified) return null;
  const { t } = await getT();
  return (
    <div className="border-b border-marigold-300 bg-marigold-50">
      <div className="container-page flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>{t('console.verifyEmailBanner', { email: user.email })}</p>
        <ResendVerification />
      </div>
    </div>
  );
}
