import type { Job, MasterItem } from '@/types';
import type { Store } from './db';
import type { Lookup } from '@/lib/jobs/filters';
import { weightsOf } from './masterData';

/*
 * Read helpers for vacancies and master data. A vacancy is public when it is published, and either a
 * government notice or posted by a verified school. Demo data (npm run seed:demo) is shown only when
 * TST_SHOW_DEMO=1, which the seed script tells you to set locally; production never sets it.
 */

export const showDemo = () => process.env.TST_SHOW_DEMO === '1';

/** Every master-data item by id (including inactive ones, so old vacancies still show their labels). */
export function lookupOf(db: Store): Lookup {
  const m = new Map<string, MasterItem>();
  for (const list of Object.values(db.master)) for (const i of list || []) m.set(i.id, i);
  return m;
}

export function isPublic(db: Store, job: Job): boolean {
  if (job.status === 'draft') return false;
  if (job.demo && !showDemo()) return false;
  if (job.kind === 'government' || job.kind === 'external') return true;
  const school = db.schools.find(s => s.id === job.schoolId);
  return !!school && (school.verification === 'verified' || (!!school.demo && showDemo()));
}

/** Public vacancies, including closed ones (job pages stay reachable; search hides past deadlines by default). */
export function publicJobs(db: Store): Job[] {
  return db.jobs.filter(j => isPublic(db, j));
}

export function matchWeights(db: Store): Record<string, number> {
  return weightsOf(db, 'matchWeights');
}

/** Is the candidate allowed to be matched (consent given and not withdrawn)? */
export function matchingAllowed(db: Store, userId: string): boolean {
  const u = db.users.find(x => x.id === userId);
  return !!u?.consents.some(c => c.purpose === 'matching' && !c.withdrawnAt);
}
