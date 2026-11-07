import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { withdrawApplication } from '@/lib/server/applications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Withdraw an application (only while it is in "Applied" or "Screening"). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || b.action !== 'withdraw' || typeof b.id !== 'string') return fail('Invalid request.');
  const err = await withDb(db => withdrawApplication(db, g.user!, b.id as string));
  return err ? fail(err) : json({ ok: true });
}
