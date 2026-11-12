import Link from 'next/link';
import { Logo } from './Logo';
import { getT } from '@/lib/i18n/server';
import { COMPANY_CREDIT } from '@/lib/site';

export default async function Footer() {
  const { t } = await getT();
  // "A product of {company}": the company name and its link are placed where {company} is in the translation.
  const [before, after = ''] = t('footer.credit', { company: '\u0000' }).split('\u0000');
  const col = (title: string, links: { href: string; label: string }[]) => (
    <div>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-900">{title}</h2>
      <ul className="space-y-1 text-sm">{links.map(l => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}</ul>
    </div>
  );
  return (
    <footer className="mt-16 border-t border-line bg-paper print:hidden">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo size={44} tagline={t('common.tagline')} />
          <p className="text-sm text-ink-soft">{t('footer.about')}</p>
        </div>
        {col(t('footer.candidates'), [{ href: '/jobs', label: t('nav.jobs') }, { href: '/jobs?type=government', label: t('nav.govtNotices') }, { href: '/career', label: t('nav.career') }, { href: '/career/tet', label: t('career.tetTitle') }, { href: '/career/salary', label: t('career.salaryTitle') }, { href: '/register', label: t('nav.register') }])}
        {col(t('footer.schools'), [{ href: '/for-schools', label: t('nav.forSchools') }, { href: '/schools', label: t('school.directoryTitle') }, { href: '/register?role=school', label: t('home.forSchoolsCta') }])}
        {col(t('footer.legal'), [{ href: '/terms', label: t('footer.terms') }, { href: '/privacy', label: t('footer.privacy') }, { href: '/refund-policy', label: t('footer.refund') }, { href: '/contact', label: t('footer.contact') }])}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-1 py-4 text-sm text-ink-muted sm:flex-row sm:justify-between">
          <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
          <span>
            {before}{COMPANY_CREDIT.name} (<a href={COMPANY_CREDIT.url} rel="noopener">{COMPANY_CREDIT.label}</a>){after}
          </span>
        </div>
      </div>
    </footer>
  );
}
