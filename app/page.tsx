import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, BadgeCheck, BadgeIndianRupee, BarChart3, BellRing, Building2, CalendarCheck, CalendarClock, CalendarDays, ClipboardCheck,
  Eye, FilePlus2, FileSignature, FileText, FolderLock, Gauge, Gift, GraduationCap, Landmark, Languages, ListChecks, Presentation, School,
  Search, Send, ShieldCheck, Sparkles, Target, Users, UsersRound,
} from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { itemName } from '@/lib/i18n/translate';
import { withDb } from '@/lib/server/db';
import { listMaster } from '@/lib/server/masterData';
import { lookupOf, publicJobs } from '@/lib/server/catalog';
import { publicSchools } from '@/lib/server/publicSchools';
import { isPast } from '@/lib/jobs/dates';
import { deadlineLabel, placeLabel } from '@/lib/jobs/display';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';
import { COMPANY, FOUNDERS } from '@/lib/content/about';
import Reveal from '@/components/home/Reveal';
import CountUp from '@/components/home/CountUp';
import VisitCounter from '@/components/home/VisitCounter';

const TEACHER_SERVICES = [
  { k: 'search', icon: Search, href: '/jobs' },
  { k: 'govt', icon: Landmark, href: '/jobs?type=government' },
  { k: 'match', icon: Target, href: '/jobs' },
  { k: 'apply', icon: Send, href: '/candidate/applications' },
  { k: 'alerts', icon: BellRing, href: '/candidate/alerts' },
  { k: 'tracker', icon: CalendarClock, href: '/candidate/tracker' },
  { k: 'interviews', icon: CalendarCheck, href: '/candidate/interviews' },
  { k: 'documents', icon: FolderLock, href: '/candidate/documents' },
  { k: 'resume', icon: FileText, href: '/candidate/resume' },
  { k: 'checker', icon: Gauge, href: '/candidate/resume/check' },
  { k: 'prep', icon: Presentation, href: '/career/interview' },
  { k: 'tet', icon: GraduationCap, href: '/career/tet' },
  { k: 'salary', icon: BadgeIndianRupee, href: '/career/salary' },
  { k: 'visible', icon: Eye, href: '/candidate/profile' },
] as const;

const SCHOOL_SERVICES = [
  { k: 'verified', icon: BadgeCheck }, { k: 'post', icon: FilePlus2 }, { k: 'pipeline', icon: ListChecks }, { k: 'schedule', icon: CalendarDays },
  { k: 'panel', icon: ClipboardCheck }, { k: 'offers', icon: FileSignature }, { k: 'talent', icon: Users }, { k: 'team', icon: UsersRound },
  { k: 'reports', icon: BarChart3 }, { k: 'branches', icon: Building2 },
] as const;

