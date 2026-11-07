'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { TrackStatus, TrackedJob } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';
import { daysLeft } from '@/lib/jobs/dates';

const STATUSES: TrackStatus[] = ['interested', 'applied', 'exam', 'interview', 'result', 'closed'];

export default function TrackerManager({ initial }: { initial: TrackedJob[] }) {
  const { t } = useI18n();
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', organisation: '', url: '', lastDate: '', status: 'interested' as TrackStatus, notes: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const sorted = items.slice().sort((a, b) => {
    const ac = a.status === 'closed' ? 1 : 0, bc = b.status === 'closed' ? 1 : 0;
    return ac - bc || (a.lastDate || '9999').localeCompare(b.lastDate || '9999');
  });

  async function patch(id: string, p: Partial<TrackedJob>) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...p } : i)));
    const r = await api('/api/candidate/tracker', { id, ...p }, 'PATCH');
    if (!r.ok) setMsg(r.error ? t(r.error) : t('common.somethingWrong'));
  }

  return (
    <div className="space-y-4">
      {msg && <p role="alert" className="alert-error">{msg}</p>}
      {!adding ? <button type="button" className="btn-primary" onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" />{t('tracker.addExternal')}</button> : (
        <form className="card grid gap-3 sm:grid-cols-2" onSubmit={async e => {
          e.preventDefault();
          const r = await api<{ item: TrackedJob }>('/api/candidate/tracker', form);
          if (!r.ok) { setMsg(r.error ? t(r.error) : t('common.somethingWrong')); return; }
          setItems(prev => [...prev, r.item]); setAdding(false); setMsg(null);
          setForm({ title: '', organisation: '', url: '', lastDate: '', status: 'interested', notes: '' });
        }}>
          <h2 className="text-lg font-bold sm:col-span-2">{t('tracker.addExternal')}</h2>
          <label><span className="label">{t('tracker.jobTitle')}</span><input className="input" required maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
          <label><span className="label">{t('tracker.organisation')}</span><input className="input" required maxLength={160} value={form.organisation} onChange={e => setForm({ ...form, organisation: e.target.value })} /></label>
          <label><span className="label">{t('tracker.link')}</span><input className="input" type="url" inputMode="url" maxLength={500} placeholder="https://" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /></label>
          <label><span className="label">{t('jobs.lastDateLabel')}</span><input className="input" type="date" value={form.lastDate} onChange={e => setForm({ ...form, lastDate: e.target.value })} /></label>
          <label className="sm:col-span-2"><span className="label">{t('tracker.notes')}</span><textarea className="input" maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="flex gap-2 sm:col-span-2"><button className="btn-primary">{t('common.save')}</button><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>{t('common.cancel')}</button></div>
        </form>
      )}

      {!sorted.length ? <p className="card text-ink-soft">{t('tracker.none')}</p> : (
        <ul className="space-y-3">
          {sorted.map(i => {
            const d = daysLeft(i.lastDate);
            return (
              <li key={i.id} className={`card space-y-2 ${i.status === 'closed' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-bold">{i.jobId ? <Link href={`/jobs/${i.jobId}`}>{i.title}</Link> : i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1">{i.title}<ExternalLink size={14} aria-hidden="true" /></a> : i.title}</h2>
                    <p className="text-sm text-ink-soft">{i.organisation}{!i.jobId && <span className="badge ml-2 border-line bg-ivory">{t('tracker.otherSite')}</span>}</p>
                  </div>
                  {d !== null && <span className={`badge shrink-0 ${d < 0 ? 'border-line bg-ivory text-ink-muted' : d <= 7 ? 'border-danger-600/30 bg-danger-50 text-danger-700' : 'border-brand-300 bg-brand-50 text-brand-800'}`}>{d < 0 ? t('tracker.passed') : d === 0 ? t('jobs.lastDayToday') : t('tracker.daysLeft', { n: d })}</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
                  <label><span className="sr-only">{t('tracker.status')}</span>
                    <select className="input" value={i.status} onChange={e => patch(i.id, { status: e.target.value as TrackStatus })}>
                      {STATUSES.map(s => <option key={s} value={s}>{t(`tracker.st_${s}`)}</option>)}
                    </select></label>
                  <label><span className="sr-only">{t('tracker.notes')}</span>
                    <input className="input" maxLength={1000} placeholder={t('tracker.notesPlaceholder')} defaultValue={i.notes || ''} onBlur={e => e.target.value !== (i.notes || '') && patch(i.id, { notes: e.target.value })} /></label>
                </div>
                <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-danger-700" onClick={async () => {
                  if (!window.confirm(t('tracker.confirmRemove', { title: i.title }))) return;
                  const r = await api(`/api/candidate/tracker?id=${encodeURIComponent(i.id)}`, undefined, 'DELETE');
                  if (r.ok) setItems(prev => prev.filter(x => x.id !== i.id));
                }}><Trash2 size={16} aria-hidden="true" />{t('profile.remove')}</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
