import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, readJson } from '@/lib/server/http';
import { findById, markEmailVerified } from '@/lib/server/auth';
import { withDb } from '@/lib/server/db';
import { verifyChallenge } from '@/lib/server/otp';
import { completeSignIn } from '@/lib/server/signin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Finishes an email-code sign-in, or the administrator's second step after the password. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { limit: [30, 15 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  const purpose = b?.purpose === 'admin-mfa' ? 'admin-mfa' : 'login';
  const r = await verifyChallenge(String(b?.challengeId || ''), String(b?.code || ''), purpose);
  if (!r.ok || !r.userId) return fail(r.error || 'That code is not correct or has expired.', 400);
  // A correct emailed code also proves the person controls the address.
  if (purpose === 'login') await markEmailVerified(r.userId);
  const user = await withDb(db => findById(db, r.userId));
  if (!user || user.status !== 'active') return fail('This account cannot sign in.', 403);
  const next = typeof r.data?.next === 'string' ? r.data.next : null;
  return completeSignIn(req, user, purpose === 'admin-mfa' ? 'password + email code' : 'email code', { remember: r.data?.remember !== false, next });
}
