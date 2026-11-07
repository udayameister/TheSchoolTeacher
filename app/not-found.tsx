import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-2xl font-bold">{t('errors.notFoundTitle')}</h1>
      <p className="mt-2 text-ink-soft">{t('errors.notFoundText')}</p>
      <Link href="/" className="btn-primary mt-6">{t('errors.goHome')}</Link>
    </div>
  );
}
