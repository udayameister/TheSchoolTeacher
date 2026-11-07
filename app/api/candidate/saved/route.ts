import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { nowIso, withDb } from '@/lib/server/db';
import { isPublic } from '@/lib/server/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Save or unsave a vacancy. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'], limit: [300, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || typeof b.jobId !== 'string') return fail('Invalid request.');
  const me = g.user!.id;
  const r = await withDb(db => {
    const job = db.jobs.find(j => j.id === b.jobId);
    if (!job || !isPublic(db, job)) return 'apply.errNotFound';
    db.savedJobs = db.savedJobs.filter(s => !(s.userId === me && s.jobId === job.id));
    if (b.saved !== false) {
      if (db.savedJobs.filter(s => s.userId === me).length >= 200) return 'jobs.errSavedLimit';
      db.savedJobs.push({ userId: me, jobId: job.id, at: nowIso() });
    }
    return null;
  });
  return r ? fail(r) : json({ ok: true, saved: b.saved !== false });
}
