import { NextResponse, type NextRequest } from 'next/server';
import { googleConfigured, startFlow, STATE_COOKIE } from '@/lib/server/oidc';
import { allow, clientIp, publicOrigin, safeNext } from '@/lib/server/security';
import { isHttps } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  if (!googleConfigured()) return NextResponse.redirect(new URL('/login?oauth_error=unavailable', origin));
  if (!allow(`oauth-start:${clientIp(req)}`, 30, 15 * 60_000)) return NextResponse.redirect(new URL('/login?oauth_error=busy', origin));
  const q = req.nextUrl.searchParams;
  try {
    const { url, cookie } = await startFlow({ next: safeNext(q.get('next')), role: q.get('role') === 'school_admin' ? 'school_admin' : 'candidate', origin });
    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, cookie, { httpOnly: true, sameSite: 'lax', secure: isHttps(req) || origin.startsWith('https:'), path: '/api/auth/google', maxAge: 600 });
    return res;
  } catch (e) {
    console.error('[TheSchoolTeacher] Google sign-in could not start:', (e as Error).message);
    return NextResponse.redirect(new URL('/login?oauth_error=provider', origin));
  }
}
