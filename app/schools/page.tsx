import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { withDb } from '@/lib/server/db';
import { publicSchools } from '@/lib/server/publicSchools';
import { lookupOf, publicJobs } from '@/lib/server/catalog';
import { listMaster } from '@/lib/server/masterData';
import { nameOf, namesOf } from '@/lib/jobs/display';
import { isPast } from '@/lib/jobs/dates';
import { itemName } from '@/lib/i18n/translate';

export const metadata: Metadata = { title: 'Verified schools', alternates: { canonical: '/schools' } };

export default async function SchoolsDirectory({ searchParams }: { searchParams: Promise<{ q?: string; state?: string; board?: string }> }) {
  const [{ t, locale }, q] = await Promise.all([getT(), searchParams]);
  const d = await withDb(db => {
    const lookup = lookupOf(db);
    const open = publicJobs(db).filter(j => j.status === 'published' && !isPast(j.lastDate));
    const s = (q.q || '').toLowerCase().trim();
    const schools = publicSchools(db)
      .filter(x => (!q.state || x.stateId === `states:${q.state}`) && (!q.board || x.boardIds.includes(`boards:${q.board}`)) && (!s || `${x.name} ${x.city}`.toLowerCase().includes(s)))
      .map(x => ({ x, open: open.filter(j => j.schoolId === x.id).length }))
      .sort((a, b) => b.open - a.open || a.x.name.localeCompare(b.x.name));
    return { lookup, schools, states: listMaster(db, 'states'), boards: listMaster(db, 'boards') };
  });
  return (
    <div className="container-page space-y-4 py-6">
      <h1 className="text-2xl font-bold">{t('school.directoryTitle')}</h1>
      <p className="text-ink-soft">{t('school.directoryIntro')}</p>
      <form method="get" className="card grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label><span className="label">{t('common.search')}</span><input name="q" className="input" defaultValue={q.q} /></label>
        <label><span className="label">{t('jobs.state')}</span><select name="state" className="input" defaultValue={q.state || ''}><option value="">{t('jobs.anyState')}</option>{d.states.map(s => <option key={s.id} value={s.code}>{itemName(s, locale)}</option>)}</select></label>
        <label><span className="label">{t('jobs.board')}</span><select name="board" className="input" defaultValue={q.board || ''}><option value="">{t('jobs.typeAll')}</option>{d.boards.map(b => <option key={b.id} value={b.code}>{itemName(b, locale)}</option>)}</select></label>
        <button className="btn-primary">{t('common.search')}</button>
      </form>
      {!d.schools.length ? <p className="card text-ink-soft">{t('school.directoryEmpty')}</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {d.schools.map(({ x, open }) => (
            <li key={x.id} className="card">
              <h2 className="flex items-start gap-1 text-lg font-bold"><Link href={`/schools/${x.slug}`}>{x.name}</Link><BadgeCheck size={18} className="mt-1 shrink-0 text-brand-600" aria-label={t('school.verifiedBadge')} /></h2>
              <p className="text-sm text-ink-soft">{[x.city, nameOf(d.lookup, x.districtId, locale), nameOf(d.lookup, x.stateId, locale)].filter(Boolean).join(', ')}</p>
              <p className="text-sm">{namesOf(d.lookup, x.boardIds, locale)} · {nameOf(d.lookup, x.managementTypeId, locale)}</p>
              <p className="mt-1 text-sm font-semibold text-brand-800">{t('school.openCount', { n: open })}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
