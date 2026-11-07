import { describe, eq, it, ok } from './harness';
import { withDb } from '@/lib/server/db';
import { registerUser } from '@/lib/server/auth';
import { applyToJob, withdrawApplication } from '@/lib/server/applications';
import { cleanProfile, completeness, emptyProfile } from '@/lib/server/profile';
import { addTracked, updateTracked } from '@/lib/server/tracker';
import { collectDue, saveAlert } from '@/lib/server/alerts';
import { eraseAccount, exportData, setMatchingConsent } from '@/lib/server/privacy';
import { canViewDocuments, checkDocSignature, signedDocUrl, sniff } from '@/lib/server/documents';
import { lookupOf, publicJobs } from '@/lib/server/catalog';
import { job, plusDays, profile, school } from './fixtures';
import type { UserAccount } from '@/types';

const consents = [{ purpose: 'terms' as const, version: 'v1' }, { purpose: 'privacy' as const, version: 'v1' }, { purpose: 'matching' as const, version: 'v1' }];
let me: UserAccount;
const S = school();
const J = job({ schoolId: S.id });

describe('candidate profile', () => {
  it('cleans input: drops unknown ids, validates phone, PIN, district and months', async () => {
    const r = await registerUser({ name: 'Lakshmi Devi', email: 'lakshmi@example.com', password: 'Blue-sky teaching 9', role: 'candidate', consents });
    ok(r.ok); if (!r.ok) return; me = r.user;
    const lookup = await withDb(db => { if (!db.master.districts!.some(d => d.code === 'CHITTOOR')) db.master.districts!.push({ ...db.master.states![0], id: 'districts:CHITTOOR', kind: 'districts', code: 'CHITTOOR', name: 'Chittoor', parentId: 'states:AP' }); return lookupOf(db); });
    const prev = emptyProfile(me.id);
    eq(cleanProfile({ phone: '12345' }, prev, lookup).error, 'Enter a 10-digit Indian mobile number.');
    ok(cleanProfile({ pincode: '01234' }, prev, lookup).error);
    ok(cleanProfile({ stateId: 'states:TN', districtId: 'districts:CHITTOOR' }, prev, lookup).error, 'district outside state');
    ok(cleanProfile({ experience: [{ school: 'X', from: '2022-05', to: '2021-01' }] }, prev, lookup).error, 'end before start');
    const ok1 = cleanProfile({ phone: '+91 98765 43210', subjectIds: ['subjects:MATHS', 'subjects:FAKE', 'posts:TGT'], tets: [{ tetId: 'nope' }, { tetId: 'tetExams:CTET', paper: 'Paper II', lifetime: true }], childSafety: { selfDeclaration: true } }, prev, lookup).profile!;
    eq(ok1.subjectIds, ['subjects:MATHS']);
    eq(ok1.tets.length, 1);
    ok(!!ok1.childSafety.selfDeclarationAt);
  });
  it('computes completeness', () => {
    const empty = completeness(emptyProfile('x'), me, []);
    ok(empty.percent < 10 && empty.missing.includes('phone'));
    const full = completeness(profile('x', { preferredStateIds: ['states:AP'], childSafety: { policeVerification: 'done', selfDeclarationAt: 'now' } }), { ...me, emailVerified: true }, [{ category: 'photo' }, { category: 'qualification' }] as never);
    eq(full.percent, 100);
  });
});

