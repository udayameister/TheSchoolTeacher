import type { CandidateProfile, ExperienceEntry, MasterKind, QualificationEntry, StoredDocument, TetEntry, UserAccount } from '@/types';
import type { Lookup } from '@/lib/jobs/filters';
import { isIsoDate, isYearMonth } from '@/lib/jobs/dates';
import { newId, nowIso } from './db';

/*
 * Candidate profile: an empty starting profile, server-side cleaning of everything the browser sends
 * (unknown master-data ids are dropped, lengths and numbers bounded), and the completeness meter.
 */

export function emptyProfile(userId: string): CandidateProfile {
  return {
    userId, phone: null, headline: null, about: null, stateId: null, districtId: null, city: null, pincode: null,
    qualifications: [], tets: [], subjectIds: [], levelIds: [], mediums: [], experience: [],
    preferredStateIds: [], preferredDistrictIds: [], willingToRelocate: false, expectedSalary: null,
    computerProficiency: 'none', rciNumber: null, certifications: null,
    childSafety: { policeVerification: 'not_done', policeVerificationDate: null, selfDeclarationAt: null },
    discoverable: false, updatedAt: nowIso(),
  };
}

const str = (v: unknown, max: number) => { const s = String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max); return s || null; };
const int = (v: unknown, min: number, max: number) => { if (v === null || v === undefined || v === '') return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const dec = (v: unknown, min: number, max: number) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null; };
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

/** Keeps only ids that exist in the given master list. */
function ids(lookup: Lookup, v: unknown, kind: MasterKind, max = 40): string[] {
  return [...new Set(arr(v, max).map(String))].filter(id => lookup.get(id)?.kind === kind);
}
function oneId(lookup: Lookup, v: unknown, kind: MasterKind): string | null {
  const id = typeof v === 'string' ? v : '';
  return lookup.get(id)?.kind === kind ? id : null;
}

export function cleanProfile(input: Record<string, unknown>, prev: CandidateProfile, lookup: Lookup): { profile?: CandidateProfile; error?: string } {
  const phone = str(input.phone, 20);
  if (phone && !/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/.test(phone)) return { error: 'Enter a 10-digit Indian mobile number.' };
  const pincode = str(input.pincode, 6);
  if (pincode && !/^[1-9]\d{5}$/.test(pincode)) return { error: 'Enter a 6-digit PIN code.' };

  const stateId = oneId(lookup, input.stateId, 'states');
  const districtId = oneId(lookup, input.districtId, 'districts');
  if (districtId && lookup.get(districtId)?.parentId !== stateId) return { error: 'The district does not belong to the chosen state.' };

  const qualifications: QualificationEntry[] = arr(input.qualifications, 20).map(raw => {
    const q = (raw || {}) as Record<string, unknown>;
    return { id: str(q.id, 40) || newId('q'), qualificationId: oneId(lookup, q.qualificationId, 'qualifications') || '', subjectId: oneId(lookup, q.subjectId, 'subjects'), institution: str(q.institution, 160) || '', year: int(q.year, 1960, 2100), percentage: dec(q.percentage, 0, 100) };
  }).filter(q => q.qualificationId);

  const tets: TetEntry[] = arr(input.tets, 20).map(raw => {
    const t = (raw || {}) as Record<string, unknown>;
    return { id: str(t.id, 40) || newId('t'), tetId: oneId(lookup, t.tetId, 'tetExams') || '', paper: str(t.paper, 80) || '', year: int(t.year, 2000, 2100), score: dec(t.score, 0, 1000), validUntil: isIsoDate(t.validUntil) ? t.validUntil : null, lifetime: t.lifetime === true };
  }).filter(t => t.tetId);

  const experience: ExperienceEntry[] = [];
  for (const raw of arr(input.experience, 30)) {
    const x = (raw || {}) as Record<string, unknown>;
    const school = str(x.school, 160);
    if (!school) continue;
    if (!isYearMonth(x.from)) return { error: `Experience at ${school}: enter the start month.` };
    const current = x.current === true;
    const to = current ? null : isYearMonth(x.to) ? x.to : null;
    if (!current && !to) return { error: `Experience at ${school}: enter the end month, or tick "I work here now".` };
    if (to && to < (x.from as string)) return { error: `Experience at ${school}: the end month is before the start month.` };
    experience.push({ id: str(x.id, 40) || newId('x'), school, boardId: oneId(lookup, x.boardId, 'boards'), postId: oneId(lookup, x.postId, 'posts'), from: x.from as string, to, current, levelIds: ids(lookup, x.levelIds, 'schoolLevels'), subjectIds: ids(lookup, x.subjectIds, 'subjects') });
  }

  const mediums = arr(input.mediums, 25).map(raw => {
    const m = (raw || {}) as Record<string, unknown>;
    const p = m.proficiency === 'native' || m.proficiency === 'fluent' ? m.proficiency : 'basic';
    return { mediumId: oneId(lookup, m.mediumId, 'mediums') || '', proficiency: p as 'basic' | 'fluent' | 'native' };
  }).filter((m, i, a) => m.mediumId && a.findIndex(x => x.mediumId === m.mediumId) === i);

  const cs = (input.childSafety || {}) as Record<string, unknown>;
  const pv = cs.policeVerification === 'done' || cs.policeVerification === 'applied' ? cs.policeVerification : 'not_done';
  const declared = cs.selfDeclaration === true;

  const profile: CandidateProfile = {
    userId: prev.userId,
    phone, headline: str(input.headline, 140), about: str(input.about, 2000),
    stateId, districtId, city: str(input.city, 80), pincode,
    qualifications, tets,
    subjectIds: ids(lookup, input.subjectIds, 'subjects'),
    levelIds: ids(lookup, input.levelIds, 'schoolLevels'),
    mediums, experience,
    preferredStateIds: ids(lookup, input.preferredStateIds, 'states', 36),
    preferredDistrictIds: ids(lookup, input.preferredDistrictIds, 'districts', 30),
    willingToRelocate: input.willingToRelocate === true,
    expectedSalary: int(input.expectedSalary, 0, 1_000_000),
    computerProficiency: (['none', 'basic', 'good', 'advanced'] as const).find(v => v === input.computerProficiency) || 'none',
    rciNumber: str(input.rciNumber, 40), certifications: str(input.certifications, 1000),
    childSafety: {
      policeVerification: pv,
      policeVerificationDate: pv !== 'not_done' && isIsoDate(cs.policeVerificationDate) ? (cs.policeVerificationDate as string) : null,
      // Keep the original time of the declaration; clear it if the candidate un-ticks it.
      selfDeclarationAt: declared ? prev.childSafety.selfDeclarationAt || nowIso() : null,
    },
    discoverable: input.discoverable === true,
    updatedAt: nowIso(),
  };
  return { profile };
}

