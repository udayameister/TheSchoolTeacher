import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { EMAIL_LISTS, setEmailPreference, type EmailList } from '@/lib/server/privacy';
import { ROLES } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Turn an email list on or off ({ list: "alerts" | "digest" | "news", on: boolean }). Security emails are always sent. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ROLES });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || !EMAIL_LISTS.includes(b.list as EmailList)) return fail('Invalid request.');
  await withDb(db => setEmailPreference(db, g.user!.id, b.list as EmailList, b.on === true));
  return json({ ok: true });
}
