'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CalendarPlus, ExternalLink, Trash2, Video } from 'lucide-react';
import type { InterviewMode, InterviewSlot, InterviewStatus } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';
import { istDateTime } from '@/lib/ics';

const MODES: InterviewMode[] = ['in_person', 'google_meet', 'teams', 'phone'];
const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** Start times from a first time, a number of slots, the length of each and a break between them. */
export function slotTimes(first: string, count: number, duration: number, gap: number): string[] {
  const m = /^(\d{2}):(\d{2})$/.exec(first);
  if (!m) return [];
  const out: string[] = [];
  let mins = Number(m[1]) * 60 + Number(m[2]);
  for (let i = 0; i < count && mins + duration <= 24 * 60; i++, mins += duration + gap) out.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
  return out;
}

export function SlotForm({ jobs, jobId }: { jobs: { id: string; title: string }[]; jobId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ jobId: jobId || jobs[0]?.id || '', kind: 'interview', date: '', first: '10:00', count: 4, durationMin: 30, gap: 10, mode: 'in_person' as InterviewMode, location: '', capacity: 1 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const times = useMemo(() => slotTimes(f.first, Number(f.count) || 0, Number(f.durationMin) || 0, Number(f.gap) || 0), [f.first, f.count, f.durationMin, f.gap]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  if (!jobs.length) return null;
  const online = f.mode === 'google_meet' || f.mode === 'teams';
  return (
    <form className="card space-y-3" onSubmit={async e => {
      e.preventDefault();
      setBusy(true);
      const r = await api<{ created: number }>('/api/school/interviews', { action: 'slots', jobId: f.jobId, kind: f.kind, date: f.date, times, durationMin: Number(f.durationMin), mode: f.mode, location: f.location, capacity: Number(f.capacity) });
      setBusy(false);
      setMsg(r.ok ? { ok: true, text: t('interviews.slotsCreated', { n: r.created }) } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
      if (r.ok) router.refresh();
    }}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarPlus size={20} aria-hidden="true" />{t('interviews.addSlots')}</h2>
      <label className="block"><span className="label">{t('jobs.post')}</span><select className="input" value={f.jobId} onChange={set('jobId')}>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></label>
      <label className="block"><span className="label">{t('interviews.kind')}</span><select className="input" value={f.kind} onChange={set('kind')}><option value="interview">{t('interviews.kind_interview')}</option><option value="demo">{t('interviews.kind_demo')}</option></select></label>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">{t('interviews.date')}</span><input className="input" type="date" required min={todayIst()} value={f.date} onChange={set('date')} /></label>
        <label><span className="label">{t('interviews.firstStart')}</span><input className="input" type="time" required value={f.first} onChange={set('first')} /></label>
        <label><span className="label">{t('interviews.count')}</span><input className="input" type="number" min={1} max={40} required value={f.count} onChange={set('count')} /></label>
        <label><span className="label">{t('interviews.duration')}</span><input className="input" type="number" min={10} max={240} step={5} required value={f.durationMin} onChange={set('durationMin')} /></label>
        <label><span className="label">{t('interviews.gap')}</span><input className="input" type="number" min={0} max={120} step={5} value={f.gap} onChange={set('gap')} /></label>
        <label><span className="label">{t('interviews.capacity')}</span><input className="input" type="number" min={1} max={50} value={f.capacity} onChange={set('capacity')} /></label>
      </div>
      <p className="hint">{t('interviews.timesPreview')}: {times.join(', ') || '—'} ({t('interviews.ist')})</p>
      <label className="block"><span className="label">{t('interviews.mode')}</span><select className="input" value={f.mode} onChange={set('mode')}>{MODES.map(m => <option key={m} value={m}>{t(`interviews.mode_${m}`)}</option>)}</select></label>
      <label className="block"><span className="label">{online ? t('interviews.meetingLink') : f.mode === 'phone' ? t('interviews.phoneDetails') : t('interviews.venue')}</span>
        <input className="input" required maxLength={300} type={online ? 'url' : 'text'} placeholder={online ? 'https://' : ''} value={f.location} onChange={set('location')} /></label>
      <button className="btn-primary w-full" disabled={busy || !times.length}>{t('interviews.createSlots', { n: times.length })}</button>
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
    </form>
  );
}

interface SlotRow extends InterviewSlot { booked: { interviewId: string; candidateName: string; applicationId: string }[] }

export function SlotList({ slots, jobs }: { slots: SlotRow[]; jobs: { id: string; title: string }[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!slots.length) return <p className="card text-ink-soft">{t('interviews.noSlots')}</p>;
  return (
    <div className="space-y-2">
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
        {slots.map(s => (
          <li key={s.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{istDateTime(s.start, locale)} · {s.durationMin} {t('interviews.min')}</p>
              <p className="text-ink-soft">{t(`interviews.kind_${s.kind}`)} · {jobs.find(j => j.id === s.jobId)?.title} · {t(`interviews.mode_${s.mode}`)}</p>
              <p className="text-xs text-ink-muted">{t('interviews.bookedOf', { n: s.booked.length, cap: s.capacity })}{s.booked.length ? ': ' : ''}{s.booked.map((b, i) => <span key={b.interviewId}>{i ? ', ' : ''}<Link href={`/school/applicants/${b.applicationId}`}>{b.candidateName}</Link></span>)}</p>
            </div>
            <button type="button" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-danger-700 underline sm:self-center" onClick={async () => {
              if (!window.confirm(s.booked.length ? t('interviews.confirmDeleteBooked', { n: s.booked.length }) : t('interviews.confirmDelete'))) return;
              const r = await api<{ affected: number }>('/api/school/interviews', { action: 'deleteSlot', id: s.id });
              setMsg(r.ok ? { ok: true, text: t('interviews.slotDeleted') } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
              router.refresh();
            }}><Trash2 size={16} aria-hidden="true" />{t('interviews.deleteSlot')}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface IvRow { id: string; applicationId: string; candidateName: string; jobTitle: string; kind: 'interview' | 'demo'; status: InterviewStatus; slot: InterviewSlot | null; demoTopic?: string | null; demoClass?: string | null; demoVideoUrl?: string | null }

const tone: Record<InterviewStatus, string> = {
  invited: 'border-marigold-400 bg-marigold-50 text-ink', booked: 'border-brand-300 bg-brand-50 text-brand-800', completed: 'border-success-600/40 bg-success-50 text-success-700',
  no_show: 'border-danger-600/40 bg-danger-50 text-danger-700', cancelled: 'border-line bg-ivory text-ink-muted',
};

export function InterviewList({ rows }: { rows: IvRow[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!rows.length) return <p className="card text-ink-soft">{t('interviews.noInvitations')}</p>;
  return (
    <div className="space-y-2">
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.id} className="card space-y-1 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link href={`/school/applicants/${r.applicationId}`} className="font-semibold">{r.candidateName}</Link>
                <span className="text-ink-soft"> · {t(`interviews.kind_${r.kind}`)} · {r.jobTitle}</span>
              </div>
              <span className={`badge ${tone[r.status]}`}>{t(`interviews.status_${r.status}`)}</span>
            </div>
            <p>{r.slot ? <>{istDateTime(r.slot.start, locale)} · {t(`interviews.mode_${r.slot.mode}`)} <a href={`/api/interviews/${r.id}/ics`} className="ml-1 inline-flex items-center gap-1">{t('interviews.addToCalendar')}</a></> : <span className="text-ink-muted">{t('interviews.notBooked')}</span>}</p>
            {r.kind === 'demo' && (r.demoTopic || r.demoClass) && <p className="text-ink-soft">{t('interviews.demoTopic')}: {r.demoTopic || '—'} · {t('interviews.demoClass')}: {r.demoClass || '—'}</p>}
            {r.demoVideoUrl && <p><a href={r.demoVideoUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1"><Video size={16} aria-hidden="true" />{t('interviews.demoVideo')}<ExternalLink size={14} aria-hidden="true" /></a></p>}
            {(r.status === 'booked' || r.status === 'invited') && (
              <label className="flex flex-wrap items-center gap-2 pt-1"><span className="text-ink-soft">{t('interviews.recordOutcome')}</span>
                <select className="input min-h-[36px] w-auto py-1 text-sm" value="" onChange={async e => {
                  const status = e.target.value;
                  if (!status) return;
                  const r2 = await api('/api/school/interviews', { action: 'outcome', id: r.id, status });
                  setMsg(r2.ok ? { ok: true, text: t('common.saved') } : { ok: false, text: r2.error ? t(r2.error) : t('common.somethingWrong') });
                  router.refresh();
                }}>
                  <option value="">—</option>
                  {(['completed', 'no_show', 'cancelled'] as const).map(s => <option key={s} value={s}>{t(`interviews.status_${s}`)}</option>)}
                </select></label>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