export interface Completeness { percent: number; missing: string[] }

/** Weighted checklist; keys are i18n keys under "profile.check.*". */
export function completeness(p: CandidateProfile, user: UserAccount, docs: StoredDocument[]): Completeness {
  const has = (c: string) => docs.some(d => d.category === c);
  const checks: [string, number, boolean][] = [
    ['email', 5, user.emailVerified],
    ['phone', 10, !!p.phone],
    ['location', 10, !!p.stateId && !!p.districtId],
    ['qualification', 15, p.qualifications.length > 0],
    ['teacherEducation', 10, p.qualifications.some(q => /^(qualifications:)(DELED|DED|BELED|BED|ITEP|MED|BPED|MPED|BED_SPL|DED_SPL|NTT_DIP|ECCE_DIP)$/.test(q.qualificationId))],
    ['tet', 10, p.tets.length > 0],
    ['subjects', 10, p.subjectIds.length > 0 && p.levelIds.length > 0],
    ['medium', 5, p.mediums.length > 0],
    ['preferences', 5, p.preferredStateIds.length + p.preferredDistrictIds.length > 0 || p.willingToRelocate],
    ['salary', 5, !!p.expectedSalary],
    ['photo', 5, has('photo')],
    ['certificates', 5, has('qualification')],
    ['childSafety', 5, !!p.childSafety.selfDeclarationAt],
  ];
  const total = checks.reduce((s, c) => s + c[1], 0);
  const got = checks.reduce((s, c) => s + (c[2] ? c[1] : 0), 0);
  return { percent: Math.round((got / total) * 100), missing: checks.filter(c => !c[2]).map(c => c[0]) };
}

/** The minimum a school needs to consider an application. */
export function readyToApply(p: CandidateProfile | undefined): string | null {
  if (!p || !p.phone) return 'profile.needPhone';
  if (!p.qualifications.length) return 'profile.needQualification';
  return null;
}
