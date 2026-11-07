import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { authenticate, ensureBootstrapAdmin, normEmail } from '@/lib/server/auth';
import { allow, resetLimit, retryAfter } from '@/lib/server/security';
import { emailConfigured } from '@/lib/server/mailer';
import { startChallenge } from '@/lib/server/otp';
import { completeSignIn } from '@/lib/server/signin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Administrators must also enter a code sent by email, once email sending is set up (ADMIN_EMAIL_CODE=off skips it). */
const adminNeedsCode = () => process.env.ADMIN_EMAIL_CODE !== 'off' && emailConfigured();

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const email = normEmail(b.email);
  // Limits: per address+IP (guessing), per IP (credential stuffing), per address (distributed guessing).
  const keys = [`login:${email}|${g.ip}`, `login-ip:${g.ip}`, `login-email:${email}`];
  if (!allow(keys[0], 10, 15 * 60_000) || !allow(keys[1], 60, 15 * 60_000) || !allow(keys[2], 30, 60 * 60_000)) {
    return fail('Too many sign-in attempts. Please wait 15 minutes and try again.', 429, { retryAfter: Math.max(retryAfter(keys[0]), 60) });
  }
  await ensureBootstrapAdmin();
  const r = await authenticate(email, String(b.password || ''));
  if (!r.ok) return fail(r.error, 401);
  resetLimit(keys[0]);
  const remember = b.remember !== false;
  if (r.user.role === 'platform_admin' && adminNeedsCode()) {
    const c = await startChallenge({ purpose: 'admin-mfa', target: r.user.email, userId: r.user.id, name: r.user.name, ip: g.ip, data: { remember, next: b.next ?? null } });
    if (!c.ok) return fail(c.error || 'Could not send the code.', c.status || 400);
    return json({ ok: false, mfa: { challengeId: c.challengeId, resendIn: c.resendIn } });
  }
  return completeSignIn(req, r.user, 'password', { remember, next: typeof b.next === 'string' ? b.next : null });
}
