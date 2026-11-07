import type { CandidateProfile, Job } from '@/types';
import type { Lookup } from './filters';
import { monthlyPay } from './filters';
import { todayIst } from './dates';

/*
 * Explainable match score between a candidate profile and a vacancy (0–100).
 * Parts and default weights (admin-editable in Master data → Match-score weights):
 *   qualification & TET 35, subject & class fit 25, experience 15, medium 10, location 10, salary 5.
 * When a mandatory requirement is unmet (a required qualification or a required TET), the score is
 * capped at MANDATORY_CAP (default 49), so such a match never looks like a good one.
 * Every part returns reasons as i18n keys + values, so "Why this match?" can be shown in any language.
 */

export type PartKey = 'QUAL_TET' | 'SUBJECT_CLASS' | 'EXPERIENCE' | 'MEDIUM' | 'LOCATION' | 'SALARY';
export const PART_KEYS: PartKey[] = ['QUAL_TET', 'SUBJECT_CLASS', 'EXPERIENCE', 'MEDIUM', 'LOCATION', 'SALARY'];
export const DEFAULT_WEIGHTS: Record<PartKey | 'MANDATORY_CAP', number> = { QUAL_TET: 35, SUBJECT_CLASS: 25, EXPERIENCE: 15, MEDIUM: 10, LOCATION: 10, SALARY: 5, MANDATORY_CAP: 49 };

export interface Reason { key: string; vars?: Record<string, string | number>; ok: boolean }
export interface MatchPart { key: PartKey; weight: number; earned: number; fraction: number; reasons: Reason[] }
export interface MatchResult { score: number; capped: boolean; parts: MatchPart[]; unmet: Reason[] }

const name = (lookup: Lookup, id: string | null | undefined) => (id ? lookup.get(id)?.name ?? id : '');
const names = (lookup: Lookup, ids: string[]) => ids.map(id => name(lookup, id)).join(', ');

/** Total teaching experience in years (overlapping periods are not merged; months are counted per entry). */
export function experienceYears(p: CandidateProfile, now = new Date()): number {
  const nowYm = todayIst(now).slice(0, 7);
  const months = p.experience.reduce((sum, e) => {
    const end = e.current || !e.to ? nowYm : e.to;
    const [fy, fm] = e.from.split('-').map(Number), [ty, tm] = end.split('-').map(Number);
    return sum + Math.max(0, (ty - fy) * 12 + (tm - fm) + 1);
  }, 0);
  return Math.round((months / 12) * 10) / 10;
}

/** Is a TET entry still valid today? Lifetime certificates and entries without an expiry date count as valid. */
export function tetValid(t: { validUntil?: string | null; lifetime?: boolean }, now = new Date()): boolean {
  return !!t.lifetime || !t.validUntil || t.validUntil >= todayIst(now);
}

