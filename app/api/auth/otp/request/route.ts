import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { findByEmail, normEmail } from '@/lib/server/auth';
import { withDb } from '@/lib/server/db';
import { isEmail } from '@/lib/server/security';
import { startChallenge } from '@/lib/server/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sign in with a code sent by email. Unknown addresses get the same answer (a decoy challenge, nothing is sent). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { limit: [20, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  const email = normEmail(b?.email);
  if (!isEmail(email)) return fail('Enter a valid email address.');
  const user = await withDb(db => findByEmail(db, email));
  const usable = !!user && user.status === 'active' && user.role !== 'platform_admin'; // administrators always use password + code
  const r = await startChallenge({ purpose: 'login', target: email, userId: usable ? user!.id : undefined, name: user?.name, ip: g.ip, decoy: !usable, data: { remember: b?.remember !== false, next: b?.next ?? null } });
  if (!r.ok) return fail(r.error || 'Could not send the code.', r.status || 400, { resendIn: r.resendIn });
  return json({ ok: true, challengeId: r.challengeId, resendIn: r.resendIn });
}
