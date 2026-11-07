import { NextResponse, type NextRequest } from 'next/server';
import { consumeToken, markEmailVerified } from '@/lib/server/auth';
import { allow, clientIp, publicOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Link from the confirmation email. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  if (!allow(`verify:${clientIp(req)}`, 30, 15 * 60_000)) return NextResponse.redirect(new URL('/verify-email?status=busy', origin));
  const userId = await consumeToken(req.nextUrl.searchParams.get('token') || '', 'verify-email');
  const ok = userId ? !!(await markEmailVerified(userId)) : false;
  return NextResponse.redirect(new URL(`/verify-email?status=${ok ? 'ok' : 'invalid'}`, origin));
}