describe('applications', () => {
  it('applies once, with screening answers, and refuses duplicates', async () => {
    await withDb(db => { db.schools.push(S); db.jobs.push(J); });
    eq((await withDb(db => applyToJob(db, me, J.id, [], { requireVerifiedEmail: false }))).ok, false, 'needs a profile');
    await withDb(db => { db.profiles[me.id] = profile(me.id); });
    const noAns = await withDb(db => applyToJob(db, me, J.id, [], { requireVerifiedEmail: false }));
    ok(!noAns.ok && noAns.error === 'apply.errAnswers');
    const verify = await withDb(db => applyToJob(db, me, J.id, [{ questionId: 'q1', answer: 'yes' }], { requireVerifiedEmail: true }));
    ok(!verify.ok && verify.error === 'apply.errVerifyEmail');
    const r = await withDb(db => applyToJob(db, me, J.id, [{ questionId: 'q1', answer: 'yes' }, { questionId: 'zz', answer: 'x' }], { requireVerifiedEmail: false }));
    ok(r.ok);
    if (r.ok) { eq(r.application.answers, [{ questionId: 'q1', answer: 'yes' }]); ok((r.application.matchScore ?? 0) > 80); eq(r.application.schoolId, S.id); }
    const dup = await withDb(db => applyToJob(db, me, J.id, [{ questionId: 'q1', answer: 'yes' }], { requireVerifiedEmail: false }));
    ok(!dup.ok && dup.error === 'apply.errDuplicate');
    ok(await withDb(db => db.tracked.some(t => t.userId === me.id && t.jobId === J.id && t.status === 'applied')), 'added to tracker');
  });
  it('refuses closed, external and unverified-school vacancies', async () => {
    const closed = job({ schoolId: S.id, lastDate: plusDays(-1) });
    const ext = job({ schoolId: S.id, applyMode: 'external', externalUrl: 'https://example.org' });
    const pending = school({ verification: 'pending' });
    const hidden = job({ schoolId: pending.id });
    await withDb(db => { db.jobs.push(closed, ext, hidden); db.schools.push(pending); });
    const err = (jobId: string) => withDb(db => { const r = applyToJob(db, me, jobId, [{ questionId: 'q1', answer: 'yes' }], { requireVerifiedEmail: false }); return r.ok ? '' : r.error; });
    eq(await err(closed.id), 'apply.errClosed');
    eq(await err(ext.id), 'apply.errExternal');
    eq(await err(hidden.id), 'apply.errNotFound');
    ok(await withDb(db => !publicJobs(db).some(j => j.id === hidden.id)), 'unverified school hidden from search');
  });
  it('withdraws only in early stages', async () => {
    const appId = await withDb(db => db.applications.find(a => a.candidateId === me.id)!.id);
    eq(await withDb(db => withdrawApplication(db, me, appId)), null);
    eq(await withDb(db => withdrawApplication(db, me, appId)), 'apply.errCannotWithdraw');
    const again = await withDb(db => applyToJob(db, me, J.id, [{ questionId: 'q1', answer: 'yes' }], { requireVerifiedEmail: false }));
    ok(!again.ok && again.error === 'apply.errWithdrawn');
  });
});

