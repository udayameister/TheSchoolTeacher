'use client';
import { useState } from 'react';
import type { ListingLists } from '@/lib/server/listingLists';
import { api } from '@/lib/clientApi';

type Opt = ListingLists['posts'][number];
interface Draft {
  id?: string; importItemId?: string; kind: 'government' | 'external'; title: string; orgName: string; postId: string; subjectIds: string[]; levelIds: string[];
  employmentTypeId: string; managementTypeId: string; boardIds: string[]; stateId: string; districtId: string; city: string; vacancies: number; lastDate: string;
  externalUrl: string; notificationPdfUrl: string; description: string;
  eligibility: { requiredQualificationIds: string[]; tetRequired: boolean; acceptedTetIds: string[]; minExperienceYears: number; otherRequirements: string };
  pay: { mode: 'not_disclosed' | 'cpc' | 'state_scale' | 'range'; payLevelId: string; scaleText: string; min: number | null; max: number | null };
  status?: string;
}

/** The admin's "Apply on official site" listing (government notice or external vacancy). English only, like the rest of the admin console. */
export default function ListingForm({ lists, initial }: { lists: ListingLists; initial: Record<string, unknown> }) {
  const i = initial as Partial<Draft> & { eligibility?: Partial<Draft['eligibility']>; pay?: Partial<Draft['pay']> };
  const [d, setD] = useState<Draft>({
    id: i.id, importItemId: i.importItemId, kind: i.kind === 'external' ? 'external' : 'government', title: i.title || '', orgName: i.orgName || '', postId: i.postId || '',
    subjectIds: i.subjectIds || [], levelIds: i.levelIds || [], employmentTypeId: i.employmentTypeId || 'employmentTypes:PERMANENT',
    managementTypeId: i.managementTypeId || '', boardIds: i.boardIds || [], stateId: i.stateId || '', districtId: i.districtId || '', city: i.city || '',
    vacancies: Number(i.vacancies) || 1, lastDate: i.lastDate || '', externalUrl: i.externalUrl || '', notificationPdfUrl: i.notificationPdfUrl || '', description: i.description || '',
    eligibility: { requiredQualificationIds: i.eligibility?.requiredQualificationIds || [], tetRequired: !!i.eligibility?.tetRequired, acceptedTetIds: i.eligibility?.acceptedTetIds || [], minExperienceYears: Number(i.eligibility?.minExperienceYears) || 0, otherRequirements: i.eligibility?.otherRequirements || '' },
    pay: { mode: (i.pay?.mode as Draft['pay']['mode']) || 'not_disclosed', payLevelId: i.pay?.payLevelId || '', scaleText: i.pay?.scaleText || '', min: i.pay?.min ?? null, max: i.pay?.max ?? null },
    status: i.status,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(p => ({ ...p, [k]: v }));
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const checks = (items: Opt[], selected: string[], on: (id: string) => void) => (
    <ul className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(o => <li key={o.id}><label className="flex min-h-[36px] items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={selected.includes(o.id)} onChange={() => on(o.id)} />{o.name}</label></li>)}</ul>
  );
  const sel = (label: string, value: string, items: Opt[], on: (v: string) => void, required = true, empty = '—') => (
    <label><span className="label">{label}</span><select className="input" required={required} value={value} onChange={e => on(e.target.value)}><option value="">{empty}</option>{items.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  );

  async function save(publish: boolean) {
    setBusy(true); setMsg(null);
    const payload = { ...d, publish, pay: { ...d.pay, payLevelId: d.pay.payLevelId || null, scaleText: d.pay.scaleText || null }, eligibility: { ...d.eligibility, otherRequirements: d.eligibility.otherRequirements || null, mediumIds: [], preferredQualificationIds: [] } };
    const r = await api<{ id: string; status: string }>('/api/admin/listings', payload);
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error || 'Could not save.' }); return; }
    window.location.href = `/admin/listings?saved=${r.status}`;
  }

  return (
    <form className="space-y-6" onSubmit={e => { e.preventDefault(); save(d.status !== 'closed'); }}>
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">The listing</h2>
        <fieldset className="sm:col-span-2"><legend className="label">Type</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="kind" className="h-4 w-4" checked={d.kind === 'government'} onChange={() => set('kind', 'government')} />Government recruitment notice (KVS, NVS, state DSC / TRB …)</label>
            <label className="flex items-center gap-2"><input type="radio" name="kind" className="h-4 w-4" checked={d.kind === 'external'} onChange={() => set('kind', 'external')} />External vacancy (a school&apos;s own site / feed)</label>
          </div></fieldset>
        <label className="sm:col-span-2"><span className="label">Title</span><input className="input" required minLength={5} maxLength={160} value={d.title} onChange={e => set('title', e.target.value)} placeholder="e.g. KVS PGT / TGT recruitment 2026 (1,821 posts)" /></label>
        <label><span className="label">Recruiting body / school</span><input className="input" required minLength={3} maxLength={160} value={d.orgName} onChange={e => set('orgName', e.target.value)} /></label>
        {sel('Management type', d.managementTypeId, lists.managementTypes, v => set('managementTypeId', v))}
        {sel('Main post', d.postId, lists.posts, v => set('postId', v))}
        {sel('Employment type', d.employmentTypeId, lists.employmentTypes, v => set('employmentTypeId', v))}
        {sel('State', d.stateId, lists.states, v => setD(p => ({ ...p, stateId: v, districtId: '' })))}
        {sel('District (optional)', d.districtId, lists.districts.filter(x => x.parentId === d.stateId), v => set('districtId', v), false, 'Whole state / several districts')}
        <label><span className="label">City / place (optional)</span><input className="input" maxLength={80} value={d.city} onChange={e => set('city', e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Number of posts</span><input className="input" type="number" min={1} max={999} required value={d.vacancies} onChange={e => set('vacancies', Number(e.target.value))} /></label>
          <label><span className="label">Last date</span><input className="input" type="date" required value={d.lastDate} onChange={e => set('lastDate', e.target.value)} /></label>
        </div>
        <label className="sm:col-span-2"><span className="label">Official page to apply</span><input className="input" type="url" required placeholder="https://" value={d.externalUrl} onChange={e => set('externalUrl', e.target.value)} /></label>
        <label className="sm:col-span-2"><span className="label">Notification PDF (optional)</span><input className="input" type="url" placeholder="https://" value={d.notificationPdfUrl} onChange={e => set('notificationPdfUrl', e.target.value)} /></label>
        <fieldset className="sm:col-span-2"><legend className="label">Classes</legend>{checks(lists.levels, d.levelIds, id => set('levelIds', toggle(d.levelIds, id)))}</fieldset>
        <details className="sm:col-span-2"><summary className="cursor-pointer font-semibold text-brand-700">Subjects ({d.subjectIds.length})</summary>{checks(lists.subjects, d.subjectIds, id => set('subjectIds', toggle(d.subjectIds, id)))}</details>
        <details className="sm:col-span-2"><summary className="cursor-pointer font-semibold text-brand-700">Boards ({d.boardIds.length})</summary>{checks(lists.boards, d.boardIds, id => set('boardIds', toggle(d.boardIds, id)))}</details>
        <label className="sm:col-span-2"><span className="label">Description (your own words)</span><textarea className="input min-h-[160px]" required minLength={30} maxLength={8000} value={d.description} onChange={e => set('description', e.target.value)} />
          <span className="hint">Summarise the posts, who can apply and how. Do not paste the notification; candidates read it on the official site.</span></label>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Eligibility in brief (used for matching)</h2>
        <fieldset><legend className="label">Required qualifications</legend>{checks(lists.qualifications, d.eligibility.requiredQualificationIds, id => set('eligibility', { ...d.eligibility, requiredQualificationIds: toggle(d.eligibility.requiredQualificationIds, id) }))}</fieldset>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={d.eligibility.tetRequired} onChange={e => set('eligibility', { ...d.eligibility, tetRequired: e.target.checked })} />A Teacher Eligibility Test is required</label>
        {d.eligibility.tetRequired && <fieldset><legend className="label">Accepted TETs</legend>{checks(lists.tets, d.eligibility.acceptedTetIds, id => set('eligibility', { ...d.eligibility, acceptedTetIds: toggle(d.eligibility.acceptedTetIds, id) }))}</fieldset>}
        <label className="block max-w-xs"><span className="label">Minimum experience (years)</span><input className="input" type="number" min={0} max={40} step={0.5} value={d.eligibility.minExperienceYears} onChange={e => set('eligibility', { ...d.eligibility, minExperienceYears: Number(e.target.value) })} /></label>
        <label className="block"><span className="label">Other requirements (optional)</span><textarea className="input" maxLength={1000} value={d.eligibility.otherRequirements} onChange={e => set('eligibility', { ...d.eligibility, otherRequirements: e.target.value })} /></label>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Pay</h2>
        <div className="flex flex-wrap gap-4 text-sm">{([['not_disclosed', 'See the notification'], ['cpc', '7th CPC pay level'], ['state_scale', 'State pay scale'], ['range', 'Monthly range']] as const).map(([m, l]) => (
          <label key={m} className="flex items-center gap-2"><input type="radio" name="pay" className="h-4 w-4" checked={d.pay.mode === m} onChange={() => set('pay', { ...d.pay, mode: m })} />{l}</label>
        ))}</div>
        {d.pay.mode === 'cpc' && sel('Pay level', d.pay.payLevelId, lists.payLevels, v => set('pay', { ...d.pay, payLevelId: v }))}
        {d.pay.mode === 'state_scale' && <label className="block"><span className="label">Pay scale</span><input className="input" required maxLength={200} value={d.pay.scaleText} onChange={e => set('pay', { ...d.pay, scaleText: e.target.value })} /></label>}
        {d.pay.mode === 'range' && <div className="grid max-w-md grid-cols-2 gap-3">
          <label><span className="label">From (₹ / month)</span><input className="input" type="number" min={0} value={d.pay.min ?? ''} onChange={e => set('pay', { ...d.pay, min: e.target.value ? Number(e.target.value) : null })} /></label>
          <label><span className="label">To (₹ / month)</span><input className="input" type="number" min={0} value={d.pay.max ?? ''} onChange={e => set('pay', { ...d.pay, max: e.target.value ? Number(e.target.value) : null })} /></label>
        </div>}
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy}>{d.status === 'published' || d.status === 'closed' ? 'Save' : 'Publish'}</button>
        {d.status !== 'published' && d.status !== 'closed' && <button type="button" className="btn-ghost" disabled={busy} onClick={() => save(false)}>Save as draft</button>}
        {d.id && (d.status === 'published' || d.status === 'closed') && <button type="button" className="btn-ghost" disabled={busy} onClick={async () => {
          const r = await api('/api/admin/listings', { action: d.status === 'published' ? 'close' : 'reopen', id: d.id });
          if (r.ok) window.location.href = '/admin/listings'; else setMsg({ ok: false, text: r.error || 'Could not change it.' });
        }}>{d.status === 'published' ? 'Close listing' : 'Reopen listing'}</button>}
      </div>
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
    </form>
  );
}
