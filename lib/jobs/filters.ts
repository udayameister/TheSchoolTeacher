import type { Job, JobFilters, MasterItem } from '@/types';
import { daysLeft } from './dates';

/*
 * Job search: URL ⇄ filters, matching, text relevance, facet counts and sorting. Pure functions,
 * used by the search page (server), job alerts (server) and tests. Filters use master-data codes
 * (readable URLs like /jobs?board=CBSE&post=PGT); jobs store ids ("boards:CBSE").
 * Adapted from the idea of AcadeXMatch lib/jobFilter.ts, rewritten for school fields.
 */

export type Lookup = Map<string, MasterItem>;
export type SortKey = 'relevance' | 'newest' | 'deadline' | 'salary' | 'distance' | 'match';

const LIST_KEYS = ['board', 'post', 'subject', 'level', 'medium', 'management', 'employment'] as const;
type ListKey = (typeof LIST_KEYS)[number];
const KIND_OF: Record<ListKey, string> = { board: 'boards', post: 'posts', subject: 'subjects', level: 'schoolLevels', medium: 'mediums', management: 'managementTypes', employment: 'employmentTypes' };

const code = (v: string) => v.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 40);
const num = (v: string | null | undefined, min: number, max: number) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;
function getAll(src: ParamSource, key: string): string[] {
  if (src instanceof URLSearchParams) return src.getAll(key).flatMap(v => v.split(','));
  const v = src[key];
  return (Array.isArray(v) ? v : v ? [v] : []).flatMap(x => x.split(','));
}
const getOne = (src: ParamSource, key: string) => getAll(src, key)[0];

export function parseFilters(src: ParamSource): JobFilters {
  const f: JobFilters = {};
  // "place" is the free-text district / city box on the home page; it is searched like the main query.
  const q = [getOne(src, 'q'), getOne(src, 'place')].filter(Boolean).join(' ').trim().slice(0, 120);
  if (q) f.q = q;
  const kind = getOne(src, 'type');
  if (kind === 'government' || kind === 'school' || kind === 'external') f.kind = kind;
  for (const k of LIST_KEYS) {
    const vals = [...new Set(getAll(src, k).map(code).filter(Boolean))].slice(0, 20);
    if (vals.length) f[k] = vals;
  }
  const state = code(getOne(src, 'state') || '');
  if (state) f.state = state;
  const district = code(getOne(src, 'district') || '');
  if (district) f.district = district;
  const sector = getOne(src, 'sector');
  if (sector === 'government' || sector === 'aided' || sector === 'private') f.sector = sector;
  const minSalary = num(getOne(src, 'minSalary'), 1, 10_000_000);
  if (minSalary) f.minSalary = minSalary;
  const closingDays = num(getOne(src, 'closing'), 0, 365);
  if (closingDays !== undefined) f.closingDays = closingDays;
  const lat = num(getOne(src, 'lat'), 6, 38), lng = num(getOne(src, 'lng'), 68, 98), km = num(getOne(src, 'km'), 1, 500);
  if (lat !== undefined && lng !== undefined) { f.lat = Math.round(lat * 1e4) / 1e4; f.lng = Math.round(lng * 1e4) / 1e4; f.km = km ?? 25; }
  return f;
}

export function filtersToQuery(f: JobFilters, extra: Record<string, string | undefined> = {}): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.kind) p.set('type', f.kind);
  for (const k of LIST_KEYS) if (f[k]?.length) p.set(k, f[k]!.join(','));
  if (f.state) p.set('state', f.state);
  if (f.district) p.set('district', f.district);
  if (f.sector) p.set('sector', f.sector);
  if (f.minSalary) p.set('minSalary', String(f.minSalary));
  if (f.closingDays !== undefined) p.set('closing', String(f.closingDays));
  if (f.lat !== undefined && f.lng !== undefined) { p.set('lat', String(f.lat)); p.set('lng', String(f.lng)); p.set('km', String(f.km ?? 25)); }
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p.toString();
}

export const hasFilters = (f: JobFilters) => Object.keys(f).length > 0;

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Highest monthly pay a vacancy offers (entry pay for pay levels), or null when not known. */
export function monthlyPay(job: Job, lookup: Lookup): number | null {
  if (job.pay.mode === 'range') return job.pay.max ?? job.pay.min ?? null;
  if (job.pay.mode === 'cpc' && job.pay.payLevelId) { const v = lookup.get(job.pay.payLevelId)?.meta.entryPay; return typeof v === 'number' ? v : null; }
  return null;
}

export function sectorOf(job: Job, lookup: Lookup): 'government' | 'aided' | 'private' | null {
  const s = lookup.get(job.managementTypeId)?.meta.sector;
  return s === 'government' || s === 'aided' || s === 'private' ? s : null;
}

// ------------------------------------------------------------------ text relevance

const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const STOP = new Set(['teacher', 'teachers', 'job', 'jobs', 'in', 'for', 'the', 'and', 'of', 'vacancy', 'vacancies']);

/** Words a job can be found by: title, organisation, place, and names / codes / Hindi names of its master data. */
export function searchText(job: Job, lookup: Lookup): string {
  const ids = [job.postId, ...job.subjectIds, ...job.levelIds, ...job.boardIds, job.stateId, job.districtId || '', job.managementTypeId, job.employmentTypeId];
  const names = ids.map(id => lookup.get(id)).filter(Boolean).flatMap(i => [i!.name, i!.code.replace(/_/g, ' '), i!.nameHi || '']);
  return norm([job.title, job.orgName, job.city, job.pincode || '', ...names].join(' '));
}

