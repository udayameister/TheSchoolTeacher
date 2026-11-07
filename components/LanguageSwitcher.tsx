'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/config';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-1 text-sm">
      <span className="sr-only">{t('common.language')}</span>
      <select
        className="min-h-[40px] rounded-lg border border-line bg-paper px-2 text-sm"
        value={locale}
        disabled={pending}
        onChange={e => {
          const next = e.target.value as Locale;
          start(async () => { await api('/api/lang', { locale: next }); router.refresh(); });
        }}
      >
        {LOCALES.map(l => <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </label>
  );
}
