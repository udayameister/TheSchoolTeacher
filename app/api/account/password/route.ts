import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { setPassword } from '@/lib/server/auth';
import { sendPasswordChangedEmail } from '@/lib/server/authEmails';
import { allow, maskIp, verifyPassword } from '@/lib/server/security';
import { ROLES } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Change (or, for Google-only accounts, create) the password. Other devices are signed out. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ROLES });
  if (isResponse(g)) return g;
  const me = g.user!;
  if (!allow(`pw-change:${me.id}`, 10, 60 * 60_000)) return fail('Too many attempts. Try again later.', 429);
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  if (me.passwordHash && !(await verifyPassword(String(b.current || ''), me.passwordHash))) return fail('Your current password is not correct.', 400);
  const problem = await setPassword(me.id, String(b.next || ''), me.id, maskIp(g.ip));
  if (problem) return fail(problem);
  await sendPasswordChangedEmail(me.email, me.name);
  return json({ ok: true, signedOut: true });
}
