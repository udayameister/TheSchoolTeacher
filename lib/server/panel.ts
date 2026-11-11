import type { Job, MasterItem, PanelMember, PanelRole, PanelScore, Recommendation, UserAccount } from '@/types';
import { audit, newId, nowIso, type Store } from './db';
import { canManageSchool } from './schools';
import { canSeeApplication, onPanel } from './pipeline';
import { listMaster } from './masterData';
import { can, panelCandidates } from './team';

/*
 * Selection panel scoring (adapted from AcadeXMatch components/SelectionCommitteeModal.tsx and lib/scoring.ts,
 * moved to the server so scores stay confidential):
 *  - Each vacancy has a panel: team members with a panel role (Principal, Coordinator, Subject expert,
 *    Management nominee, Other).
 *  - Panel members give each applicant marks out of 10 per dimension. The dimensions and their weights are
 *    admin-editable master data ("Selection-panel score dimensions"; seeded 30 / 30 / 20 / 20).
 *  - The weighted total is out of 100. A member sees only their own scores. Staff with the "scoresAll"
 *    permission (school admin, principal, HR) see every score and the combined ranking.
 *  - The ranking is the average of the members' totals; more scores breaks ties.
 */

export const PANEL_ROLES: PanelRole[] = ['principal', 'coordinator', 'subject_expert', 'management_nominee', 'other'];
export const RECOMMENDATIONS: Recommendation[] = ['strongly_recommend', 'recommend', 'reservations', 'not_recommend'];
export const MAX_PANEL = 12;
/** Stages in which applicants can be scored. */
export const SCORABLE = new Set(['shortlisted', 'interview', 'panel_review', 'offer']);

export const dimensions = (db: Store): MasterItem[] => listMaster(db, 'panelDimensions').filter(d => (Number(d.meta.weight) || 0) > 0);

/** Weighted total out of 100 from marks out of 10. Weights are normalised, so they need not add up to exactly 100. */
export function weightedTotal(marks: Record<string, number>, weights: Record<string, number>): number {
  const sum = Object.values(weights).reduce((s, w) => s + w, 0);
  if (!sum) return 0;
  const total = Object.entries(weights).reduce((s, [id, w]) => s + (w / sum) * ((marks[id] ?? 0) / 10) * 100, 0);
  return Math.round(total * 10) / 10;
}

/** Sets the selection panel of a vacancy. Members must belong to the school's team. */
export function setPanel(db: Store, user: UserAccount, jobId: string, members: unknown): { job?: Job; error?: string } {
  const job = db.jobs.find(j => j.id === jobId);
  if (!job || job.kind !== 'school' || !can(user, 'pipeline') || !canManageSchool(db, user, job.schoolId)) return { error: 'panel.errNotFound' };
  const team = new Set(panelCandidates(db, job.schoolId!).map(m => m.id));
  const list: PanelMember[] = [];
  for (const raw of Array.isArray(members) ? members.slice(0, MAX_PANEL + 1) : []) {
    const m = (raw || {}) as Record<string, unknown>;
    const userId = String(m.userId || ''), role = m.role as PanelRole;
    if (!team.has(userId)) return { error: 'panel.errMember' };
    if (!PANEL_ROLES.includes(role)) return { error: 'panel.errRole' };
    if (!list.some(x => x.userId === userId)) list.push({ userId, role });
  }
  if (list.length > MAX_PANEL) return { error: 'panel.errTooMany' };
  job.panel = list;
  job.updatedAt = nowIso();
  audit(db, { actorId: user.id, action: 'panel.set', target: job.id, detail: `${list.length} member(s)` });
  return { job };
}

export interface ScoreInput { applicationId?: unknown; marks?: unknown; recommendation?: unknown; comments?: unknown }

