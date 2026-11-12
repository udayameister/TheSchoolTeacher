/*
 * Resume checker for school-teacher CVs: a 0–100 score from explainable checks, each with a tip. Checks look
 * for what Indian schools and recruitment boards screen for (teacher-education degree, TET, subjects and
 * classes, dated experience, results you achieved, training) and for what trips up Applicant Tracking
 * Systems (tables, text boxes, columns, scanned pages). Optionally compares the CV with one vacancy.
 * Labels and tips are i18n keys under "checker.*".
 */
import type { Job, MasterItem } from '@/types';
import type { CvSuggestions } from './cvParse';

export interface LayoutSignals { tables: number; textBoxes: number; images: number; multiColumn: boolean; contactInHeader: boolean; scanned: boolean }

export interface CheckItem { key: string; weight: number; /** 0..1 */ got: number; tip?: string; vars?: Record<string, string | number> }
export interface CheckResult { score: number; grade: 'strong' | 'good' | 'fair' | 'weak'; checks: CheckItem[]; words: number; jobMatch?: JobMatch }
export interface JobMatch { percent: number; found: string[]; missing: string[] }

const ACTION = /^(taught|teach|prepared|planned|designed|developed|introduced|conducted|organi[sz]ed|led|guided|mentored|coached|trained|improved|increased|raised|achieved|created|managed|coordinated|supervised|evaluated|assessed|implemented|initiated|launched|won|established|handled|counsel(l)?ed|motivated|integrated|used)\b/i;
const QUANT = /\d+(?:\.\d+)?\s*(?:%|percent|students|pupils|learners|classes|sections|teachers|schools|marks|hours|days|months|years|awards|medals|lakh)|\b100\s*%|\brank\b|\btopper/i;

export function checkResume(text: string, cv: CvSuggestions, lists: { qualifications: MasterItem[] }, layout: LayoutSignals | null, job?: { job: Job; names: (ids: string[]) => string[] } | null): CheckResult {
  const words = text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => /^[•●▪◦‣∙·*\-–➢►✓]\s*/.test(l) || /^\d{1,2}[.)]\s/.test(l)).map(l => l.replace(/^[•●▪◦‣∙·*\-–➢►✓\d.)\s]+/, ''));
  const expBullets = cv.experience.flatMap(x => x.highlights.split('\n')).filter(Boolean);
  const pool = bullets.length ? bullets : expBullets;
  const teacherEd = cv.qualifications.some(q => lists.qualifications.find(i => i.id === q.qualificationId)?.meta?.type === 'teacher_education');
  const checks: CheckItem[] = [];
  const add = (key: string, weight: number, got: number, tip?: string, vars?: CheckItem['vars']) => checks.push({ key, weight, got: Math.max(0, Math.min(1, got)), tip: got < 1 ? tip : undefined, vars });

  add('contact', 10, (cv.email ? 0.5 : 0) + (cv.phone ? 0.5 : 0), !cv.phone ? 'tipPhone' : 'tipEmail');
  add('summary', 8, cv.summary ? (cv.summary.split(/\s+/).length >= 25 ? 1 : 0.5) : 0, 'tipSummary');
  add('teacherEducation', 12, teacherEd ? 1 : 0, 'tipTeacherEducation');
  add('tet', 10, cv.tets.length ? 1 : 0, 'tipTet');
  add('subjects', 10, (cv.subjectIds.length ? 0.6 : 0) + (cv.levelIds.length ? 0.4 : 0), 'tipSubjects');
  add('experience', 10, cv.experience.length ? 1 : /\b(fresher|internship|teaching practice|school internship)\b/i.test(text) ? 0.6 : 0, cv.experience.length ? undefined : 'tipExperience');
  const quant = pool.filter(b => QUANT.test(b)).length;
  add('results', 8, pool.length ? Math.min(1, quant / Math.max(2, Math.ceil(pool.length / 4))) : 0, 'tipResults');
  const verbs = pool.filter(b => ACTION.test(b)).length;
  add('actionVerbs', 6, pool.length ? verbs / pool.length / 0.6 : 0, 'tipActionVerbs', { n: verbs, total: pool.length });
  add('training', 6, cv.trainings.length || /\b(nishtha|diksha|cbp|workshop|in-service|training)\b/i.test(text) ? 1 : 0, 'tipTraining');
  add('length', 8, words >= 250 && words <= 900 ? 1 : words >= 150 && words <= 1300 ? 0.5 : 0, words < 250 ? 'tipShort' : 'tipLong', { n: words });
  const layoutIssues = layout ? [layout.tables && 'tables', layout.textBoxes && 'textBoxes', layout.images && 'images', layout.multiColumn && 'columns', layout.contactInHeader && 'header', layout.scanned && 'scanned'].filter(Boolean) as string[] : [];
  add('layout', 8, layout ? 1 - Math.min(1, layoutIssues.length / 3) : 1, 'tipLayout', { list: layoutIssues.join(',') });
  add('personal', 4, cv.personalDetails.some(k => ['religion', 'caste', 'marital', 'family'].includes(k)) ? 0 : 1, 'tipPersonal', { list: cv.personalDetails.join(',') });

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(checks.reduce((s, c) => s + c.weight * c.got, 0) / total * 100);
  const grade = score >= 80 ? 'strong' : score >= 65 ? 'good' : score >= 45 ? 'fair' : 'weak';
  return { score, grade, checks, words, jobMatch: job ? matchJob(text, job.job, job.names) : undefined };
}

/** Which of the vacancy's subjects, classes, qualifications, TETs and languages the CV mentions. */
export function matchJob(text: string, job: Job, names: (ids: string[]) => string[]): JobMatch {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')} `;
  const compact = text.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '');
  const terms = [...new Set([
    ...names([job.postId]), ...names(job.subjectIds), ...names(job.levelIds),
    ...names(job.eligibility.requiredQualificationIds), ...names(job.eligibility.acceptedTetIds), ...names(job.eligibility.mediumIds),
    ...(job.eligibility.tetRequired && !job.eligibility.acceptedTetIds.length ? ['TET'] : []),
  ].map(s => s.replace(/\s*\(.*\)\s*/g, ' ').trim()).filter(Boolean))];
  const found: string[] = [], missing: string[] = [];
  for (const term of terms) {
    const w = ` ${term.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim()} `;
    const c = term.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '');
    (t.includes(w) || (c.length >= 3 && c.length <= 8 && compact.includes(c)) ? found : missing).push(term);
  }
  return { percent: terms.length ? Math.round(found.length / terms.length * 100) : 0, found, missing };
}
