import { describe, eq, it, ok } from './harness';
import { withDb } from '@/lib/server/db';
import { registerUser } from '@/lib/server/auth';
import { hashPassword } from '@/lib/server/security';
import { acceptInvite, can, changeStaffRole, findInvite, inviteStaff, listTeam, removeStaff } from '@/lib/server/team';
import { canSeeApplication, moveStage, schoolApplications } from '@/lib/server/pipeline';
import { saveJob } from '@/lib/server/jobPosting';
import { lookupOf } from '@/lib/server/catalog';
import { bookSlot, cancelBooking, candidateInterviews, createSlots, deleteSlot, dueReminders, inviteToInterview, setDemoVideo, setOutcome } from '@/lib/server/interviews';
import { ranking, scoresFor, setPanel, submitScore, weightedTotal } from '@/lib/server/panel';
import { draftOffer, issueOffer, respondOffer, saveOfferSettings, withdrawOffer } from '@/lib/server/offers';
import { cleanTalentFilters, inviteTalent, searchTalent } from '@/lib/server/talent';
import { applicationsCsv, furthest, median, schoolReport, vacanciesCsv } from '@/lib/server/reports';
import { eraseAccount, exportData } from '@/lib/server/privacy';
import { buildIcs, istToUtc } from '@/lib/ics';
import { renderOffer, unknownFields } from '@/lib/offerLetter';
import { job as jobFx, plusDays, profile, school as schoolFx } from './fixtures';
import type { Application, UserAccount } from '@/types';

const consents = [{ purpose: 'terms' as const, version: 'v1' }, { purpose: 'privacy' as const, version: 'v1' }, { purpose: 'matching' as const, version: 'v1' }];
async function user(email: string, role: 'candidate' | 'school_admin'): Promise<UserAccount> {
  const r = await registerUser({ name: email.split('@')[0], email, password: 'Blue-sky teaching 9', role, consents });
  if (!r.ok) throw new Error(r.error);
  return r.user;
}
const fresh = (id: string) => withDb(db => db.users.find(u => u.id === id)!);
const HOUR = 3600_000, DAY = 24 * HOUR;

let head: UserAccount, hr: UserAccount, panelist: UserAccount, coord: UserAccount, c1: UserAccount, c2: UserAccount, outsider: UserAccount;
let schoolId = '', jobId = '', otherJobId = '', app1 = '', app2 = '';

function application(jobId: string, schoolId: string, candidateId: string, stage: Application['stage'] = 'shortlisted', matchScore = 80): Application {
  const at = new Date(Date.now() - 10 * DAY).toISOString();
  return { id: `app_${candidateId}_${jobId}`, jobId, candidateId, schoolId, stage, history: [{ stage: 'applied', at }, ...(stage !== 'applied' ? [{ stage, at }] : [])], answers: [], matchScore, appliedAt: at, updatedAt: at };
}

