import type { NextRequest } from 'next/server';
import { guard, isResponse, json } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { cleanUdise, isUdiseCode, lookupUdise } from '@/lib/server/udise';
import { udisePrefixWarning, udiseTaken } from '@/lib/server/schools';
import { lookupOf } from '@/lib/server/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Checks a UDISE+ code while the school fills in the form: format, directory entry, already registered, state prefix. */
export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin', 'platform_admin'], limit: [120, 60 * 60_000] });
  if (isResponse(g)) return g;
  const code = cleanUdise(req.nextUrl.searchParams.get('code'));
  if (!isUdiseCode(code)) return json({ ok: true, valid: false });
  const stateId = req.nextUrl.searchParams.get('state');
  const record = await lookupUdise(code);
  const r = await withDb(db => ({ taken: udiseTaken(db, code, req.nextUrl.searchParams.get('self') || undefined), warning: udisePrefixWarning(lookupOf(db), code, stateId) }));
  return json({ ok: true, valid: true, record, ...r });
}
