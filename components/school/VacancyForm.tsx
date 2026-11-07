'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Job, MasterItem, PayMode, ScreeningQuestion } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { itemName } from '@/lib/i18n/translate';
import { api } from '@/lib/clientApi';

export interface VacancyLists { posts: MasterItem[]; subjects: MasterItem[]; levels: MasterItem[]; streams: MasterItem[]; employmentTypes: MasterItem[]; mediums: MasterItem[]; qualifications: MasterItem[]; tets: MasterItem[]; payLevels: MasterItem[]; benefits: MasterItem[] }

type Draft = Pick<Job, 'title' | 'postId' | 'subjectIds' | 'levelIds' | 'streamIds' | 'employmentTypeId' | 'vacancies' | 'description' | 'eligibility' | 'pay' | 'screeningQuestions' | 'lastDate' | 'premium'>;
let seq = 0;

export default function VacancyForm({ schoolId, job, lists, defaults, verified }: { schoolId: string; job?: Job; lists: VacancyLists; defaults: { mediumIds: string[]; lastDate: string }; verified: boolean }) {
  const { t, locale } = useI18n();
  const nm = (i: MasterItem) => itemName(i, locale);
  const [d, setD] = useState<Draft>(() => job ? structuredClone(job) : {
    title: '', postId: '', subjectIds: [], levelIds: [], streamIds: [], employmentTypeId: 'employmentTypes:PERMANENT', vacancies: 1, description: '',
    eligibility: { requiredQualificationIds: [], preferredQualificationIds: [], tetRequired: false, acceptedTetIds: [], tetPaper: null, minExperienceYears: 0, minPercentage: null, mediumIds: defaults.mediumIds, policeVerificationRequired: true, otherRequirements: null },
    pay: { mode: 'range', payLevelId: null, scaleText: null, min: null, max: null, benefitIds: [] },
    screeningQuestions: [], lastDate: defaults.lastDate, premium: false,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(p => ({ ...p, [k]: v }));
  const setE = <K extends keyof Draft['eligibility']>(k: K, v: Draft['eligibility'][K]) => setD(p => ({ ...p, eligibility: { ...p.eligibility, [k]: v } }));
  const setP = <K extends keyof Draft['pay']>(k: K, v: Draft['pay'][K]) => setD(p => ({ ...p, pay: { ...p.pay, [k]: v } }));
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const post = lists.posts.find(p => p.id === d.postId);
  const live = job?.status === 'published';

  async function save(publish: boolean) {
    setBusy(true); setMsg(null);
    const r = await api<{ id: string; status: string }>('/api/school/jobs', { ...d, id: job?.id, schoolId, publish });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error && r.error !== 'network' ? t(r.error) : t('common.somethingWrong') }); return; }
    window.location.href = `/school/jobs?saved=${r.status}`;
  }

  const checks = (items: MasterItem[], selected: string[], onToggle: (id: string) => void, cols = 'sm:grid-cols-2 lg:grid-cols-3') => (
    <ul className={`grid gap-x-4 ${cols}`}>{items.map(i => <li key={i.id}><label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.includes(i.id)} onChange={() => onToggle(i.id)} />{nm(i)}</label></li>)}</ul>
  );
  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => <div><label htmlFor={id} className="label">{label}</label>{input}{hint && <p className="hint">{hint}</p>}</div>;
  const section = (id: string, title: string, children: React.ReactNode, hint?: string) => (
    <section className="card space-y-4" aria-labelledby={id}><div><h2 id={id} className="text-lg font-bold">{title}</h2>{hint && <p className="hint">{hint}</p>}</div>{children}</section>
  );
  const q = (i: number, patch: Partial<ScreeningQuestion>) => set('screeningQuestions', d.screeningQuestions.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <form onSubmit={e => { e.preventDefault(); save(!verified ? false : true); }} className="space-y-6 pb-24">
      {!verified && <p className="alert-error">{t('post.draftOnly')}</p>}

      {section('v-basic', t('post.basics'), (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('v-post', t('jobs.post'), <select id="v-post" className="input" required value={d.postId} onChange={e => set('postId', e.target.value)}><option value="">—</option>
            {(['teaching', 'leadership', 'non_teaching'] as const).map(cat => <optgroup key={cat} label={t(`post.cat_${cat}`)}>{lists.posts.filter(p => p.meta.category === cat).map(p => <option key={p.id} value={p.id}>{nm(p)}</option>)}</optgroup>)}</select>)}
          {field('v-title', t('post.title'), <input id="v-title" className="input" required minLength={5} maxLength={160} placeholder={t('post.titlePlaceholder')} value={d.title} onChange={e => set('title', e.target.value)} />)}
          {field('v-emp', t('jobs.employment'), <select id="v-emp" className="input" required value={d.employmentTypeId} onChange={e => set('employmentTypeId', e.target.value)}>{lists.employmentTypes.map(x => <option key={x.id} value={x.id}>{nm(x)}</option>)}</select>)}
          <div className="grid grid-cols-2 gap-3">
            {field('v-n', t('jobs.posts'), <input id="v-n" className="input" type="number" min={1} max={999} required value={d.vacancies} onChange={e => set('vacancies', Number(e.target.value))} />)}
            {field('v-last', t('jobs.lastDateLabel'), <input id="v-last" className="input" type="date" required value={d.lastDate} onChange={e => set('lastDate', e.target.value)} />)}
          </div>
          <fieldset className="sm:col-span-2"><legend className="label">{t('jobs.level')}</legend>{checks(lists.levels, d.levelIds, id => set('levelIds', toggleIn(d.levelIds, id)))}</fieldset>
          <details className="sm:col-span-2" open={post?.meta.subjectWise === true || d.subjectIds.length > 0}>
            <summary className="cursor-pointer font-semibold text-brand-700">{t('jobs.subject')} ({d.subjectIds.length}){post?.meta.subjectWise === true ? ` – ${t('post.subjectRequired')}` : ''}</summary>
            {checks(lists.subjects, d.subjectIds, id => set('subjectIds', toggleIn(d.subjectIds, id)))}
          </details>
          <fieldset className="sm:col-span-2"><legend className="label">{t('jobs.stream')}</legend>{checks(lists.streams, d.streamIds, id => set('streamIds', toggleIn(d.streamIds, id)), 'grid-cols-2 sm:grid-cols-4')}</fieldset>
          <div className="sm:col-span-2">{field('v-desc', t('jobs.description'), <textarea id="v-desc" className="input min-h-[180px]" required minLength={30} maxLength={8000} value={d.description} onChange={e => set('description', e.target.value)} />, t('post.descriptionHint'))}</div>
        </div>
      ))}

      {section('v-elig', t('jobs.eligibility'), (
        <>
          <fieldset><legend className="label">{t('jobs.requiredQual')}</legend>{checks(lists.qualifications, d.eligibility.requiredQualificationIds, id => setE('requiredQualificationIds', toggleIn(d.eligibility.requiredQualificationIds, id)))}</fieldset>
          <details><summary className="cursor-pointer font-semibold text-brand-700">{t('jobs.preferredQual')} ({d.eligibility.preferredQualificationIds.length})</summary>
            {checks(lists.qualifications.filter(x => !d.eligibility.requiredQualificationIds.includes(x.id)), d.eligibility.preferredQualificationIds, id => setE('preferredQualificationIds', toggleIn(d.eligibility.preferredQualificationIds, id)))}</details>
          <label className="flex min-h-[40px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={d.eligibility.tetRequired} onChange={e => setE('tetRequired', e.target.checked)} />{t('post.tetRequired')}</label>
          {d.eligibility.tetRequired && (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <fieldset><legend className="label">{t('post.acceptedTets')}</legend><p className="hint">{t('post.acceptedTetsHint')}</p>{checks(lists.tets, d.eligibility.acceptedTetIds, id => setE('acceptedTetIds', toggleIn(d.eligibility.acceptedTetIds, id)))}</fieldset>
              {field('v-paper', t('profile.paper'), <input id="v-paper" className="input" maxLength={80} placeholder="Paper II (Classes VI–VIII)" value={d.eligibility.tetPaper || ''} onChange={e => setE('tetPaper', e.target.value || null)} />)}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {field('v-exp', t('post.minExperience'), <input id="v-exp" className="input" type="number" min={0} max={40} step="0.5" value={d.eligibility.minExperienceYears} onChange={e => setE('minExperienceYears', Number(e.target.value))} />)}
            {field('v-pct', t('post.minPercentage'), <input id="v-pct" className="input" type="number" min={1} max={100} value={d.eligibility.minPercentage ?? ''} onChange={e => setE('minPercentage', e.target.value ? Number(e.target.value) : null)} />)}
          </div>
          <fieldset><legend className="label">{t('post.mediums')}</legend>{checks(lists.mediums, d.eligibility.mediumIds, id => setE('mediumIds', toggleIn(d.eligibility.mediumIds, id)))}</fieldset>
          <label className="flex min-h-[40px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={d.eligibility.policeVerificationRequired} onChange={e => setE('policeVerificationRequired', e.target.checked)} />{t('post.policeRequired')}</label>
          {field('v-other', t('jobs.other'), <textarea id="v-other" className="input" maxLength={1000} value={d.eligibility.otherRequirements || ''} onChange={e => setE('otherRequirements', e.target.value || null)} />)}
        </>
      ), t('post.eligibilityHint'))}

      {section('v-pay', t('jobs.pay'), (
        <>
          <fieldset><legend className="sr-only">{t('post.payMode')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['range', 'cpc', 'state_scale', 'not_disclosed'] as PayMode[]).map(m => (
                <label key={m} className={`flex min-h-[44px] items-center gap-2 rounded-lg border p-2 text-sm ${d.pay.mode === m ? 'border-brand-600 bg-brand-50' : 'border-line'}`}><input type="radio" name="paymode" className="h-5 w-5" checked={d.pay.mode === m} onChange={() => setP('mode', m)} />{t(`post.pay_${m}`)}</label>
              ))}
            </div></fieldset>
          {d.pay.mode === 'range' && <div className="grid grid-cols-2 gap-3">
            {field('v-min', t('post.payMin'), <input id="v-min" className="input" type="number" min={0} step={500} value={d.pay.min ?? ''} onChange={e => setP('min', e.target.value ? Number(e.target.value) : null)} />)}
            {field('v-max', t('post.payMax'), <input id="v-max" className="input" type="number" min={0} step={500} value={d.pay.max ?? ''} onChange={e => setP('max', e.target.value ? Number(e.target.value) : null)} />)}
          </div>}
          {d.pay.mode === 'cpc' && field('v-lvl', t('post.payLevel'), <select id="v-lvl" className="input" required value={d.pay.payLevelId || ''} onChange={e => setP('payLevelId', e.target.value || null)}><option value="">—</option>
            {lists.payLevels.map(l => <option key={l.id} value={l.id}>{nm(l)} – ₹{Number(l.meta.entryPay || 0).toLocaleString('en-IN')}</option>)}</select>, t('post.payLevelHint'))}
          {d.pay.mode === 'state_scale' && field('v-scale', t('post.payScale'), <input id="v-scale" className="input" required maxLength={200} placeholder={t('post.payScalePlaceholder')} value={d.pay.scaleText || ''} onChange={e => setP('scaleText', e.target.value || null)} />)}
          <fieldset><legend className="label">{t('jobs.benefits')}</legend>{checks(lists.benefits, d.pay.benefitIds, id => setP('benefitIds', toggleIn(d.pay.benefitIds, id)))}</fieldset>
        </>
      ))}

      {section('v-q', t('post.questions'), (
        <>
          {d.screeningQuestions.map((x, i) => (
            <fieldset key={x.id} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_160px]">
              <legend className="px-1 text-sm font-semibold">{t('post.questionN', { n: i + 1 })}</legend>
              <label><span className="sr-only">{t('post.questionText')}</span><input className="input" required minLength={5} maxLength={200} placeholder={t('post.questionPlaceholder')} value={x.text} onChange={e => q(i, { text: e.target.value })} /></label>
              <label><span className="sr-only">{t('post.answerType')}</span><select className="input" value={x.type} onChange={e => q(i, { type: e.target.value as ScreeningQuestion['type'], mustAnswer: null })}>
                {(['yesno', 'text', 'number'] as const).map(v => <option key={v} value={v}>{t(`post.type_${v}`)}</option>)}</select></label>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={x.required} onChange={e => q(i, { required: e.target.checked })} />{t('post.required')}</label>
                {x.type === 'yesno' && <label className="flex items-center gap-2 text-sm">{t('post.expected')}<select className="input w-auto" value={x.mustAnswer || ''} onChange={e => q(i, { mustAnswer: (e.target.value || null) as 'yes' | 'no' | null })}><option value="">{t('post.anyAnswer')}</option><option value="yes">{t('common.yes')}</option><option value="no">{t('common.no')}</option></select></label>}
                <button type="button" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-danger-700" onClick={() => set('screeningQuestions', d.screeningQuestions.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden="true" />{t('profile.remove')}</button>
              </div>
            </fieldset>
          ))}
          {d.screeningQuestions.length < 10 && <button type="button" className="btn-ghost" onClick={() => set('screeningQuestions', [...d.screeningQuestions, { id: `sq_new${Date.now().toString(36)}${seq++}`, text: '', type: 'yesno', required: true, mustAnswer: null }])}><Plus size={18} aria-hidden="true" />{t('post.addQuestion')}</button>}
        </>
      ), t('post.questionsHint'))}

      {section('v-opt', t('post.options'), (
        <label className="flex gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={d.premium} onChange={e => set('premium', e.target.checked)} /><span><span className="font-semibold">{t('post.premium')}</span><span className="block text-sm text-ink-soft">{t('post.premiumHint')}</span></span></label>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 py-3 backdrop-blur">
        <div className="container-page flex flex-wrap items-center justify-end gap-2">
          <div aria-live="polite" className="mr-auto min-w-0 text-sm">{msg && <span className={msg.ok ? 'text-success-700' : 'text-danger-700'}>{msg.text}</span>}</div>
          {!live && <button type="button" className="btn-ghost" disabled={busy} onClick={() => save(false)}>{t('post.saveDraft')}</button>}
          {verified && <button className="btn-primary" disabled={busy}>{live ? t('post.saveChanges') : t('post.publish')}</button>}
        </div>
      </div>
    </form>
  );
}
