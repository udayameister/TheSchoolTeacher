import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { audit, withDb } from '@/lib/server/db';
import { directorySize, importUdiseCsv } from '@/lib/server/udise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  return json({ ok: true, size: await directorySize() });
}

/** Import a UDISE+ directory CSV (up to 8 MB per file; split large state files by district). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  const b = await readJson(req, 8_000_000);
  if (!b || typeof b.csv !== 'string') return fail('Send the CSV text.');
  const r = await importUdiseCsv(b.csv);
  await withDb(db => audit(db, { actorId: g.user!.id, action: 'udise.import', target: 'directory', detail: `${r.added} added, ${r.updated} updated, ${r.skipped} skipped` }));
  return json({ ok: true, ...r, size: await directorySize() });
}
