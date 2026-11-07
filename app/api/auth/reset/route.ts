import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { consumeToken, markEmailVerified, setPassword } from '@/lib/server/auth';
import { sendPasswordChangedEmail } from '@/lib/server/authEmails';
import { maskIp, passwordProblem } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await guard(req, { limit: [20, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const password = String(b.password || '');
  // Check the password rules before using up the link, so a typo does not cost the link.
  const early = passwordProblem(password);
  if (early) return fail(early);
  const userId = await consumeToken(String(b.token || ''), 'reset-password');
  if (!userId) return fail('This link is invalid or has expired. Ask for a new one.', 400);
  const problem = await setPassword(userId, password, userId, maskIp(g.ip));
  if (problem) return fail(`${problem} Ask for a new link and try again.`);
  // Opening the link proves the person controls the address.
  const user = await markEmailVerified(userId);
  if (user) await sendPasswordChangedEmail(user.email, user.name);
  return json({ ok: true });
}
