'use client';
import Link from 'next/link';
import { useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function ResetForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!token) return <AuthCard title={t('auth.resetTitle')}><p className="alert-error">{t('auth.resetNoToken')}</p></AuthCard>;
  return (
    <AuthCard title={t('auth.resetTitle')}>
      {done ? (
        <><p className="alert-ok" role="status">{t('auth.resetDone')}</p><Link href="/login" className="btn-primary mt-4 w-full">{t('auth.signInButton')}</Link></>
      ) : (
        <form className="space-y-4" onSubmit={async e => {
          e.preventDefault();
          if (pw !== pw2) { setError(t('auth.mismatch')); return; }
          setBusy(true); setError(null);
          const r = await api('/api/auth/reset', { token, password: pw });
          setBusy(false);
          if (r.ok) setDone(true); else setError(r.error && r.error !== 'network' ? r.error : t('common.somethingWrong'));
        }}>
          {error && <p role="alert" className="alert-error">{error}</p>}
          <div>
            <label htmlFor="pw" className="label">{t('auth.newPassword')}</label>
            <input id="pw" type="password" className="input" autoComplete="new-password" required minLength={10} aria-describedby="pw-hint" value={pw} onChange={e => setPw(e.target.value)} />
            <p id="pw-hint" className="hint">{t('auth.passwordHint')}</p>
          </div>
          <div>
            <label htmlFor="pw2" className="label">{t('auth.confirmPassword')}</label>
            <input id="pw2" type="password" className="input" autoComplete="new-password" required value={pw2} onChange={e => setPw2(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{t('auth.resetButton')}</button>
        </form>
      )}
    </AuthCard>
  );
}
