import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Logo } from './Logo';
import LanguageSwitcher from './LanguageSwitcher';
import SignOutButton from './SignOutButton';
import { currentUser } from '@/lib/server/http';
import { homeFor } from '@/lib/server/auth';
import { getT } from '@/lib/i18n/server';

/** Server-rendered header. The mobile menu is a <details> element, so it works without JavaScript. */
export default async function Navbar() {
  const [{ t }, user] = await Promise.all([getT(), currentUser()]);
  const links = [
    { href: '/jobs', label: t('nav.jobs') },
    { href: '/jobs?type=government', label: t('nav.govtNotices') },
    { href: '/career', label: t('nav.career') },
    { href: '/for-schools', label: t('nav.forSchools') },
  ];
  const auth = () => user ? (
    <>
      <Link href={homeFor(user.role)} className="btn-primary">{t('nav.myConsole')}</Link>
      <Link href="/account" className="btn-ghost">{t('nav.account')}</Link>
      <SignOutButton label={t('nav.signOut')} />
    </>
  ) : (
    <>
      <Link href="/login" className="btn-ghost">{t('nav.signIn')}</Link>
      <Link href="/register" className="btn-primary">{t('nav.register')}</Link>
    </>
  );
  return (
    <header className="border-b border-line bg-paper print:hidden">
      <div className="container-page flex min-h-[64px] items-center justify-between gap-2">
        <Link href="/" className="no-underline hover:no-underline" aria-label="TheSchoolTeacher home"><Logo /></Link>
        <nav aria-label={t('nav.mainNav')} className="hidden items-center gap-0.5 xl:flex">
          {links.map(l => <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-lg px-2 py-2 font-medium text-ink no-underline hover:bg-brand-50">{l.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-1.5 whitespace-nowrap xl:flex">
          <LanguageSwitcher />
          {auth()}
        </div>
        <details className="relative xl:hidden">
          <summary className="btn-ghost list-none" aria-label={t('nav.menu')}><Menu size={20} aria-hidden="true" /></summary>
          <div className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-line bg-paper p-3 shadow-card">
            {links.map(l => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 font-medium text-ink no-underline hover:bg-brand-50">{l.label}</Link>)}
            <LanguageSwitcher />
            {auth()}
          </div>
        </details>
      </div>
    </header>
  );
}
