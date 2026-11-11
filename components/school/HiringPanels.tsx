'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Offer, PanelScore, Recommendation } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

const RECS: Recommendation[] = ['strongly_recommend', 'recommend', 'reservations', 'not_recommend'];
type Msg = { ok: boolean; text: string } | null;

/** A panel member's confidential score for this applicant. */
export function ScoreForm({ applicationId, dims, mine, canScore }: { applicationId: string; dims: { id: string; name: string; weight: number }[]; mine: PanelScore | null; canScore: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, string>>(Object.fromEntries(dims.map(d => [d.id, mine?.marks[d.id] != null ? String(mine.marks[d.id]) : ''])));
  const [rec, setRec] = useState<Recommendation | ''>(mine?.recommendation || '');
  const [comments, setComments] = useState(mine?.comments || '');
  const [msg, setMsg] = useState<Msg>(null);
  const sumW = dims.reduce((s, d) => s + d.weight, 0) || 1;
  const filled = dims.every(d => marks[d.id] !== '' && Number(marks[d.id]) >= 0 && Number(marks[d.id]) <= 10);
  const total = filled ? Math.round(dims.reduce((s, d) => s + (d.weight / sumW) * (Number(marks[d.id]) / 10) * 100, 0) * 10) / 10 : null;
  if (!canScore) return <p className="text-sm text-ink-soft">{t('panel.cannotScoreStage')}</p>;
  return (
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault();
      const r = await api<{ total: number }>('/api/school/panel', { action: 'score', applicationId, marks: Object.fromEntries(dims.map(d => [d.id, Number(marks[d.id])])), recommendation: rec, comments });
      setMsg(r.ok ? { ok: true, text: t('panel.scoreSaved', { total: r.total }) } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
      if (r.ok) router.refresh();
    }}>
      {dims.map(d => (
        <label key={d.id} className="flex items-center justify-between gap-2">
          <span className="text-sm"><span className="font-semibold">{d.name}</span> <span className="text-ink-muted">({Math.round((d.weight / sumW) * 100)}%)</span></span>
          <span className="flex items-center gap-1"><input className="input w-20 text-right" type="number" inputMode="decimal" min={0} max={10} step={0.5} required value={marks[d.id]} onChange={e => setMarks({ ...marks, [d.id]: e.target.value })} /><span className="text-sm text-ink-muted">/10</span></span>
        </label>
      ))}
      <label className="block"><span className="label">{t('panel.recommendation')}</span>
        <select className="input" required value={rec} onChange={e => setRec(e.target.value as Recommendation)}><option value="">—</option>{RECS.map(r => <option key={r} value={r}>{t(`panel.rec_${r}`)}</option>)}</select></label>
      <label className="block"><span className="label">{t('panel.comments')}</span><textarea className="input min-h-[70px]" maxLength={2000} value={comments} onChange={e => setComments(e.target.value)} /></label>
      <p className="text-sm font-semibold">{t('panel.total')}: {total ?? '—'} / 100</p>
      <p className="hint">{t('panel.confidential')}</p>
      <button className="btn-primary w-full">{mine ? t('panel.updateScore') : t('panel.saveScore')}</button>
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
    </form>
  );
}

/** Issue an offer letter (with a preview), or show the current one. */
export function OfferPanel({ applicationId, jobTitle, offers, hasSignatory, stage }: { applicationId: string; jobTitle: string; offers: Offer[]; hasSignatory: boolean; stage: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [f, setF] = useState({ designation: jobTitle, pay: '', joiningDate: '', acceptBy: '', reportTo: '' });
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
  const open = offers.find(o => o.status === 'issued' || o.status === 'accepted');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setPreview(null); };
  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const r = await api<{ letter: string }>('/api/school/offers', { action, applicationId, ...f, ...extra });
    setBusy(false);
    return r;
  };
  return (
    <div className="space-y-3">
      {offers.length > 0 && (
        <ul className="space-y-1 text-sm">{offers.map(o => (
          <li key={o.id}><span className="font-semibold">{t(`offers.status_${o.status}`)}</span> · {t('offers.issuedOn', { date: fmt(o.issuedAt) })}{o.respondedAt && o.status !== 'issued' ? ` · ${fmt(o.respondedAt)}` : ''}{o.responseNote ? ` – “${o.responseNote}”` : ''}
            {o.status === 'issued' && <button type="button" className="ml-2 font-semibold text-danger-700 underline" onClick={async () => {
              if (!window.confirm(t('offers.confirmWithdraw'))) return;
              const r = await api('/api/school/offers', { action: 'withdraw', id: o.id });
              setMsg(r.ok ? { ok: true, text: t('offers.withdrawnMsg') } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
              router.refresh();
            }}>{t('offers.withdraw')}</button>}
          </li>
        ))}</ul>
      )}
      {open ? <p className="hint">{t('offers.oneOpen')}</p> : stage === 'withdrawn' || stage === 'not_selected' ? <p className="text-sm text-ink-soft">{t('offers.errStage')}</p> : !hasSignatory ? (
        <p className="text-sm">{t('offers.setupFirst')} <Link href="/school/offers">{t('offers.settingsLink')}</Link></p>
      ) : (
        <form className="space-y-2" onSubmit={async e => {
          e.preventDefault();
          if (!preview) {
            const r = await call('preview');
            if (r.ok) setPreview(r.letter); else setMsg({ ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
            return;
          }
          if (!window.confirm(t('offers.confirmIssue'))) return;
          const r = await call('issue');
          setMsg(r.ok ? { ok: true, text: t('offers.issuedMsg') } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
          if (r.ok) { setPreview(null); router.refresh(); }
        }}>
          <label className="block"><span className="label">{t('offers.designation')}</span><input className="input" required maxLength={150} value={f.designation} onChange={set('designation')} /></label>
          <label className="block"><span className="label">{t('offers.pay')}</span><input className="input" required maxLength={300} placeholder={t('offers.payHint')} value={f.pay} onChange={set('pay')} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">{t('offers.acceptBy')}</span><input className="input" type="date" required value={f.acceptBy} onChange={set('acceptBy')} /></label>
            <label><span className="label">{t('offers.joiningDate')}</span><input className="input" type="date" required value={f.joiningDate} onChange={set('joiningDate')} /></label>
          </div>
          <label className="block"><span className="label">{t('offers.reportTo')}</span><input className="input" maxLength={150} placeholder={t('offers.reportToHint')} value={f.reportTo} onChange={set('reportTo')} /></label>
          {preview && <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-lg border border-line bg-ivory p-3 text-sm" aria-label={t('offers.preview')}>{preview}</div>}
          <button className="btn-primary w-full" disabled={busy}>{preview ? t('offers.issue') : t('offers.previewButton')}</button>
        </form>
      )}
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
    </div>
  );
}