describe('team and roles', () => {
  it('sets up a school with two applicants', async () => {
    head = await user('head@hire.example', 'school_admin');
    c1 = await user('asha@cand.example', 'candidate');
    c2 = await user('ravi@cand.example', 'candidate');
    outsider = await user('head@else.example', 'school_admin');
    await withDb(db => {
      const s = schoolFx({ name: 'Hiring Test School' });
      db.schools.push(s);
      schoolId = s.id;
      db.users.find(u => u.id === head.id)!.schoolId = s.id;
      const other = schoolFx({ name: 'Elsewhere School', udiseCode: '99999999999' });
      db.schools.push(other);
      db.users.find(u => u.id === outsider.id)!.schoolId = other.id;
      const j = jobFx({ schoolId: s.id, orgName: s.name, publishedAt: new Date(Date.now() - 20 * DAY).toISOString() });
      const j2 = jobFx({ schoolId: s.id, orgName: s.name, title: 'PGT Physics' });
      db.jobs.push(j, j2);
      jobId = j.id; otherJobId = j2.id;
      const a1 = application(j.id, s.id, c1.id), a2 = application(j.id, s.id, c2.id, 'shortlisted', 60);
      db.applications.push(a1, a2);
      app1 = a1.id; app2 = a2.id;
      db.profiles[c1.id] = profile(c1.id, { discoverable: true });
      db.profiles[c2.id] = profile(c2.id, { discoverable: false });
    });
  });

  it('invites staff by email; the link creates a verified staff account with that role', async () => {
    head = await fresh(head.id);
    eq(await withDb(db => inviteStaff(db, head, { email: 'bad', name: 'X Y', staffRole: 'hr' }).error), 'team.errEmail');
    eq(await withDb(db => inviteStaff(db, head, { email: 'hr@hire.example', name: 'H R', staffRole: 'owner' }).error), 'team.errRole');
    eq(await withDb(db => inviteStaff(db, head, { email: 'asha@cand.example', name: 'Asha', staffRole: 'hr' }).error), 'team.errOtherAccount', 'a candidate account cannot be turned into staff');
    const first = await withDb(db => inviteStaff(db, head, { email: 'HR@hire.example', name: 'Hema Rao', staffRole: 'hr' }));
    const r = await withDb(db => inviteStaff(db, head, { email: 'hr@hire.example', name: 'Hema Rao', staffRole: 'hr' }));
    ok(r.token && r.invite);
    eq(await withDb(db => findInvite(db, first.token!)), null, 'a new invitation replaces the old link');
    eq(await withDb(db => db.staffInvites.filter(i => i.email === 'hr@hire.example').length), 1);
    ok(!(await withDb(db => JSON.stringify(db.staffInvites))).includes(r.token!), 'only the digest is stored');
    const pw = await hashPassword('Another good pass 7');
    const a = await withDb(db => acceptInvite(db, r.token!, { name: 'Hema Rao', passwordHash: pw }));
    ok(a.user);
    hr = a.user!;
    eq([hr.role, hr.staffRole, hr.schoolId, hr.emailVerified], ['school_staff', 'hr', schoolId, true]);
    eq(await withDb(db => acceptInvite(db, r.token!, { passwordHash: pw }).error), 'team.errInviteInvalid', 'one use only');
    for (const [email, role] of [['panel@hire.example', 'panel'], ['coord@hire.example', 'coordinator']] as const) {
      const t = (await withDb(db => inviteStaff(db, head, { email, name: `${role} member`, staffRole: role }))).token!;
      const u = (await withDb(db => acceptInvite(db, t, { passwordHash: pw }))).user!;
      if (role === 'panel') panelist = u; else coord = u;
    }
    const team = await withDb(db => listTeam(db, head));
    eq(team!.members.map(m => m.role).sort(), ['coordinator', 'hr', 'panel', 'school_admin']);
  });

  it('enforces permissions by role', async () => {
    eq([can(head, 'team'), can(hr, 'team'), can(hr, 'offers'), can(coord, 'offers'), can(coord, 'pipeline'), can(panelist, 'pipeline'), can(c1, 'jobs')], [true, false, true, false, true, false, false]);
    eq(await withDb(db => inviteStaff(db, hr, { email: 'x@hire.example', name: 'X Y', staffRole: 'hr' }).error), 'team.errPermission');
    eq(await withDb(db => schoolApplications(db, panelist).length), 0, 'panel-only staff see nothing until put on a panel');
    eq(await withDb(db => moveStage(db, panelist, [app1], 'eligible', null).error), 'team.errPermission');
    ok(await withDb(db => saveJob(db, panelist, { schoolId, title: 'X' }, lookupOf(db)).error === 'post.errNotFound'), 'panel-only staff cannot post vacancies');
    eq(await withDb(db => changeStaffRole(db, head, coord.id, 'principal')), null);
    eq((await fresh(coord.id)).staffRole, 'principal');
    eq(await withDb(db => changeStaffRole(db, head, coord.id, 'coordinator')), null);
    coord = await fresh(coord.id);
  });
});