/** 0 when a word of the query is missing; otherwise a relevance score (title matches count most). */
export function textScore(job: Job, q: string, lookup: Lookup): number {
  const words = norm(q).split(' ').filter(w => w && !STOP.has(w));
  if (!words.length) return 1;
  const hay = ` ${searchText(job, lookup)} `;
  const title = ` ${norm(job.title)} `;
  let score = 0;
  for (const w of words) {
    if (!hay.includes(w)) return 0;
    score += (title.includes(` ${w}`) ? 3 : 1) + (hay.includes(` ${w} `) ? 1 : 0);
  }
  return score;
}

// ------------------------------------------------------------------ matching

const has = (ids: string[], kind: string, codes?: string[]) => !codes?.length || codes.some(c => ids.includes(`${kind}:${c}`));

/** Does the job pass every filter except `skip` (used for facet counts)? */
export function matchesFilters(job: Job, f: JobFilters, lookup: Lookup, skip?: keyof JobFilters, now = new Date()): boolean {
  if (skip !== 'kind' && f.kind && job.kind !== f.kind) return false;
  if (skip !== 'board' && !has(job.boardIds, 'boards', f.board)) return false;
  if (skip !== 'post' && !has([job.postId], 'posts', f.post)) return false;
  if (skip !== 'subject' && !has(job.subjectIds, 'subjects', f.subject)) return false;
  if (skip !== 'level' && !has(job.levelIds, 'schoolLevels', f.level)) return false;
  if (skip !== 'medium' && !has(job.eligibility.mediumIds, 'mediums', f.medium)) return false;
  if (skip !== 'management' && !has([job.managementTypeId], 'managementTypes', f.management)) return false;
  if (skip !== 'employment' && !has([job.employmentTypeId], 'employmentTypes', f.employment)) return false;
  if (skip !== 'state' && f.state && job.stateId !== `states:${f.state}`) return false;
  if (skip !== 'district' && f.district && job.districtId !== `districts:${f.district}`) return false;
  if (skip !== 'sector' && f.sector && sectorOf(job, lookup) !== f.sector) return false;
  if (skip !== 'minSalary' && f.minSalary) { const p = monthlyPay(job, lookup); if (p === null || p < f.minSalary) return false; }
  if (skip !== 'closingDays' && f.closingDays !== undefined) { const d = daysLeft(job.lastDate, now); if (d === null || d < 0 || d > f.closingDays) return false; }
  if (skip !== 'lat' && f.lat !== undefined && f.lng !== undefined) {
    if (job.lat == null || job.lng == null || distanceKm(f.lat, f.lng, job.lat, job.lng) > (f.km ?? 25)) return false;
  }
  if (skip !== 'q' && f.q && textScore(job, f.q, lookup) === 0) return false;
  return true;
}

export interface FacetCount { code: string; count: number }
export type Facets = Partial<Record<'board' | 'post' | 'subject' | 'level' | 'medium' | 'management' | 'employment' | 'state' | 'kind' | 'sector', FacetCount[]>>;

/** Counts per value for each facet, honouring all the other filters (so counts show what a click would give). */
export function facetCounts(jobs: Job[], f: JobFilters, lookup: Lookup, now = new Date()): Facets {
  const out: Facets = {};
  const count = (key: keyof Facets, skip: keyof JobFilters, values: (j: Job) => string[]) => {
    const m = new Map<string, number>();
    for (const j of jobs) if (matchesFilters(j, f, lookup, skip, now)) for (const v of new Set(values(j))) m.set(v, (m.get(v) || 0) + 1);
    out[key] = [...m.entries()].map(([c, n]) => ({ code: c, count: n })).sort((a, b) => b.count - a.count);
  };
  const codes = (ids: (string | null | undefined)[]) => ids.filter(Boolean).map(id => id!.split(':')[1]);
  count('board', 'board', j => codes(j.boardIds));
  count('post', 'post', j => codes([j.postId]));
  count('subject', 'subject', j => codes(j.subjectIds));
  count('level', 'level', j => codes(j.levelIds));
  count('medium', 'medium', j => codes(j.eligibility.mediumIds));
  count('management', 'management', j => codes([j.managementTypeId]));
  count('employment', 'employment', j => codes([j.employmentTypeId]));
  count('state', 'state', j => codes([j.stateId]));
  count('kind', 'kind', j => [j.kind]);
  count('sector', 'sector', j => [sectorOf(j, lookup) || '']);
  return out;
}

export function sortJobs(jobs: Job[], sort: SortKey, ctx: { f: JobFilters; lookup: Lookup; match?: Map<string, number> }): Job[] {
  const { f, lookup, match } = ctx;
  const rel = new Map(jobs.map(j => [j.id, f.q ? textScore(j, f.q, lookup) : 0]));
  const newest = (a: Job, b: Job) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt);
  const cmp: Record<SortKey, (a: Job, b: Job) => number> = {
    relevance: (a, b) => (rel.get(b.id)! - rel.get(a.id)!) || newest(a, b),
    newest,
    deadline: (a, b) => a.lastDate.localeCompare(b.lastDate) || newest(a, b),
    salary: (a, b) => (monthlyPay(b, lookup) ?? -1) - (monthlyPay(a, lookup) ?? -1) || newest(a, b),
    distance: (a, b) => {
      if (f.lat === undefined || f.lng === undefined) return newest(a, b);
      const d = (j: Job) => (j.lat == null || j.lng == null ? 1e9 : distanceKm(f.lat!, f.lng!, j.lat, j.lng));
      return d(a) - d(b);
    },
    match: (a, b) => (match?.get(b.id) ?? -1) - (match?.get(a.id) ?? -1) || newest(a, b),
  };
  return jobs.slice().sort(cmp[sort] || newest);
}
