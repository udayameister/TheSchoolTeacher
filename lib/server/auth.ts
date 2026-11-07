import type { ConsentRecord, LinkedIdentity, PublicUser, Role, Session, TokenType, UserAccount } from '@/types';
import { audit, newId, nowIso, withDb, type Store } from './db';
import { digest, hashPassword, isEmail, needsRehash, passwordProblem, randomToken, verifyPassword } from './security';

/*
 * Accounts, sessions and one-time link tokens. Framework-free so the tests can run it directly.
 * Adapted from AcadeXMatch lib/server/db.ts (sessions stored under the SHA-256 digest of the cookie
 * value, 30-day / 12-hour lifetimes) and lib/server/mailer.ts (one-time tokens). Never call these
 * from inside another withDb() callback: withDb runs one operation at a time.
 */

export const SESSION_COOKIE = 'tst_session';
const LONG_SESSION_DAYS = 30;
const SHORT_SESSION_HOURS = 12;

export function toPublicUser(u: UserAccount): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, identities, ...rest } = u;
  return { ...rest, hasPassword: !!passwordHash, linkedProviders: (identities || []).map(i => i.provider) };
}

export const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase().slice(0, 254);
export const findByEmail = (db: Store, email: string) => db.users.find(u => u.email === normEmail(email));
export const findById = (db: Store, id: string | null | undefined) => (id ? db.users.find(u => u.id === id) : undefined);

// ------------------------------------------------------------------ registration & sign-in

export type SelfServiceRole = Extract<Role, 'candidate' | 'school_admin'>;

export interface RegisterInput {
  name: string;
  email: string;
  password?: string;
  role: SelfServiceRole;
  consents: Omit<ConsentRecord, 'givenAt'>[];
  emailVerified?: boolean;
  identity?: LinkedIdentity;
  locale?: 'en' | 'hi';
  ip?: string;
}

export type RegisterResult = { ok: true; user: UserAccount } | { ok: false; error: string; code?: 'exists' | 'invalid' };

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const email = normEmail(input.email);
  const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!isEmail(email)) return { ok: false, error: 'Enter a valid email address.', code: 'invalid' };
  if (name.length < 2) return { ok: false, error: 'Enter your name.', code: 'invalid' };
  if (input.role !== 'candidate' && input.role !== 'school_admin') return { ok: false, error: 'Choose an account type.', code: 'invalid' };
  if (!input.consents.some(c => c.purpose === 'terms') || !input.consents.some(c => c.purpose === 'privacy')) {
    return { ok: false, error: 'Please accept the Terms and the Privacy Policy.', code: 'invalid' };
  }
  let passwordHash = '';
  if (input.password !== undefined) {
    const problem = passwordProblem(input.password, email);
    if (problem) return { ok: false, error: problem, code: 'invalid' };
    passwordHash = await hashPassword(input.password);
  }
  return withDb(db => {
    if (findByEmail(db, email)) return { ok: false as const, error: 'An account with this email already exists. Sign in instead.', code: 'exists' as const };
    const at = nowIso();
    const user: UserAccount = {
      id: newId('usr'), email, name, role: input.role, status: 'active', emailVerified: !!input.emailVerified, passwordHash,
      schoolId: null, identities: input.identity ? [input.identity] : [],
      consents: input.consents.map(c => ({ ...c, givenAt: at })), locale: input.locale || 'en', createdAt: at, lastLoginAt: null,
    };
    db.users.push(user);
    audit(db, { actorId: user.id, action: 'account.register', target: user.id, detail: input.role, ip: input.ip });
    return { ok: true as const, user };
  });
}

export type LoginResult = { ok: true; user: UserAccount } | { ok: false; error: string };

/** Checks email + password. The same message is returned for an unknown email and a wrong password. */
export async function authenticate(emailRaw: string, password: string): Promise<LoginResult> {
  const email = normEmail(emailRaw);
  const user = await withDb(db => findByEmail(db, email));
  const ok = await verifyPassword(String(password || '').slice(0, 256), user?.passwordHash);
  if (!user || !ok) return { ok: false, error: 'Incorrect email or password.' };
  if (user.status === 'suspended') return { ok: false, error: 'This account is suspended. Contact support.' };
  if (needsRehash(user.passwordHash)) {
    const fresh = await hashPassword(password);
    await withDb(db => { const u = findById(db, user.id); if (u) u.passwordHash = fresh; });
  }
  return { ok: true, user };
}

export async function setPassword(userId: string, password: string, actorId: string | null, ip?: string): Promise<string | null> {
  const user = await withDb(db => findById(db, userId));
  if (!user) return 'Account not found.';
  const problem = passwordProblem(password, user.email);
  if (problem) return problem;
  const hash = await hashPassword(password);
  await withDb(db => {
    const u = findById(db, userId);
    if (!u) return;
    u.passwordHash = hash;
    u.mustChangePassword = false;
    // A new password signs out every other device.
    for (const [k, s] of Object.entries(db.sessions)) if (s.userId === userId) delete db.sessions[k];
    for (const [k, t] of Object.entries(db.tokens)) if (t.userId === userId && t.type === 'reset-password') delete db.tokens[k];
    audit(db, { actorId, action: 'account.password_set', target: userId, ip });
  });
  return null;
}