describe('interviews and demo classes', () => {
  let ivId = '', slotA = '', slotB = '';
  it('converts India time to UTC and builds a calendar file', () => {
    eq(istToUtc('2026-11-16', '10:30'), '2026-11-16T05:00:00.000Z');
    eq(istToUtc('2026-02-30', '10:00'), null);
    eq(istToUtc('2026-11-16', '25:00'), null);
    const ics = buildIcs({ uid: 'x1', title: 'Demo class, TGT; Maths', start: '2026-11-16T05:00:00.000Z', durationMin: 30, location: 'Room 4', url: 'https://example.com/a' }, new Date('2026-11-01T00:00:00Z'));
    ok(ics.includes('DTSTART:20261116T050000Z') && ics.includes('DTEND:20261116T053000Z'));
    ok(ics.includes('SUMMARY:Demo class\\, TGT\\; Maths'), 'escaped');
    ok(ics.includes('TRIGGER:-P1D') && ics.includes('TRIGGER:-PT1H'), 'two reminders');
    ok(ics.split('\r\n').every(l => l.length <= 75), 'lines folded');
  });
  it('creates slots with validation', async () => {
    const day = plusDays(3);
    const base = { jobId, kind: 'interview', date: day, durationMin: 30, mode: 'google_meet', location: 'https://meet.google.com/abc-defg-hij', capacity: 1 };
    eq(await withDb(db => createSlots(db, panelist, { ...base, times: ['10:00'] }).error), 'interviews.errNotFound', 'panel-only staff cannot schedule');
    eq(await withDb(db => createSlots(db, outsider, { ...base, times: ['10:00'] }).error), 'interviews.errNotFound', 'another school cannot');
    eq(await withDb(db => createSlots(db, hr, { ...base, location: 'meet.google.com/x', times: ['10:00'] }).error), 'interviews.errLink');
    eq(await withDb(db => createSlots(db, hr, { ...base, date: plusDays(-1), times: ['10:00'] }).error), 'interviews.errPast');
    eq(await withDb(db => createSlots(db, hr, { ...base, times: [] }).error), 'interviews.errTimes');
    const r = await withDb(db => createSlots(db, hr, { ...base, times: ['11:00', '10:00', '10:00'] }));
    eq(r.slots!.length, 2, 'duplicates removed');
    ok(r.slots![0].start < r.slots![1].start, 'sorted');
    [slotA, slotB] = r.slots!.map(s => s.id);
  });
  it('invites applicants, moves them to Demo / interview, and skips duplicates', async () => {
    const r = await withDb(db => inviteToInterview(db, hr, { ids: [app1, app2], kind: 'interview', message: 'Bring your certificates.' }));
    eq([r.created.length, r.skipped], [2, 0]);
    eq(await withDb(db => db.applications.find(a => a.id === app1)!.stage), 'interview');
    eq((await withDb(db => inviteToInterview(db, hr, { ids: [app1], kind: 'interview' }))).skipped, 1);
    eq((await withDb(db => inviteToInterview(db, outsider, { ids: [app1], kind: 'interview' }))).error, 'ats.errNotFound');
    ivId = r.created.find(i => i.candidateId === c1.id)!.id;
  });
  it('lets candidates book, respects capacity, and cancel', async () => {
    eq(await withDb(db => bookSlot(db, c2, ivId, slotA).error), 'interviews.errNotFound', 'only the invited candidate');
    eq((await withDb(db => bookSlot(db, c1, ivId, slotA))).interview?.status, 'booked');
    const iv2 = await withDb(db => db.interviews.find(i => i.candidateId === c2.id)!.id);
    eq(await withDb(db => bookSlot(db, c2, iv2, slotA).error), 'interviews.errSlotTaken', 'one-to-one slot is full');
    eq((await withDb(db => candidateInterviews(db, c2)))[0].openSlots.map(s => s.id), [slotB]);
    eq((await withDb(db => bookSlot(db, c2, iv2, slotB))).interview?.status, 'booked');
    eq(await withDb(db => cancelBooking(db, c2, iv2)), null);
    eq(await withDb(db => db.interviews.find(i => i.id === iv2)!.status), 'invited');
    eq(await withDb(db => setDemoVideo(db, c1, ivId, 'https://youtu.be/x')), 'interviews.errNotFound', 'video only for demo classes');
  });
  it('does not allow changes shortly before the start', async () => {
    const soon = await withDb(db => { const s = db.slots.find(x => x.id === slotA)!; return Date.parse(s.start) - 60 * 60_000; });
    eq(await withDb(db => cancelBooking(db, c1, ivId, soon)), 'interviews.errTooLate');
  });
  it('sends each reminder once: 1 day and 1 hour before', async () => {
    const start = await withDb(db => Date.parse(db.slots.find(x => x.id === slotA)!.start));
    eq(await withDb(db => dueReminders(db, start - 2 * DAY).length), 0);
    eq(await withDb(db => dueReminders(db, start - 20 * HOUR).map(r => r.which)), ['1d']);
    eq(await withDb(db => dueReminders(db, start - 19 * HOUR).length), 0, 'not twice');
    eq(await withDb(db => dueReminders(db, start - 30 * 60_000).map(r => r.which)), ['1h']);
    eq(await withDb(db => dueReminders(db, start - 10 * 60_000).length), 0);
  });
  it('demo classes: topic, video link (https only); deleting a slot frees bookings', async () => {
    const r = await withDb(db => inviteToInterview(db, coord, { ids: [app1], kind: 'demo', demoTopic: 'Linear equations', demoClass: 'IX' }));
    const demo = r.created[0];
    eq([demo.demoTopic, demo.demoClass], ['Linear equations', 'IX']);
    eq(await withDb(db => setDemoVideo(db, c1, demo.id, 'http://insecure.example/v')), 'interviews.errVideo');
    eq(await withDb(db => setDemoVideo(db, c1, demo.id, 'https://youtu.be/abc')), null);
    const d = await withDb(db => deleteSlot(db, hr, slotA));
    eq(d.affected!.map(i => i.id), [ivId]);
    eq(await withDb(db => db.interviews.find(i => i.id === ivId)!.status), 'invited');
    eq((await withDb(db => setOutcome(db, hr, ivId, 'completed'))).interview?.status, 'completed');
    eq((await withDb(db => setOutcome(db, hr, ivId, 'booked'))).error, 'interviews.errStatus');
  });
});

