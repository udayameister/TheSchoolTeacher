import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { addTracked, updateTracked } from '@/lib/server/tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const C = { roles: ['candidate' as const] };

export async function POST(req: NextRequest) {
  const g = await guard(req, { ...C, limit: [200, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const r = await withDb(db => addTracked(db, g.user!.id, b));
  return r.error ? fail(r.error) : json({ ok: true, item: r.item });
}

export async function PATCH(req: NextRequest) {
  const g = await guard(req, C);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const err = await withDb(db => updateTracked(db, g.user!.id, b));
  return err ? fail(err) : json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, C);
  if (isResponse(g)) return g;
  const id = req.nextUrl.searchParams.get('id');
  const ok = await withDb(db => { const n = db.tracked.length; db.tracked = db.tracked.filter(t => !(t.id === id && t.userId === g.user!.id)); return db.tracked.length < n; });
  return ok ? json({ ok: true }) : fail('tracker.errNotFound', 404);
}
