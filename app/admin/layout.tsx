import Link from 'next/link';
import { requireRole } from '@/lib/server/http';

export const metadata = { title: 'Administration', robots: { index: false } };

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/master', label: 'Master data' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/admin/outbox', label: 'Email outbox' },
];

/** The admin console is in English only (internal tool); the public and candidate/school screens are translated. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['platform_admin'], '/admin');
  return (
    <div className="container-page grid gap-6 py-6 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Administration" className="lg:sticky lg:top-4 lg:self-start">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map(n => <li key={n.href}><Link href={n.href} className="block whitespace-nowrap rounded-lg px-3 py-2 font-medium text-ink no-underline hover:bg-brand-50">{n.label}</Link></li>)}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
