import type { Store } from './db';

/*
 * Site-wide visit counter shown on the home page: a total and a count per India-time day. The browser posts
 * at most once per 30 minutes of activity (see components/home/VisitCounter.tsx); crawlers are not counted.
 * Nothing about the visitor is stored. Daily counts older than 400 days are dropped.
 */

export const todayIst = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function recordVisit(db: Store, now = new Date()): void {
  const v = db.siteVisits;
  const day = todayIst(now);
  v.total = (v.total || 0) + 1;
  v[day] = (v[day] || 0) + 1;
  const days = Object.keys(v).filter(k => DAY.test(k)).sort();
  for (const k of days.slice(0, Math.max(0, days.length - 400))) delete v[k];
}

export function visitStats(db: Store, now = new Date()): { total: number; today: number; since: string | null } {
  const v = db.siteVisits || {};
  const days = Object.keys(v).filter(k => DAY.test(k)).sort();
  return { total: v.total || 0, today: v[todayIst(now)] || 0, since: days[0] || null };
}

export const isBotAgent = (ua: string | null | undefined) => !ua || /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|axios|node-fetch/i.test(ua);
