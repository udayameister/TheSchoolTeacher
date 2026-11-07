import { describe, eq, it, ok } from './harness';
import { withDb } from '@/lib/server/db';
import { registerUser } from '@/lib/server/auth';
import { lookupOf, publicJobs } from '@/lib/server/catalog';
import { canManageSchool, managedSchools, registerSchool, reviewSchool, udisePrefixWarning, updateSchool } from '@/lib/server/schools';
import { cleanJob, deleteDraft, duplicateJob, saveJob, setJobStatus } from '@/lib/server/jobPosting';
import { addNote, dossier, moveStage, schoolApplications } from '@/lib/server/pipeline';
import { applyToJob, withdrawApplication } from '@/lib/server/applications';
import { canViewDocuments } from '@/lib/server/documents';
import { importUdiseCsv, lookupUdise, sameSchoolName } from '@/lib/server/udise';
import { publicSchools } from '@/lib/server/publicSchools';
import { profile, plusDays } from './fixtures';
import type { UserAccount } from '@/types';

const consents = [{ purpose: 'terms' as const, version: 'v1' }, { purpose: 'privacy' as const, version: 'v1' }, { purpose: 'matching' as const, version: 'v1' }];
async function user(email: string, role: 'candidate' | 'school_admin'): Promise<UserAccount> {
  const r = await registerUser({ name: email.split('@')[0], email, password: 'Blue-sky teaching 9', role, consents });
  if (!r.ok) throw new Error(r.error);
  return r.user;
}
const fresh = (id: string) => withDb(db => db.users.find(u => u.id === id)!);
const form = (o: Record<string, unknown> = {}) => ({
  udiseCode: '28230100101', name: 'Sri Saraswathi Vidya Mandir', managementTypeId: 'managementTypes:PRIVATE_UNAIDED',
  affiliations: [{ boardId: 'boards:CBSE', number: '130456' }, { boardId: 'boards:CBSE', number: 'dup' }], stateId: 'states:AP', districtId: '', city: 'Madanapalle',
  pincode: '517325', officialEmail: 'office@ssvm.example', phone: '08571 222333', levelIds: ['schoolLevels:SECONDARY', 'bogus'], mediumIds: ['mediums:EN'], facilityIds: ['facilities:LIBRARY'], ...o,
});
const vacancy = (schoolId: string, o: Record<string, unknown> = {}) => ({
  schoolId, title: 'TGT Mathematics', postId: 'posts:TGT', subjectIds: ['subjects:MATHS'], levelIds: ['schoolLevels:SECONDARY'], employmentTypeId: 'employmentTypes:PERMANENT',
  vacancies: 2, description: 'Teach mathematics to classes IX and X. Prepare students for board exams.', lastDate: plusDays(20),
  eligibility: { requiredQualificationIds: ['qualifications:BED'], tetRequired: true, acceptedTetIds: ['tetExams:CTET'], minExperienceYears: 1, mediumIds: ['mediums:EN'] },
  pay: { mode: 'range', min: 30000, max: 40000, benefitIds: ['benefits:PF'] }, screeningQuestions: [{ text: 'Can you join in 30 days?', type: 'yesno', mustAnswer: 'yes' }], ...o,
});

let admin: UserAccount, other: UserAccount, cand: UserAccount, platform: UserAccount;
let schoolId = '', jobId = '', appId = '';