/** A panel member saves (or updates) their score for one applicant. */
export function submitScore(db: Store, user: UserAccount, input: ScoreInput): { score?: PanelScore; error?: string } {
  const app = db.applications.find(a => a.id === String(input.applicationId || ''));
  if (!canSeeApplication(db, user, app)) return { error: 'panel.errNotFound' };
  const job = db.jobs.find(j => j.id === app.jobId);
  const member = job?.panel?.find(p => p.userId === user.id);
  if (!job || !member) return { error: 'panel.errNotMember' };
  if (!SCORABLE.has(app.stage)) return { error: 'panel.errStage' };
  const dims = dimensions(db);
  if (!dims.length) return { error: 'panel.errNoDimensions' };
  const raw = (input.marks && typeof input.marks === 'object' ? input.marks : {}) as Record<string, unknown>;
  const marks: Record<string, number> = {};
  for (const d of dims) {
    const v = Number(raw[d.id]);
    if (raw[d.id] === '' || raw[d.id] == null || !Number.isFinite(v) || v < 0 || v > 10) return { error: 'panel.errMarks' };
    marks[d.id] = Math.round(v * 2) / 2;
  }
  const recommendation = input.recommendation as Recommendation;
  if (!RECOMMENDATIONS.includes(recommendation)) return { error: 'panel.errRecommendation' };
  const weights = Object.fromEntries(dims.map(d => [d.id, Number(d.meta.weight) || 0]));
  const comments = String(input.comments ?? '').trim().slice(0, 2000) || null;
  const at = nowIso();
  let score = db.panelScores.find(s => s.applicationId === app.id && s.memberId === user.id);
  if (score) Object.assign(score, { marks, weights, total: weightedTotal(marks, weights), recommendation, comments, panelRole: member.role, updatedAt: at });
  else {
    score = { id: newId('psc'), applicationId: app.id, jobId: job.id, schoolId: app.schoolId!, memberId: user.id, panelRole: member.role, marks, weights, total: weightedTotal(marks, weights), recommendation, comments, submittedAt: at, updatedAt: at };
    db.panelScores.push(score);
  }
  // Scores are confidential: the audit log records that a score was saved, not the marks.
  audit(db, { actorId: user.id, action: 'panel.score', target: app.id });
  return { score };
}

export interface ScoreView extends PanelScore { memberName: string }
export interface RankRow { applicationId: string; candidateName: string; stage: string; average: number; count: number; recommendations: Record<Recommendation, number> }

/** Scores for one application that this user may see: all of them with "scoresAll", otherwise only their own. */
export function scoresFor(db: Store, user: UserAccount, appId: string): { mine: PanelScore | null; all: ScoreView[] | null; isMember: boolean; panelSize: number } | null {
  const app = db.applications.find(a => a.id === appId);
  if (!canSeeApplication(db, user, app)) return null;
  const job = db.jobs.find(j => j.id === app.jobId);
  const list = db.panelScores.filter(s => s.applicationId === app.id);
  return {
    mine: list.find(s => s.memberId === user.id) || null,
    all: can(user, 'scoresAll') ? list.map(s => ({ ...s, memberName: db.users.find(u => u.id === s.memberId)?.name || '—' })) : null,
    isMember: onPanel(job, user.id),
    panelSize: job?.panel?.length || 0,
  };
}

/** Combined ranking for a vacancy (only for users with "scoresAll"). */
export function ranking(db: Store, user: UserAccount, jobId: string): RankRow[] | null {
  const job = db.jobs.find(j => j.id === jobId);
  if (!job || !can(user, 'scoresAll') || !canManageSchool(db, user, job.schoolId)) return null;
  const rows: RankRow[] = [];
  for (const a of db.applications.filter(x => x.jobId === job.id && x.stage !== 'withdrawn')) {
    const s = db.panelScores.filter(x => x.applicationId === a.id);
    if (!s.length) continue;
    const recommendations = Object.fromEntries(RECOMMENDATIONS.map(r => [r, s.filter(x => x.recommendation === r).length])) as Record<Recommendation, number>;
    rows.push({ applicationId: a.id, candidateName: db.users.find(u => u.id === a.candidateId)?.name || '—', stage: a.stage, average: Math.round((s.reduce((t, x) => t + x.total, 0) / s.length) * 10) / 10, count: s.length, recommendations });
  }
  return rows.sort((x, y) => y.average - x.average || y.count - x.count || x.candidateName.localeCompare(y.candidateName));
}
