import Link from 'next/link';
import { BadgeCheck, Clock, XCircle } from 'lucide-react';
import type { School } from '@/types';
import type { TFunction } from '@/lib/i18n/translate';

export default function VerificationStatus({ school, t }: { school: School; t: TFunction }) {
  if (school.verification === 'verified') return (
    <p className="alert-ok flex flex-wrap items-center gap-2"><BadgeCheck size={18} aria-hidden="true" />{t('school.statusVerified')} <Link href={`/schools/${school.slug}`}>{t('school.viewPublicPage')}</Link></p>
  );
  if (school.verification === 'rejected') return (
    <div className="alert-error space-y-1"><p className="flex items-center gap-2 font-semibold"><XCircle size={18} aria-hidden="true" />{t('school.statusRejected')}</p>
      {school.verificationNote && <p>{t('emails.reason', { reason: school.verificationNote })}</p>}<p>{t('school.rejectedHelp')}</p></div>
  );
  return <p className="flex gap-2 rounded-lg border border-marigold-300 bg-marigold-50 px-3 py-2 text-sm"><Clock size={18} className="shrink-0" aria-hidden="true" />{t('school.statusPending')}</p>;
}
