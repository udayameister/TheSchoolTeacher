import { describe, eq, it, ok } from './harness';
import { digest, hashPassword, needsRehash, passwordProblem, safeNext, verifyPassword, maskIp, sign } from '@/lib/server/security';
import { parseCsv, toCsvRow } from '@/lib/csv';
import { checkClaims } from '@/lib/server/oidc';

describe('security', () => {
  it('hashes with PBKDF2-SHA256 and verifies', async () => {
    const h = await hashPassword('Correct horse 42');
    ok(h.startsWith('pbkdf2_sha256$2000$'), h);
    ok(await verifyPassword('Correct horse 42', h));
    ok(!(await verifyPassword('correct horse 42', h)), 'case matters');
    ok(!(await verifyPassword('anything', undefined)), 'missing hash fails');
    ok((await hashPassword('Correct horse 42')) !== h, 'salted');
  });
  it('asks to re-hash weaker hashes', () => {
    ok(needsRehash('pbkdf2_sha256$1000$a$b'));
    ok(!needsRehash('pbkdf2_sha256$2000$a$b'));
  });
  it('enforces the password policy', () => {
    ok(passwordProblem('short1'));
    ok(passwordProblem('onlyletterslong'));
    ok(passwordProblem('password12345'));
    ok(passwordProblem('ravikumar2026x', 'ravikumar@example.com'));
    eq(passwordProblem('Blue-sky teaching 9'), null);
  });
  it('blocks open redirects', () => {
    eq(safeNext('/candidate'), '/candidate');
    eq(safeNext('//evil.example'), null);
    eq(safeNext('https://evil.example'), null);
    eq(safeNext('/\\evil'), null);
  });
  it('digests, masks IPs and signs', () => {
    eq(digest('abc').length, 64);
    eq(maskIp('203.0.113.45'), '203.0.x.x');
    ok(sign('x', 'a') !== sign('x', 'b'));
  });
  it('parses and writes CSV safely', () => {
    eq(parseCsv('code,name\r\nA,"Hello, ""world"""\nB,Two\n'), [['code', 'name'], ['A', 'Hello, "world"'], ['B', 'Two']]);
    eq(toCsvRow(['=HYPERLINK("x")', 'a,b', 1]), `"'=HYPERLINK(""x"")","a,b",1`);
  });
  it('checks Google ID-token claims', () => {
    const now = Date.now();
    const base = { iss: 'https://accounts.google.com', aud: 'test-client.apps.googleusercontent.com', exp: Math.floor(now / 1000) + 600, iat: Math.floor(now / 1000), nonce: 'n1', sub: '123' };
    checkClaims(base, 'n1', now);
    const bad = (c: Record<string, unknown>, n = 'n1') => { try { checkClaims({ ...base, ...c }, n, now); return false; } catch { return true; } };
    ok(bad({ iss: 'https://evil.example' }), 'issuer');
    ok(bad({ aud: 'other' }), 'audience');
    ok(bad({ exp: Math.floor(now / 1000) - 3600 }), 'expired');
    ok(bad({}, 'n2'), 'nonce');
    ok(bad({ sub: '' }), 'subject');
  });
});
