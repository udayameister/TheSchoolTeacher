'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export function ChangePassword({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      if (next !== next2) { setMsg({ ok: false, text: t('auth.mismatch') }); return; }
      setBusy(true);
      const r = await api('/api/account/password', { current, next });
      setBusy(false);
      if (r.ok) { setMsg({ ok: true, text: t('account.passwordChanged') }); setCurrent(''); setNext(''); setNext2(''); }
      else setMsg({ ok: false, text: r.error && r.error !== 'network' ? r.error : t('common.somethingWrong') });
    }}>
      {/* Hidden username field helps password managers save the right account. */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      {hasPassword && (
        <div><label htmlFor="cur" className="label">{t('account.currentPassword')}</label>
          <input id="cur" type="password" className="input" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></div>
      )}
      <div><label htmlFor="np" className="label">{t('auth.newPassword')}</label>
        <input id="np" type="password" className="input" autoComplete="new-password" required minLength={10} aria-describedby="np-hint" value={next} onChange={e => setNext(e.target.value)} />
        <p id="np-hint" className="hint">{t('auth.passwordHint')}</p></div>
      <div><label htmlFor="np2" className="label">{t('auth.confirmPassword')}</label>
        <input id="np2" type="password" className="input" autoComplete="new-password" required value={next2} onChange={e => setNext2(e.target.value)} /></div>
      {msg && <p role="status" className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy}>{hasPassword ? t('account.changePassword') : t('account.setPassword')}</button>
    </form>
  );
}

export function SignOutOthers() {
  const { t } = useI18n();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button type="button" className="btn-ghost" onClick={async () => {
        const r = await api<{ signedOut?: number }>('/api/account/sessions', {});
        setMsg(r.ok ? t('account.signedOutOthers', { n: r.signedOut ?? 0 }) : t('common.somethingWrong'));
      }}>{t('account.signOutOthers')}</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