describe('school registration and verification', () => {
  it('validates the form and registers a pending school', async () => {
    admin = await user('head@ssvm.example', 'school_admin');
    const bad = async (o: Record<string, unknown>) => withDb(db => registerSchool(db, admin, form(o), lookupOf(db), null).error);
    eq(await bad({ udiseCode: '1234' }), 'school.errUdise');
    eq(await bad({ affiliations: [] }), 'school.errBoard');
    eq(await bad({ officialEmail: '', phone: '' }), 'school.errContact');
    eq(await bad({ lat: 51.5, lng: -0.1 }), 'school.errLocation');
    const r = await withDb(db => registerSchool(db, admin, form(), lookupOf(db), null));
    ok(r.school);
    schoolId = r.school!.id;
    eq(r.school!.verification, 'pending');
    eq(r.school!.affiliations.length, 1, 'duplicate board removed');
    eq(r.school!.levelIds, ['schoolLevels:SECONDARY'], 'unknown ids dropped');
    ok(r.school!.slug.startsWith('sri-saraswathi-vidya-mandir-madanapalle'));
    eq((await fresh(admin.id)).schoolId, schoolId);
  });
  it('refuses a second school without a group, and a duplicate UDISE+ code', async () => {
    eq(await withDb(db => registerSchool(db, admin, form({ udiseCode: '28230100102' }), lookupOf(db), null).error), 'school.errAlreadyRegistered');
    other = await user('head@other.example', 'school_admin');
    eq(await withDb(db => registerSchool(db, other, form(), lookupOf(db), null).error), 'school.errUdiseTaken');
  });
  it('lets a group register branches and switch between them', async () => {
    const g = await withDb(db => registerSchool(db, other, form({ udiseCode: '33010200301', stateId: 'states:TN', name: 'Group School One', isGroup: true, groupName: 'Test Trust' }), lookupOf(db), null));
    ok(g.school?.groupId);
    other = await fresh(other.id);
    const b = await withDb(db => registerSchool(db, other, form({ udiseCode: '33010200302', stateId: 'states:TN', name: 'Group School Two' }), lookupOf(db), null));
    eq(b.school?.groupId, g.school!.groupId);
    other = await fresh(other.id);
    eq(await withDb(db => managedSchools(db, other).length), 2);
    ok(await withDb(db => !canManageSchool(db, other, schoolId)), 'cannot manage another school');
  });
  it('warns when the UDISE+ prefix does not match the state', async () => {
    const lookup = await withDb(db => lookupOf(db));
    eq(udisePrefixWarning(lookup, '28230100101', 'states:AP'), null);
    eq(udisePrefixWarning(lookup, '33010200301', 'states:AP'), 'school.warnUdisePrefix');
  });
  it('requires a reason to reject; a rejected school that saves goes back to pending', async () => {
    platform = { ...admin, id: 'adm', role: 'platform_admin' };
    ok(await withDb(db => reviewSchool(db, platform, schoolId, 'rejected', 'no').error));
    eq(await withDb(db => reviewSchool(db, platform, schoolId, 'rejected', 'UDISE code belongs to another school').school?.verification), 'rejected');
    admin = await fresh(admin.id);
    const r = await withDb(db => updateSchool(db, admin, schoolId, form({ udiseCode: '28230100109' }), lookupOf(db)));
    ok(r.resubmitted);
    eq(await withDb(db => db.schools.find(s => s.id === schoolId)!.udiseCode), '28230100109');
  });
  it('locks identity fields after verification', async () => {
    eq(await withDb(db => reviewSchool(db, platform, schoolId, 'verified', '').school?.verification), 'verified');
    await withDb(db => updateSchool(db, admin, schoolId, form({ udiseCode: '28230100555', name: 'Changed', about: 'We teach.' }), lookupOf(db)));
    const s = await withDb(db => db.schools.find(x => x.id === schoolId)!);
    eq([s.udiseCode, s.name, s.about], ['28230100109', 'Sri Saraswathi Vidya Mandir', 'We teach.']);
    ok(await withDb(db => publicSchools(db).some(x => x.id === schoolId)));
  });
});

describe('vacancies', () => {
  it('validates vacancy fields', async () => {
    const lookup = await withDb(db => lookupOf(db));
    const e = (o: Record<string, unknown>) => cleanJob(vacancy('x', o), lookup).error;
    eq(e({ title: 'TGT' }), 'post.errTitle');
    eq(e({ subjectIds: [] }), 'post.errSubject');
    eq(e({ description: 'short' }), 'post.errDescription');
    eq(e({ lastDate: plusDays(400) }), 'post.errLastDateFar');
    eq(e({ pay: { mode: 'range', min: 50000, max: 40000 } }), 'post.errRangeOrder');
    eq(e({ pay: { mode: 'cpc' } }), 'post.errPayLevel');
    eq(e({ screeningQuestions: Array.from({ length: 11 }, () => ({ text: 'Question here?' })) }), 'post.errQuestions');
    const f = cleanJob(vacancy('x', { eligibility: { requiredQualificationIds: ['qualifications:BED'], preferredQualificationIds: ['qualifications:BED', 'qualifications:MED'], tetRequired: false, acceptedTetIds: ['tetExams:CTET'] } }), lookup).fields!;
    eq(f.eligibility!.preferredQualificationIds, ['qualifications:MED'], 'required not repeated as preferred');
    eq(f.eligibility!.acceptedTetIds, [], 'no TETs when TET not required');
  });
  it('drafts while pending, publishes only when verified, copies school location', async () => {
    const pendingSchool = await withDb(db => managedSchools(db, other)[0].id);
    eq(await withDb(db => saveJob(db, other, { ...vacancy(pendingSchool), publish: true }, lookupOf(db)).error), 'post.errNotVerified');
    ok(await withDb(db => saveJob(db, other, vacancy(pendingSchool), lookupOf(db)).job?.status === 'draft'));
    ok(await withDb(db => !!saveJob(db, admin, vacancy(pendingSchool), lookupOf(db)).error), 'cannot post for another school');
    const r = await withDb(db => saveJob(db, admin, { ...vacancy(schoolId), publish: true }, lookupOf(db)));
    ok(r.published && r.job);
    jobId = r.job!.id;
    eq([r.job!.stateId, r.job!.city, r.job!.boardIds], ['states:AP', 'Madanapalle', ['boards:CBSE']]);
    ok(await withDb(db => publicJobs(db).some(j => j.id === jobId)));
  });
  it('closes, reopens, duplicates and deletes only drafts', async () => {
    eq(await withDb(db => setJobStatus(db, admin, jobId, 'closed').job?.status), 'closed');
    eq(await withDb(db => setJobStatus(db, admin, jobId, 'published').job?.status), 'published');
    const copy = await withDb(db => duplicateJob(db, admin, jobId).job!);
    eq(copy.status, 'draft');
    eq(await withDb(db => deleteDraft(db, admin, jobId)), 'post.errDeleteDraftOnly');
    eq(await withDb(db => deleteDraft(db, admin, copy.id)), null);
  });
  it('rejecting a school closes its published vacancies', async () => {
    const s2 = await withDb(db => managedSchools(db, other)[1].id);
    await withDb(db => reviewSchool(db, platform, s2, 'verified', ''));
    const j = await withDb(db => saveJob(db, other, { ...vacancy(s2), publish: true }, lookupOf(db)).job!);
    await withDb(db => reviewSchool(db, platform, s2, 'rejected', 'Affiliation number could not be found'));
    eq(await withDb(db => db.jobs.find(x => x.id === j.id)!.status), 'closed');
  });
});

