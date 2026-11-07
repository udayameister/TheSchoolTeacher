import Link from 'next/link';
import { Building2, CalendarClock, IndianRupee, Landmark, MapPin } from 'lucide-react';
import type { Job } from '@/types';
import type { Lookup } from '@/lib/jobs/filters';
import type { TFunction } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/i18n/config';
import { deadlineLabel, nameOf, payLabel, placeLabel } from '@/lib/jobs/display';
import SaveJobButton from './SaveJobButton';
import MatchBadge from './MatchBadge';

export interface CardCtx { lookup: Lookup; t: TFunction; locale: Locale; signedInCandidate: boolean; saved: Set<string>; match?: Map<string, number>; distance?: Map<string, number> }

export default function JobCard({ job, ctx }: { job: Job; ctx: CardCtx }) {
  const { lookup, t, locale } = ctx;
  const dl = deadlineLabel(job.lastDate, t, locale);
  const score = ctx.match?.get(job.id);
  const km = ctx.distance?.get(job.id);
  return (
    <article className="card flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-snug"><Link href={`/jobs/${job.id}`} className="text-brand-900">{job.title}</Link></h3>
          <p className="flex items-center gap-1 text-sm text-ink-soft">{job.kind === 'government' ? <Landmark size={15} aria-hidden="true" /> : <Building2 size={15} aria-hidden="true" />}{job.orgName}</p>
        </div>
        {score !== undefined && <MatchBadge score={score} label={t('match.badge', { score })} />}
      </div>
      <ul className="flex flex-col gap-1 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:gap-x-4">
        <li className="flex items-center gap-1"><MapPin size={15} aria-hidden="true" />{placeLabel(job, lookup, locale)}{km !== undefined ? ` · ${t('jobs.kmAway', { km: Math.round(km) })}` : ''}</li>
        <li className="flex items-center gap-1"><IndianRupee size={15} aria-hidden="true" />{payLabel(job, lookup, t)}</li>
        <li className={`flex items-center gap-1 ${dl.urgent ? 'font-semibold text-danger-700' : ''}`}><CalendarClock size={15} aria-hidden="true" />{dl.text}</li>
      </ul>
      <ul className="flex flex-wrap gap-1.5">
        {job.kind === 'government' && <li className="badge border-marigold-400 bg-marigold-50 text-marigold-800">{t('jobs.officialNotice')}</li>}
        {job.premium && <li className="badge border-brand-300 bg-brand-50 text-brand-800">{t('jobs.premium')}</li>}
        <li className="badge border-line bg-ivory text-ink">{nameOf(lookup, job.postId, locale)}</li>
        {job.boardIds.slice(0, 2).map(b => <li key={b} className="badge border-line bg-ivory text-ink">{nameOf(lookup, b, locale)}</li>)}
        <li className="badge border-line bg-ivory text-ink">{nameOf(lookup, job.employmentTypeId, locale)}</li>
      </ul>
      <div className="flex items-center justify-between">
        <Link href={`/jobs/${job.id}`} className="text-sm font-semibold">{t('jobs.viewDetails')}</Link>
        <SaveJobButton jobId={job.id} saved={ctx.saved.has(job.id)} signedIn={ctx.signedInCandidate} compact />
      </div>
    </article>
  );
}
