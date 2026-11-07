import type { AlertFrequency, Job, JobAlert, JobFilters, UserAccount } from '@/types';
import { filtersToQuery, matchesFilters, parseFilters, type Lookup } from '@/lib/jobs/filters';
import { isPast, todayIst } from '@/lib/jobs/dates';
import { deadlineLabel, payLabel, placeLabel } from '@/lib/jobs/display';
import { makeT } from '@/lib/i18n/translate';
import { audit, newId, nowIso, withDb, type Store } from './db';
import { lookupOf, publicJobs } from './catalog';
import { appUrl, emailLayout, sendMail, unsubscribeUrl } from './mailer';

/*
 * Job alerts: saved searches emailed instantly, daily or weekly (up to 10 per candidate).
 * Adapted from AcadeXMatch lib/server/jobAlerts.ts: per-alert "seen" state so each vacancy is sent
 * once, a new alert's first run only records what is already open, daily/weekly emails go out after
 * 8:00 India time, instant alerts at most every 30 minutes. Emails use the "alerts" mailing list, so the
 * unsubscribe link and the account's email preferences are respected.
 */

export const MAX_ALERTS = 10;
const MAX_SEEN = 2000;
const MAX_ITEMS = 20;
const SEND_HOUR_IST = 8;
const INSTANT_GAP_MS = 30 * 60_000;
export const FREQUENCIES: AlertFrequency[] = ['instant', 'daily', 'weekly'];

/** Cleans filters by sending them through the same parser the search page uses. */
export function cleanFilters(raw: unknown): JobFilters {
  if (!raw || typeof raw !== 'object') return {};
  return parseFilters(new URLSearchParams(filtersToQuery(raw as JobFilters)));
}

export function saveAlert(db: Store, userId: string, b: Record<string, unknown>): { alert?: JobAlert; error?: string } {
  const filters = cleanFilters(b.filters);
  if (!Object.keys(filters).length) return { error: 'alerts.errEmpty' };
  const frequency = FREQUENCIES.includes(b.frequency as AlertFrequency) ? (b.frequency as AlertFrequency) : 'daily';
  const name = String(b.name || '').trim().slice(0, 80) || 'My job alert';
  const mine = db.alerts.filter(a => a.userId === userId);
  if (typeof b.id === 'string') {
    const a = mine.find(x => x.id === b.id);
    if (!a) return { error: 'alerts.errNotFound' };
    Object.assign(a, { name, filters, frequency, active: b.active !== false });
    return { alert: a };
  }
  if (mine.length >= MAX_ALERTS) return { error: 'alerts.errLimit' };
  const alert: JobAlert = { id: newId('alr'), userId, name, filters, frequency, active: true, createdAt: nowIso(), lastSentAt: null, lastSentCount: null };
  db.alerts.push(alert);
  audit(db, { actorId: userId, action: 'alert.create', target: alert.id, detail: frequency });
  return { alert };
}

function istHour(now: Date): number {
  return Number(now.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export interface AlertRun { checked: number; emails: number; vacancies: number; skippedUnverified: number }
interface Due { alert: JobAlert; user: UserAccount; jobs: Job[] }

/** Picks the alerts that are due and the vacancies they have not sent yet (updates the bookkeeping). */
export function collectDue(db: Store, opts: { force?: boolean; only?: AlertFrequency[]; now?: Date } = {}): { due: Due[]; result: AlertRun; lookup: Lookup } {
  const now = opts.now || new Date();
  const day = todayIst(now);
  const lookup = lookupOf(db);
  const open = publicJobs(db).filter(j => j.status === 'published' && !isPast(j.lastDate, now));
  const result: AlertRun = { checked: 0, emails: 0, vacancies: 0, skippedUnverified: 0 };
  const due: Due[] = [];
  const scheduledOpen = opts.force || istHour(now) >= SEND_HOUR_IST;

  for (const alert of db.alerts) {
    if (opts.only && !opts.only.includes(alert.frequency)) continue;
    const matching = open.filter(j => matchesFilters(j, alert.filters, lookup, undefined, now));
    const st = db.alertState[alert.id];
    if (!st) { db.alertState[alert.id] = { seen: matching.map(j => j.id), lastRunDay: day }; continue; }
    if (!alert.active) continue;
    if (alert.frequency === 'instant') {
      if (!opts.force && st.lastSentMs && now.getTime() - st.lastSentMs < INSTANT_GAP_MS) continue;
    } else {
      if (!scheduledOpen) continue;
      if (!opts.force && st.lastRunDay && (alert.frequency === 'weekly' ? daysBetween(st.lastRunDay, day) < 7 : st.lastRunDay === day)) continue;
    }
    const user = db.users.find(u => u.id === alert.userId && u.status === 'active');
    if (!user) continue;
    result.checked++;
    const seen = new Set(st.seen);
    const fresh = matching.filter(j => !seen.has(j.id));
    st.lastRunDay = day;
    if (!fresh.length) continue;
    if (!user.emailVerified) { result.skippedUnverified++; continue; }
    st.seen = [...fresh.map(j => j.id), ...st.seen].slice(0, MAX_SEEN);
    st.lastSentMs = now.getTime();
    alert.lastSentAt = now.toISOString();
    alert.lastSentCount = fresh.length;
    due.push({ alert, user, jobs: fresh });
  }
  for (const id of Object.keys(db.alertState)) if (!db.alerts.some(a => a.id === id)) delete db.alertState[id];
  return { due, result, lookup };
}

/** Sends due alerts. Called by the scheduler (instrumentation.ts), after a vacancy is published, and from the admin console. */
export async function runJobAlerts(opts: { force?: boolean; only?: AlertFrequency[] } = {}): Promise<AlertRun> {
  const { due, result, lookup } = await withDb(db => collectDue(db, opts));
  const base = appUrl();
  for (const { alert, user, jobs } of due) {
    const locale = user.locale === 'hi' ? 'hi' : 'en';
    const t = makeT(locale);
    const shown = jobs.slice(0, MAX_ITEMS);
    const unsub = unsubscribeUrl(user.email, 'alerts');
    const lines = shown.flatMap(j => [`• ${j.title} (${j.orgName})`, `  ${placeLabel(j, lookup, locale)} · ${payLabel(j, lookup, t)} · ${deadlineLabel(j.lastDate, t, locale).text}`, `  ${base}/jobs/${j.id}`]);
    const { html, text } = emailLayout({
      heading: t('alerts.emailHeading', { n: jobs.length, name: alert.name }),
      paragraphs: [t('alerts.emailHello', { name: user.name }), ...lines, ...(jobs.length > shown.length ? [t('alerts.emailMore', { n: jobs.length - shown.length })] : [])],
      button: { label: t('alerts.emailButton'), url: `${base}/jobs?${filtersToQuery(alert.filters)}` },
      footer: t('alerts.emailFooter', { name: alert.name }),
      unsubscribe: unsub,
    });
    const r = await sendMail({ to: user.email, subject: t('alerts.emailSubject', { n: jobs.length, name: alert.name }), text, html, kind: 'job-alert', list: 'alerts' });
    if (r.lastError === 'unsubscribed') continue;
    result.emails++;
    result.vacancies += jobs.length;
  }
  return result;
}


