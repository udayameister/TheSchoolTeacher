import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { setPanel, submitScore } from '@/lib/server/panel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STAFF = { roles: ['school_admin' as const, 'school_staff' as const], limit: [300, 60 * 60_000] as [number, number] };

/** { action: "panel", jobId, members: [{ userId, role }] } · { action: "score", applicationId, marks: { dimensionId: 0–10 }, recommendation, comments? } */
export async function POST(req: NextRequest) {
  const g = await guard(req, STAFF);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  if (b.action === 'panel') {
    const r = await withDb(db => setPanel(db, g.user!, String(b.jobId || ''), b.members));
    return r.job ? json({ ok: true }) : fail(r.error || 'panel.errGeneric');
  }
  if (b.action === 'score') {
    const r = await withDb(db => submitScore(db, g.user!, b));
    return r.score ? json({ ok: true, total: r.score.total }) : fail(r.error || 'panel.errGeneric');
  }
  return fail('Invalid request.');
}
