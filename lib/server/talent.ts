import type { Job, TalentInvite, UserAccount } from '@/types';
import { audit, newId, type Store } from './db';
import { canManageSchool, currentSchool } from './schools';
import { lookupOf, matchingAllowed } from './catalog';
import { experienceYears, tetValid } from '@/lib/jobs/match';
import { isPast } from '@/lib/jobs/dates';
import { can } from './team';

/*
 * Talent search (adapted from AcadeXMatch app/api/talent/route.ts and app/institute/talent): schools search
 * candidates who switched on "discoverable profile" (and have not withdrawn matching consent), and invite
 * them to apply for an open vacancy. Contact details, phone, salary expectations and documents are never
 * shown here: a school sees them only after the candidate applies. Searches and invitations are audited.
 */

export interface TalentFilters { subject?: string; tet?: string; qualification?: string; minExp?: number; state?: string; district?: string; medium?: string; level?: string }

export interface TalentCard {
  id: string;
  name: string;
  headline: string | null;
  place: { cityText: string | null; districtId: string | null; stateId: string | null };
  subjectIds: string[];
  levelIds: string[];
  qualificationIds: string[];
  tetIds: string[];
  mediumIds: string[];
  years: number;
  willingToRelocate: boolean;
  updatedAt: string;
  /** Already applied to one of this school's vacancies, or already invited by this school. */
  applied: boolean;
  invitedJobIds: string[];
}

export const PAGE_SIZE = 30;
export const DAILY_INVITES = 100;

export function cleanTalentFilters(q: Record<string, string | undefined>): TalentFilters {
  const f: TalentFilters = {};
  for (const k of ['subject', 'tet', 'qualification', 'state', 'district', 'medium', 'level'] as const) { const v = (q[k] || '').trim().slice(0, 80); if (v) f[k] = v; }
  const n = Number(q.minExp);
  if (Number.isFinite(n) && n > 0) f.minExp = Math.min(40, n);
  return f;
}

/** Discoverable candidates matching the filters (best fit first: more years, then most recently updated). */
export function searchTalent(db: Store, user: UserAccount, f: TalentFilters, page = 1): { results: TalentCard[]; total: number } | null {
  if (!can(user, 'talent')) return null;
  const school = currentSchool(db, user);
  if (!school) return null;
  const lookup = lookupOf(db);
  const mineApps = new Set(db.applications.filter(a => a.schoolId === school.id).map(a => a.candidateId));
  const cards: TalentCard[] = [];
  for (const u of db.users) {
    if (u.role !== 'candidate' || u.status !== 'active') continue;
    const p = db.profiles[u.id];
    if (!p?.discoverable || !matchingAllowed(db, u.id)) continue;
    const tetIds = p.tets.filter(t => tetValid(t)).map(t => t.tetId);
    const qualificationIds = p.qualifications.map(q => q.qualificationId);
    const years = experienceYears(p);
    if (f.subject && !p.subjectIds.includes(f.subject)) continue;
    if (f.level && !p.levelIds.includes(f.level)) continue;
    if (f.tet && !tetIds.includes(f.tet)) continue;
    if (f.qualification && !qualificationIds.includes(f.qualification)) continue;
    if (f.medium && !p.mediums.some(m => m.mediumId === f.medium)) continue;
    if (f.minExp && years < f.minExp) continue;
    if (f.district && p.districtId !== f.district && !p.preferredDistrictIds.includes(f.district)) continue;
    if (f.state && p.stateId !== f.state && !p.preferredStateIds.includes(f.state) && !(p.districtId && lookup.get(p.districtId)?.parentId === f.state)) continue;
    cards.push({
      id: u.id, name: u.name, headline: p.headline || null, place: { cityText: p.city || null, districtId: p.districtId || null, stateId: p.stateId || null },
      subjectIds: p.subjectIds, levelIds: p.levelIds, qualificationIds: [...new Set(qualificationIds)], tetIds: [...new Set(tetIds)], mediumIds: p.mediums.map(m => m.mediumId),
      years, willingToRelocate: p.willingToRelocate, updatedAt: p.updatedAt, applied: mineApps.has(u.id),
      invitedJobIds: db.talentInvites.filter(i => i.schoolId === school.id && i.candidateId === u.id).map(i => i.jobId),
    });
  }
  cards.sort((a, b) => b.years - a.years || b.updatedAt.localeCompare(a.updatedAt));
  const start = (Math.max(1, page) - 1) * PAGE_SIZE;
  audit(db, { actorId: user.id, action: 'talent.search', target: school.id, detail: JSON.stringify(f).slice(0, 300) });
  return { results: cards.slice(start, start + PAGE_SIZE), total: cards.length };
}

/** Vacancies a school can invite candidates to: published, through the platform, not past the last date. */
export function invitableJobs(db: Store, schoolId: string): Job[] {
  return db.jobs.filter(j => j.schoolId === schoolId && j.status === 'published' && j.applyMode === 'platform' && !isPast(j.lastDate));
}

export function inviteTalent(db: Store, user: UserAccount, input: { candidateId?: unknown; jobId?: unknown; message?: unknown }, now = Date.now()): { invite?: TalentInvite; candidate?: UserAccount; job?: Job; error?: string } {
  if (!can(user, 'talent')) return { error: 'team.errPermission' };
  const job = db.jobs.find(j => j.id === String(input.jobId || ''));
  if (!job || !canManageSchool(db, user, job.schoolId) || !invitableJobs(db, job.schoolId!).some(j => j.id === job.id)) return { error: 'talent.errJob' };
  const cand = db.users.find(u => u.id === String(input.candidateId || '') && u.role === 'candidate' && u.status === 'active');
  if (!cand || !db.profiles[cand.id]?.discoverable || !matchingAllowed(db, cand.id)) return { error: 'talent.errCandidate' };
  if (db.applications.some(a => a.jobId === job.id && a.candidateId === cand.id)) return { error: 'talent.errApplied' };
  if (db.talentInvites.some(i => i.jobId === job.id && i.candidateId === cand.id)) return { error: 'talent.errInvited' };
  const since = new Date(now - 86400_000).toISOString();
  if (db.talentInvites.filter(i => i.schoolId === job.schoolId && i.at >= since).length >= DAILY_INVITES) return { error: 'talent.errLimit' };
  const message = String(input.message ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 600) || null;
  const invite: TalentInvite = { id: newId('tin'), schoolId: job.schoolId!, jobId: job.id, candidateId: cand.id, message, invitedBy: user.id, at: new Date(now).toISOString() };
  db.talentInvites.push(invite);
  audit(db, { actorId: user.id, action: 'talent.invite', target: cand.id, detail: job.id });
  return { invite, candidate: cand, job };
}

/** Invitations a candidate received for vacancies that are still open. */
export function candidateInvites(db: Store, me: UserAccount): { invite: TalentInvite; job: Job; applied: boolean }[] {
  return db.talentInvites.filter(i => i.candidateId === me.id).map(invite => ({ invite, job: db.jobs.find(j => j.id === invite.jobId)! }))
    .filter(x => x.job && x.job.status === 'published' && !isPast(x.job.lastDate))
    .map(x => ({ ...x, applied: db.applications.some(a => a.jobId === x.job.id && a.candidateId === me.id) }))
    .sort((a, b) => b.invite.at.localeCompare(a.invite.at));
}

