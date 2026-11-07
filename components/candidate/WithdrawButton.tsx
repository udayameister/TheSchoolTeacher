'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function WithdrawButton({ id, title }: { id: string; title: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" className="btn-ghost text-danger-700" onClick={async () => {
        if (!window.confirm(t('applications.confirmWithdraw', { title }))) return;
        const r = await api('/api/candidate/applications', { action: 'withdraw', id });
        if (r.ok) router.refresh(); else setErr(r.error ? t(r.error) : t('common.somethingWrong'));
      }}>{t('applications.withdraw')}</button>
      {err && <p role="alert" className="alert-error mt-2">{err}</p>}
    </div>
  );
}
