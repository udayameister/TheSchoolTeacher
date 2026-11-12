import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, ExternalLink, Globe, MapPin } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { withDb } from '@/lib/server/db';
import { publicSchools } from '@/lib/server/publicSchools';
import { lookupOf, publicJobs } from '@/lib/server/catalog';
import { currentUser } from '@/lib/server/http';
import { mapsUrl } from '@/lib/server/schools';
import { nameOf, namesOf } from '@/lib/jobs/display';
import { isPast } from '@/lib/jobs/dates';
import { absoluteUrl } from '@/lib/site';
import JobCard from '@/components/jobs/JobCard';

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  return withDb(db => {
    const school = publicSchools(db).find(s => s.slug === slug);
    if (!school) return null;
    const jobs = publicJobs(db).filter(j => j.schoolId === school.id && j.status === 'published' && !isPast(j.lastDate));
    return { school, jobs, lookup: lookupOf(db) };
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const r = await load((await params).slug);
  if (!r) return { title: 'Not found', robots: { index: false } };
  const desc = `${r.school.name}, ${r.school.city}. ${(r.school.about || '').slice(0, 140)}`;
  return { title: r.school.name, description: desc, alternates: { canonical: `/schools/${r.school.slug}` } };
}

export default async function SchoolPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [{ t, locale }, user, r] = await Promise.all([getT(), currentUser(), load(slug)]);
  if (!r) notFound();
  const { school: s, jobs, lookup } = r;
  const fact = (label: string, value: React.ReactNode) => value ? <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-2"><dt className="text-sm font-semibold text-ink-soft">{label}</dt><dd className="sm:col-span-2">{value}</dd></div> : null;
  const ctx = { lookup, t, locale, signedInCandidate: user?.role === 'candidate', saved: new Set<string>() };
  const ld = {
    '@context': 'https://schema.org', '@type': 'School', name: s.name, url: absoluteUrl(`/schools/${s.slug}`),
    address: { '@type': 'PostalAddress', streetAddress: s.address || undefined, addressLocality: s.city, addressRegion: nameOf(lookup, s.stateId), postalCode: s.pincode || undefined, addressCountry: 'IN' },
    ...(s.lat != null && s.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } } : {}),
    ...(s.website || (s.socialLinks || []).length ? { sameAs: [s.website, ...(s.socialLinks || []).map(l => l.url)].filter(Boolean) } : {}),
    ...(s.establishedYear ? { foundingDate: String(s.establishedYear) } : {}), ...(s.about ? { description: s.about.slice(0, 500) } : {}),
    identifier: { '@type': 'PropertyValue', propertyID: 'UDISE+', value: s.udiseCode },
  };
  return (
    <div className="container-page space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold sm:text-3xl">{s.name}<span className="badge border-brand-300 bg-brand-50 text-brand-800"><BadgeCheck size={14} className="mr-1" aria-hidden="true" />{t('school.verifiedBadge')}</span></h1>
        <p className="flex items-center gap-1 text-ink-soft"><MapPin size={16} aria-hidden="true" />{[s.city, nameOf(lookup, s.districtId, locale), nameOf(lookup, s.stateId, locale)].filter(Boolean).join(', ')}</p>
        <div className="flex flex-wrap gap-2">
          <a href={mapsUrl(s)} target="_blank" rel="noopener noreferrer" className="btn-ghost"><MapPin size={18} aria-hidden="true" />{t('school.openMap')}<span className="sr-only"> ({t('apply.newTab')})</span></a>
          {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer nofollow" className="btn-ghost"><Globe size={18} aria-hidden="true" />{t('school.website')}<ExternalLink size={14} aria-hidden="true" /></a>}
        </div>
      </header>

      {s.photos.length > 0 && (
        <ul className="-mx-4 flex snap-x gap-3 relative overflow-x-auto px-4 pb-2" aria-label={t('school.photos')}>
          {s.photos.map(p => (
            <li key={p.id} className="w-64 shrink-0 snap-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/schools/photo/${p.id}`} alt={p.caption || s.name} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" width={256} height={192} />
              {p.caption && <p className="mt-1 text-xs text-ink-soft">{p.caption}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {s.about && <section className="card"><h2 className="text-lg font-bold">{t('school.about')}</h2><p className="mt-2 whitespace-pre-line leading-relaxed">{s.about}</p></section>}
          {(s.whyJoin || (s.benefitIds || []).length > 0) && (
            <section className="card space-y-2">
              <h2 className="text-lg font-bold">{t('school.forTeachers')}</h2>
              {s.whyJoin && <p className="whitespace-pre-line leading-relaxed">{s.whyJoin}</p>}
              {(s.benefitIds || []).length > 0 && <ul className="flex flex-wrap gap-2" aria-label={t('school.staffBenefits')}>{(s.benefitIds || []).map(id => <li key={id} className="badge border-brand-300 bg-brand-50 py-1 text-sm text-brand-800">{nameOf(lookup, id, locale)}</li>)}</ul>}
            </section>
          )}
          {s.achievements && <section className="card"><h2 className="text-lg font-bold">{t('school.achievements')}</h2><p className="mt-2 whitespace-pre-line leading-relaxed">{s.achievements}</p></section>}
          <section aria-labelledby="open-h" className="space-y-3">
            <h2 id="open-h" className="text-lg font-bold">{t('school.openVacancies')} ({jobs.length})</h2>
            {jobs.length ? <ul className="space-y-3">{jobs.map(j => <li key={j.id}><JobCard job={j} ctx={ctx} /></li>)}</ul> : <p className="card text-ink-soft">{t('school.noOpenVacancies')}</p>}
          </section>
        </div>
        <aside className="card self-start">
          <h2 className="text-lg font-bold">{t('jobs.keyFacts')}</h2>
          <dl className="mt-2 divide-y divide-line">
            {fact(t('school.boards'), s.affiliations.map(a => `${nameOf(lookup, a.boardId, locale)}${a.number ? ` (${a.number})` : ''}`).join(', '))}
            {fact(t('jobs.management'), nameOf(lookup, s.managementTypeId, locale))}
            {fact(t('profile.levels'), namesOf(lookup, s.levelIds, locale))}
            {fact(t('school.streams'), namesOf(lookup, s.streamIds, locale))}
            {fact(t('school.mediums'), namesOf(lookup, s.mediumIds, locale))}
            {fact(t('school.facilities'), namesOf(lookup, s.facilityIds, locale))}
            {fact(t('school.establishedYear'), s.establishedYear ? String(s.establishedYear) : '')}
            {fact(t('school.studentCount'), s.studentCount ? s.studentCount.toLocaleString('en-IN') : '')}
            {fact(t('school.teacherCount'), s.teacherCount ? s.teacherCount.toLocaleString('en-IN') : '')}
            {fact(t('school.studentTeacherRatio'), s.studentCount && s.teacherCount ? `${Math.round(s.studentCount / s.teacherCount)} : 1` : '')}
            {fact(t('school.socialLinks'), (s.socialLinks || []).length ? <ul>{(s.socialLinks || []).map(l => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.label}</a></li>)}</ul> : '')}
            {fact('UDISE+', s.udiseCode)}
          </dl>
        </aside>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </div>
  );
}
