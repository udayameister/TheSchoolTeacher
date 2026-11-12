import type { MasterItem, MasterKind } from '@/types';
import type { Store } from './db';
import { listMaster } from './masterData';

/** Master lists for school forms, without meta (lighter pages), except where the form needs it. */
export function lite(db: Store, kind: MasterKind, keepMeta: string[] = []): MasterItem[] {
  return listMaster(db, kind).map(i => ({ ...i, meta: Object.fromEntries(keepMeta.map(k => [k, i.meta[k] ?? null])) }));
}

export function schoolFormLists(db: Store) {
  return {
    states: lite(db, 'states'), boards: lite(db, 'boards'), managementTypes: lite(db, 'managementTypes'), levels: lite(db, 'schoolLevels'),
    streams: lite(db, 'streams'), mediums: lite(db, 'mediums'), facilities: lite(db, 'facilities'), benefits: lite(db, 'benefits'),
  };
}

export function vacancyFormLists(db: Store) {
  return {
    posts: lite(db, 'posts', ['category', 'subjectWise']), subjects: lite(db, 'subjects', ['area']), levels: lite(db, 'schoolLevels'), streams: lite(db, 'streams'),
    employmentTypes: lite(db, 'employmentTypes'), mediums: lite(db, 'mediums'), qualifications: lite(db, 'qualifications', ['type']), tets: lite(db, 'tetExams', ['scope', 'papers']),
    payLevels: lite(db, 'payLevels', ['level', 'entryPay']), benefits: lite(db, 'benefits'),
  };
}
