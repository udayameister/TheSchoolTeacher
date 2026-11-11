import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { isExpired } from '@/lib/server/offers';
import { longDate } from '@/lib/offerLetter';
import OfferResponse from '@/components/candidate/OfferResponse';
import PrintButton from '@/components/PrintButton';

export const metadata = { title: 'Offer letter', robots: { index: false } };

export default async function OfferLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(['candidate'], `/candidate/offers/${id}`);
  const { t, locale } = await getT();
  const d = await withDb(db => {
    const o = db.offers.find(x => x.id === id && x.candidateId === user.id && x.status !== 'withdrawn');
    if (!o) return null;
    const school = db.schools.find(s => s.id === o.schoolId);
    return { o, school: school ? { name: school.name, udise: school.udiseCode, city: school.city, address: school.address } : null, expired: isExpired(o) };
  });
  if (!d) notFound();
  const { o } = d;
  return (
    <div className="container-page max-w-3xl space-y-4 py-6">
      <p className="text-sm print:hidden"><Link href="/candidate/offers" className="inline-flex items-center gap-1"><ArrowLeft size={16} aria-hidden="true" />{t('offers.candidateTitle')}</Link></p>
      <article className="card space-y-4 print:border-0 print:shadow-none" aria-labelledby="letter-h">
        <header className="border-b border-line pb-3">
          <h1 id="letter-h" className="text-xl font-bold">{d.school?.name}</h1>
          <p className="text-sm text-ink-soft">{[d.school?.address, d.school?.city].filter(Boolean).join(', ')} · UDISE+ {d.school?.udise}</p>
          <p className="mt-2 text-sm">{t('offers.letterDate', { date: longDate(o.issuedAt.slice(0, 10), locale) })}</p>
          <p className="text-sm font-semibold">{t('offers.subjectLine', { post: o.designation })}</p>
        </header>
        <div className="whitespace-pre-line leading-relaxed">{o.letter}</div>
        <footer className="pt-4">
          <p>{t('offers.yoursFaithfully')}</p>
          <p className="mt-6 font-semibold">{o.signatory.name}</p>
          <p className="text-sm">{o.signatory.designation}, {d.school?.name}</p>
        </footer>
      </article>
      <p className="hint print:hidden">{t('offers.onlineNote')}</p>
      <div className="flex flex-wrap gap-2 print:hidden"><PrintButton label={t('offers.print')} /></div>
      <section className="card print:hidden" aria-labelledby="resp-h">
        <h2 id="resp-h" className="mb-2 text-lg font-bold">{t('offers.yourAnswer')}</h2>
        {o.status === 'issued' && !d.expired
          ? <OfferResponse id={o.id} acceptBy={longDate(o.acceptBy, locale)} />
          : <p>{d.expired ? t('offers.expiredNote') : t(`offers.answered_${o.status}`)}{o.responseNote ? ` – “${o.responseNote}”` : ''}</p>}
      </section>
    </div>
  );
}
