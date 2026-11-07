import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { ArrowLeft, Building2, Landmark } from 'lucide-react';
import type { Job } from '@/types';
import { getT } from '@/lib/i18n/server';
import { withDb } from '@/lib/server/db';
import { currentUser } from '@/lib/server/http';
import { isPublic, lookupOf, matchWeights, matchingAllowed } from '@/lib/server/catalog';
import { computeMatch } from '@/lib/jobs/match';
import { isPast } from '@/lib/jobs/dates';
import { deadlineLabel, nameOf, namesOf, payLabel, placeLabel } from '@/lib/jobs/display';
import type { Lookup } from '@/lib/jobs/filters';
import { absoluteUrl } from '@/lib/site';
import ApplyPanel from '@/components/jobs/ApplyPanel';
import SaveJobButton from '@/components/jobs/SaveJobButton';
import ShareButtons from '@/components/jobs/ShareButtons';
import MatchExplain from '@/components/jobs/MatchExplain';

type Params = Promise<{ id: string }>;

async function load(id: string) {
  return withDb(db => {
    const job = db.jobs.find(j => j.id === id);
    if (!job || !isPublic(db, job)) return null;
    return { job, lookup: lookupOf(db) };
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const r = await load((await params).id);
  if (!r) return { title: 'Not found', robots: { index: false } };
  const { job, lookup } = r;
  const desc = `${job.orgName}, ${placeLabel(job, lookup)}. ${job.description.slice(0, 140)}`;
  return { title: `${job.title} – ${job.orgName}`, description: desc, alternates: { canonical: `/jobs/${job.id}` }, openGraph: { title: job.title, description: desc, type: 'website' } };
}

const EMPLOYMENT_SCHEMA: Record<string, string> = { PERMANENT: 'FULL_TIME', CONTRACT: 'CONTRACTOR', GUEST: 'PART_TIME', ADHOC: 'TEMPORARY', TUTOR: 'PART_TIME' };

/** schema.org JobPosting (Google for Jobs). */
function jobPostingLd(job: Job, lookup: Lookup) {
  const salary = job.pay.mode === 'range' && (job.pay.min || job.pay.max) ? { minValue: job.pay.min ?? job.pay.max, maxValue: job.pay.max ?? job.pay.min }
    : job.pay.mode === 'cpc' && typeof lookup.get(job.pay.payLevelId || '')?.meta.entryPay === 'number' ? { value: lookup.get(job.pay.payLevelId!)!.meta.entryPay } : null;
  return {
    '@context': 'https://schema.org', '@type': 'JobPosting',
    title: job.title, description: job.description.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/\n/g, '<br>'),
    identifier: { '@type': 'PropertyValue', name: job.orgName, value: job.id },
    datePosted: (job.publishedAt || job.createdAt).slice(0, 10), validThrough: `${job.lastDate}T23:59:59+05:30`,
    employmentType: EMPLOYMENT_SCHEMA[job.employmentTypeId.split(':')[1]] || 'OTHER',
    hiringOrganization: { '@type': job.kind === 'government' ? 'GovernmentOrganization' : 'EducationalOrganization', name: job.orgName },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.city, addressRegion: nameOf(lookup, job.stateId), ...(job.pincode ? { postalCode: job.pincode } : {}), addressCountry: 'IN' } },
    totalJobOpenings: job.vacancies,
    directApply: job.applyMode === 'platform',
    ...(salary ? { baseSalary: { '@type': 'MonetaryAmount', currency: 'INR', value: { '@type': 'QuantitativeValue', unitText: 'MONTH', ...salary } } } : {}),
  };
}

