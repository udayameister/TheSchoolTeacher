import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { I18nProvider } from '@/lib/i18n/client';
import { getT } from '@/lib/i18n/server';
import { LOCALE_TAGS } from '@/lib/i18n/config';
import { SITE_NAME, SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  const google = process.env.GOOGLE_SITE_VERIFICATION;
  const bing = process.env.BING_SITE_VERIFICATION;
  const title = `${t('common.tagline')} | ${SITE_NAME}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${SITE_NAME}` },
    description: t('home.heroSubtitle'),
    applicationName: SITE_NAME,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN', url: SITE_URL, title, description: t('home.heroSubtitle') },
    ...(google || bing ? { verification: { ...(google ? { google } : {}), ...(bing ? { other: { 'msvalidate.01': bing } } : {}) } } : {}),
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1A5550' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getT();
  return (
    <html lang={LOCALE_TAGS[locale]}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 rounded-lg bg-marigold-300 px-3 py-2 font-semibold text-ink">{t('common.skipToContent')}</a>
        <I18nProvider locale={locale}>
          <Navbar />
          <main id="main" className="w-full flex-1">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
