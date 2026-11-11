import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireSchoolPerm } from '@/lib/server/schoolPage';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { isExpired } from '@/lib/server/offers';
import { DEFAULT_OFFER_TEMPLATE, OFFER_FIELDS } from '@/lib/offerLetter';
import OfferSettings from '@/components/school/OfferSettings';

export const metadata = { title: 'Offer letters' };

export default async function OffersPage() {
  const user = await requireSchoolPerm('offers', '/school/offers');
  const { t, locale } = await getT();
  const d = await withDb(db => {
    const school = currentSchool(db, user);
    if (!school) return null;
    return {
      template: school.offerTemplate || '', signatory: school.offerSignatory || null,
      offers: db.offers.filter(o => o.schoolId === school.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map(o => ({
        ...o, candidateName: db.users.find(u => u.id === o.candidateId)?.name || '—', jobTitle: db.jobs.find(j => j.id === o.jobId)?.title || '', expired: isExpired(o),
      })),
    };
  });
  if (!d) redirect('/school');
  const fmt = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  return (
    <div className="container-page max-w-5xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('offers.title')}</h1>
        <p className="text-ink-soft">{t('offers.intro')}</p>
      </div>
      <section className="card" aria-labelledby="ol-h">
        <h2 id="ol-h" className="text-lg font-bold">{t('offers.issued')}</h2>
        {d.offers.length ? (
          <div className="relative mt-2 overflow-x-auto">
            <table className="table">
              <thead><tr><th scope="col">{t('common.name')}</th><th scope="col">{t('jobs.post')}</th><th scope="col">{t('offers.issuedCol')}</th><th scope="col">{t('offers.acceptBy')}</th><th scope="col">{t('offers.statusCol')}</th></tr></thead>
              <tbody>{d.offers.map(o => (
                <tr key={o.id}>
                  <td><Link href={`/school/applicants/${o.applicationId}`} className="font-semibold">{o.candidateName}</Link></td>
                  <td>{o.designation}</td>
                  <td className="whitespace-nowrap">{fmt(o.issuedAt)}</td>
                  <td className="whitespace-nowrap">{fmt(o.acceptBy)}</td>
                  <td>{o.expired ? t('offers.status_expired') : t(`offers.status_${o.status}`)}{o.responseNote ? <span className="block text-xs text-ink-muted">“{o.responseNote}”</span> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="mt-2 text-ink-soft">{t('offers.none')}</p>}
        <p className="hint mt-2">{t('offers.howToIssue')}</p>
      </section>
      <OfferSettings template={d.template} defaultTemplate={DEFAULT_OFFER_TEMPLATE} fields={[...OFFER_FIELDS]} signatory={d.signatory} />
    </div>
  );
}
