import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/config';
import { withDb } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Remembers the chosen interface language (cookie, and on the account when signed in). */
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!isLocale(b?.locale)) return fail('Unknown language.');
  if (g.user) await withDb(db => { const u = db.users.find(x => x.id === g.user!.id); if (u) u.locale = b!.locale as 'en' | 'hi'; });
  const res = json({ ok: true });
  res.cookies.set(LOCALE_COOKIE, b!.locale as string, { path: '/', sameSite: 'lax', maxAge: 365 * 86400 });
  return res;
}
