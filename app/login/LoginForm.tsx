'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import GoogleButton from '@/components/auth/GoogleButton';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

type Mode = 'password' | 'code';
interface Challenge { id: string; purpose: 'login' | 'admin-mfa'; resendIn: number }

export default function LoginForm({ google, next, oauthError }: { google: boolean; next: string | null; oauthError: string | null }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(oauthError ? t(`auth.oauth_${oauthError}`) : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const done = (r: { next?: string }) => { window.location.href = r.next || '/'; };
  const err = (r: { error?: string }) => setError(r.error === 'network' || !r.error ? t('common.somethingWrong') : r.error);

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await api<{ next?: string; mfa?: { challengeId: string; resendIn: number } }>('/api/auth/login', { email, password, remember, next });
    setBusy(false);
    if (r.mfa) { setChallenge({ id: r.mfa.challengeId, purpose: 'admin-mfa', resendIn: r.mfa.resendIn }); setWait(r.mfa.resendIn); return; }
    if (r.ok) return done(r);
    err(r);
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true); setError(null);
    const r = await api<{ challengeId?: string; resendIn?: number }>('/api/auth/otp/request', { email, remember, next });
    setBusy(false);
    if (r.ok && r.challengeId) { setChallenge({ id: r.challengeId, purpose: 'login', resendIn: r.resendIn || 60 }); setWait(r.resendIn || 60); setCode(''); return; }
    err(r);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); if (!challenge) return; setBusy(true); setError(null);
    const r = await api<{ next?: string }>('/api/auth/otp/verify', { challengeId: challenge.id, code, purpose: challenge.purpose });
    setBusy(false);
    if (r.ok) return done(r);
    err(r);
  }

  const tab = (m: Mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setChallenge(null); setError(null); }}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === m ? 'bg-paper text-brand-800 shadow-card' : 'text-ink-soft'}`}>{label}</button>
  );

  return (
    <AuthCard title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
      {error && <p role="alert" className="alert-error mb-4">{error}</p>}
      {challenge ? (
        <form onSubmit={verify} className="space-y-4">
          <p className="alert-ok" role="status">{challenge.purpose === 'admin-mfa' ? t('auth.adminCodeSent') : t('auth.codeSent', { email })}</p>
          <div>
            <label htmlFor="code" className="label">{t('auth.codeLabel')}</label>
            <input id="code" className="input text-center text-xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </div>
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{t('auth.verifyCode')}</button>
          {challenge.purpose === 'login' && (wait > 0
            ? <p className="hint" aria-live="polite">{t('auth.resendIn', { s: wait })}</p>
            : <button type="button" className="btn-ghost w-full" onClick={() => sendCode()} disabled={busy}>{t('auth.resend')}</button>)}
          <button type="button" className="text-sm font-semibold text-brand-700 underline" onClick={() => setChallenge(null)}>{t('common.back')}</button>
        </form>
      ) : (
        <>
          <div role="tablist" className="mb-4 flex gap-1 rounded-lg bg-brand-50 p-1">{tab('password', t('auth.withPassword'))}{tab('code', t('auth.withCode'))}</div>
          <form onSubmit={mode === 'password' ? signIn : sendCode} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">{t('common.email')}</label>
              <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {mode === 'password' && (
              <div>
                <label htmlFor="password" className="label">{t('common.password')}</label>
                <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
                <p className="mt-1 text-right text-sm"><Link href="/forgot-password">{t('auth.forgot')}</Link></p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={remember} onChange={e => setRemember(e.target.checked)} />{t('auth.remember')}</label>
            <button className="btn-primary w-full" disabled={busy}>{mode === 'password' ? t('auth.signInButton') : t('auth.sendCode')}</button>
          </form>
          {google && (<><p className="my-4 text-center text-sm text-ink-muted">{t('common.or')}</p><GoogleButton label={t('auth.google')} next={next} /></>)}
          <p className="mt-5 text-center text-sm">{t('auth.noAccount')} <Link href="/register">{t('auth.createOne')}</Link></p>
        </>
      )}
    </AuthCard>
  );
}
