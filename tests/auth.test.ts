import { describe, eq, it, ok } from './harness';
import { authenticate, consumeToken, createSession, createToken, deleteSession, ensureBootstrapAdmin, registerUser, setPassword, toPublicUser, userForSession } from '@/lib/server/auth';
import { withDb } from '@/lib/server/db';

const consents = [{ purpose: 'terms' as const, version: 'v1' }, { purpose: 'privacy' as const, version: 'v1' }];
let userId = '';

describe('auth', () => {
  it('registers a candidate with recorded consent', async () => {
    const r = await registerUser({ name: '  Priya   Sharma ', email: 'Priya@Example.com', password: 'Blue-sky teaching 9', role: 'candidate', consents });
    ok(r.ok, !r.ok ? r.error : '');
    if (!r.ok) return;
    userId = r.user.id;
    eq(r.user.email, 'priya@example.com');
    eq(r.user.name, 'Priya Sharma');
    eq(r.user.emailVerified, false);
    eq(r.user.consents.map(c => c.purpose), ['terms', 'privacy']);
    ok(r.user.consents.every(c => !!c.givenAt));
    const pub = toPublicUser(r.user) as unknown as Record<string, unknown>;
    ok(!('passwordHash' in pub) && pub.hasPassword === true, 'hash never leaves the server');
  });
  it('rejects duplicates, weak passwords, missing consent and admin self-sign-up', async () => {
    const dup = await registerUser({ name: 'Priya S', email: 'priya@example.com', password: 'Blue-sky teaching 9', role: 'candidate', consents });
    ok(!dup.ok && dup.code === 'exists');
    ok(!(await registerUser({ name: 'Ravi', email: 'ravi@example.com', password: 'short', role: 'candidate', consents })).ok);
    ok(!(await registerUser({ name: 'Ravi', email: 'ravi@example.com', password: 'Blue-sky teaching 9', role: 'candidate', consents: [] })).ok);
    ok(!(await registerUser({ name: 'Ravi', email: 'ravi@example.com', password: 'Blue-sky teaching 9', role: 'platform_admin' as 'candidate', consents })).ok);
  });
  it('signs in by email (any case) and password; same error for unknown email', async () => {
    ok((await authenticate('PRIYA@example.com ', 'Blue-sky teaching 9')).ok);
    const wrong = await authenticate('priya@example.com', 'nope');
    const unknown = await authenticate('nobody@example.com', 'nope');
    ok(!wrong.ok && !unknown.ok && wrong.error === unknown.error);
  });
  it('creates, reads and ends sessions; only the digest is stored', async () => {
    const { token, maxAge } = await createSession(userId, { remember: true });
    eq(maxAge, 30 * 86400);
    eq((await userForSession(token))?.id, userId);
    ok(await withDb(db => !(token in db.sessions)), 'raw token not stored');
    ok(!(await userForSession('x'.repeat(43))), 'unknown token');
    await deleteSession(token);
    ok(!(await userForSession(token)));
  });
  it('expires sessions and blocks suspended accounts', async () => {
    const { token } = await createSession(userId, { remember: false });
    await withDb(db => { for (const s of Object.values(db.sessions)) if (s.userId === userId) s.expiresAt = Date.now() - 1; });
    ok(!(await userForSession(token)), 'expired');
    const t2 = (await createSession(userId)).token;
    await withDb(db => { db.users.find(u => u.id === userId)!.status = 'suspended'; });
    ok(!(await userForSession(t2)), 'suspended');
    ok(!(await authenticate('priya@example.com', 'Blue-sky teaching 9')).ok);
    await withDb(db => { db.users.find(u => u.id === userId)!.status = 'active'; });
  });
  it('link tokens work once and the newest replaces older ones', async () => {
    const a = await createToken(userId, 'reset-password');
    const b = await createToken(userId, 'reset-password');
    eq(await consumeToken(a, 'reset-password'), null, 'older token revoked');
    eq(await consumeToken(b, 'verify-email'), null, 'wrong type');
    const c = await createToken(userId, 'reset-password');
    eq(await consumeToken(c, 'reset-password'), userId);
    eq(await consumeToken(c, 'reset-password'), null, 'single use');
  });
  it('a new password signs out every device', async () => {
    const { token } = await createSession(userId);
    eq(await setPassword(userId, 'weak', userId), 'Use at least 10 characters.');
    eq(await setPassword(userId, 'Another good one 7', userId), null);
    ok(!(await userForSession(token)));
    ok((await authenticate('priya@example.com', 'Another good one 7')).ok);
  });
  it('bootstraps the first administrator from the environment, once', async () => {
    process.env.ADMIN_EMAIL = 'Admin@TheSchoolTeacher.in';
    process.env.ADMIN_INITIAL_PASSWORD = 'First admin pass 1';
    await ensureBootstrapAdmin();
    await ensureBootstrapAdmin();
    const admins = await withDb(db => db.users.filter(u => u.role === 'platform_admin'));
    eq(admins.length, 1);
    ok(admins[0].mustChangePassword && admins[0].email === 'admin@theschoolteacher.in');
    delete process.env.ADMIN_EMAIL; delete process.env.ADMIN_INITIAL_PASSWORD;
  });
});
