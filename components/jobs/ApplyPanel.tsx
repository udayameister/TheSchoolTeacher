'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, FileText, ListPlus } from 'lucide-react';
import type { ScreeningQuestion } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

interface Props {
  jobId: string;
  applyMode: 'platform' | 'external';
  externalUrl?: string | null;
  notificationPdfUrl?: string | null;
  questions: ScreeningQuestion[];
  closed: boolean;
  viewer: 'guest' | 'candidate' | 'other';
  existingStage?: string | null;
  tracked: boolean;
}

export default function ApplyPanel(p: Props) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [stage, setStage] = useState(p.existingStage || null);
  const [tracked, setTracked] = useState(p.tracked);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = `/jobs/${p.jobId}`;

  const track = async () => {
    if (p.viewer !== 'candidate') { window.location.href = `/login?next=${encodeURIComponent(next)}`; return; }
    const r = await api('/api/candidate/tracker', { jobId: p.jobId });
    if (r.ok) setTracked(true); else setError(r.error ? t(r.error) : t('common.somethingWrong'));
  };
  const trackButton = tracked
    ? <Link href="/candidate/tracker" className="btn-ghost w-full">{t('tracker.onTracker')}</Link>
    : <button type="button" className="btn-ghost w-full" onClick={track}><ListPlus size={18} aria-hidden="true" />{t('tracker.trackIt')}</button>;

  if (p.applyMode === 'external') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">{t('apply.externalNote')}</p>
        {p.externalUrl && <a href={p.externalUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-primary w-full"><ExternalLink size={18} aria-hidden="true" />{t('apply.officialSite')}<span className="sr-only"> ({t('apply.newTab')})</span></a>}
        {p.notificationPdfUrl && <a href={p.notificationPdfUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-ghost w-full"><FileText size={18} aria-hidden="true" />{t('apply.notificationPdf')}</a>}
        {!p.closed && trackButton}
        {error && <p role="alert" className="alert-error">{error}</p>}
      </div>
    );
  }

  if (stage) return (
    <div className="space-y-3">
      <p className="alert-ok" role="status">{t('apply.alreadyApplied', { stage: t(`stages.${stage}`) })}</p>
      <Link href="/candidate/applications" className="btn-ghost w-full">{t('apply.viewApplications')}</Link>
    </div>
  );
  if (p.closed) return <p className="alert-error">{t('apply.errClosed')}</p>;
  if (p.viewer === 'guest') return (
    <div className="space-y-2">
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-primary w-full">{t('apply.signInToApply')}</Link>
      <Link href={`/register?next=${encodeURIComponent(next)}`} className="btn-ghost w-full">{t('nav.register')}</Link>
    </div>
  );
  if (p.viewer === 'other') return <p className="text-sm text-ink-soft">{t('apply.candidatesOnly')}</p>;

  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(null);
      const r = await api<{ applicationId?: string }>('/api/candidate/apply', { jobId: p.jobId, answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })) });
      setBusy(false);
      if (r.ok) { setStage('applied'); setTracked(true); return; }
      setError(r.error && r.error !== 'network' ? t(r.error) : t('common.somethingWrong'));
    }}>
      {p.questions.length > 0 && <h3 className="font-bold">{t('apply.questions')}</h3>}
      {p.questions.map(q => {
        const id = `q-${q.id}`;
        const set = (v: string) => setAnswers(a => ({ ...a, [q.id]: v }));
        return q.type === 'yesno' ? (
          <fieldset key={q.id}>
            <legend className="label">{q.text}{q.required && <span aria-hidden="true"> *</span>}</legend>
            <div className="flex gap-4">
              {['yes', 'no'].map(v => <label key={v} className="flex min-h-[40px] items-center gap-2"><input type="radio" name={id} value={v} required={q.required} className="h-5 w-5" onChange={() => set(v)} />{t(`common.${v}`)}</label>)}
            </div>
          </fieldset>
        ) : (
          <div key={q.id}>
            <label htmlFor={id} className="label">{q.text}{q.required && <span aria-hidden="true"> *</span>}</label>
            {q.type === 'number'
              ? <input id={id} type="number" inputMode="decimal" className="input" required={q.required} onChange={e => set(e.target.value)} />
              : <textarea id={id} className="input min-h-[80px]" maxLength={1000} required={q.required} onChange={e => set(e.target.value)} />}
          </div>
        );
      })}
      {error && <p role="alert" className="alert-error">{error}{error === t('profile.needPhone') || error === t('profile.needQualification') ? <> <Link href="/candidate/profile">{t('profile.complete')}</Link></> : null}</p>}
      <button className="btn-primary w-full" disabled={busy}>{t('apply.applyNow')}</button>
      <p className="hint">{t('apply.shareNote')}</p>
      {trackButton}
    </form>
  );
}
