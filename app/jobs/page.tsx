import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'Teacher jobs', alternates: { canonical: '/jobs' } };

/** Placeholder until Phase 2 (job search with facets). Shows the query the visitor typed so the home search is not a dead end. */
export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t } = await getT();
  const q = await searchParams;
  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-bold">{q.type === 'government' ? t('nav.govtNotices') : t('nav.jobs')}</h1>
      <p className="mt-3 text-ink-soft">{t('home.latestEmpty')}</p>
      <p className="mt-1 text-sm text-ink-muted">{t('common.comingSoon')}</p>
    </div>
  );
}
