import { NextResponse, type NextRequest } from 'next/server';
import type { UserAccount } from '@/types';
import { createSession, homeFor, toPublicUser } from './auth';
import { setSessionCookie } from './http';
import { clientIp, deviceLabel, maskIp, safeNext } from './security';

/** Creates a session, sets the cookie and answers with where to go next. */
export async function completeSignIn(req: NextRequest, user: UserAccount, method: string, opts: { remember?: boolean; next?: string | null } = {}): Promise<NextResponse> {
  const { token, maxAge } = await createSession(user.id, { remember: opts.remember, device: deviceLabel(req.headers.get('user-agent')), ip: maskIp(clientIp(req)), method });
  const next = user.mustChangePassword ? '/account?change=1' : safeNext(opts.next) || homeFor(user.role);
  const res = NextResponse.json({ ok: true, user: toPublicUser(user), next });
  setSessionCookie(res, req, token, maxAge);
  return res;
}
