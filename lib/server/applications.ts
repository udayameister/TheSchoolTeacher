import type { Application, Job, Stage, UserAccount } from '@/types';
import { audit, newId, nowIso, type Store } from './db';
import { isPublic, lookupOf, matchWeights, matchingAllowed } from './catalog';
import { computeMatch } from '@/lib/jobs/match';
import { isPast } from '@/lib/jobs/dates';
import { readyToApply } from './profile';
import { WITHDRAWABLE } from '@/lib/jobs/display';

/*
 * Applying, withdrawing, saving and tracking. All checks run on the server:
 * the vacancy must be public, open (last date not passed) and accept applications on the platform;
 * one application per candidate and vacancy; required screening questions answered; minimum profile.
 * Errors are i18n keys under "apply.*" so the browser can show them in the visitor's language.
 */

export type ApplyResult = { ok: true; application: Application } | { ok: false; error: string };

export function applyToJob(db: Store, me: UserAccount, jobId: string, answersIn: unknown, opts: { requireVerifiedEmail: boolean }): ApplyResult {
  const job = db.jobs.find(j => j.id === jobId);
  if (!job || !isPublic(db, job)) return { ok: false, error: 'apply.errNotFound' };
  if (job.status !== 'published' || isPast(job.lastDate)) return { ok: false, error: 'apply.errClosed' };
  if (job.applyMode !== 'platform') return { ok: false, error: 'apply.errExternal' };
  if (opts.requireVerifiedEmail && !me.emailVerified) return { ok: false, error: 'apply.errVerifyEmail' };
  const existing = db.applications.find(a => a.jobId === jobId && a.candidateId === me.id);
  if (existing) return { ok: false, error: existing.stage === 'withdrawn' ? 'apply.errWithdrawn' : 'apply.errDuplicate' };
  const profile = db.profiles[me.id];
  const notReady = readyToApply(profile);
  if (notReady) return { ok: false, error: notReady };

  const given = new Map<string, string>();
  for (const raw of Array.isArray(answersIn) ? answersIn.slice(0, 30) : []) {
    const a = (raw || {}) as Record<string, unknown>;
    if (typeof a.questionId === 'string') given.set(a.questionId, String(a.answer ?? '').trim().slice(0, 1000));
  }
  const answers: Application['answers'] = [];
  for (const q of job.screeningQuestions) {
    let v = given.get(q.id) || '';
    if (q.type === 'yesno' && v && v !== 'yes' && v !== 'no') v = '';
    if (q.type === 'number' && v && !Number.isFinite(Number(v))) v = '';
    if (q.required && !v) return { ok: false, error: 'apply.errAnswers' };
    if (v) answers.push({ questionId: q.id, answer: v });
  }

  const at = nowIso();
  const score = matchingAllowed(db, me.id) ? computeMatch(job, profile!, lookupOf(db), matchWeights(db)).score : null;
  const application: Application = {
    id: newId('app'), jobId, candidateId: me.id, schoolId: job.schoolId ?? null, stage: 'applied',
    history: [{ stage: 'applied', at, by: me.id }], answers, matchScore: score, appliedAt: at, updatedAt: at,
  };
  db.applications.push(application);
  // Applying also puts the vacancy on the candidate's deadline tracker.
  if (!db.tracked.some(t => t.userId === me.id && t.jobId === jobId)) db.tracked.push(trackedFromJob(me.id, job, 'applied'));
  else for (const t of db.tracked) if (t.userId === me.id && t.jobId === jobId) { t.status = 'applied'; t.updatedAt = at; }
  audit(db, { actorId: me.id, action: 'application.create', target: application.id, detail: jobId });
  return { ok: true, application };
}

export function withdrawApplication(db: Store, me: UserAccount, appId: string): string | null {
  const a = db.applications.find(x => x.id === appId && x.candidateId === me.id);
  if (!a) return 'apply.errNotFound';
  if (!WITHDRAWABLE.includes(a.stage)) return 'apply.errCannotWithdraw';
  const at = nowIso();
  a.stage = 'withdrawn' as Stage;
  a.history.push({ stage: 'withdrawn', at, by: me.id });
  a.updatedAt = at;
  audit(db, { actorId: me.id, action: 'application.withdraw', target: a.id });
  return null;
}

export function trackedFromJob(userId: string, job: Job, status: 'interested' | 'applied' = 'interested') {
  const at = nowIso();
  return { id: newId('trk'), userId, jobId: job.id, title: job.title, organisation: job.orgName, url: job.applyMode === 'external' ? job.externalUrl ?? null : null, lastDate: job.lastDate, status, notes: null, createdAt: at, updatedAt: at };
}
