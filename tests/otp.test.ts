import { describe, eq, it, ok } from './harness';
import { startChallenge, verifyChallenge } from '@/lib/server/otp';
import { resetLimit } from '@/lib/server/security';

let lastCode = '';
const send = async (_to: string, _n: string, code: string) => { lastCode = code; return { status: 'logged' }; };

describe('email sign-in codes', () => {
  it('sends a 6-digit code that works once', async () => {
    const r = await startChallenge({ purpose: 'login', target: 'otp1@example.com', userId: 'usr_1', ip: '1.1.1.1', send });
    ok(r.ok && r.challengeId);
    eq(lastCode.length, 6);
    ok(!(await verifyChallenge(r.challengeId!, lastCode, 'admin-mfa')).ok, 'purpose must match');
    const v = await verifyChallenge(r.challengeId!, lastCode, 'login');
    ok(v.ok && v.userId === 'usr_1');
    ok(!(await verifyChallenge(r.challengeId!, lastCode, 'login')).ok, 'single use');
  });
  it('enforces the resend wait', async () => {
    ok((await startChallenge({ purpose: 'login', target: 'otp3@example.com', ip: '1.1.1.1', send })).ok);
    const r = await startChallenge({ purpose: 'login', target: 'otp3@example.com', ip: '1.1.1.1', send });
    ok(!r.ok && (r.resendIn || 0) > 0);
  });
  it('cancels after 5 wrong codes', async () => {
    const r = await startChallenge({ purpose: 'login', target: 'otp2@example.com', userId: 'usr_2', ip: '1.1.1.2', send });
    const wrong = lastCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) ok(/left/.test((await verifyChallenge(r.challengeId!, wrong, 'login')).error || ''));
    ok(/Too many/.test((await verifyChallenge(r.challengeId!, wrong, 'login')).error || ''));
    ok(!(await verifyChallenge(r.challengeId!, lastCode, 'login')).ok, 'cancelled even with the right code');
  });
  it('decoys for unknown addresses send nothing and never verify', async () => {
    lastCode = '';
    resetLimit('otp:ip:1.1.1.3');
    const r = await startChallenge({ purpose: 'login', target: 'ghost@example.com', ip: '1.1.1.3', decoy: true, send });
    ok(r.ok && r.challengeId, 'same answer as a real address');
    eq(lastCode, '', 'nothing sent');
    ok(!(await verifyChallenge(r.challengeId!, '123456', 'login')).ok);
  });
});
