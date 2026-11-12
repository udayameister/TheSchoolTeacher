'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, LocateFixed, Plus, Trash2 } from 'lucide-react';
import type { MasterItem, School, UdiseRecord } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { itemName } from '@/lib/i18n/translate';
import { api } from '@/lib/clientApi';

export interface SchoolLists { states: MasterItem[]; boards: MasterItem[]; managementTypes: MasterItem[]; levels: MasterItem[]; streams: MasterItem[]; mediums: MasterItem[]; facilities: MasterItem[]; benefits: MasterItem[] }
type Lite = { id: string; name: string; nameHi?: string };

const blank = {
  udiseCode: '', name: '', managementTypeId: '', affiliations: [{ boardId: '', number: '' }] as { boardId: string; number: string | null }[],
  levelIds: [] as string[], streamIds: [] as string[], mediumIds: [] as string[], facilityIds: [] as string[],
  stateId: '', districtId: '', city: '', address: '', pincode: '', lat: '' as string | number, lng: '' as string | number,
  officialEmail: '', phone: '', principalName: '', website: '', about: '',
  establishedYear: '' as string | number, studentCount: '' as string | number, teacherCount: '' as string | number,
  benefitIds: [] as string[], whyJoin: '', achievements: '', socialLinks: [] as { label: string; url: string }[],
};

/**
 * Registration and school profile form. `mode="register"` creates a school (or a branch); `mode="edit"` saves an
 * existing one. Identity fields (UDISE+ code, name, management, boards, state, district) are read-only once the
 * school is verified, unless the platform administrator is editing.
 */
