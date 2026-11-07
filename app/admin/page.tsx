import Link from 'next/link';
import { withDb } from '@/lib/server/db';
import { storageStatus } from '@/lib/server/persist';
import { emailConfigured } from '@/lib/server/mailer';
import { googleConfigured } from '@/lib/server/oidc';

export default async function AdminHome() {
  const [stats, storage] = await Promise.all([
    withDb(db => ({
      users: db.users.length,
      byRole: db.users.reduce<Record<string, number>>((m, u) => ({ ...m, [u.role]: (m[u.role] || 0) + 1 }), {}),
      verify: Object.values(db.master).flat().filter(i => i && i.verify && i.active).length,
      failedMail: db.outbox.filter(o => o.status === 'failed').length,
      queuedMail: db.outbox.filter(o => o.status === 'queued').length,
    })),
    storageStatus(),
  ]);
  const tile = (label: string, value: React.ReactNode, href?: string) => (
    <div className="card"><p className="text-sm text-ink-muted">{label}</p><p className="mt-1 text-2xl font-bold text-brand-900">{href ? <Link href={href}>{value}</Link> : value}</p></div>
  );
  const ok = (v: boolean, yes: string, no: string) => <span className={`badge ${v ? 'border-success-600/30 bg-success-50 text-success-700' : 'border-marigold-400 bg-marigold-50 text-marigold-800'}`}>{v ? yes : no}</span>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administration</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tile('Accounts', stats.users, '/admin/users')}
        {tile('Teachers', stats.byRole.candidate || 0)}
        {tile('School accounts', (stats.byRole.school_admin || 0) + (stats.byRole.school_staff || 0))}
        {tile('Master data to verify', stats.verify, '/admin/master')}
      </div>
      <section className="card">
        <h2 className="text-lg font-bold">System</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Database: {storage.backend === 'mysql' ? 'MySQL' : 'local files (./data)'} {ok(storage.ok, 'working', `error: ${storage.error || ''}`)}</li>
          <li>Email: {ok(emailConfigured(), 'configured', 'not configured: messages are only recorded in the outbox')} {stats.queuedMail ? `· ${stats.queuedMail} waiting to retry` : ''} {stats.failedMail ? `· ${stats.failedMail} failed` : ''}</li>
          <li>Google sign-in: {ok(googleConfigured(), 'on', 'off (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set)')}</li>
          <li>Signing secret: {ok(!!process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32, 'set', 'AUTH_SECRET missing: codes and links stop working after a restart')}</li>
        </ul>
      </section>
    </div>
  );
}
