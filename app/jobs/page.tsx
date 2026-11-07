import type { Metadata } from 'next';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { withDb } from '@/lib/server/db';
import { currentUser } from '@/lib/server/http';
import { listMaster } from '@/lib/server/masterData';
import { lookupOf, matchWeights, matchingAllowed, publicJobs } from '@/lib/server/catalog';
import { distanceKm, facetCounts, filtersToQuery, hasFilters, matchesFilters, parseFilters, sortJobs, type SortKey } from '@/lib/jobs/filters';
import { isPast } from '@/lib/jobs/dates';
import { computeMatch } from '@/lib/jobs/match';
import JobCard from '@/components/jobs/JobCard';
import FilterForm from '@/components/jobs/FilterForm';
import { NearMeButton, SaveAlertButton } from '@/components/jobs/SearchTools';

const PAGE_SIZE = 20;
const SORTS: SortKey[] = ['relevance', 'newest', 'deadline', 'salary', 'distance', 'match'];

type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { t } = await getT();
  const f = parseFilters(await searchParams);
  // Filtered result pages are not indexed (Phase 6 adds dedicated landing pages for districts, boards and subjects).
  return { title: f.kind === 'government' ? t('nav.govtNotices') : t('nav.jobs'), alternates: { canonical: '/jobs' }, robots: hasFilters(f) ? { index: false, follow: true } : undefined };
}

export default async function JobsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [{ t, locale }, user] = await Promise.all([getT(), currentUser()]);
  const f = parseFilters(sp);
  const showClosed = sp.closed === '1';
  const sortParam = String(sp.sort || '');
  const candidate = user?.role === 'candidate' ? user : null;

  const data = await withDb(db => {
    const lookup = lookupOf(db);
    const all = publicJobs(db).filter(j => j.status === 'published' && (showClosed || !isPast(j.lastDate)));
    const results = all.filter(j => matchesFilters(j, f, lookup));
    const canMatch = !!candidate && matchingAllowed(db, candidate.id) && !!db.profiles[candidate.id];
    const weights = matchWeights(db);
    const match = new Map<string, number>(canMatch ? results.map(j => [j.id, computeMatch(j, db.profiles[candidate!.id], lookup, weights).score]) : []);
    const lists = {
      states: listMaster(db, 'states'), districts: f.state ? listMaster(db, 'districts').filter(d => d.parentId === `states:${f.state}`) : [],
      boards: listMaster(db, 'boards'), posts: listMaster(db, 'posts'), subjects: listMaster(db, 'subjects'), levels: listMaster(db, 'schoolLevels'),
      mediums: listMaster(db, 'mediums'), managementTypes: listMaster(db, 'managementTypes'), employmentTypes: listMaster(db, 'employmentTypes'),
    };
    return {
      lookup, results, match, canMatch, lists, facets: facetCounts(all, f, lookup),
      saved: new Set(candidate ? db.savedJobs.filter(s => s.userId === candidate.id).map(s => s.jobId) : []),
    };
  });

  const defaultSort: SortKey = f.q ? 'relevance' : f.lat !== undefined ? 'distance' : 'newest';
  const sort: SortKey = SORTS.includes(sortParam as SortKey) && (sortParam !== 'match' || data.canMatch) ? (sortParam as SortKey) : defaultSort;
  const sorted = sortJobs(data.results, sort, { f, lookup: data.lookup, match: data.match });
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const shown = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const distance = new Map(f.lat !== undefined ? shown.filter(j => j.lat != null).map(j => [j.id, distanceKm(f.lat!, f.lng!, j.lat!, j.lng!)]) : []);
  const query = filtersToQuery(f);
  const link = (extra: Record<string, string | undefined>) => `/jobs?${filtersToQuery(f, { sort: sort === defaultSort ? undefined : sort, closed: showClosed ? '1' : undefined, ...extra })}`;
  const ctx = { lookup: data.lookup, t, locale, signedInCandidate: !!candidate, saved: data.saved, match: data.canMatch ? data.match : undefined, distance };
  const formProps = { f, facets: data.facets, lists: data.lists, t, locale, sort: sort === defaultSort ? '' : sort };

  return (
    <div className="container-page py-6">
      <h1 className="text-2xl font-bold">{f.kind === 'government' ? t('nav.govtNotices') : t('nav.jobs')}</h1>
      {f.kind === 'government' && <p className="mt-1 text-sm text-ink-soft">{t('home.govtStripNote')}</p>}

      <div className="mt-4 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside aria-label={t('jobs.filters')}>
          <details className="card lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold"><SlidersHorizontal size={18} aria-hidden="true" />{t('jobs.filters')}{hasFilters(f) ? ` (${t('jobs.active')})` : ''}</summary>
            <div className="mt-3"><FilterForm {...formProps} prefix="m" /></div>
          </details>
          <div className="card hidden lg:block"><FilterForm {...formProps} prefix="d" /></div>
          <div className="mt-3"><NearMeButton /></div>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="results-heading" className="text-base font-semibold text-ink" aria-live="polite">{sorted.length === 1 ? t('jobs.resultCountOne') : t('jobs.resultCount', { n: sorted.length })}</h2>
            <nav aria-label={t('jobs.sortBy')} className="flex flex-wrap items-center gap-1 text-sm">
              <span className="text-ink-muted">{t('jobs.sortBy')}:</span>
              {SORTS.filter(s => (s !== 'relevance' || f.q) && (s !== 'distance' || f.lat !== undefined) && (s !== 'match' || data.canMatch)).map(s => (
                <Link key={s} href={link({ sort: s === defaultSort ? undefined : s })} aria-current={sort === s ? 'true' : undefined}
                  className={`rounded-lg px-2 py-1 no-underline ${sort === s ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50'}`}>{t(`jobs.sort_${s}`)}</Link>
              ))}
            </nav>
          </div>
          {hasFilters(f) && <SaveAlertButton signedInCandidate={!!candidate} query={query} />}
          {candidate && !data.canMatch && <p className="text-sm text-ink-muted">{t('match.enableHint')} <Link href="/account#privacy">{t('match.enableLink')}</Link></p>}

          {shown.length === 0 ? (
            <div className="card">
              <p>{data.results.length === 0 && !hasFilters(f) ? t('home.latestEmpty') : t('jobs.noResults')}</p>
              {hasFilters(f) && <p className="mt-2 text-sm"><Link href="/jobs">{t('jobs.clear')}</Link></p>}
            </div>
          ) : (
            <ul className="space-y-3">{shown.map(j => <li key={j.id}><JobCard job={j} ctx={ctx} /></li>)}</ul>
          )}

          {pages > 1 && (
            <nav aria-label={t('jobs.pagination')} className="flex items-center justify-between">
              {page > 1 ? <Link className="btn-ghost" href={link({ page: String(page - 1) })}>{t('jobs.prev')}</Link> : <span />}
              <span className="text-sm text-ink-muted">{t('jobs.pageOf', { page, pages })}</span>
              {page < pages ? <Link className="btn-ghost" href={link({ page: String(page + 1) })}>{t('jobs.next')}</Link> : <span />}
            </nav>
          )}
          <p className="text-sm">{showClosed ? <Link href={link({ closed: undefined })}>{t('jobs.hideClosed')}</Link> : <Link href={link({ closed: '1' })}>{t('jobs.showClosed')}</Link>}</p>
        </section>
      </div>
    </div>
  );
}
