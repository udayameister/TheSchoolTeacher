import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { withDb } from '@/lib/server/db';
import { listMaster } from '@/lib/server/masterData';
import { itemName } from '@/lib/i18n/translate';
import { CTET_PATTERN, PRACTICE } from '@/lib/content/tetPractice';
import PracticeQuiz from '@/components/career/PracticeQuiz';

export const metadata: Metadata = {
  title: 'TET preparation corner: CTET and state TETs',
  description: 'CTET and state TET exams with official websites, the CTET paper pattern and free Child Development & Pedagogy practice questions with explanations.',
  alternates: { canonical: '/career/tet' },
};

export default async function TetCornerPage() {
  const { t, locale } = await getT();
  const tets = await withDb(db => {
    const states = new Map(listMaster(db, 'states').map(s => [s.id, s]));
    return listMaster(db, 'tetExams').map(x => ({
      id: x.id, name: itemName(x, locale), state: x.parentId && states.get(x.parentId) ? itemName(states.get(x.parentId)!, locale) : '',
      papers: String(x.meta.papers || ''), validity: String(x.meta.validity || ''), by: String(x.meta.conductedBy || ''), website: String(x.meta.website || ''), central: x.meta.scope === 'central',
    }));
  });
  const L = (x: { en: string; hi: string }) => x[locale];
  return (
    <div className="container-page max-w-4xl space-y-8 py-8">
      <header>
        <h1 className="text-3xl font-bold">{t('career.tetTitle')}</h1>
        <p className="mt-1 text-lg text-ink-soft">{t('career.tetIntro')}</p>
      </header>

      <section aria-labelledby="pat-h" className="card space-y-3">
        <h2 id="pat-h" className="text-xl font-bold">{t('career.ctetPattern')}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>{t('career.patQuestions', { n: CTET_PATTERN.questions, m: CTET_PATTERN.marks })}</li>
          <li>{t('career.patTime', { n: CTET_PATTERN.minutes / 60 })}</li>
          <li>{CTET_PATTERN.negative ? t('career.patNegative') : t('career.patNoNegative')}</li>
          <li>{t('career.patPass', { n: CTET_PATTERN.passPercent })}</li>
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="font-semibold">{t('career.paper1')}</p><ul className="list-disc pl-5 text-sm">{CTET_PATTERN.paper1.map((x, i) => <li key={i}>{L(x)}</li>)}</ul></div>
          <div><p className="font-semibold">{t('career.paper2')}</p><ul className="list-disc pl-5 text-sm">{CTET_PATTERN.paper2.map((x, i) => <li key={i}>{L(x)}</li>)}</ul></div>
        </div>
        <p className="hint">{t('career.patternNote')}</p>
      </section>

      <section aria-labelledby="ex-h" className="space-y-3">
        <h2 id="ex-h" className="text-xl font-bold">{t('career.exams')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">{t('profile.exam')}</th><th className="py-2 pr-3">{t('jobs.state')}</th><th className="py-2 pr-3">{t('career.papers')}</th><th className="py-2">{t('career.officialSite')}</th></tr></thead>
            <tbody>
              {tets.map(x => (
                <tr key={x.id} className="border-b border-line align-top">
                  <td className="py-2 pr-3 font-semibold">{x.name}{x.by && <span className="block text-xs font-normal text-ink-muted">{t('career.conductedBy', { v: x.by })}</span>}{x.validity && <span className="block text-xs font-normal text-ink-muted">{t('career.validity', { v: x.validity })}</span>}</td>
                  <td className="py-2 pr-3">{x.central ? t('career.allIndia') : x.state}</td>
                  <td className="py-2 pr-3">{x.papers.split(',').filter(Boolean).join(' · ')}</td>
                  <td className="py-2">{x.website ? <a href={x.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">{new URL(x.website).hostname}<ExternalLink size={14} aria-hidden="true" /></a> : <span className="text-ink-muted">{t('career.checkStateBoard')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">{t('career.examsNote')}</p>
      </section>

      <section aria-labelledby="pr-h" className="space-y-3">
        <h2 id="pr-h" className="text-xl font-bold">{t('career.practice')}</h2>
        <p className="text-ink-soft">{t('career.practiceIntro')}</p>
        <PracticeQuiz questions={PRACTICE} />
      </section>
    </div>
  );
}
