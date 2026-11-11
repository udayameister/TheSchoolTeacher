import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { candidateInterviews, CHANGE_CUTOFF_MIN } from '@/lib/server/interviews';
import InterviewBooking from '@/components/candidate/InterviewBooking';

export const metadata = { title: 'Interviews and demo classes' };

export default async function CandidateInterviews() {
  const user = await requireRole(['candidate'], '/candidate/interviews');
  const { t } = await getT();
  const rows = await withDb(db => candidateInterviews(db, user));
  const active = rows.filter(r => r.status === 'invited' || r.status === 'booked');
  const past = rows.filter(r => !(r.status === 'invited' || r.status === 'booked'));
  return (
    <div className="container-page max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('interviews.title')}</h1>
        <p className="text-ink-soft">{t('interviews.candidateIntro', { h: CHANGE_CUTOFF_MIN / 60 })}</p>
      </div>
      {!rows.length && <p className="card text-ink-soft">{t('interviews.candidateNone')} <Link href="/candidate/applications">{t('candidate.nav_applications')}</Link></p>}
      {active.map(r => <InterviewBooking key={r.id} iv={r} />)}
      {past.length > 0 && (
        <section aria-labelledby="past-h">
          <h2 id="past-h" className="text-lg font-bold">{t('interviews.past')}</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-paper">{past.map(r => (
            <li key={r.id} className="p-3 text-sm"><span className="font-semibold">{t(`interviews.kind_${r.kind}`)}</span> · {r.jobTitle} · {r.orgName} · {t(`interviews.status_${r.status}`)}</li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
