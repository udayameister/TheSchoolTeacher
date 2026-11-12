import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Award, ExternalLink, Mail, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { CONTACT_EMAIL } from '@/lib/site';
import { COMPANY, FOUNDERS } from '@/lib/content/about';
import Reveal from '@/components/home/Reveal';

export const metadata: Metadata = {
  title: 'About us: founders and mission',
  description: 'TheSchoolTeacher is a teacher-recruitment platform for Indian schools by UKQAAI Technologies, founded by Udayakumar Palanivelu (Founder & CEO) and Dr. M. Indhumathi (Co-Founder).',
  alternates: { canonical: '/about' },
};

export default async function AboutPage() {
  const { t, locale } = await getT();
  const L = (x: { en: string; hi: string }) => x[locale];
  const values = [[Scale, 'v1'], [Sparkles, 'v2'], [ShieldCheck, 'v3']] as const;
  return (
    <div className="theme-maroon bg-maroon-50">
      <section className="relative overflow-hidden border-b border-maroon-100 bg-gradient-to-br from-maroon-100 via-maroon-50 to-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-maroon-200/60 blur-3xl animate-drift" />
        <div className="container-page relative max-w-4xl py-14 text-center">
          <Reveal><p className="text-sm font-bold uppercase tracking-widest text-maroon-700">{t('home.aboutKicker')}</p></Reveal>
          <Reveal delay={80}><h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{t('about.heroTitle')}</h1></Reveal>
          <Reveal delay={160}><p className="mx-auto mt-4 max-w-2xl text-lg text-[#4A3E41]">{t('about.heroText')}</p></Reveal>
        </div>
      </section>

      <section className="container-page max-w-5xl space-y-12 py-14" aria-labelledby="f-h">
        <h2 id="f-h" className="text-3xl font-extrabold">{t('about.founders')}</h2>
        {FOUNDERS.map((f, i) => (
          <Reveal key={f.name} className="grid items-start gap-8 md:grid-cols-[auto_1fr]">
            <div className="relative mx-auto" style={{ width: i === 0 ? 260 : 190 }}>
              <div aria-hidden="true" className="absolute -inset-3 rotate-2 rounded-[2rem] border-2 border-maroon-200" />
              <Image src={f.photo.src} alt={`${f.name}, ${L(f.role)}`} width={i === 0 ? 260 : 190} height={Math.round((i === 0 ? 260 : 190) * f.photo.height / f.photo.width)} priority={i === 0}
                className="relative rounded-[1.75rem] object-cover shadow-lift ring-4 ring-white" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-maroon-700">{L(f.role)}</p>
              <h3 className="mt-1 text-3xl font-extrabold">{f.name}</h3>
              <p className="mt-3 text-lg text-[#4A3E41]">{L(f.summary)}</p>
              {f.highlights.length > 0 && (
                <ul className="mt-4 space-y-2">{f.highlights.map(h => <li key={h.en} className="flex gap-3"><Award size={20} className="mt-0.5 shrink-0 text-maroon-600" aria-hidden="true" />{L(h)}</li>)}</ul>
              )}
              <figure className="mt-6 rounded-2xl border border-maroon-100 bg-white p-5 shadow-sm">
                <blockquote className="leading-relaxed">“{L(f.note)}”</blockquote>
                <figcaption className="mt-2 text-sm font-semibold text-maroon-800">— {f.name}</figcaption>
              </figure>
              {f.links.length > 0 && (
                <p className="mt-4 flex flex-wrap gap-4">{f.links.map(l => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-maroon-800">{l.label}<ExternalLink size={14} aria-hidden="true" /></a>)}</p>
              )}
            </div>
          </Reveal>
        ))}
      </section>

      <section className="border-y border-maroon-100 bg-white py-14" aria-labelledby="v-h">
        <div className="container-page max-w-5xl">
          <h2 id="v-h" className="text-3xl font-extrabold">{t('about.values')}</h2>
          <ul className="mt-6 grid gap-5 md:grid-cols-3">
            {values.map(([I, k], i) => (
              <Reveal as="li" key={k} delay={i * 100} className="rounded-2xl border border-maroon-100 bg-maroon-50 p-6">
                <I size={28} className="text-maroon-700" aria-hidden="true" />
                <h3 className="mt-3 font-bold">{t(`about.${k}`)}</h3>
                <p className="mt-1 text-sm text-[#4A3E41]">{t(`about.${k}d`)}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page grid max-w-5xl gap-6 py-14 md:grid-cols-2">
        <Reveal className="rounded-3xl border border-maroon-100 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-extrabold">{t('about.sister')}</h2>
          <p className="mt-2 text-[#4A3E41]">{t('about.sisterText', { name: COMPANY.sister.name, what: L(COMPANY.sister.what) })}</p>
          <p className="mt-3 flex flex-wrap gap-4">
            <a href={COMPANY.sister.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-maroon-800">{COMPANY.sister.url.replace('https://', '')}<ExternalLink size={14} aria-hidden="true" /></a>
            <a href={COMPANY.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-maroon-800">{COMPANY.name}<ExternalLink size={14} aria-hidden="true" /></a>
          </p>
        </Reveal>
        <Reveal delay={100} className="rounded-3xl bg-gradient-to-r from-maroon-700 to-maroon-900 p-6 text-white shadow-lift">
          <h2 className="text-xl font-extrabold text-white">{t('about.contact')}</h2>
          <p className="mt-2 text-maroon-100">{t('about.contactText')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn bg-white text-maroon-900 hover:bg-maroon-50"><Mail size={18} aria-hidden="true" />{CONTACT_EMAIL}</a>
            <Link href="/jobs" className="btn border border-white/40 text-white hover:bg-white/10">{t('nav.jobs')}<ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
