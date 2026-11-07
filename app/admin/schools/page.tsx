import Link from 'next/link';
import { withDb } from '@/lib/server/db';
import { lookupOf } from '@/lib/server/catalog';
import { lookupUdise } from '@/lib/server/udise';
import { udisePrefixWarning } from '@/lib/server/schools';
import { nameOf, namesOf } from '@/lib/jobs/display';
import SchoolReview from '@/components/admin/SchoolReview';

export const metadata = { title: 'School verification' };

const TABS = ['pending', 'verified', 'rejected'] as const;

/** Verification queue. Check the UDISE+ code (directory and the UDISE+ portal), affiliation and official contact. */
export default async function AdminSchools({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = (TABS as readonly string[]).includes((await searchParams).status || '') ? (await searchParams).status! : 'pending';
  const d = await withDb(db => {
    const lookup = lookupOf(db);
    return {
      lookup,
      counts: Object.fromEntries(TABS.map(s => [s, db.schools.filter(x => x.verification === s && !x.demo).length])),
      rows: db.schools.filter(x => x.verification === status && !x.demo).sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || '')).map(x => ({
        x,
        owner: db.users.find(u => u.id === x.createdBy),
        dupes: db.schools.filter(o => o.id !== x.id && o.udiseCode === x.udiseCode && !o.demo).map(o => `${o.name} (${o.verification})`),
        warning: udisePrefixWarning(lookup, x.udiseCode, x.stateId),
        group: x.groupId ? db.groups.find(g => g.id === x.groupId)?.name : null,
        jobs: db.jobs.filter(j => j.schoolId === x.id).length,
      })),
    };
  });
  const dir = new Map(await Promise.all(d.rows.map(async r => [r.x.id, await lookupUdise(r.x.udiseCode)] as const)));
  const row = (k: string, v: React.ReactNode) => v ? <div className="grid gap-1 py-1 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-semibold text-ink-soft">{k}</dt><dd className="text-sm">{v}</dd></div> : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">School verification</h1>
      <nav className="flex gap-1 text-sm" aria-label="Status">
        {TABS.map(s => <Link key={s} href={`/admin/schools?status=${s}`} aria-current={s === status ? 'true' : undefined} className={`rounded-lg px-3 py-1.5 capitalize no-underline ${s === status ? 'bg-brand-700 text-white' : 'text-brand-800 hover:bg-brand-50'}`}>{s} ({d.counts[s]})</Link>)}
      </nav>
      <p className="hint">Check the code on the official UDISE+ portal (udiseplus.gov.in, “Know your school”) when the directory has no entry. Never verify a school you could not check.</p>
      {!d.rows.length ? <p className="card text-ink-soft">Nothing here.</p> : (
        <ul className="space-y-4">
          {d.rows.map(({ x, owner, dupes, warning, group, jobs }) => {
            const rec = dir.get(x.id);
            return (
              <li key={x.id} className="card grid gap-4 lg:grid-cols-[1fr_320px]">
                <div>
                  <h2 className="text-lg font-bold">{x.name}</h2>
                  <dl className="mt-2">
                    {row('UDISE+ code', <span className="font-mono">{x.udiseCode}</span>)}
                    {row('Directory', rec ? <span className={x.directoryMatch ? 'text-success-700' : 'text-danger-700'}>{rec.name}{rec.district ? `, ${rec.district}` : ''}{rec.state ? `, ${rec.state}` : ''} {x.directoryMatch ? '✓ name matches' : '✗ name differs'}</span> : <span className="text-ink-muted">not in the imported directory</span>)}
                    {warning && row('Check', <span className="text-danger-700">The first two digits do not match the state’s UDISE+ prefix.</span>)}
                    {dupes.length > 0 && row('Same code used by', <span className="text-danger-700">{dupes.join('; ')}</span>)}
                    {row('Management', nameOf(d.lookup, x.managementTypeId))}
                    {row('Boards', x.affiliations.map(a => `${nameOf(d.lookup, a.boardId)}${a.number ? ` – ${a.number}` : ' – no affiliation no.'}`).join('; '))}
                    {row('Place', [x.address, x.city, nameOf(d.lookup, x.districtId), nameOf(d.lookup, x.stateId), x.pincode].filter(Boolean).join(', '))}
                    {row('Official email', x.officialEmail ? `${x.officialEmail} ${x.officialEmailVerified ? '✓ confirmed' : '(not confirmed)'}` : '—')}
                    {row('Phone', x.phone)}
                    {row('Principal', x.principalName)}
                    {row('Website', x.website && <a href={x.website} target="_blank" rel="noopener noreferrer nofollow">{x.website}</a>)}
                    {row('Classes', namesOf(d.lookup, x.levelIds))}
                    {row('Account', owner ? `${owner.name} <${owner.email}> ${owner.emailVerified ? '✓' : '(email not confirmed)'}` : '—')}
                    {row('Group', group)}
                    {row('Submitted', x.submittedAt?.slice(0, 16).replace('T', ' '))}
                    {row('Vacancies', String(jobs))}
                    {row('Last note', x.verificationNote)}
                  </dl>
                </div>
                <SchoolReview id={x.id} status={x.verification} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
