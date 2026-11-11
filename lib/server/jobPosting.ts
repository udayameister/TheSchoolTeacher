import type { Job, JobPay, JobStatus, MasterKind, PayMode, ScreeningQuestion, UserAccount } from '@/types';
import type { Lookup } from '@/lib/jobs/filters';
import { daysLeft, isIsoDate } from '@/lib/jobs/dates';
import { audit, newId, nowIso, type Store } from './db';
import { canManageSchool } from './schools';
import { can } from './team';

/** Vacancies need the "jobs" permission (panel-only staff cannot post or edit). */
const canEditJobs = (db: Store, user: UserAccount, schoolId: string | null | undefined) => can(user, 'jobs') && canManageSchool(db, user, schoolId);

/*
 * Vacancies posted by schools: server-side validation of the vacancy form, create / edit, publish /
 * close / reopen and duplicate. Location, boards and management type come from the school record, so a
 * vacancy always matches its (verified) school. Errors are i18n keys under "post.*".
 */

const str = (v: unknown, max: number) => { const s = String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max); return s || null; };
const arr = (v: unknown, max = 40): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const ids = (lookup: Lookup, v: unknown, kind: MasterKind) => [...new Set(arr(v).map(String))].filter(id => lookup.get(id)?.kind === kind);
const oneId = (lookup: Lookup, v: unknown, kind: MasterKind) => (typeof v === 'string' && lookup.get(v)?.kind === kind ? v : null);
const money = (v: unknown) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? n : NaN; };

export const MAX_QUESTIONS = 10;

export function cleanJob(input: Record<string, unknown>, lookup: Lookup): { fields?: Partial<Job>; error?: string } {
  const title = str(input.title, 160);
  if (!title || title.length < 5) return { error: 'post.errTitle' };
  const postId = oneId(lookup, input.postId, 'posts');
  if (!postId) return { error: 'post.errPost' };
  const subjectIds = ids(lookup, input.subjectIds, 'subjects');
  if (lookup.get(postId)?.meta.subjectWise === true && !subjectIds.length) return { error: 'post.errSubject' };
  const levelIds = ids(lookup, input.levelIds, 'schoolLevels');
  if (!levelIds.length && lookup.get(postId)?.meta.category === 'teaching') return { error: 'post.errLevel' };
  const employmentTypeId = oneId(lookup, input.employmentTypeId, 'employmentTypes');
  if (!employmentTypeId) return { error: 'post.errEmployment' };
  const vacancies = Math.round(Number(input.vacancies));
  if (!(vacancies >= 1 && vacancies <= 999)) return { error: 'post.errVacancies' };
  const description = str(input.description, 8000);
  if (!description || description.length < 30) return { error: 'post.errDescription' };
  const lastDate = input.lastDate;
  if (!isIsoDate(lastDate)) return { error: 'post.errLastDate' };
  const dl = daysLeft(lastDate);
  if (dl === null || dl > 366) return { error: 'post.errLastDateFar' };

  const e = (input.eligibility || {}) as Record<string, unknown>;
  const minExp = Number(e.minExperienceYears || 0);
  if (!(minExp >= 0 && minExp <= 40)) return { error: 'post.errExperience' };
  const minPct = e.minPercentage === '' || e.minPercentage == null ? null : Number(e.minPercentage);
  if (minPct !== null && !(minPct > 0 && minPct <= 100)) return { error: 'post.errPercentage' };
  const eligibility = {
    requiredQualificationIds: ids(lookup, e.requiredQualificationIds, 'qualifications'),
    preferredQualificationIds: ids(lookup, e.preferredQualificationIds, 'qualifications'),
    tetRequired: e.tetRequired === true,
    acceptedTetIds: e.tetRequired === true ? ids(lookup, e.acceptedTetIds, 'tetExams') : [],
    tetPaper: e.tetRequired === true ? str(e.tetPaper, 80) : null,
    minExperienceYears: Math.round(minExp * 10) / 10,
    minPercentage: minPct,
    mediumIds: ids(lookup, e.mediumIds, 'mediums'),
    policeVerificationRequired: e.policeVerificationRequired === true,
    otherRequirements: str(e.otherRequirements, 1000),
  };
  eligibility.preferredQualificationIds = eligibility.preferredQualificationIds.filter(q => !eligibility.requiredQualificationIds.includes(q));

  const p = (input.pay || {}) as Record<string, unknown>;
  const mode = (['cpc', 'state_scale', 'range', 'not_disclosed'] as PayMode[]).find(m => m === p.mode) || 'not_disclosed';
  const pay: JobPay = { mode, payLevelId: null, scaleText: null, min: null, max: null, benefitIds: ids(lookup, p.benefitIds, 'benefits') };
  if (mode === 'cpc') { pay.payLevelId = oneId(lookup, p.payLevelId, 'payLevels'); if (!pay.payLevelId) return { error: 'post.errPayLevel' }; }
  if (mode === 'state_scale') { pay.scaleText = str(p.scaleText, 200); if (!pay.scaleText) return { error: 'post.errScale' }; }
  if (mode === 'range') {
    const min = money(p.min), max = money(p.max);
    if (Number.isNaN(min) || Number.isNaN(max) || (!min && !max)) return { error: 'post.errRange' };
    if (min && max && min > max) return { error: 'post.errRangeOrder' };
    pay.min = min; pay.max = max;
  }

  const questions: ScreeningQuestion[] = [];
  for (const raw of arr(input.screeningQuestions, MAX_QUESTIONS + 5)) {
    const q = (raw || {}) as Record<string, unknown>;
    const text = str(q.text, 200);
    if (!text) continue;
    if (text.length < 5) return { error: 'post.errQuestion' };
    const type = q.type === 'text' || q.type === 'number' ? q.type : 'yesno';
    questions.push({ id: str(q.id, 40) || newId('sq'), text, type, required: q.required !== false, mustAnswer: type === 'yesno' && (q.mustAnswer === 'yes' || q.mustAnswer === 'no') ? q.mustAnswer : null });
  }
  if (questions.length > MAX_QUESTIONS) return { error: 'post.errQuestions' };

  return {
    fields: {
      title, postId, subjectIds, levelIds, streamIds: ids(lookup, input.streamIds, 'streams'), employmentTypeId, vacancies, description,
      eligibility, pay, screeningQuestions: questions, lastDate, premium: input.premium === true,
    },
  };
}

