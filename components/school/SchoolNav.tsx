'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

const TABS = [['/school', 'dashboard'], ['/school/jobs', 'jobs'], ['/school/applicants', 'applicants'], ['/school/profile', 'profile']] as const;

export default function SchoolNav({ schools, currentId, canAddBranch }: { schools: { id: string; name: string }[]; currentId: string | null; canAddBranch: boolean }) {
  const { t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  return (
    <nav aria-label={t('school.navLabel')} className="border-b border-line bg-paper">
      <div className="container-page flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex gap-1 relative overflow-x-auto">
          {TABS.map(([href, key]) => {
            const active = href === '/school' ? path === href : path.startsWith(href);
            return <li key={href}><Link href={href} aria-current={active ? 'page' : undefined} className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold no-underline ${active ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50'}`}>{t(`school.nav_${key}`)}</Link></li>;
          })}
        </ul>
        {schools.length > 1 || canAddBranch ? (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm"><span className="whitespace-nowrap">{t('school.branch')}</span>
              <select className="input min-h-[40px] py-1" value={currentId || ''} onChange={async e => {
                if (e.target.value === '__new') { router.push('/school/register?branch=1'); return; }
                await api('/api/school/switch', { schoolId: e.target.value }); router.refresh();
              }}>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                {canAddBranch && <option value="__new">+ {t('school.addBranch')}</option>}
              </select></label>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
