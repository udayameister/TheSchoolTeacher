import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = { title: 'For schools', alternates: { canonical: '/for-schools' } };

export default async function ForSchools() {
  const { t } = await getT();
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold">{t('home.forSchoolsTitle')}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{t('home.forSchoolsText')}</p>
      <p className="mt-3 max-w-2xl text-ink-soft">{t('home.trust1Text')}</p>
      <Link href="/register?role=school" className="btn-primary mt-6">{t('home.forSchoolsCta')}</Link>
    </div>
  );
}
