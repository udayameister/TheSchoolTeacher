'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function OfferResponse({ id, acceptBy }: { id: string; acceptBy: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const answer = async (accept: boolean) => {
    if (!window.confirm(accept ? t('offers.confirmAccept') : t('offers.confirmDecline'))) return;
    setBusy(true);
    const r = await api('/api/candidate/offers', { id, accept, note });
    setBusy(false);
    if (r.ok) router.refresh(); else setError(r.error ? t(r.error) : t('common.somethingWrong'));
  };
  return (
    <div className="space-y-3">
      <p className="text-sm">{t('offers.answerBy', { date: acceptBy })}</p>
      <label className="block"><span className="label">{t('offers.noteToSchool')}</span><textarea className="input min-h-[70px]" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => answer(true)}>{t('offers.accept')}</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => answer(false)}>{t('offers.decline')}</button>
      </div>
      <div aria-live="polite">{error && <p className="alert-error">{error}</p>}</div>
    </div>
  );
}
