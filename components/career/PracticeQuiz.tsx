'use client';
import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import type { PracticeQuestion } from '@/lib/content/tetPractice';

/** One question at a time, instant feedback with the reason, score at the end. Nothing is stored. */
export default function PracticeQuiz({ questions }: { questions: PracticeQuestion[] }) {
  const { t, locale } = useI18n();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = i >= questions.length;
  if (done) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-4xl font-bold text-brand-700">{score} / {questions.length}</p>
        <p>{t(score / questions.length >= 0.6 ? 'career.quizGood' : 'career.quizKeepGoing')}</p>
        <button type="button" className="btn-primary" onClick={() => { setI(0); setPicked(null); setScore(0); }}>{t('career.quizAgain')}</button>
      </div>
    );
  }
  const q = questions[i];
  return (
    <div className="card space-y-3">
      <p className="text-sm text-ink-muted">{t('career.quizProgress', { n: i + 1, total: questions.length })} · {q.topic[locale]}</p>
      <fieldset>
        <legend className="text-lg font-semibold">{q.q[locale]}</legend>
        <ul className="mt-3 space-y-2">
          {q.options.map((o, k) => {
            const state = picked === null ? '' : k === q.answer ? 'border-success-600 bg-success-50' : k === picked ? 'border-danger-600 bg-danger-50' : 'opacity-70';
            return (
              <li key={k}>
                <button type="button" disabled={picked !== null} aria-pressed={picked === k} onClick={() => { setPicked(k); if (k === q.answer) setScore(s => s + 1); }}
                  className={`flex min-h-[48px] w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-left ${state}`}>
                  {picked !== null && k === q.answer && <CheckCircle2 size={18} className="shrink-0 text-success-600" aria-hidden="true" />}
                  {picked === k && k !== q.answer && <XCircle size={18} className="shrink-0 text-danger-600" aria-hidden="true" />}
                  {o[locale]}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div aria-live="polite">
        {picked !== null && (
          <div className="space-y-3">
            <p><span className={`font-semibold ${picked === q.answer ? 'text-success-700' : 'text-danger-700'}`}>{picked === q.answer ? t('career.correct') : t('career.notQuite')}</span> {q.why[locale]}</p>
            <button type="button" className="btn-primary" onClick={() => { setI(n => n + 1); setPicked(null); }}>{i + 1 < questions.length ? t('career.next') : t('career.seeScore')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
