import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, readJson } from '@/lib/server/http';
import { createToken, registerUser, type SelfServiceRole } from '@/lib/server/auth';
import { sendVerificationEmail } from '@/lib/server/authEmails';
import { completeSignIn } from '@/lib/server/signin';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/site';
import { maskIp } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Self sign-up for candidates and school administrators. School accounts stay unverified until the admin checks the UDISE+ code (Phase 3). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { limit: [10, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const role: SelfServiceRole = b.role === 'school_admin' ? 'school_admin' : 'candidate';
  if (b.acceptTerms !== true || b.acceptPrivacy !== true) return fail('Please accept the Terms and the Privacy Policy.');
  const consents = [
    { purpose: 'terms' as const, version: TERMS_VERSION },
    { purpose: 'privacy' as const, version: PRIVACY_VERSION },
    ...(role === 'candidate' && b.consentMatching === true ? [{ purpose: 'matching' as const, version: PRIVACY_VERSION }] : []),
  ];
  const r = await registerUser({
    name: String(b.name || ''), email: String(b.email || ''), password: String(b.password || ''), role, consents,
    locale: b.locale === 'hi' ? 'hi' : 'en', ip: maskIp(g.ip),
  });
  if (!r.ok) return fail(r.error, r.code === 'exists' ? 409 : 400);
  const token = await createToken(r.user.id, 'verify-email');
  await sendVerificationEmail(r.user.email, r.user.name, token);
  return completeSignIn(req, r.user, 'registration', { next: typeof b.next === 'string' ? b.next : null });
}
