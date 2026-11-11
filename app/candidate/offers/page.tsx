import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { isExpired } from '@/lib/server/offers';
import { longDate } from '@/lib/offerLetter';

export const metadata = { title: 'Offer letters' };

export default async function CandidateOffers() {
  const user = await requireRole(['candidate'], '/candidate/offers');
  const { t, locale } = await getT();
  const offers = await withDb(db => db.offers.filter(o => o.candidateId === user.id && o.status !== 'withdrawn').sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    .map(o => ({ ...o, orgName: db.jobs.find(j => j.id === o.jobId)?.orgName || '', expired: isExpired(o) })));
  return (
    <div className="container-page max-w-3xl space-y-6 py-6">
      <h1 className="text-2xl font-bold">{t('offers.candidateTitle')}</h1>
      {!offers.length ? <p className="card text-ink-soft">{t('offers.candidateNone')}</p> : (
        <ul className="space-y-3">{offers.map(o => (
          <li key={o.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold">{o.designation}</p>
              <p className="text-ink-soft">{o.orgName}</p>
              <p className="text-sm">{o.status === 'issued' && !o.expired ? t('offers.answerBy', { date: longDate(o.acceptBy, locale) }) : o.expired ? t('offers.status_expired') : t(`offers.status_${o.status}`)}</p>
            </div>
            <Link href={`/candidate/offers/${o.id}`} className={o.status === 'issued' && !o.expired ? 'btn-primary' : 'btn-ghost'}>{o.status === 'issued' && !o.expired ? t('offers.readAndAnswer') : t('offers.viewLetter')}</Link>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
