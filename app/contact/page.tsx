import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Contact', alternates: { canonical: '/contact' } };

export default async function Contact() {
  const { t } = await getT();
  const [before, after = ''] = t('legal.contactText', { email: '\u0000' }).split('\u0000');
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-bold">{t('legal.contactTitle')}</h1>
      <p className="mt-3 text-lg">{before}<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{after}</p>
    </div>
  );
}