describe('selection panel', () => {
  it('computes a normalised weighted total', () => {
    eq(weightedTotal({ a: 10, b: 5 }, { a: 30, b: 30 }), 75);
    eq(weightedTotal({ a: 8, b: 6, c: 10, d: 4 }, { a: 30, b: 30, c: 20, d: 20 }), 70);
    eq(weightedTotal({}, {}), 0);
  });
  it('sets a panel from the team only', async () => {
    eq((await withDb(db => setPanel(db, hr, jobId, [{ userId: c1.id, role: 'principal' }]))).error, 'panel.errMember');
    eq((await withDb(db => setPanel(db, hr, jobId, [{ userId: panelist.id, role: 'king' }]))).error, 'panel.errRole');
    eq((await withDb(db => setPanel(db, panelist, jobId, [{ userId: panelist.id, role: 'subject_expert' }]))).error, 'panel.errNotFound');
    const r = await withDb(db => setPanel(db, hr, jobId, [{ userId: panelist.id, role: 'subject_expert' }, { userId: head.id, role: 'principal' }, { userId: panelist.id, role: 'other' }]));
    eq(r.job!.panel!.length, 2, 'no duplicates');
  });
  it('panel members see only their vacancy, score confidentially, and the ranking combines scores', async () => {
    eq(await withDb(db => schoolApplications(db, panelist).map(a => a.id).sort()), [app1, app2].sort());
    ok(await withDb(db => canSeeApplication(db, panelist, db.applications.find(a => a.id === app1))));
    const dims = await withDb(db => (db.master.panelDimensions || []).filter(d => d.active).map(d => d.id));
    eq(dims.length, 4);
    const marks = (v: number) => Object.fromEntries(dims.map(d => [d, v]));
    eq((await withDb(db => submitScore(db, panelist, { applicationId: app1, marks: { [dims[0]]: 5 }, recommendation: 'recommend' }))).error, 'panel.errMarks');
    eq((await withDb(db => submitScore(db, panelist, { applicationId: app1, marks: marks(11), recommendation: 'recommend' }))).error, 'panel.errMarks');
    eq((await withDb(db => submitScore(db, hr, { applicationId: app1, marks: marks(8), recommendation: 'recommend' }))).error, 'panel.errNotMember');
    eq((await withDb(db => submitScore(db, panelist, { applicationId: app1, marks: marks(8), recommendation: 'recommend', comments: 'Clear explanations.' }))).score?.total, 80);
    eq((await withDb(db => submitScore(db, panelist, { applicationId: app1, marks: marks(9), recommendation: 'strongly_recommend' }))).score?.total, 90, 'updates the same score');
    await withDb(db => submitScore(db, head, { applicationId: app1, marks: marks(7), recommendation: 'recommend' }));
    await withDb(db => submitScore(db, panelist, { applicationId: app2, marks: marks(6), recommendation: 'reservations' }));
    eq(await withDb(db => db.panelScores.length), 3);
    const own = await withDb(db => scoresFor(db, panelist, app1));
    eq([own!.mine?.total, own!.all], [90, null], 'a panel member sees only their own score');
    eq((await withDb(db => scoresFor(db, hr, app1)))!.all!.length, 2, 'HR sees all scores');
    eq(await withDb(db => ranking(db, panelist, jobId)), null);
    const rank = await withDb(db => ranking(db, hr, jobId));
    eq(rank!.map(r => [r.applicationId, r.average, r.count]), [[app1, 80, 2], [app2, 60, 1]]);
    ok(!(await withDb(db => JSON.stringify(db.audit.filter(a => a.action === 'panel.score')))).includes('Clear explanations'), 'audit log does not hold the comments');
  });
  it('removing a staff member ends their access and takes them off panels', async () => {
    const extra = (await withDb(db => inviteStaff(db, head, { email: 'temp@hire.example', name: 'Temp Member', staffRole: 'panel' }))).token!;
    const u = (await withDb(async db => acceptInvite(db, extra, { passwordHash: await hashPassword('Temporary pass 77') }))).user!;
    await withDb(db => setPanel(db, head, otherJobId, [{ userId: u.id, role: 'other' }]));
    eq(await withDb(db => removeStaff(db, head, u.id)), null);
    const after = await fresh(u.id);
    eq([after.schoolId, after.staffRole], [null, null]);
    eq(await withDb(db => db.jobs.find(j => j.id === otherJobId)!.panel), []);
  });
});

