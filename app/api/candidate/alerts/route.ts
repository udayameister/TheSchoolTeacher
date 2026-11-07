import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { saveAlert } from '@/lib/server/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const C = { roles: ['candidate' as const] };

/** Create or update an alert ({ id?, name, filters, frequency, active }). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { ...C, limit: [60, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const r = await withDb(db => saveAlert(db, g.user!.id, b));
  return r.error ? fail(r.error) : json({ ok: true, alert: r.alert });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, C);
  if (isResponse(g)) return g;
  const id = req.nextUrl.searchParams.get('id');
  const ok = await withDb(db => { const n = db.alerts.length; db.alerts = db.alerts.filter(a => !(a.id === id && a.userId === g.user!.id)); return db.alerts.length < n; });
  return ok ? json({ ok: true }) : fail('alerts.errNotFound', 404);
}
