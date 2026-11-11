import Link from 'next/link';
import { BadgeCheck, Gift, Landmark, Search, ShieldCheck } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { itemName } from '@/lib/i18n/translate';
import { withDb } from '@/lib/server/db';
import { listMaster } from '@/lib/server/masterData';
import { lookupOf, publicJobs } from '@/lib/server/catalog';
import { isPast } from '@/lib/jobs/dates';
import { deadlineLabel, placeLabel } from '@/lib/jobs/display';

export default async function HomePage() {
  const { t, locale } = await getT();
  const { boards, states, latest, notices, lookup } = await withDb(db => {
    const open = publicJobs(db).filter(j => j.status === 'published' && !isPast(j.lastDate))
      .sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt));
    return {
      boards: listMaster(db, 'boards').filter(b => b.meta.scope !== 'state' && b.code !== 'OTHER'),
      states: listMaster(db, 'states'),
      latest: open.filter(j => j.kind !== 'government').slice(0, 6),
      notices: open.filter(j => j.kind === 'government').slice(0, 4),
      lookup: lookupOf(db),
    };
  });
  const faqs = [1, 2, 3, 4].map(n => ({ q: t(`home.faq${n}q`), a: t(`home.faq${n}a`) }));

  return (
    <>
      <section className="border-b border-line bg-gradient-to-b from-brand-50 to-ivory">
        <div className="container-page py-10 sm:py-14">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">{t('home.heroTitle')}</h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft">{t('home.heroSubtitle')}</p>
          <form action="/jobs" method="get" role="search" className="card mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="q" className="label">{t('home.searchLabel')}</label>
              <input id="q" name="q" className="input" placeholder={t('home.searchPlaceholder')} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="place" className="label">{t('home.districtLabel')}</label>
              <input id="place" name="place" className="input" placeholder={t('home.districtPlaceholder')} autoComplete="address-level2" />
            </div>
            <button className="btn-primary" type="submit"><Search size={18} aria-hidden="true" />{t('home.searchButton')}</button>
          </form>
          <div className="mt-6 space-y-3">
            <div>
              <h2 className="mb-2 text-sm font-bold text-brand-900">{t('home.byBoard')}</h2>
              <ul className="flex flex-wrap gap-2">
                {boards.map(b => <li key={b.id}><Link href={`/jobs?board=${b.code}`} className="badge border-brand-200 bg-paper px-3 py-1.5 text-sm text-brand-800 no-underline hover:bg-brand-50">{itemName(b, locale)}</Link></li>)}
              </ul>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-bold text-brand-900">{t('home.byState')}</summary>
              <ul className="mt-2 flex flex-wrap gap-2">
                {states.map(s => <li key={s.id}><Link href={`/jobs?state=${s.code}`} className="badge border-line bg-paper px-3 py-1.5 text-sm text-ink no-underline hover:bg-brand-50">{itemName(s, locale)}</Link></li>)}
              </ul>
            </details>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-marigold-50">
        <div className="container-page flex flex-col gap-2 py-4 sm:flex-row sm:items-start">
          <h2 className="flex shrink-0 items-center gap-2 text-base font-bold text-marigold-800"><Landmark size={18} aria-hidden="true" />{t('home.govtStrip')}</h2>
          <div className="text-sm text-ink-soft">
            {notices.length ? (
              <ul className="space-y-1">{notices.map(n => <li key={n.id}><Link href={`/jobs/${n.id}`} className="font-semibold">{n.title}</Link> <span className="text-ink-muted">· {n.orgName} · {deadlineLabel(n.lastDate, t, locale).text}</span></li>)}
                <li><Link href="/jobs?type=government" className="font-semibold">{t('home.allNotices')}</Link></li></ul>
            ) : <p>{t('home.govtEmpty')}</p>}
            <p className="mt-1 text-xs">{t('home.govtStripNote')}</p>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-6 py-10 lg:grid-cols-2">
        <section className="card" aria-labelledby="latest">
          <h2 id="latest" className="text-xl font-bold">{t('home.latestJobs')}</h2>
          {latest.length ? (
            <ul className="mt-3 divide-y divide-line">{latest.map(j => (
              <li key={j.id} className="py-2"><Link href={`/jobs/${j.id}`} className="font-semibold">{j.title}</Link>
                <span className="block text-sm text-ink-muted">{j.orgName} · {placeLabel(j, lookup, locale)} · {deadlineLabel(j.lastDate, t, locale).text}</span></li>
            ))}</ul>
          ) : <p className="mt-3 text-ink-soft">{t('home.latestEmpty')}</p>}
          <Link href="/jobs" className="mt-3 inline-block text-sm font-semibold">{t('home.allJobs')}</Link>
        </section>
        <section className="card" aria-labelledby="events">
          <h2 id="events" className="text-xl font-bold">{t('home.events')}</h2>
          <p className="mt-3 text-ink-soft">{t('home.eventsEmpty')}</p>
        </section>
      </div>

      <section className="container-page">
        <div className="rounded-xl bg-brand-800 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold text-white">{t('home.forSchoolsTitle')}</h2>
          <p className="mt-2 max-w-2xl text-brand-50">{t('home.forSchoolsText')}</p>
          <Link href="/register?role=school" className="btn-accent mt-5">{t('home.forSchoolsCta')}</Link>
        </div>
      </section>

      <section className="container-page py-10" aria-labelledby="trust">
        <h2 id="trust" className="text-2xl font-bold">{t('home.trustTitle')}</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {[[BadgeCheck, 'trust1'], [ShieldCheck, 'trust2'], [Gift, 'trust3']].map(([Icon, k]) => {
            const I = Icon as typeof BadgeCheck;
            return (
              <li key={k as string} className="card">
                <I className="text-brand-700" size={28} aria-hidden="true" />
                <h3 className="mt-2 font-bold">{t(`home.${k}Title`)}</h3>
                <p className="mt-1 text-sm text-ink-soft">{t(`home.${k}Text`)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container-page" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-bold">{t('home.faqTitle')}</h2>
        <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-paper">
          {faqs.map(f => (
            <details key={f.q} className="p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }).replace(/</g, '\\u003c') }} />
      </section>
    </>
  );
}
