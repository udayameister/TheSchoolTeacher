import type { Job } from '@/types';
import type { Lookup } from '@/lib/jobs/filters';
import { sectorOf } from '@/lib/jobs/filters';
import { lookupOf, publicJobs } from './catalog';
import type { Store } from './db';
import { listMaster } from './masterData';

/*
 * Salary & career insights, computed from vacancies published on the site (school, government and imported
 * listings) and the pay levels in master data. Only vacancies that state a monthly figure are counted, and a
 * group with fewer than MIN_SAMPLE vacancies is not shown, so one listing never stands for "the market".
 */

export const MIN_SAMPLE = 3;

export interface PayRow { postId: string; sector: 'government' | 'aided' | 'private' | 'all'; count: number; low: number; median: number; high: number }

function pct(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}

/** Monthly figure of a vacancy: the middle of a stated range, or the entry pay of its pay level. */
export function payPoint(job: Job, lookup: Lookup): number | null {
  if (job.pay.mode === 'range') {
    const a = job.pay.min ?? null, b = job.pay.max ?? null;
    const v = a != null && b != null ? (a + b) / 2 : a ?? b;
    return v != null && v >= 3000 && v <= 500_000 ? v : null;
  }
  if (job.pay.mode === 'cpc' && job.pay.payLevelId) { const v = lookup.get(job.pay.payLevelId)?.meta.entryPay; return typeof v === 'number' ? v : null; }
  return null;
}

export function salaryInsights(db: Store, opts: { stateId?: string | null; months?: number } = {}, now = new Date()) {
  const lookup = lookupOf(db);
  const since = new Date(now.getTime() - (opts.months ?? 12) * 30 * 86_400_000).toISOString();
  // Closed vacancies count too (they show what was offered); drafts never do.
  const jobs = db.jobs.filter(j => j.status !== 'draft' && (j.publishedAt || j.createdAt) >= since && (!opts.stateId || j.stateId === opts.stateId));
  const pub = new Set(publicJobs(db).map(j => j.id));
  const groups = new Map<string, number[]>();
  for (const j of jobs) {
    if (j.status === 'published' && !pub.has(j.id)) continue;
    const v = payPoint(j, lookup);
    if (v == null) continue;
    const sector = sectorOf(j, lookup) || 'private';
    for (const key of [`${j.postId}|${sector}`, `${j.postId}|all`]) groups.set(key, [...(groups.get(key) || []), v]);
  }
  const rows: PayRow[] = [];
  for (const [key, vals] of groups) {
    if (vals.length < MIN_SAMPLE) continue;
    const [postId, sector] = key.split('|') as [string, PayRow['sector']];
    const s = [...vals].sort((a, b) => a - b);
    rows.push({ postId, sector, count: s.length, low: pct(s, 0.25), median: pct(s, 0.5), high: pct(s, 0.75) });
  }
  const order = new Map(listMaster(db, 'posts').map((p, i) => [p.id, i]));
  rows.sort((a, b) => (order.get(a.postId) ?? 999) - (order.get(b.postId) ?? 999) || a.sector.localeCompare(b.sector));
  const payLevels = listMaster(db, 'payLevels').map(p => ({ id: p.id, name: p.name, nameHi: p.nameHi, level: Number(p.meta.level) || 0, entryPay: Number(p.meta.entryPay) || 0, posts: String(p.meta.posts || '').split(',').map(s => s.trim()).filter(Boolean), verify: p.verify }))
    .filter(p => p.entryPay > 0).sort((a, b) => a.level - b.level);
  const postsByCode = new Map(listMaster(db, 'posts').map(p => [p.code, p]));
  return {
    rows, counted: jobs.length,
    payLevels: payLevels.map(p => ({ ...p, postNames: p.posts.map(c => postsByCode.get(c)).filter(Boolean).map(x => ({ name: x!.name, nameHi: x!.nameHi })) })),
    lookup,
  };
}
