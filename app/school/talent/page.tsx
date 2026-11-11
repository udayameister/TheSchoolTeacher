import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireSchoolPerm } from '@/lib/server/schoolPage';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { lookupOf } from '@/lib/server/catalog';
import { listMaster } from '@/lib/server/masterData';
import { cleanTalentFilters, invitableJobs, PAGE_SIZE, searchTalent } from '@/lib/server/talent';
import { nameOf, namesOf } from '@/lib/jobs/display';
import TalentInvite from '@/components/school/TalentInvite';
import type { MasterKind } from '@/types';

export const metadata = { title: 'Talent search' };

type Q = Record<string, string | undefined>;

export default async function TalentPage({ searchParams }: { searchParams: Promise<Q> }) {
  const user = await requireSchoolPerm('talent', '/school/talent');
  const [{ t, locale }, q] = await Promise.all([getT(), searchParams]);
  const f = cleanTalentFilters(q);
  const page = Math.max(1, Math.min(100, Number(q.page) || 1));
  const searched = Object.keys(f).length > 0 || q.go === '1';
  const d = await withDb(db => {
    const school = currentSchool(db, user);
    if (!school) return null;
    const opts = (kind: MasterKind, parent?: string) => listMaster(db, kind).filter(i => !parent || i.parentId === parent).map(i => ({ id: i.id, name: nameOf(lookupOf(db), i.id, locale) }));
    return {
      lookup: lookupOf(db),
      res: searched ? searchTalent(db, user, f, page) : null,
      jobs: invitableJobs(db, school.id).map(j => ({ id: j.id, title: j.title })),
      o: {
        subject: opts('subjects'), level: opts('schoolLevels'), tet: opts('tetExams'), qualification: opts('qualifications'), medium: opts('mediums'),
        state: opts('states'), district: f.state ? opts('districts', f.state) : [],
      },
    };
  });
  if (!d) redirect('/school');
  const sel = (name: keyof typeof d.o, label: string) => (
    <label><span className="label">{label}</span>
      <select name={name} className="input" defaultValue={(f as Record<string, unknown>)[name] as string || ''}><option value="">{t('talent.any')}</option>{d.o[name].map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
  );
  const pages = d.res ? Math.ceil(d.res.total / PAGE_SIZE) : 0;
  const link = (p: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(q).filter(([, v]) => v) as [string, string][]), page: String(p) }).toString()}`;
  return (
    <div className="container-page space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('talent.title')}</h1>
        <p className="text-ink-soft">{t('talent.intro')}</p>
      </div>
      <form method="get" className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="go" value="1" />
        {sel('subject', t('profile.subjects'))}
        {sel('level', t('profile.levels'))}
        {sel('tet', t('profile.tets'))}
        {sel('qualification', t('profile.qualifications'))}
        {sel('medium', t('profile.mediums'))}
        {sel('state', t('talent.state'))}
        {d.o.district.length > 0 ? sel('district', t('talent.district')) : <p className="hint self-end">{t('talent.districtHint')}</p>}
        <label><span className="label">{t('talent.minExp')}</span><input name="minExp" type="number" min={0} max={40} className="input" defaultValue={f.minExp ?? ''} /></label>
        <div className="sm:col-span-2 lg:col-span-4"><button className="btn-primary">{t('common.search')}</button></div>
      </form>
      {!d.res ? <p className="text-ink-soft">{t('talent.startHint')}</p> : (
        <section aria-labelledby="res-h" className="space-y-3">
          <h2 id="res-h" className="text-lg font-bold">{t('talent.results', { n: d.res.total })}</h2>
          {!d.jobs.length && <p className="alert-error">{t('talent.noOpenJobs')}</p>}
          <ul className="space-y-3">{d.res.results.map(c => (
            <li key={c.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{c.name}</h3>
                  {c.headline && <p className="text-ink-soft">{c.headline}</p>}
                </div>
                {c.applied && <span className="badge border-brand-300 bg-brand-50 text-brand-800">{t('talent.alreadyApplied')}</span>}
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline font-semibold">{t('profile.subjects')}: </dt><dd className="inline">{namesOf(d.lookup, c.subjectIds, locale) || '—'}</dd></div>
                <div><dt className="inline font-semibold">{t('profile.levels')}: </dt><dd className="inline">{namesOf(d.lookup, c.levelIds, locale) || '—'}</dd></div>
                <div><dt className="inline font-semibold">{t('profile.qualifications')}: </dt><dd className="inline">{namesOf(d.lookup, c.qualificationIds, locale) || '—'}</dd></div>
                <div><dt className="inline font-semibold">{t('profile.tets')}: </dt><dd className="inline">{namesOf(d.lookup, c.tetIds, locale) || '—'}</dd></div>
                <div><dt className="inline font-semibold">{t('profile.mediums')}: </dt><dd className="inline">{namesOf(d.lookup, c.mediumIds, locale) || '—'}</dd></div>
                <div><dt className="inline font-semibold">{t('profile.experience')}: </dt><dd className="inline">{t('ats.years', { n: c.years })}</dd></div>
                <div className="sm:col-span-2"><dt className="inline font-semibold">{t('profile.location')}: </dt><dd className="inline">{[c.place.cityText, nameOf(d.lookup, c.place.districtId, locale), nameOf(d.lookup, c.place.stateId, locale)].filter(Boolean).join(', ') || '—'}{c.willingToRelocate ? ` · ${t('profile.relocate')}` : ''}</dd></div>
              </dl>
              {d.jobs.length > 0 && <TalentInvite candidateId={c.id} name={c.name} jobs={d.jobs.filter(j => !c.invitedJobIds.includes(j.id))} invitedCount={c.invitedJobIds.length} />}
            </li>
          ))}</ul>
          {pages > 1 && (
            <nav aria-label={t('talent.pages')} className="flex flex-wrap gap-2">
              {page > 1 && <a className="btn-ghost" href={link(page - 1)}>{t('talent.prev')}</a>}
              <span className="self-center text-sm">{t('talent.pageOf', { page, pages })}</span>
              {page < pages && <a className="btn-ghost" href={link(page + 1)}>{t('talent.next')}</a>}
            </nav>
          )}
          <p className="hint">{t('talent.privacyNote')}</p>
        </section>
      )}
    </div>
  );
}
