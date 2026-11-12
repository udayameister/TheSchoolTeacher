import type { CandidateProfile, UserAccount } from '@/types';
import type { Locale } from '@/lib/i18n/config';
import { parseCv, type CvLists, type CvSuggestions } from '@/lib/cvParse';
import { checkResume, type CheckResult, type LayoutSignals } from '@/lib/resumeCheck';
import { resumeText } from '@/lib/resume/model';
import { lookupOf } from './catalog';
import type { Store } from './db';
import { listMaster } from './masterData';
import { buildResume } from './resume';
import { newId } from './db';

/* Glue between the stored master data / profile and the CV parser and resume checker. */

export function cvLists(db: Store): CvLists {
  return {
    qualifications: listMaster(db, 'qualifications'), tets: listMaster(db, 'tetExams'), subjects: listMaster(db, 'subjects'),
    levels: listMaster(db, 'schoolLevels'), mediums: listMaster(db, 'mediums'), posts: listMaster(db, 'posts'),
  };
}

function jobFor(db: Store, jobId: string | null | undefined) {
  const job = jobId ? db.jobs.find(j => j.id === jobId && j.status === 'published') : undefined;
  if (!job) return null;
  const lookup = lookupOf(db);
  return { job, names: (ids: string[]) => ids.map(id => lookup.get(id)?.name || '').filter(Boolean) };
}

/** Checks any CV text (an upload). */
export function checkText(db: Store, text: string, layout: LayoutSignals | null, jobId?: string | null): { cv: CvSuggestions; check: CheckResult } {
  const lists = cvLists(db);
  const cv = parseCv(text, lists);
  return { cv, check: checkResume(text, cv, lists, layout, jobFor(db, jobId)) };
}

/** Checks the resume the builder makes from the profile, exactly as it would be sent. */
export function checkBuilt(db: Store, user: UserAccount, locale: Locale, hidden: string[], jobId?: string | null): CheckResult {
  // The checker reads English section names and spellings, so score the English text.
  const text = resumeText(buildResume(db, user, 'en', { photo: false }), hidden);
  return checkText(db, text, null, jobId).check;
}

export interface ApplyInput {
  phone?: string | null; summary?: string | null;
  qualifications?: { qualificationId: string; institution?: string; year?: number | null; percentage?: number | null }[];
  tets?: { tetId: string; paper?: string; year?: number | null; score?: number | null }[];
  subjectIds?: string[]; levelIds?: string[]; mediumIds?: string[];
  experience?: { school: string; postId?: string | null; from: string; to?: string | null; current?: boolean; highlights?: string }[];
  trainings?: string[]; awards?: string[]; skills?: string[];
}

/**
 * Adds the suggestions the candidate ticked to the profile (raw form, to be cleaned by cleanProfile).
 * Existing entries win: an imported qualification / TET that is already on the profile is skipped, and an
 * existing phone or "about" is only replaced when the candidate asked for it.
 */
export function mergeImport(prev: CandidateProfile, a: ApplyInput): Record<string, unknown> {
  const arr = <T,>(v: T[] | undefined, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
  const qualifications = [...prev.qualifications];
  for (const q of arr(a.qualifications, 15)) if (!qualifications.some(x => x.qualificationId === q.qualificationId)) qualifications.push({ id: newId('q'), qualificationId: q.qualificationId, subjectId: null, institution: String(q.institution || ''), year: q.year ?? null, percentage: q.percentage ?? null });
  const tets = [...prev.tets];
  for (const x of arr(a.tets, 10)) if (!tets.some(y => y.tetId === x.tetId)) tets.push({ id: newId('t'), tetId: x.tetId, paper: String(x.paper || ''), year: x.year ?? null, score: x.score ?? null, validUntil: null, lifetime: false });
  const experience = [...prev.experience];
  for (const x of arr(a.experience, 15)) if (!experience.some(y => y.school.toLowerCase() === String(x.school).toLowerCase() && y.from === x.from)) experience.push({ id: newId('x'), school: String(x.school), boardId: null, postId: x.postId || null, from: x.from, to: x.current ? null : x.to || null, current: !!x.current, levelIds: [], subjectIds: [], highlights: String(x.highlights || '') });
  // "NISHTHA training, 2021" → title "NISHTHA training", year 2021.
  const split = (v: string) => { const year = Number(v.match(/\b(19[6-9]\d|20\d{2})\b/)?.[1]) || null; return { title: (year ? v.replace(new RegExp(`[\\s,(–-]*${year}\\)?\\s*$`), '') : v).trim().slice(0, 160) || v.slice(0, 160), year }; };
  const trainings = [...(prev.trainings || [])];
  for (const t of arr(a.trainings, 20)) { const x = split(String(t)); if (!trainings.some(y => split(y.title).title.toLowerCase() === x.title.toLowerCase())) trainings.push({ id: newId('tr'), title: x.title, provider: null, year: x.year, hours: null }); }
  const awards = [...(prev.awards || [])];
  for (const t of arr(a.awards, 15)) { const x = split(String(t)); if (!awards.some(y => split(y.title).title.toLowerCase() === x.title.toLowerCase())) awards.push({ id: newId('aw'), title: x.title, issuer: null, year: x.year }); }
  const uniq = (x: string[], y: string[] | undefined) => [...new Set([...x, ...arr(y, 30).map(String)])];
  // "Languages known" in a CV are languages spoken, not necessarily languages the person can teach in.
  const languageIds = [...new Set([...(prev.languageIds || []), ...arr(a.mediumIds, 15).map(String)])];
  return {
    ...prev,
    phone: a.phone || prev.phone, about: a.summary || prev.about,
    qualifications, tets, experience, trainings, awards, languageIds,
    subjectIds: uniq(prev.subjectIds, a.subjectIds), levelIds: uniq(prev.levelIds, a.levelIds),
    skills: uniq(prev.skills || [], a.skills).slice(0, 30),
    childSafety: { ...prev.childSafety, selfDeclaration: !!prev.childSafety.selfDeclarationAt },
  };
}
