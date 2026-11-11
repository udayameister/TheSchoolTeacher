import type { Store } from './db';
import { listMaster } from './masterData';

/** Master-data choices for the admin's listing form (English names; the admin console is English-only). */
export function listingLists(db: Store) {
  const pick = (kind: Parameters<typeof listMaster>[1]) => listMaster(db, kind).map(i => ({ id: i.id, name: i.name, parentId: i.parentId ?? null, meta: i.meta }));
  return {
    posts: pick('posts'), subjects: pick('subjects'), levels: pick('schoolLevels'), employmentTypes: pick('employmentTypes'), managementTypes: pick('managementTypes'),
    boards: pick('boards'), states: pick('states'), districts: pick('districts'), qualifications: pick('qualifications'), tets: pick('tetExams'), payLevels: pick('payLevels'),
  };
}
export type ListingLists = ReturnType<typeof listingLists>;
