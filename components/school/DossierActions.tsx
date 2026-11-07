'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApplicationNote, Stage } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

const PIPELINE: Stage[] = ['applied', 'screening', 'eligible', 'shortlisted', 'interview', 'panel_review', 'offer', 'joined', 'not_selected'];

export function StageControl({ id, stage }: { id: string; stage: Stage }) {
  const { t } = useI18n();
  const router = useRouter();
  const [next, setNext] = useState<Stage | ''>('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (stage === 'withdrawn') return <p className="text-sm text-ink-soft">{t('ats.withdrawnNote')}</p>;
  return (
    <form className="space-y-2" onSubmit={async e => {
      e.preventDefault();
      if (!next) return;
      if (next === 'not_selected' && !window.confirm(t('ats.confirmNotSelected', { n: 1 }))) return;
      const r = await api('/api/school/applications', { action: 'stage', ids: [id], stage: next, note });
      setMsg(r.ok ? { ok: true, text: t('ats.moved', { n: 1, stage: t(`stages.${next}`) }) } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
      if (r.ok) { setNext(''); setNote(''); router.refresh(); }
    }}>
      <label className="block"><span className="label">{t('ats.moveTo')}</span>
        <select className="input" value={next} onChange={e => setNext(e.target.value as Stage)} required><option value="">—</option>{PIPELINE.filter(s => s !== stage).map(s => <option key={s} value={s}>{t(`stages.${s}`)}</option>)}</select></label>
      <label className="block"><span className="label">{t('ats.stageNote')}</span><input className="input" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
      <p className="hint">{t('ats.emailHint')}</p>
      <button className="btn-primary w-full" disabled={!next}>{t('ats.apply')}</button>
      {msg && <p role="status" className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}
    </form>
  );
}

export function Notes({ id, initial }: { id: string; initial: ApplicationNote[] }) {
  const { t, locale } = useI18n();
  const [notes, setNotes] = useState(initial);
  const [text, setText] = useState('');
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return (
    <div className="space-y-3">
      {notes.length ? <ul className="space-y-2">{notes.map(n => <li key={n.id} className="rounded-lg bg-ivory p-2 text-sm"><p className="whitespace-pre-line">{n.text}</p><p className="mt-1 text-xs text-ink-muted">{n.authorName} · {fmt(n.at)}</p></li>)}</ul> : <p className="text-sm text-ink-soft">{t('ats.noNotes')}</p>}
      <form className="space-y-2" onSubmit={async e => {
        e.preventDefault();
        const r = await api<{ note: ApplicationNote }>('/api/school/applications', { action: 'note', id, text });
        if (r.ok) { setNotes(x => [...x, r.note]); setText(''); }
      }}>
        <label className="block"><span className="sr-only">{t('ats.addNote')}</span><textarea className="input min-h-[80px]" maxLength={2000} required placeholder={t('ats.notePlaceholder')} value={text} onChange={e => setText(e.target.value)} /></label>
        <button className="btn-ghost">{t('ats.addNote')}</button>
      </form>
      <p className="hint">{t('ats.notesPrivate')}</p>
    </div>
  );
}
