import type { Application, Stage, UserAccount } from '@/types';
import type { Store } from './db';
import { currentSchool } from './schools';
import { toCsvRow } from '@/lib/csv';
import { can } from './team';

/*
 * Hiring reports for a school (adapted from AcadeXMatch app/institute/reports/page.tsx, computed on the
 * server): the hiring funnel, time to hire, offers, and results by vacancy, for a date range of
 * applications. CSV export of the by-vacancy table and of the application list.
 */

export const FUNNEL: Stage[] = ['applied', 'screening', 'eligible', 'shortlisted', 'interview', 'panel_review', 'offer', 'joined'];
export const RANGES = [30, 90, 365, 0] as const;
const DAY = 86400_000;

const idx = (s: Stage) => FUNNEL.indexOf(s);
/** Furthest stage on the main path the application ever reached (not selected / withdrawn do not count). */
export function furthest(a: Application): number {
  return Math.max(idx(a.stage), ...a.history.map(h => idx(h.stage)), 0);
}
const joinedAt = (a: Application) => a.history.find(h => h.stage === 'joined')?.at || null;
const days = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / DAY));
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
}

export interface VacancyRow { jobId: string; title: string; status: string; publishedAt: string | null; views: number; applications: number; shortlisted: number; interviewed: number; offers: number; accepted: number; joined: number; avgMatch: number | null; daysToFirstHire: number | null }
export interface SchoolReport {
  schoolName: string;
  rangeDays: number;
  funnel: { stage: Stage; count: number }[];
  notSelected: number;
  withdrawn: number;
  total: number;
  timeToHire: { median: number | null; average: number | null; hires: number };
  offers: { issued: number; accepted: number; declined: number; withdrawn: number; pending: number; acceptanceRate: number | null };
  interviews: { invited: number; booked: number; completed: number; noShow: number };
  vacancies: VacancyRow[];
}

export function schoolReport(db: Store, user: UserAccount, rangeDays: number, now = Date.now()): SchoolReport | null {
  if (!can(user, 'reports')) return null;
  const school = currentSchool(db, user);
  if (!school) return null;
  const range = (RANGES as readonly number[]).includes(rangeDays) ? rangeDays : 90;
  const since = range ? new Date(now - range * DAY).toISOString() : '';
  const apps = db.applications.filter(a => a.schoolId === school.id && a.appliedAt >= since);
  const appIds = new Set(apps.map(a => a.id));
  const live = apps.filter(a => a.stage !== 'withdrawn');
  const hires = live.filter(a => joinedAt(a)).map(a => days(a.appliedAt, joinedAt(a)!));
  const offers = db.offers.filter(o => appIds.has(o.applicationId));
  const ivs = db.interviews.filter(i => appIds.has(i.applicationId));
  const answered = offers.filter(o => o.status === 'accepted' || o.status === 'declined');
  const jobs = db.jobs.filter(j => j.schoolId === school.id && j.status !== 'draft').sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt));
  const vacancies = jobs.map<VacancyRow>(j => {
    const ja = live.filter(a => a.jobId === j.id);
    const scored = ja.filter(a => typeof a.matchScore === 'number');
    const firstHire = ja.map(joinedAt).filter((x): x is string => !!x).sort()[0];
    const jo = offers.filter(o => o.jobId === j.id);
    return {
      jobId: j.id, title: j.title, status: j.status, publishedAt: j.publishedAt || null, views: db.jobViews[j.id] ?? j.views ?? 0,
      applications: ja.length, shortlisted: ja.filter(a => furthest(a) >= idx('shortlisted')).length, interviewed: ja.filter(a => furthest(a) >= idx('interview')).length,
      offers: jo.filter(o => o.status !== 'withdrawn').length, accepted: jo.filter(o => o.status === 'accepted').length, joined: ja.filter(a => a.stage === 'joined').length,
      avgMatch: scored.length ? Math.round(scored.reduce((s, a) => s + (a.matchScore as number), 0) / scored.length) : null,
      daysToFirstHire: firstHire && j.publishedAt ? days(j.publishedAt, firstHire) : null,
    };
  });
  return {
    schoolName: school.name, rangeDays: range,
    funnel: FUNNEL.map(stage => ({ stage, count: live.filter(a => furthest(a) >= idx(stage)).length })),
    notSelected: live.filter(a => a.stage === 'not_selected').length, withdrawn: apps.length - live.length, total: apps.length,
    timeToHire: { median: median(hires), average: hires.length ? Math.round((hires.reduce((s, x) => s + x, 0) / hires.length) * 10) / 10 : null, hires: hires.length },
    offers: {
      issued: offers.length, accepted: offers.filter(o => o.status === 'accepted').length, declined: offers.filter(o => o.status === 'declined').length,
      withdrawn: offers.filter(o => o.status === 'withdrawn').length, pending: offers.filter(o => o.status === 'issued').length,
      acceptanceRate: answered.length ? Math.round((offers.filter(o => o.status === 'accepted').length / answered.length) * 100) : null,
    },
    interviews: { invited: ivs.length, booked: ivs.filter(i => i.status === 'booked').length, completed: ivs.filter(i => i.status === 'completed').length, noShow: ivs.filter(i => i.status === 'no_show').length },
    vacancies,
  };
}

export function vacanciesCsv(r: SchoolReport): string {
  const head = ['Vacancy', 'Status', 'Published', 'Views', 'Applications', 'Shortlisted', 'Interviewed', 'Offers', 'Offers accepted', 'Joined', 'Average match %', 'Days to first hire'];
  return [toCsvRow(head), ...r.vacancies.map(v => toCsvRow([v.title, v.status, v.publishedAt?.slice(0, 10) || '', v.views, v.applications, v.shortlisted, v.interviewed, v.offers, v.accepted, v.joined, v.avgMatch ?? '', v.daysToFirstHire ?? '']))].join('\r\n') + '\r\n';
}

/** The application list for the range (no contact details). */
export function applicationsCsv(db: Store, user: UserAccount, rangeDays: number, now = Date.now()): string | null {
  if (!can(user, 'reports')) return null;
  const school = currentSchool(db, user);
  if (!school) return null;
  const range = (RANGES as readonly number[]).includes(rangeDays) ? rangeDays : 90;
  const since = range ? new Date(now - range * DAY).toISOString() : '';
  const rows = db.applications.filter(a => a.schoolId === school.id && a.appliedAt >= since).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).map(a => toCsvRow([
    db.users.find(u => u.id === a.candidateId)?.name || '', db.jobs.find(j => j.id === a.jobId)?.title || '', a.stage, a.appliedAt.slice(0, 10), a.updatedAt.slice(0, 10), a.matchScore ?? '',
  ]));
  return [toCsvRow(['Candidate', 'Vacancy', 'Stage', 'Applied on', 'Last update', 'Match % at applying']), ...rows].join('\r\n') + '\r\n';
}
