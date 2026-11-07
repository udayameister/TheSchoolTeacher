'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function ResendSchoolEmail() {
  const { t } = useI18n();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" className="font-semibold text-brand-700 underline" onClick={async () => {
        const r = await api('/api/school/send-email-verification', {});
        setMsg(r.ok ? t('school.emailLinkSent') : r.error ? t(r.error) : t('common.somethingWrong'));
      }}>{t('school.sendEmailLink')}</button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </span>
  );
}
