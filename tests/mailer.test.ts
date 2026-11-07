import { describe, eq, it, ok } from './harness';
import { readUnsubscribeToken, sendMail, unsubscribeToken } from '@/lib/server/mailer';
import { withDb } from '@/lib/server/db';

describe('email outbox', () => {
  it('records messages when no provider is configured', async () => {
    const r = await sendMail({ to: 'Someone@Example.com', subject: 'Hello', text: 'Body', kind: 'test' });
    eq(r.status, 'logged');
    ok(await withDb(db => db.outbox.some(o => o.id === r.id && o.to === 'someone@example.com' && o.text === 'Body')));
  });
  it('never stores the content of sensitive messages', async () => {
    const r = await sendMail({ to: 'a@example.com', subject: '123456 is your code', text: 'Code 123456', kind: 'otp', sensitive: true });
    const stored = await withDb(db => db.outbox.find(o => o.id === r.id)!);
    ok(!stored.text.includes('123456') && !stored.subject.includes('123456'));
  });
  it('signs unsubscribe links and rejects tampering', () => {
    const t = unsubscribeToken('A@Example.com', 'alerts');
    eq(readUnsubscribeToken(t), { email: 'a@example.com', list: 'alerts' });
    const [data] = t.split('.');
    eq(readUnsubscribeToken(`${data}.forged`), null);
    eq(readUnsubscribeToken(`${Buffer.from('a@example.com|news').toString('base64url')}.${t.split('.')[1]}`), null);
  });
  it('does not send bulk mail to people who unsubscribed', async () => {
    await withDb(db => { db.suppressed.push('digest:gone@example.com'); });
    const r = await sendMail({ to: 'gone@example.com', subject: 'Digest', text: 'x', kind: 'digest', list: 'digest' });
    eq(r.lastError, 'unsubscribed');
    ok(await withDb(db => !db.outbox.some(o => o.to === 'gone@example.com')));
  });
});
