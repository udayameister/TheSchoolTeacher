import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { ROLES } from '@/types';
import { ChangePassword, SignOutOthers } from '@/components/account/AccountForms';
import ResendVerification from '@/components/account/ResendVerification';
import { EmailPreferences, PrivacyTools } from '@/components/account/PrivacyTools';

export const metadata = { title: 'My account', robots: { index: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ change?: string }> }) {
  const [user, { t }, q] = await Promise.all([requireRole(ROLES, '/account'), getT(), searchParams]);
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-1 py-2 sm:grid-cols-3"><dt className="font-semibold">{label}</dt><dd className="sm:col-span-2">{value}</dd></div>
  );
  return (
    <div className="container-page max-w-3xl space-y-6 py-8">
      <h1 className="text-2xl font-bold">{t('account.title')}</h1>
      {(user.mustChangePassword || q.change) && <p className="alert-error" role="alert">{t('account.mustChange')}</p>}
      <section className="card">
        <h2 className="text-lg font-bold">{t('account.details')}</h2>
        <dl className="mt-2 divide-y divide-line">
          {row(t('common.name'), user.name)}
          {row(t('common.email'), user.email)}
          {row(t('account.role'), t(`account.role_${user.role}`))}
          {row(t('account.emailStatus'), user.emailVerified ? <span className="badge border-success-600/30 bg-success-50 text-success-700">{t('account.verified')}</span> : <div className="space-y-2"><span className="badge border-marigold-400 bg-marigold-50 text-marigold-800">{t('account.notVerified')}</span><ResendVerification /></div>)}
        </dl>
      </section>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">{user.passwordHash ? t('account.changePassword') : t('account.setPassword')}</h2>
        <ChangePassword hasPassword={!!user.passwordHash} email={user.email} />
      </section>
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">{t('account.security')}</h2>
        <SignOutOthers />
      </section>
      <section className="card scroll-mt-4" id="email">
        <h2 className="mb-3 text-lg font-bold">{t('privacy.emailTitle')}</h2>
        <EmailPreferences unsubscribed={user.unsubscribed || []} candidate={user.role === 'candidate'} />
      </section>
      {user.role !== 'platform_admin' && (
        <section className="card scroll-mt-4" id="privacy">
          <h2 className="mb-3 text-lg font-bold">{t('account.privacy')}</h2>
          <PrivacyTools matching={user.consents.some(c => c.purpose === 'matching' && !c.withdrawnAt)} hasPassword={!!user.passwordHash} candidate={user.role === 'candidate'} />
        </section>
      )}
    </div>
  );
}
