import Link from 'next/link';
import type { Metadata } from 'next';
import { BadgeIndianRupee, FileText, GraduationCap, Presentation } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Career tools for teachers',
  description: 'Free tools for school teachers in India: resume builder and checker, interview and demo-class preparation, TET practice and salary insights.',
  alternates: { canonical: '/career' },
};

export default async function CareerHub() {
  const { t } = await getT();
  const cards = [
    { href: '/candidate/resume', icon: FileText, title: t('career.resumeTitle'), text: t('career.resumeText') },
    { href: '/career/interview', icon: Presentation, title: t('career.interviewTitle'), text: t('career.interviewText') },
    { href: '/career/tet', icon: GraduationCap, title: t('career.tetTitle'), text: t('career.tetText') },
    { href: '/career/salary', icon: BadgeIndianRupee, title: t('career.salaryTitle'), text: t('career.salaryText') },
  ];
  return (
    <div className="container-page max-w-5xl space-y-6 py-8">
      <header>
        <h1 className="text-3xl font-bold">{t('career.title')}</h1>
        <p className="mt-1 text-lg text-ink-soft">{t('career.intro')}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map(c => (
          <li key={c.href}>
            <Link href={c.href} className="card flex h-full gap-4 no-underline hover:border-brand-400 hover:no-underline">
              <c.icon size={32} className="shrink-0 text-brand-700" aria-hidden="true" />
              <span><span className="block text-lg font-bold text-ink">{c.title}</span><span className="block text-ink-soft">{c.text}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">{t('career.free')}</p>
    </div>
  );
}
