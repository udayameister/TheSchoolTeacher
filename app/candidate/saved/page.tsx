import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { isPublic, lookupOf, matchWeights, matchingAllowed } from '@/lib/server/catalog';
import { computeMatch } from '@/lib/jobs/match';
import JobCard from '@/components/jobs/JobCard';

export const metadata = { title: 'Saved jobs' };

export default async function SavedPage() {
  const user = await requireRole(['candidate'], '/candidate/saved');
  const { t, locale } = await getT();
  const d = await withDb(db => {
    const lookup = lookupOf(db);
    const ids = db.savedJobs.filter(s => s.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).map(s => s.jobId);
    const jobs = ids.map(id => db.jobs.find(j => j.id === id)).filter(j => j && isPublic(db, j)) as NonNullable<ReturnType<typeof db.jobs.find>>[];
    const profile = db.profiles[user.id];
    const match = new Map(profile && matchingAllowed(db, user.id) ? jobs.map(j => [j.id, computeMatch(j, profile, lookup, matchWeights(db)).score]) : []);
    return { lookup, jobs, match };
  });
  const ctx = { lookup: d.lookup, t, locale, signedInCandidate: true, saved: new Set(d.jobs.map(j => j.id)), match: d.match.size ? d.match : undefined };
  return (
    <div className="container-page max-w-4xl py-6">
      <h1 className="text-2xl font-bold">{t('candidate.nav_saved')}</h1>
      {d.jobs.length ? <ul className="mt-4 space-y-3">{d.jobs.map(j => <li key={j.id}><JobCard job={j} ctx={ctx} /></li>)}</ul>
        : <div className="card mt-4"><p>{t('jobs.savedNone')}</p><Link href="/jobs" className="btn-primary mt-3">{t('home.searchButton')}</Link></div>}
    </div>
  );
}
