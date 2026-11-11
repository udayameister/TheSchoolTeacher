import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { lookupOf, matchWeights, matchingAllowed, publicJobs } from '@/lib/server/catalog';
import { completeness, emptyProfile } from '@/lib/server/profile';
import { computeMatch } from '@/lib/jobs/match';
import { daysLeft, isPast } from '@/lib/jobs/dates';
import JobCard from '@/components/jobs/JobCard';
import Meter from '@/components/candidate/Meter';
import { candidateInvites } from '@/lib/server/talent';
import { isExpired } from '@/lib/server/offers';

export default async function CandidateHome() {
  const user = await requireRole(['candidate'], '/candidate');
  const { t, locale } = await getT();
  const d = await withDb(db => {
    const lookup = lookupOf(db);
    const profile = db.profiles[user.id];
    const c = completeness(profile || emptyProfile(user.id), user, db.documents.filter(x => x.userId === user.id));
    const applied = new Set(db.applications.filter(a => a.candidateId === user.id).map(a => a.jobId));
    const open = publicJobs(db).filter(j => j.status === 'published' && !isPast(j.lastDate) && !applied.has(j.id));
    const canMatch = !!profile && matchingAllowed(db, user.id);
    const w = matchWeights(db);
    const scored = canMatch ? open.map(j => ({ j, s: computeMatch(j, profile!, lookup, w).score })).sort((a, b) => b.s - a.s) : open.map(j => ({ j, s: -1 })).sort((a, b) => (b.j.publishedAt || '').localeCompare(a.j.publishedAt || ''));
    const top = scored.slice(0, 5);
    return {
      lookup, c, canMatch,
      jobs: top.map(x => x.j), match: new Map(canMatch ? top.map(x => [x.j.id, x.s]) : []),
      apps: db.applications.filter(a => a.candidateId === user.id),
      deadlines: db.tracked.filter(x => x.userId === user.id && x.status !== 'closed').map(x => ({ ...x, lastDate: (x.jobId && db.jobs.find(j => j.id === x.jobId)?.lastDate) || x.lastDate }))
        .filter(x => { const n = daysLeft(x.lastDate); return n !== null && n >= 0 && n <= 14; }).sort((a, b) => (a.lastDate || '').localeCompare(b.lastDate || '')).slice(0, 5),
      saved: new Set(db.savedJobs.filter(s => s.userId === user.id).map(s => s.jobId)),
      alerts: db.alerts.filter(a => a.userId === user.id).length,
      invites: candidateInvites(db, user).filter(x => !x.applied).slice(0, 5),
      toBook: db.interviews.filter(i => i.candidateId === user.id && i.status === 'invited').length,
      booked: db.interviews.filter(i => i.candidateId === user.id && i.status === 'booked' && (db.slots.find(s => s.id === i.slotId)?.start || '') >= new Date().toISOString()).length,
      offers: db.offers.filter(o => o.candidateId === user.id && o.status === 'issued' && !isExpired(o)).length,
    };
  });
  const active = d.apps.filter(a => a.stage !== 'withdrawn' && a.stage !== 'not_selected').length;
  const ctx = { lookup: d.lookup, t, locale, signedInCandidate: true, saved: d.saved, match: d.canMatch ? d.match : undefined };

  return (
    <div className="container-page space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('console.candidateTitle')}</h1>
        <p className="text-ink-soft">{t('candidate.welcome', { name: user.name })}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="card space-y-3 md:col-span-2">
          <Meter percent={d.c.percent} label={t('profile.completeness')} />
          {d.c.missing.length > 0 && <p className="text-sm text-ink-soft">{t('profile.stillMissing')}: {d.c.missing.slice(0, 4).map(m => t(`profile.check_${m}`)).join(' · ')}{d.c.missing.length > 4 ? ' …' : ''}</p>}
          <Link href="/candidate/profile" className="btn-primary">{d.c.percent < 100 ? t('profile.complete') : t('profile.edit')}</Link>
        </section>
        <section className="card space-y-1">
          <p><Link href="/candidate/applications" className="text-2xl font-bold">{active}</Link> <span className="text-ink-soft">{t('candidate.activeApplications')}</span></p>
          <p><Link href="/candidate/saved" className="text-2xl font-bold">{d.saved.size}</Link> <span className="text-ink-soft">{t('candidate.savedJobs')}</span></p>
          <p><Link href="/candidate/alerts" className="text-2xl font-bold">{d.alerts}</Link> <span className="text-ink-soft">{t('candidate.jobAlerts')}</span></p>
        </section>
      </div>

      {(d.toBook > 0 || d.booked > 0 || d.offers > 0) && (
        <section className="card space-y-1 border-marigold-400" aria-labelledby="act-h">
          <h2 id="act-h" className="text-lg font-bold">{t('candidate.actionNeeded')}</h2>
          {d.offers > 0 && <p><Link href="/candidate/offers" className="font-semibold">{t('candidate.offersWaiting', { n: d.offers })}</Link></p>}
          {d.toBook > 0 && <p><Link href="/candidate/interviews" className="font-semibold">{t('candidate.interviewsToBook', { n: d.toBook })}</Link></p>}
          {d.booked > 0 && <p><Link href="/candidate/interviews">{t('candidate.interviewsBooked', { n: d.booked })}</Link></p>}
        </section>
      )}

      {d.invites.length > 0 && (
        <section className="card" aria-labelledby="inv-h">
          <h2 id="inv-h" className="text-lg font-bold">{t('candidate.invitations')}</h2>
          <p className="text-sm text-ink-soft">{t('candidate.invitationsHint')}</p>
          <ul className="mt-2 divide-y divide-line">{d.invites.map(x => (
            <li key={x.invite.id} className="py-2 text-sm">
              <Link href={`/jobs/${x.job.id}`} className="font-semibold">{x.job.title}</Link> · {x.job.orgName}
              {x.invite.message && <p className="mt-1 whitespace-pre-line text-ink-soft">“{x.invite.message}”</p>}
            </li>
          ))}</ul>
        </section>
      )}

      {d.deadlines.length > 0 && (
        <section className="card" aria-labelledby="dl-h">
          <h2 id="dl-h" className="text-lg font-bold">{t('candidate.upcomingDeadlines')}</h2>
          <ul className="mt-2 divide-y divide-line">
            {d.deadlines.map(x => {
              const n = daysLeft(x.lastDate)!;
              return <li key={x.id} className="flex justify-between gap-2 py-2 text-sm"><span>{x.jobId ? <Link href={`/jobs/${x.jobId}`}>{x.title}</Link> : x.title} · {x.organisation}</span><span className={n <= 3 ? 'font-semibold text-danger-700' : ''}>{n === 0 ? t('jobs.lastDayToday') : t('tracker.daysLeft', { n })}</span></li>;
            })}
          </ul>
          <Link href="/candidate/tracker" className="mt-2 inline-block text-sm font-semibold">{t('candidate.nav_tracker')}</Link>
        </section>
      )}

      <section aria-labelledby="rec-h" className="space-y-3">
        <h2 id="rec-h" className="text-lg font-bold">{d.canMatch ? t('candidate.recommended') : t('home.latestJobs')}</h2>
        {!d.canMatch && <p className="text-sm text-ink-muted">{t('match.enableHint')} <Link href="/account#privacy">{t('match.enableLink')}</Link></p>}
        {d.jobs.length ? <ul className="space-y-3">{d.jobs.map(j => <li key={j.id}><JobCard job={j} ctx={ctx} /></li>)}</ul> : <p className="card text-ink-soft">{t('home.latestEmpty')}</p>}
        <Link href="/jobs" className="btn-ghost">{t('home.searchButton')}</Link>
      </section>
    </div>
  );
}