/**
 * Creates the first platform administrator from ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD when no
 * administrator exists yet. The password must be changed at first sign-in.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const email = normEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_INITIAL_PASSWORD || '';
  if (!email || !password) return;
  const exists = await withDb(db => db.users.some(u => u.role === 'platform_admin'));
  if (exists) return;
  const hash = await hashPassword(password);
  await withDb(db => {
    if (db.users.some(u => u.role === 'platform_admin')) return;
    const existing = findByEmail(db, email);
    if (existing) { existing.role = 'platform_admin'; existing.mustChangePassword = true; existing.passwordHash = hash; return; }
    const at = nowIso();
    db.users.push({
      id: newId('usr'), email, name: 'Platform administrator', role: 'platform_admin', status: 'active', emailVerified: true,
      passwordHash: hash, mustChangePassword: true, consents: [], createdAt: at, lastLoginAt: null,
    });
    audit(db, { actorId: null, action: 'account.bootstrap_admin', target: email });
  });
}

// ------------------------------------------------------------------ sessions

export async function createSession(userId: string, meta: { remember?: boolean; device?: string; ip?: string; method?: string } = {}): Promise<{ token: string; maxAge: number | undefined }> {
  const token = randomToken(32);
  const remember = meta.remember !== false;
  const life = remember ? LONG_SESSION_DAYS * 86400 : SHORT_SESSION_HOURS * 3600;
  await withDb(db => {
    const now = Date.now();
    for (const [k, s] of Object.entries(db.sessions)) if (s.expiresAt < now) delete db.sessions[k];
    db.sessions[digest(token)] = { userId, createdAt: now, expiresAt: now + life * 1000, lastSeen: now, device: meta.device, ip: meta.ip, method: meta.method };
    const u = findById(db, userId);
    if (u) u.lastLoginAt = nowIso();
    audit(db, { actorId: userId, action: 'auth.sign_in', target: userId, detail: meta.method, ip: meta.ip });
  });
  return { token, maxAge: remember ? life : undefined };
}

const SEEN_EVERY_MS = 10 * 60_000;

/** The signed-in, active user for a session cookie value, or null. */
export async function userForSession(token: string | undefined): Promise<UserAccount | null> {
  if (!token || token.length < 32 || token.length > 200) return null;
  return withDb(db => {
    const key = digest(token);
    const s: Session | undefined = db.sessions[key];
    if (!s) return null;
    if (s.expiresAt < Date.now()) { delete db.sessions[key]; return null; }
    const u = findById(db, s.userId);
    if (!u || u.status !== 'active') return null;
    if (Date.now() - s.lastSeen > SEEN_EVERY_MS) s.lastSeen = Date.now();
    return u;
  });
}

export function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return Promise.resolve();
  return withDb(db => { delete db.sessions[digest(token)]; });
}

/** Signs the user out everywhere except (optionally) the current session. */
export function revokeSessions(userId: string, keepToken?: string): Promise<number> {
  const keep = keepToken ? digest(keepToken) : null;
  return withDb(db => {
    let n = 0;
    for (const [k, s] of Object.entries(db.sessions)) if (s.userId === userId && k !== keep) { delete db.sessions[k]; n++; }
    return n;
  });
}

// ------------------------------------------------------------------ one-time link tokens

const TOKEN_HOURS: Record<TokenType, number> = { 'verify-email': 72, 'reset-password': 0.5, 'verify-school-email': 72 };

/** Creates a link token; any earlier token of the same type for this user stops working. Only its digest is stored. */
export function createToken(userId: string, type: TokenType, data?: string): Promise<string> {
  const token = randomToken(32);
  return withDb(db => {
    const now = Date.now();
    for (const [k, t] of Object.entries(db.tokens)) if (t.expiresAt < now || (t.userId === userId && t.type === type && t.data === data)) delete db.tokens[k];
    db.tokens[digest(token)] = { userId, type, expiresAt: now + TOKEN_HOURS[type] * 3600_000, ...(data ? { data } : {}) };
    return token;
  });
}

/** Uses up a token. Returns the user id (and stored data) when it was valid. */
export function consumeTokenData(token: string, type: TokenType): Promise<{ userId: string; data?: string } | null> {
  if (!token || token.length > 200) return Promise.resolve(null);
  return withDb(db => {
    const key = digest(token);
    const t = db.tokens[key];
    if (!t || t.type !== type) return null;
    delete db.tokens[key];
    return t.expiresAt >= Date.now() ? { userId: t.userId, data: t.data } : null;
  });
}

export async function consumeToken(token: string, type: TokenType): Promise<string | null> {
  return (await consumeTokenData(token, type))?.userId ?? null;
}

export function markEmailVerified(userId: string): Promise<UserAccount | null> {
  return withDb(db => {
    const u = findById(db, userId);
    if (!u) return null;
    if (!u.emailVerified) { u.emailVerified = true; audit(db, { actorId: userId, action: 'account.email_verified', target: userId }); }
    return u;
  });
}

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  return role === 'platform_admin' ? '/admin' : role === 'candidate' ? '/candidate' : '/school';
}
