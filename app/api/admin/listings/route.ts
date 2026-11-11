import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { saveListing, setListingStatus } from '@/lib/server/importer';
import { runJobAlerts } from '@/lib/server/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Create or update a government notice / external vacancy listing ({ id?, importItemId?, …fields, publish? }). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'], limit: [300, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req, 100_000);
  if (!b) return fail('Invalid request.');
  if (b.action === 'close' || b.action === 'reopen') {
    const e = await withDb(db => setListingStatus(db, g.user!, String(b.id || ''), b.action === 'close' ? 'closed' : 'published'));
    return e ? fail(e) : json({ ok: true });
  }
  const r = await withDb(db => {
    const wasLive = typeof b.id === 'string' && db.jobs.find(j => j.id === b.id)?.status === 'published';
    const out = saveListing(db, g.user!, b);
    return { ...out, newlyLive: !!out.job && out.job.status === 'published' && !wasLive };
  });
  if (!r.job) return fail(r.error || 'Could not save.');
  if (r.newlyLive) runJobAlerts({ only: ['instant'] }).catch(() => undefined);
  return json({ ok: true, id: r.job.id, status: r.job.status });
}
