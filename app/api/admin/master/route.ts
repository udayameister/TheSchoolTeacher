import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { listMaster, saveMasterItem, setMasterActive } from '@/lib/server/masterData';
import { isMasterKind } from '@/lib/masterData/kinds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN = { roles: ['platform_admin' as const] };

export async function GET(req: NextRequest) {
  const g = await guard(req, ADMIN);
  if (isResponse(g)) return g;
  const kind = req.nextUrl.searchParams.get('kind');
  if (!isMasterKind(kind)) return fail('Unknown list.', 404);
  const items = await withDb(db => listMaster(db, kind, { includeInactive: true }));
  return json({ ok: true, items }, 200, { 'Cache-Control': 'no-store' });
}

/** Create or update one item. */
export async function POST(req: NextRequest) {
  const g = await guard(req, ADMIN);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || !isMasterKind(b.kind)) return fail('Unknown list.');
  const kind = b.kind;
  const r = await withDb(db => saveMasterItem(db, kind, (b.item || {}) as Record<string, unknown>, g.user!.id));
  return r.error ? fail(r.error) : json({ ok: true, item: r.item });
}

/** Activate / deactivate (items are never deleted, vacancies keep pointing at them). */
export async function PATCH(req: NextRequest) {
  const g = await guard(req, ADMIN);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || !isMasterKind(b.kind) || typeof b.id !== 'string') return fail('Invalid request.');
  const kind = b.kind;
  const ok = await withDb(db => setMasterActive(db, kind, b.id as string, b.active === true, g.user!.id));
  return ok ? json({ ok: true }) : fail('Item not found.', 404);
}
