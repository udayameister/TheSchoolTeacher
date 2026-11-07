'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CandidateProfile, ExperienceEntry, MasterItem, QualificationEntry, TetEntry } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { itemName } from '@/lib/i18n/translate';
import { api } from '@/lib/clientApi';
import Meter from './Meter';

export interface ProfileLists { states: MasterItem[]; subjects: MasterItem[]; levels: MasterItem[]; mediums: MasterItem[]; qualifications: MasterItem[]; tets: MasterItem[]; boards: MasterItem[]; posts: MasterItem[] }
type Lite = { id: string; name: string; nameHi?: string; parentId?: string | null };

let seq = 0;
const tmpId = (p: string) => `${p}_new${Date.now().toString(36)}${seq++}`;

/** Districts of one state, fetched on demand (the full list can be long). */
function useDistricts(stateId: string | null | undefined): Lite[] {
  const [list, setList] = useState<Lite[]>([]);
  useEffect(() => {
    if (!stateId) { setList([]); return; }
    let live = true;
    api<{ items: Lite[] }>(`/api/master?kind=districts&parent=${encodeURIComponent(stateId)}`).then(r => { if (live && r.ok) setList(r.items); });
    return () => { live = false; };
  }, [stateId]);
  return list;
}

export default function ProfileForm({ initial, name: initialName, lists, completeness: initialC, matchingConsent }: {
  initial: CandidateProfile; name: string; lists: ProfileLists; completeness: { percent: number; missing: string[] }; matchingConsent: boolean;
}) {
  const { t, locale } = useI18n();
  const nm = (i: Lite) => itemName(i, locale);
  const [p, setP] = useState<CandidateProfile>(initial);
  const [name, setName] = useState(initialName);
  const [declare, setDeclare] = useState(!!initial.childSafety.selfDeclarationAt);
  const [c, setC] = useState(initialC);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefState, setPrefState] = useState<string>(initial.stateId || '');
  const districts = useDistricts(p.stateId);
  const prefDistricts = useDistricts(prefState);
  const [knownDistricts, setKnownDistricts] = useState<Record<string, Lite>>({});
  useEffect(() => { setKnownDistricts(k => ({ ...k, ...Object.fromEntries([...districts, ...prefDistricts].map(d => [d.id, d])) })); }, [districts, prefDistricts]);

  const set = <K extends keyof CandidateProfile>(k: K, v: CandidateProfile[K]) => setP(prev => ({ ...prev, [k]: v }));
  const toggle = (k: 'subjectIds' | 'levelIds' | 'preferredStateIds' | 'preferredDistrictIds', id: string) =>
    setP(prev => ({ ...prev, [k]: prev[k].includes(id) ? prev[k].filter(x => x !== id) : [...prev[k], id] }));
  const updateRow = <T extends { id: string }>(k: 'qualifications' | 'tets' | 'experience', id: string, patch: Partial<T>) =>
    setP(prev => ({ ...prev, [k]: (prev[k] as unknown as T[]).map(r => (r.id === id ? { ...r, ...patch } : r)) }));
  const removeRow = (k: 'qualifications' | 'tets' | 'experience', id: string) => setP(prev => ({ ...prev, [k]: (prev[k] as { id: string }[]).filter(r => r.id !== id) }));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await api<{ profile: CandidateProfile; completeness: typeof c }>('/api/candidate/profile', { ...p, name, childSafety: { ...p.childSafety, selfDeclaration: declare } });
    setBusy(false);
    if (r.ok) { setP(r.profile); setC(r.completeness); setMsg({ ok: true, text: t('profile.saved') }); }
    else setMsg({ ok: false, text: r.error && r.error !== 'network' ? r.error : t('common.somethingWrong') });
  }

  const checks = (items: Lite[], selected: string[], onToggle: (id: string) => void, cols = 'sm:grid-cols-2 lg:grid-cols-3') => (
    <ul className={`grid gap-x-4 ${cols}`}>
      {items.map(i => <li key={i.id}><label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.includes(i.id)} onChange={() => onToggle(i.id)} />{nm(i)}</label></li>)}
    </ul>
  );
  const section = (id: string, title: string, children: React.ReactNode, hint?: string) => (
    <section className="card space-y-4" aria-labelledby={id}>
      <div><h2 id={id} className="text-lg font-bold">{title}</h2>{hint && <p className="hint">{hint}</p>}</div>
      {children}
    </section>
  );
  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => (
    <div><label htmlFor={id} className="label">{label}</label>{input}{hint && <p className="hint">{hint}</p>}</div>
  );
  const select = (id: string, value: string | null | undefined, items: Lite[], onChange: (v: string | null) => void, placeholder = '—', required = false) => (
    <select id={id} className="input" value={value || ''} required={required} onChange={e => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>{items.map(i => <option key={i.id} value={i.id}>{nm(i)}</option>)}
    </select>
  );
  const year = new Date().getFullYear();
  const papersOf = (tetId: string) => String(lists.tets.find(x => x.id === tetId)?.meta.papers || '').split(',').map(s => s.trim()).filter(Boolean);

  return (
    <form onSubmit={save} className="space-y-6 pb-24">
      <div className="card space-y-2">
        <Meter percent={c.percent} label={t('profile.completeness')} />
        {c.missing.length > 0 && <p className="text-sm text-ink-soft">{t('profile.stillMissing')}: {c.missing.map(m => t(`profile.check_${m}`)).join(' · ')}</p>}
      </div>

      {section('s-personal', t('profile.personal'), (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('pf-name', t('common.name'), <input id="pf-name" className="input" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} />)}
          {field('pf-phone', t('profile.phone'), <input id="pf-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="98765 43210" value={p.phone || ''} onChange={e => set('phone', e.target.value)} />, t('profile.phoneHint'))}
          <div className="sm:col-span-2">{field('pf-headline', t('profile.headline'), <input id="pf-headline" className="input" maxLength={140} placeholder={t('profile.headlinePlaceholder')} value={p.headline || ''} onChange={e => set('headline', e.target.value)} />)}</div>
          <div className="sm:col-span-2">{field('pf-about', t('profile.about'), <textarea id="pf-about" className="input min-h-[100px]" maxLength={2000} value={p.about || ''} onChange={e => set('about', e.target.value)} />)}</div>
        </div>
      ))}

      {section('s-location', t('profile.location'), (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('pf-state', t('jobs.state'), select('pf-state', p.stateId, lists.states, v => setP(prev => ({ ...prev, stateId: v, districtId: null }))))}
          {field('pf-district', t('jobs.district'), select('pf-district', p.districtId, districts, v => set('districtId', v), p.stateId ? '—' : t('jobs.pickStateFirst')), p.stateId && !districts.length ? t('profile.noDistricts') : undefined)}
          {field('pf-city', t('profile.city'), <input id="pf-city" className="input" maxLength={80} autoComplete="address-level2" value={p.city || ''} onChange={e => set('city', e.target.value)} />)}
          {field('pf-pin', t('profile.pincode'), <input id="pf-pin" className="input" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={p.pincode || ''} onChange={e => set('pincode', e.target.value.replace(/\D/g, ''))} />)}
        </div>
      ))}

      {section('s-qual', t('profile.qualifications'), (
        <>
          {p.qualifications.map((q: QualificationEntry, i) => (
            <fieldset key={q.id} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">{t('profile.qualificationN', { n: i + 1 })}</legend>
              {field(`q-${q.id}-q`, t('profile.qualification'), select(`q-${q.id}-q`, q.qualificationId, lists.qualifications, v => updateRow<QualificationEntry>('qualifications', q.id, { qualificationId: v || '' }), '—', true))}
              {field(`q-${q.id}-s`, t('profile.subjectOptional'), select(`q-${q.id}-s`, q.subjectId, lists.subjects, v => updateRow<QualificationEntry>('qualifications', q.id, { subjectId: v })))}
              {field(`q-${q.id}-i`, t('profile.institution'), <input id={`q-${q.id}-i`} className="input" maxLength={160} value={q.institution} onChange={e => updateRow<QualificationEntry>('qualifications', q.id, { institution: e.target.value })} />)}
              <div className="grid grid-cols-2 gap-3">
                {field(`q-${q.id}-y`, t('profile.year'), <input id={`q-${q.id}-y`} className="input" type="number" min={1960} max={year + 1} value={q.year ?? ''} onChange={e => updateRow<QualificationEntry>('qualifications', q.id, { year: e.target.value ? Number(e.target.value) : null })} />)}
                {field(`q-${q.id}-p`, t('profile.percentage'), <input id={`q-${q.id}-p`} className="input" type="number" min={0} max={100} step="0.01" value={q.percentage ?? ''} onChange={e => updateRow<QualificationEntry>('qualifications', q.id, { percentage: e.target.value ? Number(e.target.value) : null })} />)}
              </div>
              <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-danger-700 sm:col-span-2" onClick={() => removeRow('qualifications', q.id)}><Trash2 size={16} aria-hidden="true" />{t('profile.remove')}</button>
            </fieldset>
          ))}
          <button type="button" className="btn-ghost" onClick={() => set('qualifications', [...p.qualifications, { id: tmpId('q'), qualificationId: '', subjectId: null, institution: '', year: null, percentage: null }])}><Plus size={18} aria-hidden="true" />{t('profile.addQualification')}</button>
        </>
      ), t('profile.qualificationsHint'))}

      {section('s-tet', t('profile.tets'), (
        <>
          {p.tets.map((x: TetEntry, i) => (
            <fieldset key={x.id} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">{t('profile.tetN', { n: i + 1 })}</legend>
              {field(`t-${x.id}-e`, t('profile.exam'), select(`t-${x.id}-e`, x.tetId, lists.tets, v => updateRow<TetEntry>('tets', x.id, { tetId: v || '', paper: '' }), '—', true))}
              {field(`t-${x.id}-p`, t('profile.paper'), papersOf(x.tetId).length
                ? <select id={`t-${x.id}-p`} className="input" value={x.paper} onChange={e => updateRow<TetEntry>('tets', x.id, { paper: e.target.value })}><option value="">—</option>{papersOf(x.tetId).map(pp => <option key={pp} value={pp}>{pp}</option>)}</select>
                : <input id={`t-${x.id}-p`} className="input" maxLength={80} value={x.paper} onChange={e => updateRow<TetEntry>('tets', x.id, { paper: e.target.value })} />)}
              <div className="grid grid-cols-2 gap-3">
                {field(`t-${x.id}-y`, t('profile.year'), <input id={`t-${x.id}-y`} className="input" type="number" min={2000} max={year + 1} value={x.year ?? ''} onChange={e => updateRow<TetEntry>('tets', x.id, { year: e.target.value ? Number(e.target.value) : null })} />)}
                {field(`t-${x.id}-s`, t('profile.score'), <input id={`t-${x.id}-s`} className="input" type="number" min={0} step="0.01" value={x.score ?? ''} onChange={e => updateRow<TetEntry>('tets', x.id, { score: e.target.value ? Number(e.target.value) : null })} />)}
              </div>
              <div className="space-y-2">
                <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={!!x.lifetime} onChange={e => updateRow<TetEntry>('tets', x.id, { lifetime: e.target.checked, validUntil: e.target.checked ? null : x.validUntil })} />{t('profile.lifetime')}</label>
                {!x.lifetime && field(`t-${x.id}-v`, t('profile.validUntil'), <input id={`t-${x.id}-v`} className="input" type="date" value={x.validUntil || ''} onChange={e => updateRow<TetEntry>('tets', x.id, { validUntil: e.target.value || null })} />)}
              </div>
              <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-danger-700 sm:col-span-2" onClick={() => removeRow('tets', x.id)}><Trash2 size={16} aria-hidden="true" />{t('profile.remove')}</button>
            </fieldset>
          ))}
          <button type="button" className="btn-ghost" onClick={() => set('tets', [...p.tets, { id: tmpId('t'), tetId: '', paper: '', year: null, score: null, validUntil: null, lifetime: false }])}><Plus size={18} aria-hidden="true" />{t('profile.addTet')}</button>
          <p className="hint">{t('profile.tetDocsHint')} <Link href="/candidate/documents">{t('candidate.nav_documents')}</Link></p>
        </>
      ))}

      {section('s-teach', t('profile.teaching'), (
        <>
          <fieldset><legend className="label">{t('profile.levels')}</legend>{checks(lists.levels, p.levelIds, id => toggle('levelIds', id))}</fieldset>
          <fieldset><legend className="label">{t('profile.subjects')}</legend>{checks(lists.subjects, p.subjectIds, id => toggle('subjectIds', id))}</fieldset>
          <fieldset>
            <legend className="label">{t('profile.mediums')}</legend>
            <ul className="space-y-2">
              {p.mediums.map(m => (
                <li key={m.mediumId} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[120px] font-semibold">{nm(lists.mediums.find(x => x.id === m.mediumId) || { id: m.mediumId, name: m.mediumId })}</span>
                  <label className="sr-only" htmlFor={`m-${m.mediumId}`}>{t('profile.proficiency')}</label>
                  <select id={`m-${m.mediumId}`} className="input w-auto" value={m.proficiency} onChange={e => set('mediums', p.mediums.map(x => (x.mediumId === m.mediumId ? { ...x, proficiency: e.target.value as typeof m.proficiency } : x)))}>
                    {(['basic', 'fluent', 'native'] as const).map(v => <option key={v} value={v}>{t(`profile.prof_${v}`)}</option>)}
                  </select>
                  <button type="button" className="text-sm font-semibold text-danger-700" onClick={() => set('mediums', p.mediums.filter(x => x.mediumId !== m.mediumId))}>{t('profile.remove')}</button>
                </li>
              ))}
            </ul>
            <label className="sr-only" htmlFor="add-medium">{t('profile.addMedium')}</label>
            <select id="add-medium" className="input mt-2" value="" onChange={e => e.target.value && set('mediums', [...p.mediums, { mediumId: e.target.value, proficiency: 'fluent' }])}>
              <option value="">{t('profile.addMedium')}</option>
              {lists.mediums.filter(m => !p.mediums.some(x => x.mediumId === m.id)).map(m => <option key={m.id} value={m.id}>{nm(m)}</option>)}
            </select>
          </fieldset>
        </>
      ))}

      {section('s-exp', t('profile.experience'), (
        <>
          {p.experience.map((x: ExperienceEntry, i) => (
            <fieldset key={x.id} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">{t('profile.experienceN', { n: i + 1 })}</legend>
              <div className="sm:col-span-2">{field(`x-${x.id}-s`, t('profile.school'), <input id={`x-${x.id}-s`} className="input" required maxLength={160} value={x.school} onChange={e => updateRow<ExperienceEntry>('experience', x.id, { school: e.target.value })} />)}</div>
              {field(`x-${x.id}-b`, t('jobs.board'), select(`x-${x.id}-b`, x.boardId, lists.boards, v => updateRow<ExperienceEntry>('experience', x.id, { boardId: v })))}
              {field(`x-${x.id}-p`, t('jobs.post'), select(`x-${x.id}-p`, x.postId, lists.posts, v => updateRow<ExperienceEntry>('experience', x.id, { postId: v })))}
              {field(`x-${x.id}-f`, t('profile.from'), <input id={`x-${x.id}-f`} className="input" type="month" required value={x.from} onChange={e => updateRow<ExperienceEntry>('experience', x.id, { from: e.target.value })} />)}
              <div className="space-y-2">
                {!x.current && field(`x-${x.id}-t`, t('profile.to'), <input id={`x-${x.id}-t`} className="input" type="month" value={x.to || ''} onChange={e => updateRow<ExperienceEntry>('experience', x.id, { to: e.target.value || null })} />)}
                <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={x.current} onChange={e => updateRow<ExperienceEntry>('experience', x.id, { current: e.target.checked, to: null })} />{t('profile.currentJob')}</label>
              </div>
              <fieldset className="sm:col-span-2"><legend className="label">{t('profile.classesTaught')}</legend>{checks(lists.levels, x.levelIds, id => updateRow<ExperienceEntry>('experience', x.id, { levelIds: x.levelIds.includes(id) ? x.levelIds.filter(v => v !== id) : [...x.levelIds, id] }))}</fieldset>
              <details className="sm:col-span-2"><summary className="cursor-pointer text-sm font-semibold text-brand-700">{t('profile.subjectsTaught')} ({x.subjectIds.length})</summary>
                {checks(lists.subjects, x.subjectIds, id => updateRow<ExperienceEntry>('experience', x.id, { subjectIds: x.subjectIds.includes(id) ? x.subjectIds.filter(v => v !== id) : [...x.subjectIds, id] }))}</details>
              <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-danger-700 sm:col-span-2" onClick={() => removeRow('experience', x.id)}><Trash2 size={16} aria-hidden="true" />{t('profile.remove')}</button>
            </fieldset>
          ))}
          <button type="button" className="btn-ghost" onClick={() => set('experience', [...p.experience, { id: tmpId('x'), school: '', boardId: null, postId: null, from: '', to: null, current: false, levelIds: [], subjectIds: [] }])}><Plus size={18} aria-hidden="true" />{t('profile.addExperience')}</button>
        </>
      ), t('profile.experienceHint'))}

      {section('s-pref', t('profile.preferences'), (
        <>
          <details><summary className="cursor-pointer text-sm font-semibold text-brand-700">{t('profile.preferredStates')} ({p.preferredStateIds.length})</summary>{checks(lists.states, p.preferredStateIds, id => toggle('preferredStateIds', id))}</details>
          <div>
            <p className="label">{t('profile.preferredDistricts')}</p>
            <ul className="mb-2 flex flex-wrap gap-2">
              {p.preferredDistrictIds.map(id => (
                <li key={id} className="badge border-brand-300 bg-brand-50 py-1 text-sm text-brand-800">{knownDistricts[id] ? nm(knownDistricts[id]) : id.split(':')[1]}
                  <button type="button" className="ml-1 font-bold" aria-label={`${t('profile.remove')} ${knownDistricts[id]?.name || id}`} onClick={() => toggle('preferredDistrictIds', id)}>×</button></li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <label><span className="sr-only">{t('jobs.state')}</span>{select('pref-state', prefState, lists.states, v => setPrefState(v || ''), t('jobs.state'))}</label>
              <label><span className="sr-only">{t('jobs.district')}</span>
                <select className="input" value="" disabled={!prefDistricts.length} onChange={e => { const v = e.target.value; if (v && !p.preferredDistrictIds.includes(v) && p.preferredDistrictIds.length < 30) toggle('preferredDistrictIds', v); }}>
                  <option value="">{t('profile.addDistrict')}</option>{prefDistricts.map(d => <option key={d.id} value={d.id}>{nm(d)}</option>)}
                </select></label>
            </div>
          </div>
          <label className="flex min-h-[40px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={p.willingToRelocate} onChange={e => set('willingToRelocate', e.target.checked)} />{t('profile.relocate')}</label>
          {field('pf-salary', t('profile.expectedSalary'), <input id="pf-salary" className="input" type="number" inputMode="numeric" min={0} step={500} value={p.expectedSalary ?? ''} onChange={e => set('expectedSalary', e.target.value ? Number(e.target.value) : null)} />, t('profile.expectedSalaryHint'))}
        </>
      ))}

      {section('s-other', t('profile.otherSkills'), (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('pf-comp', t('profile.computer'), <select id="pf-comp" className="input" value={p.computerProficiency} onChange={e => set('computerProficiency', e.target.value as CandidateProfile['computerProficiency'])}>
            {(['none', 'basic', 'good', 'advanced'] as const).map(v => <option key={v} value={v}>{t(`profile.comp_${v}`)}</option>)}</select>)}
          {field('pf-rci', t('profile.rci'), <input id="pf-rci" className="input" maxLength={40} value={p.rciNumber || ''} onChange={e => set('rciNumber', e.target.value)} />, t('profile.rciHint'))}
          <div className="sm:col-span-2">{field('pf-cert', t('profile.certifications'), <textarea id="pf-cert" className="input min-h-[80px]" maxLength={1000} placeholder={t('profile.certificationsPlaceholder')} value={p.certifications || ''} onChange={e => set('certifications', e.target.value)} />)}</div>
        </div>
      ))}

      {section('s-safety', t('profile.childSafety'), (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('pf-police', t('profile.policeVerification'), <select id="pf-police" className="input" value={p.childSafety.policeVerification} onChange={e => set('childSafety', { ...p.childSafety, policeVerification: e.target.value as CandidateProfile['childSafety']['policeVerification'] })}>
              {(['not_done', 'applied', 'done'] as const).map(v => <option key={v} value={v}>{t(`profile.police_${v}`)}</option>)}</select>)}
            {p.childSafety.policeVerification !== 'not_done' && field('pf-police-date', t('profile.policeDate'), <input id="pf-police-date" className="input" type="date" value={p.childSafety.policeVerificationDate || ''} onChange={e => set('childSafety', { ...p.childSafety, policeVerificationDate: e.target.value || null })} />)}
          </div>
          <label className="flex gap-2 rounded-lg border border-line bg-ivory p-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={declare} onChange={e => setDeclare(e.target.checked)} /><span>{t('profile.declaration')}</span></label>
          <p className="hint">{t('profile.childSafetyDocs')} <Link href="/candidate/documents">{t('candidate.nav_documents')}</Link></p>
        </>
      ), t('profile.childSafetyHint'))}

      {section('s-visibility', t('profile.visibility'), (
        <>
          <label className="flex gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" disabled={!matchingConsent} checked={p.discoverable && matchingConsent} onChange={e => set('discoverable', e.target.checked)} /><span>{t('profile.discoverable')}</span></label>
          <p className="hint">{matchingConsent ? t('profile.discoverableHint') : <>{t('profile.discoverableNeedsConsent')} <Link href="/account#privacy">{t('match.enableLink')}</Link></>}</p>
        </>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 py-3 backdrop-blur">
        <div className="container-page flex items-center justify-between gap-3">
          <div aria-live="polite" className="min-w-0 text-sm">{msg && <span className={msg.ok ? 'text-success-700' : 'text-danger-700'}>{msg.text}</span>}</div>
          <button className="btn-primary shrink-0" disabled={busy}>{busy ? t('common.loading') : t('profile.save')}</button>
        </div>
      </div>
    </form>
  );
}
