'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/client';

const TABS = [
  ['/candidate', 'dashboard'], ['/candidate/profile', 'profile'], ['/candidate/documents', 'documents'], ['/candidate/applications', 'applications'],
  ['/candidate/interviews', 'interviews'], ['/candidate/offers', 'offers'], ['/candidate/saved', 'saved'], ['/candidate/tracker', 'tracker'], ['/candidate/alerts', 'alerts'],
] as const;

export default function CandidateNav() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <nav aria-label={t('candidate.navLabel')} className="border-b border-line bg-paper">
      <ul className="container-page flex gap-1 relative overflow-x-auto py-2">
        {TABS.map(([href, key]) => {
          const active = href === '/candidate' ? path === href : path.startsWith(href);
          return <li key={href}><Link href={href} aria-current={active ? 'page' : undefined} className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold no-underline ${active ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50'}`}>{t(`candidate.nav_${key}`)}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
