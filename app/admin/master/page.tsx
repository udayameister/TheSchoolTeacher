import Link from 'next/link';
import { KINDS } from '@/lib/masterData/kinds';
import { withDb } from '@/lib/server/db';

export default async function MasterIndex() {
  const counts = await withDb(db => Object.fromEntries(KINDS.map(k => {
    const list = db.master[k.kind] || [];
    return [k.kind, { total: list.length, active: list.filter(i => i.active).length, verify: list.filter(i => i.verify && i.active).length }];
  })));
  const groups = [...new Set(KINDS.map(k => k.group))];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Master data</h1>
        <p className="mt-1 text-ink-soft">Every list the product uses. Items marked <strong>VERIFY</strong> were seeded and must be checked against official sources before launch (see docs/VERIFY_BEFORE_LAUNCH.md).</p>
      </div>
      {groups.map(g => (
        <section key={g}>
          <h2 className="mb-2 text-lg font-bold">{g}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {KINDS.filter(k => k.group === g).map(k => (
              <li key={k.kind} className="card">
                <Link href={`/admin/master/${k.kind}`} className="text-base font-bold">{k.label}</Link>
                <p className="mt-1 text-sm text-ink-soft">{k.description}</p>
                <p className="mt-2 text-sm">
                  {counts[k.kind].active} active{counts[k.kind].total > counts[k.kind].active ? ` · ${counts[k.kind].total - counts[k.kind].active} inactive` : ''}
                  {counts[k.kind].verify > 0 && <span className="badge ml-2 border-marigold-400 bg-marigold-50 text-marigold-800">{counts[k.kind].verify} to verify</span>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