describe('documents', () => {
  it('detects real file types and signs short-lived links', () => {
    eq(sniff(Buffer.from('%PDF-1.7 ...')), 'application/pdf');
    eq(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
    eq(sniff(Buffer.from('<html><script>')), null);
    const url = new URL(`http://x${signedDocUrl('doc_1')}`);
    ok(checkDocSignature('doc_1', url.searchParams.get('e'), url.searchParams.get('s')));
    ok(!checkDocSignature('doc_2', url.searchParams.get('e'), url.searchParams.get('s')), 'other document');
    ok(!checkDocSignature('doc_1', url.searchParams.get('e'), url.searchParams.get('s'), Date.now() + 16 * 60_000), 'expired');
  });
  it('shows documents only to the owner, admins and schools applied to', async () => {
    const staff = { ...me, id: 'u_staff', role: 'school_staff' as const, schoolId: S.id };
    const other = { ...me, id: 'u_other', role: 'school_staff' as const, schoolId: 'sch_other' };
    const r = await withDb(db => {
      db.applications.push({ id: 'app_x', jobId: J.id, candidateId: 'u_cand', schoolId: S.id, stage: 'applied', history: [], answers: [], appliedAt: '', updatedAt: '' });
      return [canViewDocuments(db, staff, 'u_cand'), canViewDocuments(db, other, 'u_cand'), canViewDocuments(db, { ...me, id: 'u_cand' }, 'u_cand'), canViewDocuments(db, null, 'u_cand')];
    });
    eq(r, [true, false, true, false]);
  });
});

describe('tracker and alerts', () => {
  it('tracks external jobs and validates fields', async () => {
    ok((await withDb(db => addTracked(db, me.id, { title: '', organisation: 'X' }))).error);
    ok((await withDb(db => addTracked(db, me.id, { title: 'KVS PRT', organisation: 'KVS', lastDate: 'tomorrow' }))).error);
    const r = await withDb(db => addTracked(db, me.id, { title: 'KVS PRT', organisation: 'KVS', url: 'javascript:alert(1)', lastDate: plusDays(5) }));
    ok(r.item && r.item.url === null, 'unsafe link dropped');
    eq(await withDb(db => updateTracked(db, me.id, { id: r.item!.id, status: 'exam' })), null);
    eq(await withDb(db => updateTracked(db, 'someone-else', { id: r.item!.id, status: 'exam' })), 'tracker.errNotFound');
  });
  it('sends each new vacancy once per alert, never on the first run', async () => {
    await withDb(db => { const u = db.users.find(x => x.id === me.id)!; u.emailVerified = true; });
    const a = await withDb(db => saveAlert(db, me.id, { name: 'Maths', frequency: 'instant', filters: { subject: ['MATHS'], state: 'AP' } }));
    ok(a.alert);
    ok((await withDb(db => saveAlert(db, me.id, { name: 'x', filters: {} }))).error === 'alerts.errEmpty');
    eq((await withDb(db => collectDue(db, { force: true }))).due.length, 0, 'first run records what is already open');
    await withDb(db => { db.jobs.push(job({ schoolId: S.id, title: 'New maths post' })); });
    const due = await withDb(db => collectDue(db, { force: true }));
    eq(due.due.length, 1);
    eq(due.due[0].jobs.map(j => j.title), ['New maths post']);
    eq((await withDb(db => collectDue(db, { force: true }))).due.length, 0, 'not sent twice');
  });
  it('limits alerts to 10', async () => {
    for (let i = 0; i < 9; i++) await withDb(db => saveAlert(db, me.id, { name: `a${i}`, filters: { board: ['CBSE'] } }));
    eq((await withDb(db => saveAlert(db, me.id, { name: 'too many', filters: { board: ['CBSE'] } }))).error, 'alerts.errLimit');
  });
});

describe('privacy (DPDP)', () => {
  it('exports everything held about the person', async () => {
    const d = await withDb(db => exportData(db, me.id))!;
    ok(d && d.profile && d.applications.length === 1 && d.jobAlerts.length === 10 && d.tracker.length >= 2);
    ok(!JSON.stringify(d).includes('passwordHash'), 'no password hash in export');
  });
  it('withdrawing matching consent turns off talent search', async () => {
    await withDb(db => { db.profiles[me.id].discoverable = true; setMatchingConsent(db, db.users.find(u => u.id === me.id)!, false); });
    ok(await withDb(db => !db.profiles[me.id].discoverable && db.users.find(u => u.id === me.id)!.consents.some(c => c.purpose === 'matching' && !!c.withdrawnAt)));
  });
  it('erases the account and everything linked to it', async () => {
    await withDb(db => eraseAccount(db, me.id, me.id));
    const left = await withDb(db => [db.users.some(u => u.id === me.id), !!db.profiles[me.id], db.applications.some(a => a.candidateId === me.id), db.alerts.some(a => a.userId === me.id), db.tracked.some(t => t.userId === me.id), db.audit.some(a => a.actorEmail === 'lakshmi@example.com')]);
    eq(left, [false, false, false, false, false, false]);
  });
});