describe('applicant pipeline', () => {
  it('shows applications only to the school that received them', async () => {
    cand = await user('meena@example.com', 'candidate');
    await withDb(db => { db.profiles[cand.id] = profile(cand.id); });
    const r = await withDb(db => applyToJob(db, cand, jobId, [{ questionId: db.jobs.find(j => j.id === jobId)!.screeningQuestions[0].id, answer: 'no' }], { requireVerifiedEmail: false }));
    ok(r.ok); if (!r.ok) return;
    appId = r.application.id;
    eq(await withDb(db => schoolApplications(db, admin).map(a => a.id)), [appId]);
    eq(await withDb(db => schoolApplications(db, other).length), 0);
    eq(await withDb(db => dossier(db, other, appId)), null);
    ok(await withDb(db => canViewDocuments(db, admin, cand.id) && !canViewDocuments(db, other, cand.id)));
  });
  it('builds the dossier with flagged answers and match', async () => {
    const d = await withDb(db => dossier(db, admin, appId))!;
    ok(d && d.candidate.email === 'meena@example.com' && d.answers[0].flagged && d.match && d.profile?.phone);
  });
  it('moves stages (single and bulk), keeps history and refuses other schools', async () => {
    const r = await withDb(db => moveStage(db, admin, [appId], 'shortlisted', 'Strong demo'));
    eq(r.moved, 1);
    eq(r.changed.length, 1, 'shortlisted is emailed');
    const q = await withDb(db => moveStage(db, admin, [appId], 'screening', null));
    eq(q.changed.length, 0, 'screening is not emailed');
    eq(await withDb(db => moveStage(db, other, [appId], 'not_selected', null).error), 'ats.errNotFound');
    eq(await withDb(db => moveStage(db, admin, [appId], 'withdrawn' as never, null).error), 'ats.errStage');
    const h = await withDb(db => db.applications.find(a => a.id === appId)!.history.map(x => x.stage));
    eq(h, ['applied', 'shortlisted', 'screening']);
  });
  it('keeps internal notes for the school only', async () => {
    ok((await withDb(db => addNote(db, admin, appId, 'Called; available from June.'))).note);
    eq((await withDb(db => addNote(db, other, appId, 'x'))).error, 'ats.errNotFound');
    eq((await withDb(db => addNote(db, admin, appId, '  '))).error, 'ats.errNoteEmpty');
  });
  it('hides contact details and documents once the candidate withdraws, and freezes the stage', async () => {
    eq(await withDb(db => withdrawApplication(db, cand, appId)), null);
    const d = await withDb(db => dossier(db, admin, appId))!;
    ok(d && d.candidate.email === null && d.profile?.phone === null && d.documents.length === 0);
    eq((await withDb(db => moveStage(db, admin, [appId], 'shortlisted', null))).moved, 0);
    ok(await withDb(db => !canViewDocuments(db, admin, cand.id)));
  });
});

describe('UDISE+ directory', () => {
  it('imports CSV, skips bad rows and looks codes up', async () => {
    const r = await importUdiseCsv('UDISE Code,School Name,State Name,District,Block\n28230100109,SRI SARASWATHI VIDYA MANDIR,Andhra Pradesh,Chittoor,Madanapalle\nbad,No code,,,\n');
    eq([r.added, r.updated, r.skipped], [1, 0, 1]);
    eq((await lookupUdise('28230100109'))?.district, 'Chittoor');
    eq((await importUdiseCsv('udise code,name\n28230100109,Renamed\n')).updated, 1);
    ok(sameSchoolName('Sri Saraswathi Vidya Mandir', 'SRI SARASWATHI VIDYA MANDIR, '));
    ok(!sameSchoolName('Sri Saraswathi Vidya Mandir', 'Kendriya Vidyalaya No. 1'));
  });
});
