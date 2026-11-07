import { NextRequest } from 'next/server';
import { describe, eq, it, ok } from './harness';
import { guard, isResponse } from '@/lib/server/http';
import { createSession, registerUser, SESSION_COOKIE } from '@/lib/server/auth';

const consents = [{ purpose: 'terms' as const, version: 'v1' }, { purpose: 'privacy' as const, version: 'v1' }];
const req = (method: string, headers: Record<string, string> = {}, path = '/api/x') =>
  new NextRequest(`http://localhost:3000${path}`, { method, headers: { host: 'localhost:3000', ...headers }, ...(method === 'GET' ? {} : { body: '{}' }) });
const status = async (p: ReturnType<typeof guard>) => { const r = await p; return isResponse(r) ? r.status : 200; };

describe('server-side guards', () => {
  it('rejects cross-site and non-JSON writes (CSRF)', async () => {
    eq(await status(guard(req('POST', { origin: 'https://evil.example', 'content-type': 'application/json' }))), 403);
    eq(await status(guard(req('POST', { 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' }))), 403);
    eq(await status(guard(req('POST', { origin: 'http://localhost:3000', 'content-type': 'text/plain' }))), 415);
    eq(await status(guard(req('POST', { origin: 'http://localhost:3000', 'content-type': 'application/json' }))), 200);
  });
  it('enforces roles on the server', async () => {
    eq(await status(guard(req('GET'), { roles: ['platform_admin'] })), 401);
    const r = await registerUser({ name: 'Guard Test', email: 'guard@example.com', password: 'Blue-sky teaching 9', role: 'candidate', consents });
    ok(r.ok);
    if (!r.ok) return;
    const { token } = await createSession(r.user.id);
    const cookie = { cookie: `${SESSION_COOKIE}=${token}` };
    eq(await status(guard(req('GET', cookie), { roles: ['platform_admin'] })), 403);
    eq(await status(guard(req('GET', cookie), { roles: ['candidate'] })), 200);
  });
  it('rate-limits per IP', async () => {
    const h = { 'x-forwarded-for': '9.9.9.9' };
    for (let i = 0; i < 3; i++) eq(await status(guard(req('GET', h, '/api/limited'), { limit: [3, 60_000] })), 200);
    eq(await status(guard(req('GET', h, '/api/limited'), { limit: [3, 60_000] })), 429);
  });
});
