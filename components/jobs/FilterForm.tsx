import type { JobFilters, MasterItem } from '@/types';
import type { Facets } from '@/lib/jobs/filters';
import type { TFunction } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/i18n/config';
import { itemName } from '@/lib/i18n/translate';

/*
 * The search filters as a plain GET form: it works without JavaScript and on slow phones.
 * Rendered twice (collapsible on phones, sidebar on wide screens), so ids carry a prefix.
 */

export interface FilterLists { states: MasterItem[]; districts: MasterItem[]; boards: MasterItem[]; posts: MasterItem[]; subjects: MasterItem[]; levels: MasterItem[]; mediums: MasterItem[]; managementTypes: MasterItem[]; employmentTypes: MasterItem[] }

type GroupKey = 'board' | 'post' | 'subject' | 'level' | 'medium' | 'management' | 'employment';
const VISIBLE = 8;

export default function FilterForm({ f, facets, lists, t, locale, prefix, sort }: { f: JobFilters; facets: Facets; lists: FilterLists; t: TFunction; locale: Locale; prefix: string; sort: string }) {
  const id = (s: string) => `${prefix}-${s}`;
  const count = (key: keyof Facets, code: string) => facets[key]?.find(x => x.code === code)?.count ?? 0;

  const group = (key: GroupKey, items: MasterItem[], label: string) => {
    const selected = new Set(f[key] || []);
    // Values with vacancies first, then the rest; selected values always visible.
    const sorted = items.slice().sort((a, b) => count(key, b.code) - count(key, a.code));
    const shown = sorted.filter((it, i) => i < VISIBLE || selected.has(it.code));
    const rest = sorted.filter(it => !shown.includes(it));
    const box = (it: MasterItem) => (
      <li key={it.id}><label className="flex min-h-[36px] items-center gap-2 text-sm">
        <input type="checkbox" name={key} value={it.code} defaultChecked={selected.has(it.code)} className="h-5 w-5 shrink-0" />
        <span className="flex-1">{itemName(it, locale)}</span><span className="text-xs text-ink-muted">{count(key, it.code)}</span>
      </label></li>
    );
    return (
      <fieldset className="border-t border-line pt-3">
        <legend className="mb-1 text-sm font-bold text-brand-900">{label}</legend>
        <ul>{shown.map(box)}</ul>
        {rest.length > 0 && <details><summary className="cursor-pointer text-sm font-semibold text-brand-700">{t('jobs.showMore', { n: rest.length })}</summary><ul>{rest.map(box)}</ul></details>}
      </fieldset>
    );
  };

  return (
    <form method="get" action="/jobs" className="space-y-3">
      <input type="hidden" name="sort" value={sort} />
      <div>
        <label htmlFor={id('q')} className="label">{t('home.searchLabel')}</label>
        <input id={id('q')} name="q" className="input" defaultValue={f.q} placeholder={t('home.searchPlaceholder')} />
      </div>
      <fieldset>
        <legend className="label">{t('jobs.type')}</legend>
        {[['', t('jobs.typeAll')], ['school', t('jobs.typeSchool')], ['government', t('jobs.typeGovt')], ['external', t('jobs.typeExternal')]].map(([v, l]) => (
          <label key={v} className="flex min-h-[36px] items-center gap-2 text-sm"><input type="radio" name="type" value={v} defaultChecked={(f.kind || '') === v} className="h-5 w-5" />{l}</label>
        ))}
      </fieldset>
      <div>
        <label htmlFor={id('state')} className="label">{t('jobs.state')}</label>
        <select id={id('state')} name="state" className="input" defaultValue={f.state || ''}>
          <option value="">{t('jobs.anyState')}</option>
          {lists.states.map(s => <option key={s.id} value={s.code}>{itemName(s, locale)} ({count('state', s.code)})</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={id('district')} className="label">{t('jobs.district')}</label>
        <select id={id('district')} name="district" className="input" defaultValue={f.district || ''} disabled={!f.state}>
          <option value="">{f.state ? t('jobs.anyDistrict') : t('jobs.pickStateFirst')}</option>
          {lists.districts.filter(d => d.parentId === `states:${f.state}`).map(d => <option key={d.id} value={d.code}>{itemName(d, locale)}</option>)}
        </select>
      </div>
      {f.lat !== undefined && (
        <div>
          <label htmlFor={id('km')} className="label">{t('jobs.within')}</label>
          <input type="hidden" name="lat" value={f.lat} /><input type="hidden" name="lng" value={f.lng} />
          <select id={id('km')} name="km" className="input" defaultValue={String(f.km ?? 25)}>
            {[5, 10, 25, 50, 100].map(k => <option key={k} value={k}>{t('jobs.kmOption', { km: k })}</option>)}
          </select>
        </div>
      )}
      {group('post', lists.posts, t('jobs.post'))}
      {group('subject', lists.subjects, t('jobs.subject'))}
      {group('level', lists.levels, t('jobs.level'))}
      {group('board', lists.boards, t('jobs.board'))}
      {group('medium', lists.mediums, t('jobs.medium'))}
      {group('management', lists.managementTypes, t('jobs.management'))}
      {group('employment', lists.employmentTypes, t('jobs.employment'))}
      <div className="border-t border-line pt-3">
        <label htmlFor={id('sector')} className="label">{t('jobs.sector')}</label>
        <select id={id('sector')} name="sector" className="input" defaultValue={f.sector || ''}>
          <option value="">{t('jobs.sectorAll')}</option>
          {['government', 'aided', 'private'].map(s => <option key={s} value={s}>{t(`jobs.sector_${s}`)} ({count('sector', s)})</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={id('minSalary')} className="label">{t('jobs.minSalary')}</label>
        <input id={id('minSalary')} name="minSalary" type="number" inputMode="numeric" min={0} step={1000} className="input" defaultValue={f.minSalary || ''} />
      </div>
      <div>
        <label htmlFor={id('closing')} className="label">{t('jobs.closing')}</label>
        <select id={id('closing')} name="closing" className="input" defaultValue={f.closingDays !== undefined ? String(f.closingDays) : ''}>
          <option value="">{t('jobs.closingAny')}</option>
          {[3, 7, 15, 30].map(d => <option key={d} value={d}>{t('jobs.closingWithin', { days: d })}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1">{t('jobs.applyFilters')}</button>
        <a href="/jobs" className="btn-ghost">{t('jobs.clear')}</a>
      </div>
    </form>
  );
}
