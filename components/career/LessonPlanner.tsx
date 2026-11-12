'use client';
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { PLAN_PHASES } from '@/lib/content/interviewPrep';

/** 5E lesson / demo-class plan maker. Everything stays in the browser; "Print" gives a one-page plan. */
export default function LessonPlanner() {
  const { t, locale } = useI18n();
  const [f, setF] = useState({ teacher: '', subject: '', cls: '', topic: '', minutes: 35, outcomes: '', materials: '' });
  const [acts, setActs] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string | number) => setF(p => ({ ...p, [k]: v }));
  const mins = Math.max(10, Math.min(120, Number(f.minutes) || 35));
  // Whole minutes per phase that add up to the lesson length.
  const raw = PLAN_PHASES.map(p => p.share * mins);
  const times = raw.map(Math.floor);
  let rest = mins - times.reduce((a, b) => a + b, 0);
  raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { times[i]++; rest--; } });
  let clock = 0;
  const field = (id: string, label: string, input: React.ReactNode) => <div><label htmlFor={id} className="label">{label}</label>{input}</div>;

  return (
    <div className="space-y-4">
      <form className="card grid gap-4 sm:grid-cols-2 print:hidden" onSubmit={e => e.preventDefault()}>
        {field('lp-subject', t('career.lpSubject'), <input id="lp-subject" className="input" maxLength={80} value={f.subject} onChange={e => set('subject', e.target.value)} />)}
        {field('lp-class', t('career.lpClass'), <input id="lp-class" className="input" maxLength={40} placeholder={t('career.lpClassPlaceholder')} value={f.cls} onChange={e => set('cls', e.target.value)} />)}
        <div className="sm:col-span-2">{field('lp-topic', t('career.lpTopic'), <input id="lp-topic" className="input" maxLength={160} value={f.topic} onChange={e => set('topic', e.target.value)} />)}</div>
        {field('lp-min', t('career.lpMinutes'), <input id="lp-min" className="input" type="number" min={10} max={120} value={f.minutes} onChange={e => set('minutes', e.target.value)} />)}
        {field('lp-teacher', t('career.lpTeacher'), <input id="lp-teacher" className="input" maxLength={80} value={f.teacher} onChange={e => set('teacher', e.target.value)} />)}
        <div className="sm:col-span-2">{field('lp-out', t('career.lpOutcomes'), <textarea id="lp-out" className="input min-h-[80px]" maxLength={800} placeholder={t('career.lpOutcomesPlaceholder')} value={f.outcomes} onChange={e => set('outcomes', e.target.value)} />)}</div>
        <div className="sm:col-span-2">{field('lp-mat', t('career.lpMaterials'), <input id="lp-mat" className="input" maxLength={300} placeholder={t('career.lpMaterialsPlaceholder')} value={f.materials} onChange={e => set('materials', e.target.value)} />)}</div>
        {PLAN_PHASES.map((p, i) => (
          <div key={p.id} className="sm:col-span-2">
            {field(`lp-${p.id}`, `${p.name[locale]} · ${t('career.lpMin', { n: times[i] })}`, <textarea id={`lp-${p.id}`} className="input min-h-[70px]" maxLength={800} placeholder={p.prompt[locale]} value={acts[p.id] || ''} onChange={e => setActs(a => ({ ...a, [p.id]: e.target.value }))} />)}
          </div>
        ))}
        <button type="button" className="btn-primary sm:col-span-2 sm:justify-self-start" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />{t('career.lpPrint')}</button>
      </form>

      <article className="card space-y-3 print:border-0 print:p-0 print:shadow-none" aria-label={t('career.lpPreview')}>
        <h3 className="text-xl font-bold">{t('career.lpHeading')}{f.topic ? `: ${f.topic}` : ''}</h3>
        <p className="text-sm">{[f.subject && `${t('career.lpSubject')}: ${f.subject}`, f.cls && `${t('career.lpClass')}: ${f.cls}`, `${t('career.lpMinutes')}: ${mins}`, f.teacher && `${t('career.lpTeacher')}: ${f.teacher}`].filter(Boolean).join('  ·  ')}</p>
        {f.outcomes && <div><p className="font-semibold">{t('career.lpOutcomes')}</p><ul className="list-disc pl-5">{f.outcomes.split('\n').filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
        {f.materials && <p><span className="font-semibold">{t('career.lpMaterials')}:</span> {f.materials}</p>}
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b border-line text-left"><th className="py-1 pr-2">{t('career.lpTime')}</th><th className="py-1 pr-2">{t('career.lpPhase')}</th><th className="py-1">{t('career.lpActivity')}</th></tr></thead>
          <tbody>
            {PLAN_PHASES.map((p, i) => { const start = clock; clock += times[i]; return (
              <tr key={p.id} className="border-b border-line align-top"><td className="whitespace-nowrap py-2 pr-2">{start}–{clock} {t('career.lpMinShort')}</td><td className="py-2 pr-2 font-semibold">{p.name[locale]}</td><td className="whitespace-pre-line py-2">{acts[p.id] || <span className="text-ink-muted">{p.prompt[locale]}</span>}</td></tr>
            ); })}
          </tbody>
        </table>
      </article>
    </div>
  );
}