export function computeMatch(job: Job, p: CandidateProfile, lookup: Lookup, weightsIn: Partial<Record<string, number>> = {}, now = new Date()): MatchResult {
  const w = { ...DEFAULT_WEIGHTS, ...weightsIn };
  const unmet: Reason[] = [];
  const parts: MatchPart[] = [];
  const add = (key: PartKey, fraction: number, reasons: Reason[]) => {
    const f = Math.max(0, Math.min(1, fraction));
    parts.push({ key, weight: w[key], earned: Math.round(w[key] * f * 10) / 10, fraction: f, reasons });
  };
  const e = job.eligibility;

  // 1. Qualification & TET
  {
    const reasons: Reason[] = [];
    const held = new Set(p.qualifications.map(q => q.qualificationId));
    const missing = e.requiredQualificationIds.filter(id => !held.has(id));
    const reqFrac = e.requiredQualificationIds.length ? (e.requiredQualificationIds.length - missing.length) / e.requiredQualificationIds.length : 1;
    if (e.requiredQualificationIds.length) {
      if (missing.length) { const r = { key: 'match.qualMissing', vars: { list: names(lookup, missing) }, ok: false }; reasons.push(r); unmet.push(r); }
      else reasons.push({ key: 'match.qualOk', vars: { list: names(lookup, e.requiredQualificationIds) }, ok: true });
    }
    let tetFrac = 1;
    if (e.tetRequired) {
      const accepted = e.acceptedTetIds;
      const mine = p.tets.filter(t => !accepted.length || accepted.includes(t.tetId));
      const valid = mine.filter(t => tetValid(t, now));
      if (valid.length) reasons.push({ key: 'match.tetOk', vars: { list: names(lookup, [...new Set(valid.map(t => t.tetId))]) }, ok: true });
      else {
        tetFrac = 0;
        const r = mine.length
          ? { key: 'match.tetExpired', vars: { list: names(lookup, [...new Set(mine.map(t => t.tetId))]) }, ok: false }
          : { key: 'match.tetMissing', vars: { list: accepted.length ? names(lookup, accepted) : 'TET' }, ok: false };
        reasons.push(r); unmet.push(r);
      }
    }
    let pctFrac = 1;
    if (e.minPercentage) {
      const best = Math.max(-1, ...p.qualifications.map(q => q.percentage ?? -1));
      if (best < 0) { pctFrac = 0.5; reasons.push({ key: 'match.pctUnknown', vars: { min: e.minPercentage }, ok: false }); }
      else if (best < e.minPercentage) { pctFrac = 0; reasons.push({ key: 'match.pctLow', vars: { min: e.minPercentage, have: best }, ok: false }); }
      else reasons.push({ key: 'match.pctOk', vars: { min: e.minPercentage }, ok: true });
    }
    const pref = e.preferredQualificationIds.filter(id => held.has(id));
    if (pref.length) reasons.push({ key: 'match.preferredOk', vars: { list: names(lookup, pref) }, ok: true });
    if (!reasons.length) reasons.push({ key: 'match.noQualRule', ok: true });
    add('QUAL_TET', reqFrac * 0.5 + tetFrac * 0.35 + pctFrac * 0.15, reasons);
  }

  // 2. Subject & class fit
  {
    const reasons: Reason[] = [];
    const subj = job.subjectIds.length ? job.subjectIds.filter(s => p.subjectIds.includes(s)) : [];
    const subjFrac = job.subjectIds.length ? (subj.length ? 1 : 0) : 1;
    if (job.subjectIds.length) reasons.push(subj.length ? { key: 'match.subjectOk', vars: { list: names(lookup, subj) }, ok: true } : { key: 'match.subjectNo', vars: { list: names(lookup, job.subjectIds) }, ok: false });
    const lvl = job.levelIds.filter(l => p.levelIds.includes(l));
    const lvlFrac = job.levelIds.length ? lvl.length / job.levelIds.length : 1;
    if (job.levelIds.length) reasons.push(lvl.length ? { key: 'match.levelOk', vars: { list: names(lookup, lvl) }, ok: true } : { key: 'match.levelNo', vars: { list: names(lookup, job.levelIds) }, ok: false });
    add('SUBJECT_CLASS', subjFrac * 0.6 + lvlFrac * 0.4, reasons);
  }

  // 3. Experience
  {
    const years = experienceYears(p, now);
    const min = e.minExperienceYears || 0;
    const frac = min > 0 ? years / min : years > 0 ? 1 : 0.6;
    const ok = years >= min;
    add('EXPERIENCE', frac, [min > 0
      ? { key: ok ? 'match.expOk' : 'match.expShort', vars: { have: years, min }, ok }
      : { key: years > 0 ? 'match.expHave' : 'match.expFresh', vars: { have: years }, ok: true }]);
  }

  // 4. Medium / language
  {
    if (!e.mediumIds.length) add('MEDIUM', 1, [{ key: 'match.mediumAny', ok: true }]);
    else {
      const mine = p.mediums.filter(m => e.mediumIds.includes(m.mediumId));
      const strong = mine.filter(m => m.proficiency !== 'basic');
      add('MEDIUM', strong.length ? 1 : mine.length ? 0.5 : 0, [strong.length
        ? { key: 'match.mediumOk', vars: { list: names(lookup, strong.map(m => m.mediumId)) }, ok: true }
        : mine.length ? { key: 'match.mediumBasic', vars: { list: names(lookup, mine.map(m => m.mediumId)) }, ok: false }
          : { key: 'match.mediumNo', vars: { list: names(lookup, e.mediumIds) }, ok: false }]);
    }
  }

  // 5. Location
  {
    const place = name(lookup, job.districtId) || job.city;
    let frac: number, r: Reason;
    if (job.districtId && (p.preferredDistrictIds.includes(job.districtId) || p.districtId === job.districtId)) { frac = 1; r = { key: 'match.locDistrict', vars: { place }, ok: true }; }
    else if (p.preferredStateIds.includes(job.stateId) || p.stateId === job.stateId) { frac = 0.7; r = { key: 'match.locState', vars: { place: name(lookup, job.stateId) }, ok: true }; }
    else if (p.willingToRelocate) { frac = 0.5; r = { key: 'match.locRelocate', vars: { place: name(lookup, job.stateId) }, ok: true }; }
    else { frac = 0.15; r = { key: 'match.locFar', vars: { place: name(lookup, job.stateId) }, ok: false }; }
    add('LOCATION', frac, [r]);
  }

  // 6. Salary
  {
    const pay = monthlyPay(job, lookup);
    const want = p.expectedSalary;
    if (!want || pay === null) add('SALARY', 0.5, [{ key: pay === null ? 'match.payUnknown' : 'match.payNoExpectation', ok: true }]);
    else add('SALARY', pay >= want ? 1 : pay / want, [{ key: pay >= want ? 'match.payOk' : 'match.payLow', vars: { pay, want }, ok: pay >= want }]);
  }

  const total = PART_KEYS.reduce((s, k) => s + w[k], 0) || 1;
  let score = Math.round((parts.reduce((s, x) => s + x.earned, 0) / total) * 100);
  const capped = unmet.length > 0 && score > w.MANDATORY_CAP;
  if (capped) score = w.MANDATORY_CAP;
  return { score, capped, parts, unmet };
}
