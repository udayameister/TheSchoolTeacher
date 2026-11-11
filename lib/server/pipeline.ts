import type { Application, ApplicationNote, Job, Stage, UserAccount } from '@/types';
import { audit, newId, nowIso, type Store } from './db';
import { managedSchools } from './schools';
import { lookupOf, matchWeights, matchingAllowed } from './catalog';
import { computeMatch, type MatchResult } from '@/lib/jobs/match';
import { docView, type DocView } from './documents';
import { NOTIFY_STAGES } from './schoolEmails';
import { can } from './team';

/*
 * The school's applicant pipeline (ATS): Applied → Screening → Eligible → Shortlisted → Demo / Interview →
 * Panel review → Offer → Joined, plus Not selected. Staff may move an application to any stage (forwards
 * or back) except "withdrawn", which only the candidate can choose. Every move is kept in the history
 * and the audit log; candidates are emailed for shortlisted, interview and not selected.
 */

export const PIPELINE: Stage[] = ['applied', 'screening', 'eligible', 'shortlisted', 'interview', 'panel_review', 'offer', 'joined', 'not_selected'];

/** Is the user on the selection panel of this vacancy? */
export const onPanel = (job: Job | undefined, userId: string) => !!job?.panel?.some(p => p.userId === userId);

/**
 * Applications the user may see: all of their schools' applications with the "pipeline" permission;
 * otherwise (panel members) only those for vacancies whose selection panel they sit on.
 */
export function schoolApplications(db: Store, user: UserAccount): Application[] {
  const mine = new Set(managedSchools(db, user).map(s => s.id));
  const all = db.applications.filter(a => !!a.schoolId && mine.has(a.schoolId));
  if (can(user, 'pipeline')) return all;
  const panelJobs = new Set(db.jobs.filter(j => onPanel(j, user.id)).map(j => j.id));
  return all.filter(a => panelJobs.has(a.jobId));
}

export function canSeeApplication(db: Store, user: UserAccount, app: Application | undefined): app is Application {
  if (!app || !app.schoolId || !managedSchools(db, user).some(s => s.id === app.schoolId)) return false;
  return can(user, 'pipeline') || onPanel(db.jobs.find(j => j.id === app.jobId), user.id);
}

export interface StageChange { app: Application; candidate: UserAccount; job: Job }

/** Moves one or more applications. Returns the changes to email about, or an error key. */
export function moveStage(db: Store, user: UserAccount, appIds: string[], stage: Stage, note: string | null): { changed: StageChange[]; moved: number; error?: string } {
  if (!can(user, 'pipeline')) return { changed: [], moved: 0, error: 'team.errPermission' };
  if (!PIPELINE.includes(stage)) return { changed: [], moved: 0, error: 'ats.errStage' };
  const ids = [...new Set(appIds)].slice(0, 200);
  const apps = ids.map(id => db.applications.find(a => a.id === id));
  if (!apps.length || apps.some(a => !canSeeApplication(db, user, a))) return { changed: [], moved: 0, error: 'ats.errNotFound' };
  const changed: StageChange[] = [];
  let moved = 0;
  const at = nowIso();
  for (const a of apps as Application[]) {
    if (a.stage === 'withdrawn' || a.stage === stage) continue;
    a.stage = stage;
    moved++;
    a.history.push({ stage, at, by: user.id, note: note ? note.slice(0, 500) : null });
    a.updatedAt = at;
    audit(db, { actorId: user.id, action: 'application.stage', target: a.id, detail: stage });
    const candidate = db.users.find(u => u.id === a.candidateId);
    const job = db.jobs.find(j => j.id === a.jobId);
    if (candidate && job && NOTIFY_STAGES.includes(stage)) changed.push({ app: a, candidate, job });
  }
  return { changed, moved };
}

export function addNote(db: Store, user: UserAccount, appId: string, text: string): { note?: ApplicationNote; error?: string } {
  const app = db.applications.find(a => a.id === appId);
  if (!canSeeApplication(db, user, app)) return { error: 'ats.errNotFound' };
  const t = String(text || '').trim().slice(0, 2000);
  if (!t) return { error: 'ats.errNoteEmpty' };
  const note: ApplicationNote = { id: newId('note'), applicationId: appId, authorId: user.id, authorName: user.name, text: t, at: nowIso() };
  db.appNotes.push(note);
  return { note };
}

export interface Dossier {
  app: Application;
  job: Job;
  candidate: { id: string; name: string; email: string | null; emailVerified: boolean };
  profile: Store['profiles'][string] | null;
  documents: DocView[];
  match: MatchResult | null;
  answers: { question: string; answer: string; flagged: boolean }[];
  notes: ApplicationNote[];
}

/** Everything a school needs about one applicant. Withdrawn applications hide contact details and documents. */
export function dossier(db: Store, user: UserAccount, appId: string): Dossier | null {
  const app = db.applications.find(a => a.id === appId);
  if (!canSeeApplication(db, user, app)) return null;
  const job = db.jobs.find(j => j.id === app.jobId);
  const cand = db.users.find(u => u.id === app.candidateId);
  if (!job || !cand) return null;
  const withdrawn = app.stage === 'withdrawn';
  const profile = db.profiles[cand.id] || null;
  const lookup = lookupOf(db);
  return {
    app, job,
    candidate: { id: cand.id, name: cand.name, email: withdrawn ? null : cand.email, emailVerified: cand.emailVerified },
    profile: profile && withdrawn ? { ...profile, phone: null } : profile,
    documents: withdrawn ? [] : db.documents.filter(d => d.userId === cand.id).map(docView),
    // Respect the candidate's matching consent: no score when it was withdrawn (the school reads the profile instead).
    match: profile && matchingAllowed(db, cand.id) ? computeMatch(job, profile, lookup, matchWeights(db)) : null,
    answers: job.screeningQuestions.map(q => {
      const answer = app.answers.find(a => a.questionId === q.id)?.answer || '';
      return { question: q.text, answer, flagged: !!q.mustAnswer && answer !== q.mustAnswer };
    }),
    notes: db.appNotes.filter(n => n.applicationId === app.id).sort((a, b) => a.at.localeCompare(b.at)),
  };
}

