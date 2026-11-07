import { createHash, createHmac, pbkdf2, randomBytes, randomInt, timingSafeEqual } from 'crypto';

/*
 * Server-side security helpers: PBKDF2-SHA256 password hashing, token digests, one-time codes, an
 * in-memory request limiter and request-origin helpers. Adapted from AcadeXMatch
 * lib/server/security.ts (token digests, limiter, clientIp, publicOrigin, safeNext); the password
 * hash is PBKDF2-SHA256 here, as the spec asks. Nothing here logs secrets.
 */

// ------------------------------------------------------------------ passwords (PBKDF2-HMAC-SHA256)

/** OWASP (2023) recommends 600,000 iterations for PBKDF2-HMAC-SHA256. Tests may lower it with PBKDF2_ITERATIONS. */
const iterations = () => {
  const n = Number(process.env.PBKDF2_ITERATIONS);
  return Number.isInteger(n) && n >= 1000 ? n : 600_000;
};
const KEYLEN = 32;

function derive(password: string, salt: Buffer, iter: number, keylen = KEYLEN): Promise<Buffer> {
  return new Promise((resolve, reject) => pbkdf2(password.normalize('NFKC'), salt, iter, keylen, 'sha256', (e, k) => (e ? reject(e) : resolve(k))));
}

/** "pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const iter = iterations();
  const key = await derive(password, salt, iter);
  return ['pbkdf2_sha256', iter, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const [tag, iter, salt, hash] = String(stored || '').split('$');
  if (tag !== 'pbkdf2_sha256' || !salt || !hash || !(Number(iter) >= 1000)) {
    // Spend comparable time so a missing account cannot be told apart by timing.
    await derive(password, randomBytes(16), Math.min(iterations(), 600_000));
    return false;
  }
  const want = Buffer.from(hash, 'base64');
  const got = await derive(password, Buffer.from(salt, 'base64'), Number(iter), want.length);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** True when a stored hash uses fewer iterations than today's setting (re-hash after a successful sign-in). */
export function needsRehash(stored: string): boolean {
  const [tag, iter] = stored.split('$');
  return tag !== 'pbkdf2_sha256' || Number(iter) < iterations();
}

/** Password rules shown on the sign-up form: at least 10 characters, a letter and a digit, not the email. */
export function passwordProblem(password: string, email = ''): string | null {
  if (password.length < 10) return 'Use at least 10 characters.';
  if (password.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use at least one letter and one number.';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return 'Do not use your email address in the password.';
  if (/^(password|qwerty|12345|abc123|letmein|welcome|india)/i.test(password)) return 'This password is too easy to guess.';
  return null;
}

// ------------------------------------------------------------------ tokens

/** Only this digest of a session token or link token is stored. */
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Keyed digest (HMAC) for short secrets like 6-digit codes, so a database copy cannot be brute-forced offline. */
export function keyedDigest(value: string, purpose: string): string {
  return createHmac('sha256', serverSecret()).update(`${purpose}:${value}`).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function randomDigits(length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String(randomInt(0, 10));
  return s;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** HMAC signature for links that must not be forged (unsubscribe, OAuth state). */
export function sign(data: string, purpose: string): string {
  return createHmac('sha256', serverSecret()).update(`${purpose}:${data}`).digest('base64url');
}

/**
 * Secret for signing. Set AUTH_SECRET (32+ characters) in production; without it a random
 * per-process secret is used, so pending sign-in codes and links stop working after a restart.
 */
const g = globalThis as unknown as { __tstSecret?: string };
export function serverSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (!g.__tstSecret) {
    g.__tstSecret = randomBytes(32).toString('hex');
    if (process.env.NODE_ENV === 'production') console.warn('[TheSchoolTeacher] AUTH_SECRET is not set (or shorter than 32 characters). Using a temporary secret.');
  }
  return g.__tstSecret;
}

// ------------------------------------------------------------------ request limits

interface Bucket { n: number; reset: number }
const buckets = ((globalThis as unknown as { __tstLimits?: Map<string, Bucket> }).__tstLimits ||= new Map());

/** Counts one attempt for `key`; false when more than `max` happened within `windowMs`. In memory, per server process. */
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 50_000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  b.n++;
  return b.n <= max;
}

export function retryAfter(key: string): number {
  const b = buckets.get(key);
  return b && b.reset > Date.now() ? Math.ceil((b.reset - Date.now()) / 1000) : 0;
}

export function resetLimit(key: string): void { buckets.delete(key); }

// ------------------------------------------------------------------ request helpers

interface HeaderSource { headers: { get(name: string): string | null } }

/** Caller's IP behind Cloudflare / the host's proxy (the last X-Forwarded-For hop; earlier ones can be forged). */
export function clientIp(req: HeaderSource): string {
  const xff = req.headers.get('x-forwarded-for')?.split(',').map(s => s.trim()).filter(Boolean);
  return (req.headers.get('cf-connecting-ip') || xff?.[xff.length - 1] || req.headers.get('x-real-ip') || 'local').trim().slice(0, 64);
}

/** IP with the last two octets hidden, for storage (enough to spot abuse, less personal data). */
export function maskIp(ip: string): string {
  return ip.replace(/(\d+\.\d+)\.\d+\.\d+$/, '$1.x.x').replace(/^([0-9a-f]+:[0-9a-f]+:[0-9a-f]+):.*$/i, '$1::');
}

/** Public address of the site for links and redirects (APP_URL, or its www / bare twin the browser used). */
export function publicOrigin(req: HeaderSource & { nextUrl?: { origin: string } }): string {
  const app = (process.env.APP_URL || '').replace(/\/$/, '');
  let appHost = '', proto = 'https:';
  try { if (app) { const u = new URL(app); appHost = u.host.toLowerCase(); proto = u.protocol; } } catch { /* invalid APP_URL */ }
  const seen = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim().toLowerCase();
  if (appHost && seen) {
    const bare = (h: string) => h.replace(/^www\./, '');
    if (seen === appHost || bare(seen) === bare(appHost)) return `${proto}//${seen}`;
  }
  if (app) return app;
  return req.nextUrl?.origin || 'http://localhost:3000';
}

/** Short description of the browser for security emails ("Chrome on Android"). */
export function deviceLabel(ua: string | null): string {
  const s = ua || '';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'A browser';
  const os = /Windows/.test(s) ? 'Windows' : /Android/.test(s) ? 'Android' : /iPhone|iPad|iOS/.test(s) ? 'iOS' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : 'an unknown device';
  return `${browser} on ${os}`;
}

/** Same-site relative path only (prevents open redirects through ?next=). */
export function safeNext(next: string | null | undefined): string | null {
  const n = String(next || '');
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n.slice(0, 500) : null;
}

export function isEmail(v: string): boolean {
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}
