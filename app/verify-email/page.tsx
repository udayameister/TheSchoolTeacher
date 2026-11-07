import Link from 'next/link';
import AuthCard from '@/components/auth/AuthCard';
import { getT } from '@/lib/i18n/server';
import { currentUser } from '@/lib/server/http';
import { homeFor } from '@/lib/server/auth';

export const metadata = { title: 'Email confirmation', robots: { index: false } };

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ t }, user, q] = await Promise.all([getT(), currentUser(), searchParams]);
  const status = q.status === 'ok' ? 'ok' : q.status === 'busy' ? 'busy' : 'invalid';
  return (
    <AuthCard title={status === 'ok' ? t('account.verified') : t('account.emailStatus')}>
      <p className={status === 'ok' ? 'alert-ok' : 'alert-error'} role="status">{t(status === 'ok' ? 'auth.verifyOk' : status === 'busy' ? 'auth.verifyBusy' : 'auth.verifyInvalid')}</p>
      <Link href={user ? homeFor(user.role) : '/login'} className="btn-primary mt-4 w-full">{user ? t('nav.myConsole') : t('auth.signInButton')}</Link>
    </AuthCard>
  );
}
