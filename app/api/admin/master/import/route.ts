import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { importMasterCsv } from '@/lib/server/masterData';
import { isMasterKind } from '@/lib/masterData/kinds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** CSV import (the browser reads the file and sends its text). Up to 5 MB. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  const b = await readJson(req, 5_000_000);
  if (!b || !isMasterKind(b.kind) || typeof b.csv !== 'string') return fail('Send the list name and the CSV text.');
  const kind = b.kind;
  const r = await withDb(db => importMasterCsv(db, kind, b.csv as string, g.user!.id));
  return r.errors.length ? fail('Nothing was imported. Fix these rows and try again.', 400, { errors: r.errors }) : json({ ok: true, ...r });
}