export default async function JobPage({ params }: { params: Params }) {
  const { id } = await params;
  const [{ t, locale }, user, h] = await Promise.all([getT(), currentUser(), headers()]);
  const candidate = user?.role === 'candidate' ? user : null;
  const isBot = /bot|crawl|spider|slurp|preview/i.test(h.get('user-agent') || '');

  const data = await withDb(db => {
    const job = db.jobs.find(j => j.id === id);
    if (!job || !isPublic(db, job)) return null;
    if (!isBot) db.jobViews[job.id] = (db.jobViews[job.id] || 0) + 1;
    const lookup = lookupOf(db);
    const profile = candidate ? db.profiles[candidate.id] : undefined;
    return {
      job, lookup,
      match: candidate && profile && matchingAllowed(db, candidate.id) ? computeMatch(job, profile, lookup, matchWeights(db)) : null,
      stage: candidate ? db.applications.find(a => a.jobId === job.id && a.candidateId === candidate.id)?.stage ?? null : null,
      saved: !!candidate && db.savedJobs.some(s => s.userId === candidate.id && s.jobId === job.id),
      tracked: !!candidate && db.tracked.some(tr => tr.userId === candidate.id && tr.jobId === job.id),
      hasProfile: !!profile,
    };
  });
  if (!data) notFound();
  const { job, lookup } = data;
  const e = job.eligibility;
  const closed = job.status === 'closed' || isPast(job.lastDate);
  const dl = deadlineLabel(job.lastDate, t, locale);
  const url = absoluteUrl(`/jobs/${job.id}`);

  const fact = (label: string, value: React.ReactNode) => value ? <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-2"><dt className="text-sm font-semibold text-ink-soft">{label}</dt><dd className="sm:col-span-2">{value}</dd></div> : null;
  const tetText = e.tetRequired ? `${e.acceptedTetIds.length ? namesOf(lookup, e.acceptedTetIds, locale) : t('jobs.anyTet')}${e.tetPaper ? ` – ${e.tetPaper}` : ''}` : '';

  return (
    <div className="container-page py-6">
      <p className="text-sm"><Link href="/jobs" className="inline-flex items-center gap-1"><ArrowLeft size={16} aria-hidden="true" />{t('jobs.backToSearch')}</Link></p>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_340px]">
        <article className="min-w-0 space-y-6">
          <header className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {job.kind === 'government' && <span className="badge border-marigold-400 bg-marigold-50 text-marigold-800">{t('jobs.officialNotice')}</span>}
              {job.premium && <span className="badge border-brand-300 bg-brand-50 text-brand-800">{t('jobs.premium')}</span>}
              {closed && <span className="badge border-danger-600/30 bg-danger-50 text-danger-700">{t('jobs.closed')}</span>}
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">{job.title}</h1>
            <p className="flex items-center gap-1.5 text-lg text-ink-soft">{job.kind === 'government' ? <Landmark size={18} aria-hidden="true" /> : <Building2 size={18} aria-hidden="true" />}{job.orgName}</p>
            <p className={dl.urgent ? 'font-semibold text-danger-700' : 'text-ink-soft'}>{dl.text}</p>
            {/* On phones the apply box is below the details, so offer a jump to it. */}
            <a href="#apply-h" className="btn-primary lg:hidden">{t('jobs.jumpToApply')}</a>
          </header>

          {job.kind === 'government' && <p className="alert-error" role="note">{t('jobs.govtDisclaimer')}</p>}

          <section className="card" aria-labelledby="facts-h">
            <h2 id="facts-h" className="text-lg font-bold">{t('jobs.keyFacts')}</h2>
            <dl className="mt-2 divide-y divide-line">
              {fact(t('jobs.post'), nameOf(lookup, job.postId, locale))}
              {fact(t('jobs.subject'), namesOf(lookup, job.subjectIds, locale))}
              {fact(t('jobs.level'), namesOf(lookup, job.levelIds, locale))}
              {fact(t('jobs.stream'), namesOf(lookup, job.streamIds, locale))}
              {fact(t('jobs.board'), namesOf(lookup, job.boardIds, locale))}
              {fact(t('jobs.management'), nameOf(lookup, job.managementTypeId, locale))}
              {fact(t('jobs.employment'), nameOf(lookup, job.employmentTypeId, locale))}
              {fact(t('jobs.location'), placeLabel(job, lookup, locale) + (job.pincode ? ` – ${job.pincode}` : ''))}
              {fact(t('jobs.posts'), String(job.vacancies))}
              {fact(t('jobs.pay'), payLabel(job, lookup, t))}
              {fact(t('jobs.benefits'), namesOf(lookup, job.pay.benefitIds, locale))}
              {fact(t('jobs.lastDateLabel'), dl.text)}
              {job.keyDates.length > 0 && fact(t('jobs.keyDates'), <ul>{job.keyDates.map(k => <li key={k.label}>{k.label}: {k.date}</li>)}</ul>)}
            </dl>
          </section>

          <section className="card" aria-labelledby="elig-h">
            <h2 id="elig-h" className="text-lg font-bold">{t('jobs.eligibility')}</h2>
            <dl className="mt-2 divide-y divide-line">
              {fact(t('jobs.requiredQual'), namesOf(lookup, e.requiredQualificationIds, locale))}
              {fact(t('jobs.preferredQual'), namesOf(lookup, e.preferredQualificationIds, locale))}
              {fact(t('jobs.tet'), e.tetRequired ? tetText : t('jobs.tetNotRequired'))}
              {fact(t('jobs.minExperience'), e.minExperienceYears ? t('jobs.years', { n: e.minExperienceYears }) : t('jobs.freshersWelcome'))}
              {fact(t('jobs.minPercentage'), e.minPercentage ? `${e.minPercentage}%` : '')}
              {fact(t('jobs.medium'), namesOf(lookup, e.mediumIds, locale))}
              {fact(t('jobs.policeVerification'), e.policeVerificationRequired ? t('jobs.policeRequired') : '')}
              {fact(t('jobs.other'), e.otherRequirements)}
            </dl>
          </section>

          <section className="card" aria-labelledby="desc-h">
            <h2 id="desc-h" className="text-lg font-bold">{t('jobs.description')}</h2>
            <div className="mt-2 whitespace-pre-line leading-relaxed">{job.description}</div>
          </section>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="card space-y-3" aria-labelledby="apply-h">
            <h2 id="apply-h" className="scroll-mt-4 text-lg font-bold">{job.applyMode === 'external' ? t('apply.howToApply') : t('apply.apply')}</h2>
            <ApplyPanel jobId={job.id} applyMode={job.applyMode} externalUrl={job.externalUrl} notificationPdfUrl={job.notificationPdfUrl}
              questions={job.screeningQuestions} closed={closed} viewer={!user ? 'guest' : candidate ? 'candidate' : 'other'} existingStage={data.stage} tracked={data.tracked} />
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <SaveJobButton jobId={job.id} saved={data.saved} signedIn={!!candidate} />
            </div>
            <ShareButtons title={`${job.title} – ${job.orgName}`} url={url} />
          </section>
          {data.match ? <MatchExplain m={data.match} t={t} /> : candidate && (
            <p className="card text-sm text-ink-soft">{data.hasProfile ? <>{t('match.enableHint')} <Link href="/account#privacy">{t('match.enableLink')}</Link></> : <>{t('match.needProfile')} <Link href="/candidate/profile">{t('profile.complete')}</Link></>}</p>
          )}
        </aside>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd(job, lookup)).replace(/</g, '\\u003c') }} />
    </div>
  );
}