export default async function HomePage() {
  const { t, locale } = await getT();
  const L = (x: { en: string; hi: string }) => x[locale];
  const d = await withDb(db => {
    const open = publicJobs(db).filter(j => j.status === 'published' && !isPast(j.lastDate))
      .sort((a, b) => (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt));
    return {
      boards: listMaster(db, 'boards').filter(b => b.meta.scope !== 'state' && b.code !== 'OTHER'),
      states: listMaster(db, 'states'),
      latest: open.filter(j => j.kind !== 'government').slice(0, 6),
      notices: open.filter(j => j.kind === 'government').slice(0, 4),
      stats: { open: open.length, govt: open.filter(j => j.kind === 'government').length, schools: publicSchools(db).length, boards: listMaster(db, 'boards').length, tets: listMaster(db, 'tetExams').length },
      lookup: lookupOf(db),
    };
  });
  const faqs = [1, 2, 3, 4].map(n => ({ q: t(`home.faq${n}q`), a: t(`home.faq${n}a`) }));
  const orgLd = {
    '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: absoluteUrl('/brand/logo-mark-512.png'),
    founder: FOUNDERS.map(f => ({ '@type': 'Person', name: f.name, jobTitle: f.role.en })),
    parentOrganization: { '@type': 'Organization', name: COMPANY.name, url: COMPANY.url },
  };
  const stats = [
    { n: d.stats.open, label: t('home.statOpen') }, { n: d.stats.govt, label: t('home.statGovt') }, { n: d.stats.schools, label: t('home.statSchools') },
    { n: d.stats.boards, label: t('home.statBoards') }, { n: d.stats.tets, label: t('home.statTets') },
  ];
  const ticker = TEACHER_SERVICES.map(s => t(`home.ts_${s.k}`)).concat(SCHOOL_SERVICES.map(s => t(`home.ss_${s.k}`)));

  return (
    <div className="theme-maroon bg-maroon-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd).replace(/</g, '\\u003c') }} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-maroon-100 bg-gradient-to-br from-maroon-100 via-maroon-50 to-white">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-maroon-200/60 blur-3xl animate-drift" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-32 h-72 w-72 rounded-full bg-marigold-200/50 blur-3xl animate-drift [animation-delay:-6s]" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-maroon-300/30 blur-3xl animate-drift [animation-delay:-12s]" />
        <div className="container-page relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <Reveal><p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-maroon-800 shadow-sm"><Sparkles size={16} aria-hidden="true" />{t('home.kicker')}</p></Reveal>
            <Reveal delay={80}>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                {t('home.heroTitleA')}{' '}
                <span className="bg-gradient-to-r from-maroon-700 via-maroon-500 to-marigold-600 bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">{t('home.heroTitleB')}</span>
              </h1>
            </Reveal>
            <Reveal delay={160}><p className="mt-4 max-w-2xl text-lg text-[#4A3E41]">{t('home.heroSubtitle')}</p></Reveal>
            <Reveal delay={240}>
              <form action="/jobs" method="get" role="search" className="mt-6 grid gap-3 rounded-2xl border border-maroon-100 bg-white p-4 shadow-lift sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div><label htmlFor="q" className="label">{t('home.searchLabel')}</label><input id="q" name="q" className="input" placeholder={t('home.searchPlaceholder')} autoComplete="off" /></div>
                <div><label htmlFor="place" className="label">{t('home.districtLabel')}</label><input id="place" name="place" className="input" placeholder={t('home.districtPlaceholder')} autoComplete="address-level2" /></div>
                <button className="btn bg-maroon-700 text-white hover:bg-maroon-800" type="submit"><Search size={18} aria-hidden="true" />{t('home.searchButton')}</button>
              </form>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href="/register" className="btn bg-ink text-white hover:bg-black">{t('home.ctaTeacher')}<ArrowRight size={18} aria-hidden="true" /></Link>
                <Link href="/register?role=school" className="btn border border-maroon-300 bg-white text-maroon-800 hover:bg-maroon-50">{t('home.ctaSchool')}</Link>
                <VisitCounter />
              </div>
            </Reveal>
          </div>

          {/* Floating feature cards (illustration of the services, not real listings) */}
          <div aria-hidden="true" className="relative mx-auto hidden h-[400px] w-full max-w-md sm:block">
            {[
              { icon: Target, title: t('home.ts_match'), cls: 'left-0 top-0 animate-float', tint: 'bg-maroon-700 text-white' },
              { icon: FileText, title: t('home.ts_resume'), cls: 'right-0 top-20 animate-float-slow [animation-delay:-2s]', tint: 'bg-white text-ink' },
              { icon: CalendarDays, title: t('home.ss_schedule'), cls: 'left-4 top-40 animate-float [animation-delay:-4s]', tint: 'bg-white text-ink' },
              { icon: GraduationCap, title: t('home.ts_tet'), cls: 'right-2 top-60 animate-float-slow [animation-delay:-1s]', tint: 'bg-marigold-300 text-ink' },
              { icon: FileSignature, title: t('home.ss_offers'), cls: 'left-10 top-[20rem] animate-float [animation-delay:-3s]', tint: 'bg-white text-ink' },
            ].map(c => (
              <div key={c.title} className={`absolute flex w-56 items-center gap-3 rounded-2xl border border-maroon-100 p-4 shadow-lift ${c.tint} ${c.cls}`}>
                <c.icon size={26} className="shrink-0" />
                <span className="text-sm font-semibold leading-snug">{c.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Services ticker */}
        <div className="relative overflow-hidden border-t border-maroon-100 bg-maroon-800 py-3 text-maroon-50" aria-hidden="true">
          <div className="flex w-max animate-marquee gap-8 whitespace-nowrap text-sm font-semibold">
            {[...ticker, ...ticker].map((s, i) => <span key={i} className="inline-flex items-center gap-8">{s}<span className="text-marigold-300">✦</span></span>)}
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="container-page py-10" aria-label={t('home.statsLabel')}>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {stats.map((s, i) => (
            <Reveal as="li" key={s.label} delay={i * 80} className="rounded-2xl border border-maroon-100 bg-white p-5 text-center shadow-sm">
              <p className="text-3xl font-extrabold text-maroon-800"><CountUp value={s.n} /></p>
              <p className="mt-1 text-sm text-[#4A3E41]">{s.label}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Services for teachers */}
      <section id="teachers" className="container-page scroll-mt-20 py-8" aria-labelledby="ts-h">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-widest text-maroon-700">{t('home.forTeachersKicker')}</p>
          <h2 id="ts-h" className="mt-1 text-3xl font-extrabold">{t('home.forTeachersTitle')}</h2>
          <p className="mt-2 max-w-2xl text-[#4A3E41]">{t('home.forTeachersText')}</p>
        </Reveal>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TEACHER_SERVICES.map((s, i) => (
            <Reveal as="li" key={s.k} delay={(i % 4) * 70}>
              <Link href={s.href} className="group flex h-full flex-col rounded-2xl border border-maroon-100 bg-white p-5 text-ink no-underline shadow-sm transition duration-300 hover:-translate-y-1 hover:border-maroon-300 hover:no-underline hover:shadow-lift">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-maroon-100 text-maroon-800 transition group-hover:scale-110 group-hover:bg-maroon-700 group-hover:text-white"><s.icon size={22} aria-hidden="true" /></span>
                <span className="mt-3 font-bold">{t(`home.ts_${s.k}`)}</span>
                <span className="mt-1 text-sm text-[#4A3E41]">{t(`home.td_${s.k}`)}</span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Services for schools */}
      <section id="schools" className="scroll-mt-20 bg-gradient-to-b from-maroon-900 to-maroon-950 py-14 text-white" aria-labelledby="ss-h">
        <div className="container-page">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-widest text-marigold-300">{t('home.forSchoolsKicker')}</p>
            <h2 id="ss-h" className="mt-1 text-3xl font-extrabold text-white">{t('home.forSchoolsTitle')}</h2>
            <p className="mt-2 max-w-2xl text-maroon-100">{t('home.forSchoolsText')}</p>
          </Reveal>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {SCHOOL_SERVICES.map((s, i) => (
              <Reveal as="li" key={s.k} delay={(i % 5) * 70} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/10">
                <s.icon size={26} className="text-marigold-300" aria-hidden="true" />
                <h3 className="mt-3 font-bold text-white">{t(`home.ss_${s.k}`)}</h3>
                <p className="mt-1 text-sm text-maroon-100">{t(`home.sd_${s.k}`)}</p>
              </Reveal>
            ))}
          </ul>
          <Reveal className="mt-8 flex flex-wrap gap-3">
            <Link href="/register?role=school" className="btn-accent">{t('home.forSchoolsCta')}<ArrowRight size={18} aria-hidden="true" /></Link>
            <Link href="/for-schools" className="btn border border-white/30 text-white hover:bg-white/10">{t('home.forSchoolsMore')}</Link>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-14" aria-labelledby="how-h">
        <Reveal><h2 id="how-h" className="text-center text-3xl font-extrabold">{t('home.howTitle')}</h2></Reveal>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {(['teacher', 'school'] as const).map(side => (
            <Reveal key={side} className="rounded-3xl border border-maroon-100 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-xl font-bold text-maroon-800">{side === 'teacher' ? <GraduationCap aria-hidden="true" /> : <School aria-hidden="true" />}{t(`home.how_${side}`)}</h3>
              <ol className="mt-4 space-y-4">
                {[1, 2, 3].map(n => (
                  <li key={n} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-maroon-700 font-bold text-white">{n}</span>
                    <div><p className="font-semibold">{t(`home.how_${side}${n}`)}</p><p className="text-sm text-[#4A3E41]">{t(`home.how_${side}${n}d`)}</p></div>
                  </li>
                ))}
              </ol>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Government notices + latest */}
      <section className="container-page grid gap-6 pb-14 lg:grid-cols-2">
        <Reveal className="rounded-3xl border border-maroon-100 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-bold"><Landmark size={20} className="text-maroon-700" aria-hidden="true" />{t('home.govtStrip')}</h2>
          {d.notices.length ? (
            <ul className="mt-3 divide-y divide-maroon-100">{d.notices.map(n => <li key={n.id} className="py-2"><Link href={`/jobs/${n.id}`} className="font-semibold text-maroon-800">{n.title}</Link><span className="block text-sm text-ink-muted">{n.orgName} · {deadlineLabel(n.lastDate, t, locale).text}</span></li>)}</ul>
          ) : <p className="mt-3 text-[#4A3E41]">{t('home.govtEmpty')}</p>}
          <Link href="/jobs?type=government" className="mt-3 inline-block text-sm font-semibold text-maroon-800">{t('home.allNotices')}</Link>
          <p className="mt-2 text-xs text-ink-muted">{t('home.govtStripNote')}</p>
        </Reveal>
        <Reveal delay={100} className="rounded-3xl border border-maroon-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">{t('home.latestJobs')}</h2>
          {d.latest.length ? (
            <ul className="mt-3 divide-y divide-maroon-100">{d.latest.map(j => (
              <li key={j.id} className="py-2"><Link href={`/jobs/${j.id}`} className="font-semibold text-maroon-800">{j.title}</Link>
                <span className="block text-sm text-ink-muted">{j.orgName} · {placeLabel(j, d.lookup, locale)} · {deadlineLabel(j.lastDate, t, locale).text}</span></li>
            ))}</ul>
          ) : <p className="mt-3 text-[#4A3E41]">{t('home.latestEmpty')}</p>}
          <Link href="/jobs" className="mt-3 inline-block text-sm font-semibold text-maroon-800">{t('home.allJobs')}</Link>
          <div className="mt-4 border-t border-maroon-100 pt-3">
            <p className="text-sm font-bold">{t('home.byBoard')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">{d.boards.map(b => <li key={b.id}><Link href={`/jobs?board=${b.code}`} className="badge border-maroon-200 bg-maroon-50 px-3 py-1 text-sm text-maroon-800 no-underline hover:bg-maroon-100">{itemName(b, locale)}</Link></li>)}</ul>
            <details className="mt-2"><summary className="cursor-pointer text-sm font-bold">{t('home.byState')}</summary>
              <ul className="mt-2 flex flex-wrap gap-2">{d.states.map(s => <li key={s.id}><Link href={`/jobs?state=${s.code}`} className="badge border-maroon-100 bg-white px-3 py-1 text-sm text-ink no-underline hover:bg-maroon-50">{itemName(s, locale)}</Link></li>)}</ul>
            </details>
          </div>
        </Reveal>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 border-y border-maroon-100 bg-white py-14" aria-labelledby="about-h">
        <div className="container-page">
          <Reveal className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-maroon-700">{t('home.aboutKicker')}</p>
            <h2 id="about-h" className="mt-1 text-3xl font-extrabold">{t('home.aboutTitle')}</h2>
            <p className="mx-auto mt-2 max-w-2xl text-[#4A3E41]">{t('home.aboutText', { company: COMPANY.name, sister: COMPANY.sister.name })}</p>
          </Reveal>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {FOUNDERS.map((f, i) => (
              <Reveal key={f.name} delay={i * 120} className="flex flex-col gap-5 rounded-3xl border border-maroon-100 bg-maroon-50 p-6 sm:flex-row">
                <div className="relative mx-auto w-[120px] shrink-0 self-start sm:mx-0">
                  <div aria-hidden="true" className="absolute -inset-2 rotate-3 rounded-[1.6rem] border-2 border-maroon-200" />
                  <Image src={f.photo.src} alt={`${f.name}, ${L(f.role)}`} width={120} height={Math.round(120 * f.photo.height / f.photo.width)} className="relative rounded-3xl object-cover shadow-lift ring-4 ring-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold">{f.name}</h3>
                  <p className="font-semibold text-maroon-800">{L(f.role)}, {COMPANY.name}</p>
                  <p className="mt-1 text-sm text-[#4A3E41]">{L(f.summary)}</p>
                  <blockquote className="mt-3 border-l-4 border-maroon-300 pl-4 text-sm leading-relaxed text-ink">{L(f.note)}</blockquote>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-8 text-center"><Link href="/about" className="btn bg-maroon-700 text-white hover:bg-maroon-800">{t('home.aboutMore')}<ArrowRight size={18} aria-hidden="true" /></Link></Reveal>
        </div>
      </section>

      {/* Trust */}
      <section className="container-page py-14" aria-labelledby="trust">
        <Reveal><h2 id="trust" className="text-3xl font-extrabold">{t('home.trustTitle')}</h2></Reveal>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([[BadgeCheck, 'trust1'], [ShieldCheck, 'trust2'], [Gift, 'trust3'], [Languages, 'trust4']] as const).map(([I, k], i) => (
            <Reveal as="li" key={k} delay={i * 80} className="rounded-2xl border border-maroon-100 bg-white p-5 shadow-sm">
              <I className="text-maroon-700" size={28} aria-hidden="true" />
              <h3 className="mt-2 font-bold">{t(`home.${k}Title`)}</h3>
              <p className="mt-1 text-sm text-[#4A3E41]">{t(`home.${k}Text`)}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="container-page pb-14" aria-labelledby="faq">
        <Reveal><h2 id="faq" className="text-3xl font-extrabold">{t('home.faqTitle')}</h2></Reveal>
        <div className="mt-4 divide-y divide-maroon-100 rounded-2xl border border-maroon-100 bg-white">
          {faqs.map(f => (
            <details key={f.q} className="group p-4">
              <summary className="cursor-pointer font-semibold marker:text-maroon-700">{f.q}</summary>
              <p className="mt-2 text-[#4A3E41]">{f.a}</p>
            </details>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }).replace(/</g, '\\u003c') }} />
      </section>

      {/* Closing call to action */}
      <section className="container-page pb-16">
        <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-maroon-700 to-maroon-900 p-8 text-white shadow-lift sm:p-10">
          <div aria-hidden="true" className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-marigold-300/30 blur-2xl animate-drift" />
          <h2 className="relative text-3xl font-extrabold text-white">{t('home.finalTitle')}</h2>
          <p className="relative mt-2 max-w-2xl text-maroon-100">{t('home.finalText')}</p>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="btn bg-white text-maroon-900 hover:bg-maroon-50">{t('home.ctaTeacher')}</Link>
            <Link href="/register?role=school" className="btn-accent">{t('home.ctaSchool')}</Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
