import type { Job, Stage } from '@/types';
import type { Lookup } from './filters';
import type { TFunction } from '@/lib/i18n/translate';
import { itemName } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/i18n/config';
import { daysLeft } from './dates';

/* Display helpers shared by job cards, job pages and emails. */

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function nameOf(lookup: Lookup, id: string | null | undefined, locale: Locale = 'en'): string {
  const it = id ? lookup.get(id) : undefined;
  return it ? itemName(it, locale) : '';
}

export function namesOf(lookup: Lookup, ids: string[], locale: Locale = 'en'): string {
  return ids.map(id => nameOf(lookup, id, locale)).filter(Boolean).join(', ');
}

export function payLabel(job: Job, lookup: Lookup, t: TFunction): string {
  const p = job.pay;
  if (p.mode === 'cpc' && p.payLevelId) {
    const lvl = lookup.get(p.payLevelId);
    const entry = lvl?.meta.entryPay;
    return t('jobs.payCpc', { level: String(lvl?.meta.level ?? ''), entry: typeof entry === 'number' ? inr(entry) : '—' });
  }
  if (p.mode === 'state_scale' && p.scaleText) return p.scaleText;
  if (p.mode === 'range' && (p.min || p.max)) {
    if (p.min && p.max && p.min !== p.max) return t('jobs.payRange', { min: inr(p.min), max: inr(p.max) });
    return t('jobs.payMonth', { amount: inr((p.max || p.min)!) });
  }
  return t('jobs.payNotDisclosed');
}

export function placeLabel(job: Job, lookup: Lookup, locale: Locale = 'en'): string {
  return [job.city, nameOf(lookup, job.districtId, locale), nameOf(lookup, job.stateId, locale)].filter((v, i, a) => v && a.indexOf(v) === i).join(', ');
}

export function deadlineLabel(lastDate: string, t: TFunction, locale: Locale = 'en', now = new Date()): { text: string; urgent: boolean; closed: boolean } {
  const d = daysLeft(lastDate, now);
  const date = new Date(`${lastDate}T00:00:00Z`).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (d === null) return { text: '', urgent: false, closed: false };
  if (d < 0) return { text: t('jobs.closedOn', { date }), urgent: false, closed: true };
  if (d === 0) return { text: t('jobs.lastDayToday'), urgent: true, closed: false };
  return { text: t('jobs.lastDate', { date, days: d }), urgent: d <= 7, closed: false };
}

export const STAGES: Stage[] = ['applied', 'screening', 'eligible', 'shortlisted', 'interview', 'panel_review', 'offer', 'joined'];
export const WITHDRAWABLE: Stage[] = ['applied', 'screening'];

/** Human summary of search filters, e.g. "PGT · Physics · CBSE · Andhra Pradesh". */
export function describeFilters(f: import('@/types').JobFilters, lookup: Lookup, t: TFunction, locale: Locale = 'en'): string {
  const n = (kind: string, codes?: string[]) => (codes || []).map(c => nameOf(lookup, `${kind}:${c}`, locale) || c);
  return [
    f.q ? `“${f.q}”` : '',
    f.kind ? t(f.kind === 'government' ? 'jobs.typeGovt' : f.kind === 'external' ? 'jobs.typeExternal' : 'jobs.typeSchool') : '',
    ...n('posts', f.post), ...n('subjects', f.subject), ...n('schoolLevels', f.level), ...n('boards', f.board), ...n('mediums', f.medium),
    ...n('managementTypes', f.management), ...n('employmentTypes', f.employment),
    f.district ? nameOf(lookup, `districts:${f.district}`, locale) || f.district : '',
    f.state ? nameOf(lookup, `states:${f.state}`, locale) || f.state : '',
    f.sector ? t(`jobs.sector_${f.sector}`) : '',
    f.minSalary ? `≥ ${inr(f.minSalary)}` : '',
    f.closingDays !== undefined ? t('jobs.closingWithin', { days: f.closingDays }) : '',
    f.lat !== undefined ? t('jobs.kmOption', { km: f.km ?? 25 }) : '',
  ].filter(Boolean).join(' · ');
}
