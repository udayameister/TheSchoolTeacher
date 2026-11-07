import { createHash, createPublicKey, verify as verifySig, type JsonWebKey } from 'crypto';
import { randomToken, safeEqual, sign } from './security';

/*
 * "Continue with Google": OpenID Connect authorization-code flow with PKCE (S256), state and nonce.
 * Adapted from AcadeXMatch lib/server/oidc.ts (Google part): the ID token is checked here (RS256
 * signature against Google's published keys, issuer, audience, expiry, nonce). Accounts are keyed by
 * Google's stable subject id, never by email alone.
 *
 * Offered only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. Redirect URI to register in the
 * Google Cloud console: <APP_URL>/api/auth/google/callback
 */

const DISCOVERY = () => process.env.GOOGLE_DISCOVERY_URL || 'https://accounts.google.com/.well-known/openid-configuration';
const clientId = () => process.env.GOOGLE_CLIENT_ID || '';
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET || '';

export const googleConfigured = () => !!(clientId() && clientSecret());

export function redirectUri(origin: string): string {
  return `${(process.env.OAUTH_REDIRECT_BASE || origin).replace(/\/$/, '')}/api/auth/google/callback`;
}

interface Discovery { authorization_endpoint: string; token_endpoint: string; jwks_uri: string }
const cache = ((globalThis as unknown as { __tstOidc?: Map<string, { at: number; value: unknown }> }).__tstOidc ||= new Map());

async function getJson<T>(url: string, maxAgeMs = 3600_000, force = false): Promise<T> {
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.at < maxAgeMs) return hit.value as T;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`${new URL(url).host} returned ${r.status}`);
    const value = await r.json();
    cache.set(url, { at: Date.now(), value });
    return value as T;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------ signed state cookie

export const STATE_COOKIE = 'tst_oauth';
export interface FlowState { state: string; nonce: string; verifier: string; next: string | null; role: 'candidate' | 'school_admin'; t: number; ru: string }

export function encodeState(s: FlowState): string {
  const data = Buffer.from(JSON.stringify(s)).toString('base64url');
  return `${data}.${sign(data, 'oauth')}`;
}

export function decodeState(cookie: string | undefined): FlowState | null {
  if (!cookie) return null;
  const [data, sig] = cookie.split('.');
  if (!data || !sig || !safeEqual(sign(data, 'oauth'), sig)) return null;
  try {
    const s = JSON.parse(Buffer.from(data, 'base64url').toString()) as FlowState;
    return Date.now() - s.t < 10 * 60_000 ? s : null;
  } catch {
    return null;
  }
}

export async function startFlow(opts: { next: string | null; role: 'candidate' | 'school_admin'; origin: string }): Promise<{ url: string; cookie: string }> {
  const d = await getJson<Discovery>(DISCOVERY());
  const st: FlowState = { state: randomToken(24), nonce: randomToken(24), verifier: randomToken(48), next: opts.next, role: opts.role, t: Date.now(), ru: redirectUri(opts.origin) };
  const params = new URLSearchParams({
    client_id: clientId(), response_type: 'code', redirect_uri: st.ru, scope: 'openid email profile',
    state: st.state, nonce: st.nonce, code_challenge: createHash('sha256').update(st.verifier).digest('base64url'), code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return { url: `${d.authorization_endpoint}?${params}`, cookie: encodeState(st) };
}

// ------------------------------------------------------------------ token exchange & ID-token checks

export interface GoogleIdentity { subject: string; email: string | null; emailVerified: boolean; name: string }

const b64json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString()) as Record<string, unknown>;

/** Claim checks (separate so the tests can exercise them). Throws on any problem. */
export function checkClaims(claims: Record<string, unknown>, nonce: string, now = Date.now()): void {
  const sec = Math.floor(now / 1000);
  const iss = String(claims.iss || '');
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') throw new Error('wrong issuer');
  const aud = claims.aud;
  const id = clientId();
  if (!(aud === id || (Array.isArray(aud) && aud.includes(id) && claims.azp === id))) throw new Error('wrong audience');
  if (typeof claims.exp !== 'number' || claims.exp < sec - 60) throw new Error('token expired');
  if (typeof claims.iat === 'number' && claims.iat > sec + 300) throw new Error('token issued in the future');
  if (!nonce || typeof claims.nonce !== 'string' || !safeEqual(claims.nonce, nonce)) throw new Error('nonce mismatch');
  if (!claims.sub || typeof claims.sub !== 'string') throw new Error('no subject');
}

async function verifyIdToken(idToken: string, nonce: string): Promise<Record<string, unknown>> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const header = b64json(parts[0]);
  const claims = b64json(parts[1]);
  if (header.alg !== 'RS256') throw new Error('unexpected signing algorithm');
  const d = await getJson<Discovery>(DISCOVERY());
  let jwks = await getJson<{ keys: (JsonWebKey & { kid?: string })[] }>(d.jwks_uri);
  let jwk = jwks.keys.find(k => k.kid === header.kid);
  if (!jwk) { jwks = await getJson(d.jwks_uri, 0, true); jwk = jwks.keys.find(k => k.kid === header.kid); }
  if (!jwk) throw new Error('signing key not found');
  const key = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
  if (!verifySig('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'))) throw new Error('bad signature');
  checkClaims(claims, nonce);
  return claims;
}

export async function finishFlow(code: string, st: FlowState): Promise<GoogleIdentity> {
  const d = await getJson<Discovery>(DISCOVERY());
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let tok: { id_token?: string; error?: string };
  try {
    const r = await fetch(d.token_endpoint, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: st.ru, client_id: clientId(), client_secret: clientSecret(), code_verifier: st.verifier }).toString(),
    });
    tok = await r.json().catch(() => ({}));
    if (!r.ok || !tok.id_token) throw new Error(`token exchange failed (${r.status} ${tok.error || ''})`);
  } finally {
    clearTimeout(timer);
  }
  const c = await verifyIdToken(tok.id_token!, st.nonce);
  const email = typeof c.email === 'string' ? c.email.toLowerCase() : null;
  return { subject: String(c.sub), email, emailVerified: !!email && (c.email_verified === true || c.email_verified === 'true'), name: String(c.name || '') };
}
