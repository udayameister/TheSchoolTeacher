import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role, UserAccount } from '@/types';
import { SESSION_COOKIE, homeFor, userForSession } from './auth';
import { allow, clientIp, retryAfter } from './security';

/*
 * Request helpers for API routes and server components. Every API route calls guard() first:
 *  - CSRF: state-changing requests must be same-origin (Origin / Sec-Fetch-Site) and, unless
 *    `form` is set, JSON. SameSite=Lax cookies add a second layer. (Adapted from AcadeXMatch
 *    lib/server/auth.ts sameOrigin / badOrigin.)
 *  - Authorization: the role check happens here, on the server, for every route.
 *  - Optional rate limit per IP.
 */

export const json = (data: unknown, status = 200, headers?: Record<string, string>) => NextResponse.json(data, { status, headers });
export const fail = (error: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ ok: false, error, ...extra }, { status });

export function sameOrigin(req: NextRequest): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === (req.headers.get('x-forwarded-host') || req.headers.get('host')); } catch { return false; }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PASSWORD_CHANGE_ROUTES = new Set(['/api/account/password', '/api/auth/resend-verification']);

export interface GuardOpts {
  /** Required roles; omit for routes anyone may call (still CSRF-checked). */
  roles?: Role[];
  /** Allow multipart/form-data (file uploads, CSV) instead of JSON. */
  form?: boolean;
  /** Rate limit: [max requests, window in ms] per IP and route. */
  limit?: [number, number];
}

export type Guarded = { user: UserAccount | null; ip: string; token?: string };

export async function guard(req: NextRequest, opts: GuardOpts = {}): Promise<Guarded | NextResponse> {
  if (MUTATING.has(req.method)) {
    if (!sameOrigin(req)) return fail('Not allowed.', 403);
    const type = req.headers.get('content-type')?.split(';')[0].trim();
    const okType = type === 'application/json' || (opts.form && type === 'multipart/form-data');
    if (!okType) return fail('Not allowed.', 415);
  }
  const ip = clientIp(req);
  if (opts.limit) {
    const key = `rl:${req.nextUrl.pathname}:${ip}`;
    if (!allow(key, opts.limit[0], opts.limit[1])) return fail('Too many requests. Please wait a little and try again.', 429, { retryAfter: retryAfter(key) });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await userForSession(token);
  if (opts.roles) {
    if (!user) return fail('Please sign in.', 401);
    if (!opts.roles.includes(user.role)) return fail('You do not have permission to do this.', 403);
    // An account with a password someone else set (the bootstrap administrator) may only change it.
    if (user.mustChangePassword && !PASSWORD_CHANGE_ROUTES.has(req.nextUrl.pathname)) return fail('Please choose a new password first (My account).', 403);
  }
  return { user, ip, token };
}

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;

export function isHttps(req: NextRequest): boolean {
  return req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

/** `maxAge` undefined = cookie ends when the browser closes ("keep me signed in" off). */
export function setSessionCookie(res: NextResponse, req: NextRequest, token: string, maxAge: number | undefined): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: isHttps(req) || (process.env.NODE_ENV === 'production' && !/^(localhost|127\.)/.test(req.headers.get('host') || '')),
    ...(maxAge ? { maxAge } : {}),
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest, maxBytes = 200_000): Promise<T | null> {
  const text = await req.text().catch(() => '');
  if (!text || text.length > maxBytes) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? (v as T) : null; } catch { return null; }
}

// ------------------------------------------------------------------ server components

/** Signed-in user in a server component / layout, or null. */
export async function currentUser(): Promise<UserAccount | null> {
  const jar = await cookies();
  return userForSession(jar.get(SESSION_COOKIE)?.value);
}

/** For console layouts: redirects to sign-in, or to the user's own console, unless the role matches. */
export async function requireRole(roles: Role[], nextPath: string): Promise<UserAccount> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  // A password set by someone else (the first administrator's) must be replaced before anything else.
  if (user.mustChangePassword && nextPath !== '/account') redirect('/account?change=1');
  return user;
}
