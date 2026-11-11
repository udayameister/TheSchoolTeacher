'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function JoinForm({ token, email, name: initialName, existing }: { token: string; email: string; name: string; existing: boolean }) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      setBusy(true); setError(null);
      const r = await api<{ next: string }>('/api/join', existing ? { token } : { token, name, password });
      setBusy(false);
      if (r.ok) window.location.assign(r.next || '/school'); else setError(r.error ? t(r.error) : t('common.somethingWrong'));
    }}>
      <p className="text-sm text-ink-soft">{t('common.email')}: <span className="font-semibold text-ink">{email}</span></p>
      {!existing && <>
        <label className="block"><span className="label">{t('common.name')}</span><input className="input" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="block"><span className="label">{t('team.choosePassword')}</span><input className="input" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
          <span className="hint">{t('team.passwordHint')}</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5" required checked={agree} onChange={e => setAgree(e.target.checked)} />
          <span>{t('team.agree')} <Link href="/terms" target="_blank">{t('footer.terms')}</Link> · <Link href="/privacy" target="_blank">{t('footer.privacy')}</Link></span></label>
      </>}
      <button className="btn-primary w-full" disabled={busy}>{t('team.joinButton')}</button>
      <div aria-live="polite">{error && <p className="alert-error">{error}</p>}</div>
    </form>
  );
}
