'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CalendarCheck, CalendarPlus, MapPin, Video } from 'lucide-react';
import type { InterviewSlot, InterviewStatus } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';
import { istDateTime } from '@/lib/ics';

interface Iv {
  id: string; kind: 'interview' | 'demo'; status: InterviewStatus; jobTitle: string; orgName: string; slot: InterviewSlot | null; openSlots: InterviewSlot[]; canChange: boolean;
  demoTopic?: string | null; demoClass?: string | null; demoVideoUrl?: string | null; message?: string | null;
}

export default function InterviewBooking({ iv }: { iv: Iv }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [choice, setChoice] = useState('');
  const [changing, setChanging] = useState(false);
  const [video, setVideo] = useState(iv.demoVideoUrl || '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const r = await api('/api/candidate/interviews', { id: iv.id, ...body });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
    if (r.ok) { setChanging(false); setChoice(''); router.refresh(); }
  };
  const online = iv.slot && (iv.slot.mode === 'google_meet' || iv.slot.mode === 'teams');
  const choices = iv.openSlots.filter(s => s.id !== iv.slot?.id);
  return (
    <section className="card space-y-3" aria-labelledby={`iv-${iv.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`iv-${iv.id}`} className="text-lg font-bold">{t(`interviews.kind_${iv.kind}`)}: {iv.jobTitle}</h2>
          <p className="text-ink-soft">{iv.orgName}</p>
        </div>
        <span className={`badge ${iv.status === 'booked' ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-marigold-400 bg-marigold-50 text-ink'}`}>{t(`interviews.status_${iv.status}`)}</span>
      </div>
      {iv.message && <p className="whitespace-pre-line rounded-lg bg-ivory p-3 text-sm">{iv.message}</p>}
      {iv.kind === 'demo' && (iv.demoTopic || iv.demoClass) && <p className="text-sm"><span className="font-semibold">{t('interviews.demoTopic')}:</span> {iv.demoTopic || '—'} · <span className="font-semibold">{t('interviews.demoClass')}:</span> {iv.demoClass || '—'}</p>}

      {iv.slot && iv.status === 'booked' && (
        <div className="space-y-1 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <p className="flex items-center gap-2 font-semibold"><CalendarCheck size={18} aria-hidden="true" />{istDateTime(iv.slot.start, locale)} ({iv.slot.durationMin} {t('interviews.min')}, {t('interviews.ist')})</p>
          <p className="flex items-start gap-2 text-sm">{online ? <Video size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <span>{t(`interviews.mode_${iv.slot.mode}`)}: {online ? <a href={iv.slot.location} target="_blank" rel="noopener noreferrer" className="break-all">{iv.slot.location}</a> : iv.slot.location}</span></p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a className="btn-ghost min-h-[40px] py-1 text-sm" href={`/api/interviews/${iv.id}/ics`}><CalendarPlus size={16} aria-hidden="true" />{t('interviews.addToCalendar')}</a>
            {iv.canChange && choices.length > 0 && <button type="button" className="btn-ghost min-h-[40px] py-1 text-sm" aria-expanded={changing} onClick={() => setChanging(v => !v)}>{t('interviews.changeTime')}</button>}
            {iv.canChange && <button type="button" className="min-h-[40px] text-sm font-semibold text-danger-700 underline" disabled={busy} onClick={() => window.confirm(t('interviews.confirmCancel')) && call({ action: 'cancel' }, t('interviews.cancelledMsg'))}>{t('interviews.cancelBooking')}</button>}
          </div>
          {!iv.canChange && <p className="hint">{t('interviews.tooLateHint')}</p>}
        </div>
      )}

      {(iv.status === 'invited' || changing) && (
        choices.length ? (
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (choice) call({ action: 'book', slotId: choice }, t('interviews.bookedMsg')); }}>
            <fieldset>
              <legend className="label">{t('interviews.chooseSlot')} ({t('interviews.ist')})</legend>
              <ul className="grid gap-2 sm:grid-cols-2">{choices.map(s => (
                <li key={s.id}><label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${choice === s.id ? 'border-brand-600 bg-brand-50' : 'border-line'}`}>
                  <input type="radio" name={`slot-${iv.id}`} className="mt-1 h-4 w-4" value={s.id} checked={choice === s.id} onChange={() => setChoice(s.id)} />
                  <span><span className="block font-semibold">{istDateTime(s.start, locale)}</span><span className="text-ink-soft">{s.durationMin} {t('interviews.min')} · {t(`interviews.mode_${s.mode}`)}</span></span>
                </label></li>
              ))}</ul>
            </fieldset>
            <button className="btn-primary" disabled={!choice || busy}>{t('interviews.book')}</button>
          </form>
        ) : iv.status === 'invited' ? <p className="text-sm text-ink-soft">{t('interviews.noSlotsYet')}</p> : null
      )}

      {iv.kind === 'demo' && (
        <form className="space-y-1 border-t border-line pt-3" onSubmit={e => { e.preventDefault(); call({ action: 'video', url: video }, t('common.saved')); }}>
          <label className="block"><span className="label">{t('interviews.demoVideoLink')}</span><input className="input" type="url" placeholder="https://" maxLength={500} value={video} onChange={e => setVideo(e.target.value)} /></label>
          <p className="hint">{t('interviews.demoVideoHint')}</p>
          <button className="btn-ghost min-h-[40px] py-1" disabled={busy}>{t('common.save')}</button>
        </form>
      )}
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
    </section>
  );
}
