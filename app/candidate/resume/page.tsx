import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { buildResume } from '@/lib/server/resume';
import { completeness, emptyProfile } from '@/lib/server/profile';
import ResumeBuilder from '@/components/candidate/ResumeBuilder';

export const metadata = { title: 'Resume builder', robots: { index: false } };

export default async function ResumePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const q = await searchParams;
  const user = await requireRole(['candidate'], '/candidate/resume');
  const { t, locale } = await getT();
  const lang = q.lang === 'hi' || q.lang === 'en' ? q.lang : locale;
  const d = await withDb(db => {
    const p = db.profiles[user.id] || emptyProfile(user.id);
    return { data: buildResume(db, user, lang), c: completeness(p, user, db.documents.filter(x => x.userId === user.id)) };
  });
  return (
    <div className="container-page max-w-6xl space-y-4 py-6 print:max-w-none print:p-0">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold">{t('resume.title')}</h1>
        <p className="text-ink-soft">{t('resume.intro')}</p>
        {d.c.percent < 70 && <p className="mt-2 rounded-lg border border-marigold-300 bg-marigold-50 p-3 text-sm">{t('resume.incomplete', { n: d.c.percent })} <Link href="/candidate/profile">{t('profile.complete')}</Link> · <Link href="/candidate/resume/check#import">{t('resume.importLink')}</Link></p>}
      </div>
      <ResumeBuilder data={d.data} lang={lang} />
    </div>
  );
}