describe('offer letters', () => {
  let offerId = '';
  it('fills the template and flags unknown fields', () => {
    eq(renderOffer('Dear {candidateName}, {foo} at {school}.', { candidateName: 'Asha', school: 'ABC' }), 'Dear Asha, {foo} at ABC.');
    eq(unknownFields('{candidateName} {foo} {bar} {foo}'), ['foo', 'bar']);
    ok(renderOffer('', { candidateName: 'Asha' }).startsWith('Dear Asha,'), 'default template');
  });
  it('needs settings, valid dates and the offers permission', async () => {
    const base = { applicationId: app1, designation: 'TGT (Mathematics)', pay: '₹38,000 per month', joiningDate: plusDays(20), acceptBy: plusDays(7), reportTo: 'the Principal' };
    eq((await withDb(db => issueOffer(db, coord, base))).error, 'team.errPermission');
    eq((await withDb(db => issueOffer(db, hr, { ...base, joiningDate: plusDays(3) }))).error, 'offers.errJoinBeforeAccept');
    eq((await withDb(db => issueOffer(db, hr, { ...base, acceptBy: plusDays(-1) }))).error, 'offers.errAcceptPast');
    eq((await withDb(db => issueOffer(db, hr, base))).error, 'offers.errNoSignatory');
    eq((await withDb(db => saveOfferSettings(db, hr, { template: 'Dear {candidateName}, {oops}. Pay {pay}.', signatoryName: '', signatoryDesignation: 'Principal' }))).error, 'offers.errSignatory');
    eq((await withDb(db => saveOfferSettings(db, hr, { template: 'Dear {candidateName}, {oops}. Pay {pay}.', signatoryName: 'Dr. S. Rao', signatoryDesignation: 'Principal' }))).unknown, ['oops']);
    await withDb(db => saveOfferSettings(db, hr, { template: '', signatoryName: 'Dr. S. Rao', signatoryDesignation: 'Principal' }));
    const d = await withDb(db => draftOffer(db, hr, base));
    ok(d.letter!.includes('Dear asha,') && d.letter!.includes('₹38,000 per month') && d.letter!.includes('Hiring Test School'));
    const r = await withDb(db => issueOffer(db, hr, base));
    ok(r.offer);
    offerId = r.offer!.id;
    eq(await withDb(db => db.applications.find(a => a.id === app1)!.stage), 'offer');
    eq((await withDb(db => issueOffer(db, hr, base))).error, 'offers.errExists');
    await withDb(db => saveOfferSettings(db, hr, { template: 'Changed {candidateName}', signatoryName: 'Dr. S. Rao', signatoryDesignation: 'Principal' }));
    ok((await withDb(db => db.offers.find(o => o.id === offerId)!.letter)).startsWith('Dear asha,'), 'issued letters do not change with the template');
  });
  it('the candidate answers once; the school can withdraw only unanswered offers', async () => {
    eq((await withDb(db => respondOffer(db, c2, offerId, true, ''))).error, 'offers.errNotFound');
    eq((await withDb(db => respondOffer(db, c1, offerId, true, 'Happy to join.'))).offer?.status, 'accepted');
    eq((await withDb(db => respondOffer(db, c1, offerId, false, ''))).error, 'offers.errAnswered');
    eq((await withDb(db => withdrawOffer(db, hr, offerId))).error, 'offers.errAnswered');
    const second = await withDb(db => issueOffer(db, head, { applicationId: app2, pay: 'As per school scale', joiningDate: plusDays(30), acceptBy: plusDays(10) }));
    eq((await withDb(db => withdrawOffer(db, outsider, second.offer!.id))).error, 'offers.errNotFound');
    eq((await withDb(db => withdrawOffer(db, hr, second.offer!.id))).offer?.status, 'withdrawn');
  });
});

