import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { DEMO_CHECKLIST, DOCUMENT_CHECKLIST, QUESTION_GROUPS } from '@/lib/content/interviewPrep';
import Checklist from '@/components/career/Checklist';
import LessonPlanner from '@/components/career/LessonPlanner';

export const metadata: Metadata = {
  title: 'Teacher interview and demo-class preparation',
  description: 'Common school-teacher interview questions with tips, a demo-class checklist, a documents checklist and a free 5E lesson-plan maker.',
  alternates: { canonical: '/career/interview' },
};

export default async function InterviewPrepPage() {
  const { t, locale } = await getT();
  const L = (x: { en: string; hi: string }) => x[locale];
  return (
    <div className="container-page max-w-4xl space-y-8 py-8">
      <header className="print:hidden">
        <h1 className="text-3xl font-bold">{t('career.interviewTitle')}</h1>
        <p className="mt-1 text-lg text-ink-soft">{t('career.interviewIntro')}</p>
        <nav aria-label={t('career.onThisPage')} className="mt-3 flex flex-wrap gap-2 text-sm">
          <a href="#questions" className="badge border-brand-300 bg-brand-50 py-1 text-brand-800">{t('career.questions')}</a>
          <a href="#demo" className="badge border-brand-300 bg-brand-50 py-1 text-brand-800">{t('career.demoChecklist')}</a>
          <a href="#documents" className="badge border-brand-300 bg-brand-50 py-1 text-brand-800">{t('career.documents')}</a>
          <a href="#planner" className="badge border-brand-300 bg-brand-50 py-1 text-brand-800">{t('career.planner')}</a>
        </nav>
      </header>

      <section id="questions" aria-labelledby="q-h" className="space-y-4 print:hidden">
        <h2 id="q-h" className="text-2xl font-bold">{t('career.questions')}</h2>
        <p className="text-ink-soft">{t('career.questionsHint')}</p>
        {QUESTION_GROUPS.map(g => (
          <div key={g.id} className="card space-y-2">
            <h3 className="text-lg font-bold">{L(g.title)}</h3>
            {g.questions.map(q => (
              <details key={q.id} className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer font-semibold">{L(q.q)}</summary>
                <p className="mt-2 text-ink-soft"><span className="font-semibold text-ink">{t('career.tip')}:</span> {L(q.tip)}</p>
              </details>
            ))}
          </div>
        ))}
      </section>

      <section id="demo" aria-labelledby="d-h" className="space-y-3 print:hidden">
        <h2 id="d-h" className="text-2xl font-bold">{t('career.demoChecklist')}</h2>
        <Checklist items={DEMO_CHECKLIST.map(i => ({ id: i.id, text: L(i.text) }))} storageKey="tst_demo_checklist" />
      </section>

      <section id="documents" aria-labelledby="k-h" className="space-y-3 print:hidden">
        <h2 id="k-h" className="text-2xl font-bold">{t('career.documents')}</h2>
        <Checklist items={DOCUMENT_CHECKLIST.map(i => ({ id: i.id, text: L(i.text) }))} storageKey="tst_doc_checklist" />
      </section>

      <section id="planner" aria-labelledby="pl-h" className="space-y-3">
        <h2 id="pl-h" className="text-2xl font-bold print:hidden">{t('career.planner')}</h2>
        <p className="text-ink-soft print:hidden">{t('career.plannerIntro')}</p>
        <LessonPlanner />
      </section>
    </div>
  );
}
