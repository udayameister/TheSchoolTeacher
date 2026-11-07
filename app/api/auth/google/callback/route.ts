import { NextResponse, type NextRequest } from 'next/server';
import { createSession, findByEmail, homeFor, registerUser } from '@/lib/server/auth';
import { decodeState, finishFlow, googleConfigured, STATE_COOKIE } from '@/lib/server/oidc';
import { allow, clientIp, deviceLabel, maskIp, publicOrigin, safeEqual, safeNext } from '@/lib/server/security';
import { setSessionCookie } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Return from Google. Rules (same as AcadeXMatch app/api/auth/oauth/[provider]/callback):
 *  - an account already linked to this Google subject is signed in;
 *  - an existing account with the same email is NOT merged automatically: the person signs in the
 *    usual way first (proves they own the account);
 *  - otherwise a new account is created. Continuing with Google on the sign-up page counts as
 *    accepting the Terms and Privacy Policy shown next to the button.
 */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const go = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    res.cookies.set(STATE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });
    return res;
  };
  if (!googleConfigured()) return go('/login?oauth_error=unavailable');
  if (!allow(`oauth-cb:${clientIp(req)}`, 30, 15 * 60_000)) return go('/login?oauth_error=busy');
  const q = req.nextUrl.searchParams;
  if (q.get('error')) return go(`/login?oauth_error=${q.get('error') === 'access_denied' ? 'cancelled' : 'provider'}`);
  const st = decodeState(req.cookies.get(STATE_COOKIE)?.value);
  const code = q.get('code');
  if (!st || !code || !safeEqual(String(q.get('state') || ''), st.state)) return go('/login?oauth_error=state');

  let id;
  try { id = await finishFlow(code, st); } catch (e) {
    console.error('[TheSchoolTeacher] Google sign-in failed:', (e as Error).message);
    return go('/login?oauth_error=provider');
  }

  let user = await withDb(db => db.users.find(u => u.identities?.some(i => i.provider === 'google' && i.subject === id.subject)));
  if (!user) {
    if (!id.email || !id.emailVerified) return go('/login?oauth_error=noemail');
    if (await withDb(db => !!findByEmail(db, id.email!))) return go('/login?oauth_error=exists');
    const r = await registerUser({
      name: id.name || id.email.split('@')[0], email: id.email, role: st.role, emailVerified: true,
      identity: { provider: 'google', subject: id.subject, email: id.email, linkedAt: new Date().toISOString() },
      consents: [{ purpose: 'terms', version: TERMS_VERSION }, { purpose: 'privacy', version: PRIVACY_VERSION }], ip: maskIp(clientIp(req)),
    });
    if (!r.ok) return go('/login?oauth_error=provider');
    user = r.user;
  }
  if (user.status !== 'active') return go('/login?oauth_error=suspended');
  const { token, maxAge } = await createSession(user.id, { remember: true, device: deviceLabel(req.headers.get('user-agent')), ip: maskIp(clientIp(req)), method: 'Google' });
  const res = go(safeNext(st.next) || homeFor(user.role));
  setSessionCookie(res, req, token, maxAge);
  return res;
}
