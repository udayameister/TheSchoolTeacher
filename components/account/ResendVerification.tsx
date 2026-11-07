'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function ResendVerification() {
  const { t } = useI18n();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className="btn-ghost" disabled={busy} onClick={async () => {
        setBusy(true);
        const r = await api<{ delivered?: boolean; logged?: boolean }>('/api/auth/resend-verification', {});
        setBusy(false);
        setMsg(r.ok ? (r.logged ? t('account.verificationLogged') : t('account.verificationSent')) : r.error || t('common.somethingWrong'));
      }}>{t('account.resendVerification')}</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
