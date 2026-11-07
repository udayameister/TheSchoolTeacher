import type { TrackStatus, TrackedJob } from '@/types';
import { isIsoDate } from '@/lib/jobs/dates';
import { newId, nowIso, type Store } from './db';
import { isPublic } from './catalog';
import { trackedFromJob } from './applications';

export const TRACK_STATUSES: TrackStatus[] = ['interested', 'applied', 'exam', 'interview', 'result', 'closed'];
const MAX_TRACKED = 200;

const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const url = (v: unknown) => { const s = str(v, 500); if (!s) return null; try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch { return null; } };

/** Adds a vacancy from this site, or a job from another site (title, organisation, link, last date). */
export function addTracked(db: Store, userId: string, b: Record<string, unknown>): { item?: TrackedJob; error?: string } {
  if (db.tracked.filter(t => t.userId === userId).length >= MAX_TRACKED) return { error: 'tracker.errLimit' };
  if (typeof b.jobId === 'string') {
    const job = db.jobs.find(j => j.id === b.jobId);
    if (!job || !isPublic(db, job)) return { error: 'apply.errNotFound' };
    const existing = db.tracked.find(t => t.userId === userId && t.jobId === job.id);
    if (existing) return { item: existing };
    const item = trackedFromJob(userId, job);
    db.tracked.push(item);
    return { item };
  }
  const title = str(b.title, 160), organisation = str(b.organisation, 160);
  if (!title || !organisation) return { error: 'tracker.errRequired' };
  if (b.lastDate && !isIsoDate(b.lastDate)) return { error: 'tracker.errDate' };
  const at = nowIso();
  const item: TrackedJob = {
    id: newId('trk'), userId, jobId: null, title, organisation, url: url(b.url), lastDate: isIsoDate(b.lastDate) ? b.lastDate : null,
    status: TRACK_STATUSES.includes(b.status as TrackStatus) ? (b.status as TrackStatus) : 'interested', notes: str(b.notes, 1000) || null, createdAt: at, updatedAt: at,
  };
  db.tracked.push(item);
  return { item };
}

export function updateTracked(db: Store, userId: string, b: Record<string, unknown>): string | null {
  const t = db.tracked.find(x => x.id === b.id && x.userId === userId);
  if (!t) return 'tracker.errNotFound';
  if (b.status !== undefined) { if (!TRACK_STATUSES.includes(b.status as TrackStatus)) return 'tracker.errStatus'; t.status = b.status as TrackStatus; }
  if (b.notes !== undefined) t.notes = str(b.notes, 1000) || null;
  if (!t.jobId) {
    if (b.title !== undefined) { const v = str(b.title, 160); if (!v) return 'tracker.errRequired'; t.title = v; }
    if (b.organisation !== undefined) { const v = str(b.organisation, 160); if (!v) return 'tracker.errRequired'; t.organisation = v; }
    if (b.url !== undefined) t.url = url(b.url);
    if (b.lastDate !== undefined) { if (b.lastDate && !isIsoDate(b.lastDate)) return 'tracker.errDate'; t.lastDate = (b.lastDate as string) || null; }
  }
  t.updatedAt = nowIso();
  return null;
}