export type SaveResult = { job?: Job; error?: string; published?: boolean };

/** Creates or updates a vacancy for a school the user manages. `publish` publishes it (verified schools only). */
export function saveJob(db: Store, user: UserAccount, input: Record<string, unknown>, lookup: Lookup): SaveResult {
  const existing = typeof input.id === 'string' ? db.jobs.find(j => j.id === input.id) : undefined;
  if (input.id && !existing) return { error: 'post.errNotFound' };
  const schoolId = existing?.schoolId || (typeof input.schoolId === 'string' ? input.schoolId : '');
  if (!canEditJobs(db, user, schoolId)) return { error: 'post.errNotFound' };
  const school = db.schools.find(s => s.id === schoolId)!;
  const { fields, error } = cleanJob(input, lookup);
  if (!fields) return { error };
  const publish = input.publish === true;
  if (publish && school.verification !== 'verified') return { error: 'post.errNotVerified' };
  if (publish && (daysLeft(fields.lastDate) ?? -1) < 0) return { error: 'post.errLastDatePast' };
  const at = nowIso();
  const fromSchool = {
    kind: 'school' as const, schoolId: school.id, orgName: school.name, boardIds: school.boardIds, managementTypeId: school.managementTypeId,
    stateId: school.stateId, districtId: school.districtId ?? null, city: school.city, pincode: school.pincode ?? null, lat: school.lat ?? null, lng: school.lng ?? null,
    applyMode: 'platform' as const, externalUrl: null, notificationPdfUrl: null, keyDates: [],
  };
  let job: Job;
  let published = false;
  if (existing) {
    const wasLive = existing.status === 'published';
    Object.assign(existing, fields, fromSchool, { updatedAt: at });
    if (publish && !wasLive) { existing.status = 'published'; existing.publishedAt ||= at; published = true; }
    job = existing;
  } else {
    job = {
      id: newId('job'), title: '', postId: '', subjectIds: [], levelIds: [], streamIds: [], employmentTypeId: '', vacancies: 1, description: '',
      eligibility: fields.eligibility!, pay: fields.pay!, premium: false, screeningQuestions: [], lastDate: '',
      ...fromSchool, ...fields,
      status: publish ? 'published' : 'draft', publishedAt: publish ? at : null, createdAt: at, updatedAt: at, createdBy: user.id, views: 0,
    } as Job;
    db.jobs.push(job);
    published = publish;
  }
  audit(db, { actorId: user.id, action: existing ? 'job.update' : 'job.create', target: job.id, detail: `${job.title} (${job.status})` });
  return { job, published };
}

/** Publish, close or reopen. Reopening needs a last date in the future. */
export function setJobStatus(db: Store, user: UserAccount, jobId: string, status: JobStatus): SaveResult {
  const job = db.jobs.find(j => j.id === jobId);
  if (!job || job.kind !== 'school' || !canEditJobs(db, user, job.schoolId)) return { error: 'post.errNotFound' };
  const school = db.schools.find(s => s.id === job.schoolId);
  if (status === 'published') {
    if (school?.verification !== 'verified') return { error: 'post.errNotVerified' };
    if ((daysLeft(job.lastDate) ?? -1) < 0) return { error: 'post.errLastDatePast' };
  }
  const published = status === 'published' && job.status !== 'published';
  job.status = status;
  if (published) job.publishedAt ||= nowIso();
  job.updatedAt = nowIso();
  audit(db, { actorId: user.id, action: `job.${status}`, target: job.id });
  return { job, published };
}

/** Copies a vacancy as a new draft ("Copy of …"), keeping everything except dates and counts. */
export function duplicateJob(db: Store, user: UserAccount, jobId: string): SaveResult {
  const src = db.jobs.find(j => j.id === jobId);
  if (!src || src.kind !== 'school' || !canEditJobs(db, user, src.schoolId)) return { error: 'post.errNotFound' };
  const at = nowIso();
  const copy: Job = { ...structuredClone(src), id: newId('job'), title: `${src.title}`.slice(0, 150), status: 'draft', publishedAt: null, createdAt: at, updatedAt: at, createdBy: user.id, views: 0 };
  copy.screeningQuestions = copy.screeningQuestions.map(q => ({ ...q, id: newId('sq') }));
  db.jobs.push(copy);
  audit(db, { actorId: user.id, action: 'job.duplicate', target: copy.id, detail: src.id });
  return { job: copy };
}

/** Deletes a draft that never received applications. */
export function deleteDraft(db: Store, user: UserAccount, jobId: string): string | null {
  const job = db.jobs.find(j => j.id === jobId);
  if (!job || job.kind !== 'school' || !canEditJobs(db, user, job.schoolId)) return 'post.errNotFound';
  if (job.status !== 'draft' || db.applications.some(a => a.jobId === jobId)) return 'post.errDeleteDraftOnly';
  db.jobs = db.jobs.filter(j => j !== job);
  audit(db, { actorId: user.id, action: 'job.delete_draft', target: jobId });
  return null;
}