export default function SchoolForm({ mode, school, lists, identityLocked, canCreateGroup }: { mode: 'register' | 'edit'; school?: School; lists: SchoolLists; identityLocked: boolean; canCreateGroup: boolean }) {
  const { t, locale } = useI18n();
  const nm = (i: Lite) => itemName(i, locale);
  const [f, setF] = useState(() => school ? {
    ...blank, ...Object.fromEntries(Object.entries(school).filter(([k]) => k in blank).map(([k, v]) => [k, v ?? ''])),
    affiliations: school.affiliations.length ? school.affiliations.map(a => ({ boardId: a.boardId, number: a.number ?? '' })) : blank.affiliations,
    benefitIds: school.benefitIds || [], socialLinks: school.socialLinks || [],
  } as typeof blank : blank);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [districts, setDistricts] = useState<Lite[]>([]);
  const [check, setCheck] = useState<{ valid: boolean; record?: UdiseRecord | null; taken?: boolean; warning?: string | null } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF(prev => ({ ...prev, [k]: v }));
  const toggle = (k: 'levelIds' | 'streamIds' | 'mediumIds' | 'facilityIds' | 'benefitIds', id: string) => setF(prev => ({ ...prev, [k]: prev[k].includes(id) ? prev[k].filter(x => x !== id) : [...prev[k], id] }));

  useEffect(() => {
    if (!f.stateId) { setDistricts([]); return; }
    let live = true;
    api<{ items: Lite[] }>(`/api/master?kind=districts&parent=${encodeURIComponent(f.stateId)}`).then(r => { if (live && r.ok) setDistricts(r.items); });
    return () => { live = false; };
  }, [f.stateId]);

  async function checkUdise() {
    const code = f.udiseCode.replace(/\D/g, '');
    const r = await api<{ valid: boolean; record?: UdiseRecord | null; taken?: boolean; warning?: string | null }>(`/api/school/udise?code=${code}&state=${encodeURIComponent(f.stateId)}${school ? `&self=${school.id}` : ''}`);
    if (!r.ok) return;
    setCheck(r);
    if (r.record && !f.name) set('name', r.record.name);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const body = { ...f, affiliations: f.affiliations.filter(a => a.boardId), isGroup, groupName, ...(school ? { schoolId: school.id } : {}) };
    const r = await api<{ schoolId?: string; resubmitted?: boolean }>(mode === 'register' ? '/api/school/register' : '/api/school/profile', body);
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error && r.error !== 'network' ? t(r.error) : t('common.somethingWrong') }); return; }
    if (mode === 'register') { window.location.href = '/school?registered=1'; return; }
    setMsg({ ok: true, text: r.resubmitted ? t('school.resubmitted') : t('school.saved') });
  }

  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => <div><label htmlFor={id} className="label">{label}</label>{input}{hint && <p className="hint">{hint}</p>}</div>;
  const checks = (items: Lite[], k: 'levelIds' | 'streamIds' | 'mediumIds' | 'facilityIds' | 'benefitIds') => (
    <ul className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(i => <li key={i.id}><label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0" checked={f[k].includes(i.id)} onChange={() => toggle(k, i.id)} />{nm(i)}</label></li>)}</ul>
  );
  const section = (id: string, title: string, children: React.ReactNode, hint?: string) => (
    <section className="card space-y-4" aria-labelledby={id}><div><h2 id={id} className="text-lg font-bold">{title}</h2>{hint && <p className="hint">{hint}</p>}</div>{children}</section>
  );
  const lockHint = identityLocked ? t('school.identityLocked') : undefined;

  return (
    <form onSubmit={submit} className="space-y-6">
      {section('s-id', t('school.identity'), (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="sc-udise" className="label">{t('school.udise')}</label>
            <div className="flex gap-2">
              <input id="sc-udise" className="input" inputMode="numeric" maxLength={11} required disabled={identityLocked} placeholder="28xxxxxxxxx" value={f.udiseCode}
                onChange={e => { set('udiseCode', e.target.value.replace(/\D/g, '')); setCheck(null); }} onBlur={() => f.udiseCode.length === 11 && checkUdise()} aria-describedby="sc-udise-hint" />
              {!identityLocked && <button type="button" className="btn-ghost shrink-0" onClick={checkUdise} disabled={f.udiseCode.length !== 11}>{t('school.check')}</button>}
            </div>
            <p id="sc-udise-hint" className="hint">{t('school.udiseHint')}</p>
            <div aria-live="polite">
              {check && !check.valid && <p className="alert-error mt-2">{t('school.errUdise')}</p>}
              {check?.taken && <p className="alert-error mt-2">{t('school.errUdiseTaken')}</p>}
              {check?.record && <p className="alert-ok mt-2 flex gap-2"><CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />{t('school.directoryFound', { name: check.record.name, place: [check.record.block, check.record.district, check.record.state].filter(Boolean).join(', ') })}</p>}
              {check?.valid && !check.record && !check.taken && <p className="hint mt-2">{t('school.directoryNotFound')}</p>}
              {check?.warning && <p className="alert-error mt-2">{t(check.warning)}</p>}
            </div>
          </div>
          <div className="sm:col-span-2">{field('sc-name', t('school.name'), <input id="sc-name" className="input" required minLength={3} maxLength={160} disabled={identityLocked} value={f.name} onChange={e => set('name', e.target.value)} />, lockHint)}</div>
          {field('sc-mgmt', t('jobs.management'), <select id="sc-mgmt" className="input" required disabled={identityLocked} value={f.managementTypeId} onChange={e => set('managementTypeId', e.target.value)}><option value="">—</option>{lists.managementTypes.map(m => <option key={m.id} value={m.id}>{nm(m)}</option>)}</select>)}
          <fieldset className="sm:col-span-2">
            <legend className="label">{t('school.boards')}</legend>
            <ul className="space-y-2">
              {f.affiliations.map((a, i) => (
                <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <label><span className="sr-only">{t('jobs.board')} {i + 1}</span>
                    <select className="input" required={i === 0} disabled={identityLocked} value={a.boardId} onChange={e => set('affiliations', f.affiliations.map((x, j) => (j === i ? { ...x, boardId: e.target.value } : x)))}>
                      <option value="">{t('jobs.board')}</option>{lists.boards.map(b => <option key={b.id} value={b.id}>{nm(b)}</option>)}
                    </select></label>
                  <label><span className="sr-only">{t('school.affiliationNo')} {i + 1}</span>
                    <input className="input" maxLength={40} disabled={identityLocked} placeholder={t('school.affiliationNo')} value={a.number || ''} onChange={e => set('affiliations', f.affiliations.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))} /></label>
                  {!identityLocked && f.affiliations.length > 1 && <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-danger-700" onClick={() => set('affiliations', f.affiliations.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden="true" />{t('profile.remove')}</button>}
                </li>
              ))}
            </ul>
            {!identityLocked && f.affiliations.length < 6 && <button type="button" className="btn-ghost mt-2" onClick={() => set('affiliations', [...f.affiliations, { boardId: '', number: '' }])}><Plus size={18} aria-hidden="true" />{t('school.addBoard')}</button>}
          </fieldset>
          {mode === 'register' && canCreateGroup && (
            <div className="space-y-2 sm:col-span-2">
              <label className="flex gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={isGroup} onChange={e => setIsGroup(e.target.checked)} /><span>{t('school.isGroup')}</span></label>
              {isGroup && field('sc-group', t('school.groupName'), <input id="sc-group" className="input" maxLength={160} value={groupName} onChange={e => setGroupName(e.target.value)} />)}
            </div>
          )}
        </div>
      ), t('school.identityHint'))}

      {section('s-loc', t('school.location'), (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('sc-state', t('jobs.state'), <select id="sc-state" className="input" required disabled={identityLocked} value={f.stateId} onChange={e => setF(prev => ({ ...prev, stateId: e.target.value, districtId: '' }))}><option value="">—</option>{lists.states.map(s => <option key={s.id} value={s.id}>{nm(s)}</option>)}</select>)}
          {field('sc-district', t('jobs.district'), <select id="sc-district" className="input" disabled={identityLocked || !districts.length} value={f.districtId} onChange={e => set('districtId', e.target.value)}><option value="">{f.stateId ? '—' : t('jobs.pickStateFirst')}</option>{districts.map(d => <option key={d.id} value={d.id}>{nm(d)}</option>)}</select>, f.stateId && !districts.length ? t('profile.noDistricts') : undefined)}
          {field('sc-city', t('profile.city'), <input id="sc-city" className="input" required maxLength={80} value={f.city} onChange={e => set('city', e.target.value)} />)}
          {field('sc-pin', t('profile.pincode'), <input id="sc-pin" className="input" inputMode="numeric" maxLength={6} value={f.pincode} onChange={e => set('pincode', e.target.value.replace(/\D/g, ''))} />)}
          <div className="sm:col-span-2">{field('sc-addr', t('school.address'), <textarea id="sc-addr" className="input" maxLength={300} value={f.address} onChange={e => set('address', e.target.value)} />)}</div>
          <div className="space-y-2 sm:col-span-2">
            <p className="label">{t('school.mapLocation')}</p>
            <div className="grid grid-cols-2 gap-2">
              <label><span className="sr-only">{t('school.lat')}</span><input className="input" inputMode="decimal" placeholder={t('school.lat')} value={f.lat} onChange={e => set('lat', e.target.value)} /></label>
              <label><span className="sr-only">{t('school.lng')}</span><input className="input" inputMode="decimal" placeholder={t('school.lng')} value={f.lng} onChange={e => set('lng', e.target.value)} /></label>
            </div>
            <button type="button" className="btn-ghost" onClick={() => navigator.geolocation?.getCurrentPosition(p => setF(prev => ({ ...prev, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) })))}><LocateFixed size={18} aria-hidden="true" />{t('school.useMyLocation')}</button>
            <p className="hint">{t('school.mapHint')}</p>
          </div>
        </div>
      ))}

      {section('s-contact', t('school.contact'), (
        <div className="grid gap-4 sm:grid-cols-2">
          {field('sc-email', t('school.officialEmail'), <input id="sc-email" type="email" className="input" maxLength={254} value={f.officialEmail} onChange={e => set('officialEmail', e.target.value)} />, t('school.officialEmailHint'))}
          {field('sc-phone', t('school.phone'), <input id="sc-phone" type="tel" className="input" maxLength={20} value={f.phone} onChange={e => set('phone', e.target.value)} />)}
          {field('sc-principal', t('school.principal'), <input id="sc-principal" className="input" maxLength={120} value={f.principalName} onChange={e => set('principalName', e.target.value)} />)}
          {field('sc-web', t('school.website'), <input id="sc-web" className="input" inputMode="url" maxLength={300} placeholder="https://" value={f.website} onChange={e => set('website', e.target.value)} />)}
        </div>
      ), t('school.contactHint'))}

      {section('s-academics', t('school.academics'), (
        <>
          <fieldset><legend className="label">{t('profile.levels')}</legend>{checks(lists.levels, 'levelIds')}</fieldset>
          <fieldset><legend className="label">{t('school.streams')}</legend>{checks(lists.streams, 'streamIds')}</fieldset>
          <fieldset><legend className="label">{t('school.mediums')}</legend>{checks(lists.mediums, 'mediumIds')}</fieldset>
        </>
      ))}

      {section('s-about', t('school.aboutSection'), (
        <>
          {field('sc-about', t('school.about'), <textarea id="sc-about" className="input min-h-[140px]" maxLength={3000} value={f.about} onChange={e => set('about', e.target.value)} />, t('school.aboutHint'))}
          <fieldset><legend className="label">{t('school.facilities')}</legend>{checks(lists.facilities, 'facilityIds')}</fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            {field('sc-est', t('school.establishedYear'), <input id="sc-est" className="input" type="number" inputMode="numeric" min={1800} max={new Date().getFullYear()} value={f.establishedYear} onChange={e => set('establishedYear', e.target.value)} />)}
            {field('sc-students', t('school.studentCount'), <input id="sc-students" className="input" type="number" inputMode="numeric" min={1} max={100000} value={f.studentCount} onChange={e => set('studentCount', e.target.value)} />)}
            {field('sc-teachers', t('school.teacherCount'), <input id="sc-teachers" className="input" type="number" inputMode="numeric" min={1} max={5000} value={f.teacherCount} onChange={e => set('teacherCount', e.target.value)} />)}
          </div>
          {field('sc-ach', t('school.achievements'), <textarea id="sc-ach" className="input min-h-[90px]" maxLength={2000} value={f.achievements} onChange={e => set('achievements', e.target.value)} />, t('school.achievementsHint'))}
        </>
      ))}

      {section('s-staff', t('school.forTeachers'), (
        <>
          {field('sc-why', t('school.whyJoin'), <textarea id="sc-why" className="input min-h-[120px]" maxLength={2000} placeholder={t('school.whyJoinPlaceholder')} value={f.whyJoin} onChange={e => set('whyJoin', e.target.value)} />, t('school.whyJoinHint'))}
          {lists.benefits.length > 0 && <fieldset><legend className="label">{t('school.staffBenefits')}</legend>{checks(lists.benefits, 'benefitIds')}</fieldset>}
          <div>
            <p className="label">{t('school.socialLinks')}</p>
            {f.socialLinks.map((l, i) => (
              <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                {field(`sl-${i}-l`, t('profile.linkLabel'), <input id={`sl-${i}-l`} className="input" maxLength={40} placeholder="YouTube" value={l.label} onChange={e => set('socialLinks', f.socialLinks.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />)}
                {field(`sl-${i}-u`, t('profile.linkUrl'), <input id={`sl-${i}-u`} className="input" inputMode="url" maxLength={300} placeholder="https://" value={l.url} onChange={e => set('socialLinks', f.socialLinks.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />)}
                <button type="button" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-danger-700" onClick={() => set('socialLinks', f.socialLinks.filter((_, k) => k !== i))}><Trash2 size={16} aria-hidden="true" />{t('profile.remove')}</button>
              </div>
            ))}
            {f.socialLinks.length < 6 && <button type="button" className="btn-ghost" onClick={() => set('socialLinks', [...f.socialLinks, { label: '', url: '' }])}><Plus size={18} aria-hidden="true" />{t('profile.addLink')}</button>}
          </div>
        </>
      ), t('school.forTeachersHint'))}

      {msg && <p role="status" className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? t('common.loading') : mode === 'register' ? t('school.submitForVerification') : t('common.save')}</button>
      {mode === 'register' && <p className="hint">{t('school.submitHint')}</p>}
    </form>
  );
}
