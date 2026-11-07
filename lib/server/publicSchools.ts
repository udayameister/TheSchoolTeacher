import type { School } from '@/types';
import type { Store } from './db';
import { showDemo } from './catalog';

/** Verified schools are public (sample schools only with TST_SHOW_DEMO=1). */
export function publicSchools(db: Store): School[] {
  return db.schools.filter(s => s.verification === 'verified' && (!s.demo || showDemo()));
}
