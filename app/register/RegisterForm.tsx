'use client';
import Link from 'next/link';
import { useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import GoogleButton from '@/components/auth/GoogleButton';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

type Role = 'candidate' | 'school_admin';

/** Puts a link where {placeholder} appears in a translated sentence. */
function withLink(text: string, key: string, href: string, label: string) {
  const [a, b = ''] = text.split(`{${key}}`);
  return <>{a}<Link href={href} target="_blank">{label}</Link>{b}</>;
}

export default function RegisterForm({ google, initialRole, next }: { google: boolean; initialRole: Role; next: string | null }) {
  const { t, locale } = useI18n();
  const [role, setRole] = useState<Role>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  // Not pre-ticked: DPDP consent must be a clear, affirmative action.
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await api<{ next?: string }>('/api/auth/register', { role, name, email, password, acceptTerms: terms, acceptPrivacy: privacy, consentMatching: matching, locale, next });
    setBusy(false);
    if (r.ok) { window.location.href = r.next || '/'; return; }
    setError(r.error === 'network' || !r.error ? t('common.somethingWrong') : r.error);
  }

  const roleOption = (value: Role, label: string, hint: string) => (
    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${role === value ? 'border-brand-600 bg-brand-50' : 'border-line'}`}>
      <input type="radio" name="role" className="mt-1 h-5 w-5" checked={role === value} onChange={() => setRole(value)} />
      <span><span className="block font-semibold">{label}</span><span className="block text-sm text-ink-soft">{hint}</span></span>
    </label>
  );

  return (
    <AuthCard title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      {error && <p role="alert" className="alert-error mb-4">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="label">{t('auth.iAm')}</legend>
          {roleOption('candidate', t('auth.roleCandidate'), t('auth.roleCandidateHint'))}
          {roleOption('school_admin', t('auth.roleSchool'), t('auth.roleSchoolHint'))}
        </fieldset>
        <div>
          <label htmlFor="name" className="label">{t('common.name')}</label>
          <input id="name" className="input" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="email" className="label">{t('common.email')}</label>
          <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">{t('common.password')}</label>
          <input id="password" type="password" className="input" autoComplete="new-password" required minLength={10} maxLength={128} aria-describedby="pw-hint" value={password} onChange={e => setPassword(e.target.value)} />
          <p id="pw-hint" className="hint">{t('auth.passwordHint')}</p>
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" required checked={terms} onChange={e => setTerms(e.target.checked)} /><span>{withLink(t('auth.acceptTerms'), 'terms', '/terms', t('footer.terms'))}</span></label>
          <label className="flex gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" required checked={privacy} onChange={e => setPrivacy(e.target.checked)} /><span>{withLink(t('auth.acceptPrivacy'), 'privacy', '/privacy', t('footer.privacy'))}</span></label>
          {role === 'candidate' && <label className="flex gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={matching} onChange={e => setMatching(e.target.checked)} /><span>{t('auth.consentMatching')}</span></label>}
        </div>
        <button className="btn-primary w-full" disabled={busy}>{t('auth.registerButton')}</button>
      </form>
      {google && (
        <>
          <p className="my-4 text-center text-sm text-ink-muted">{t('common.or')}</p>
          <GoogleButton label={t('auth.google')} next={next} role={role} />
          <p className="hint text-center">{t('auth.googleConsent')}</p>
        </>
      )}
      <p className="mt-5 text-center text-sm">{t('auth.haveAccount')} <Link href="/login">{t('auth.signInButton')}</Link></p>
    </AuthCard>
  );
}