describe('talent search', () => {
  it('finds only discoverable candidates who allow matching, without contact details', async () => {
    eq(cleanTalentFilters({ subject: ' subjects:MATHS ', minExp: '-3', x: 'y' } as Record<string, string>), { subject: 'subjects:MATHS' });
    eq(await withDb(db => searchTalent(db, panelist, {})), null);
    const r = await withDb(db => searchTalent(db, coord, { subject: 'subjects:MATHS' }));
    eq(r!.results.map(c => c.id), [c1.id], 'Ravi is not discoverable');
    ok(!JSON.stringify(r).includes('cand.example') && !JSON.stringify(r).includes('9876543210'), 'no email or phone');
    eq((await withDb(db => searchTalent(db, coord, { subject: 'subjects:PHYSICS' })))!.total, 0);
    eq((await withDb(db => searchTalent(db, coord, { minExp: 10 })))!.total, 0);
    eq((await withDb(db => searchTalent(db, coord, { tet: 'tetExams:CTET', district: 'districts:CHITTOOR' })))!.total, 1);
  });
  it('invites a candidate once per vacancy, and never someone who applied', async () => {
    eq((await withDb(db => inviteTalent(db, coord, { candidateId: c1.id, jobId }))).error, 'talent.errApplied');
    eq((await withDb(db => inviteTalent(db, coord, { candidateId: c2.id, jobId: otherJobId }))).error, 'talent.errCandidate');
    eq((await withDb(db => inviteTalent(db, outsider, { candidateId: c1.id, jobId: otherJobId }))).error, 'talent.errJob');
    ok((await withDb(db => inviteTalent(db, coord, { candidateId: c1.id, jobId: otherJobId, message: 'We liked your profile.' }))).invite);
    eq((await withDb(db => inviteTalent(db, coord, { candidateId: c1.id, jobId: otherJobId }))).error, 'talent.errInvited');
  });
});

describe('reports', () => {
  it('builds the funnel, time to hire, offers and vacancy table', async () => {
    eq(median([5, 1, 3]), 3);
    eq(median([1, 2, 3, 4]), 2.5);
    eq(median([]), null);
    eq(furthest({ stage: 'not_selected', history: [{ stage: 'applied', at: '' }, { stage: 'interview', at: '' }, { stage: 'not_selected', at: '' }] } as Application), 4);
    await withDb(db => moveStage(db, hr, [app1], 'joined', null));
    eq(await withDb(db => schoolReport(db, coord, 90)), null, 'coordinators cannot see reports');
    const r = (await withDb(db => schoolReport(db, hr, 90)))!;
    eq(r.funnel.find(f => f.stage === 'applied')!.count, 2);
    eq(r.funnel.find(f => f.stage === 'interview')!.count, 2);
    eq(r.funnel.find(f => f.stage === 'joined')!.count, 1);
    eq([r.timeToHire.hires, r.timeToHire.median], [1, 10]);
    eq([r.offers.issued, r.offers.accepted, r.offers.withdrawn, r.offers.acceptanceRate], [2, 1, 1, 100]);
    const v = r.vacancies.find(x => x.jobId === jobId)!;
    eq([v.applications, v.interviewed, v.joined, v.avgMatch, v.daysToFirstHire], [2, 2, 1, 70, 20]);
    const csv = vacanciesCsv(r);
    ok(csv.startsWith('Vacancy,Status,Published') && csv.includes('TGT Mathematics'));
    const apps = (await withDb(db => applicationsCsv(db, hr, 0)))!;
    eq(apps.trim().split('\r\n').length, 3);
    ok(!apps.includes('@'), 'no email addresses');
  });
});

describe('data rights for hiring data', () => {
  it('exports interviews, offers and invitations, and erases them with the account', async () => {
    const x = (await withDb(db => exportData(db, c1.id)))!;
    ok(x.interviews.length >= 2 && x.offers.length === 1 && x.invitationsToApply.length === 1);
    await withDb(db => eraseAccount(db, c1.id, c1.id));
    const left = await withDb(db => [db.interviews, db.offers, db.panelScores, db.talentInvites].map(l => JSON.stringify(l).includes(c1.id) || JSON.stringify(l).includes(app1)));
    eq(left, [false, false, false, false]);
  });
});
