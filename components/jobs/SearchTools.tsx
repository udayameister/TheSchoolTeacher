'use client';
import { useState } from 'react';
import { BellPlus, LocateFixed } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';
import { parseFilters } from '@/lib/jobs/filters';

/** "Near me": asks the browser for the location and searches within the chosen distance. */
export function NearMeButton() {
  const { t } = useI18n();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <button type="button" className="btn-ghost w-full" onClick={() => {
        if (!navigator.geolocation) { setMsg(t('jobs.nearMeUnavailable')); return; }
        setMsg(t('common.loading'));
        navigator.geolocation.getCurrentPosition(pos => {
          const p = new URLSearchParams(window.location.search);
          p.set('lat', pos.coords.latitude.toFixed(4)); p.set('lng', pos.coords.longitude.toFixed(4));
          if (!p.get('km')) p.set('km', '25');
          p.set('sort', 'distance'); p.delete('page');
          window.location.search = p.toString();
        }, () => setMsg(t('jobs.nearMeDenied')), { timeout: 15000, maximumAge: 600000 });
      }}><LocateFixed size={18} aria-hidden="true" />{t('jobs.nearMe')}</button>
      {msg && <p className="hint" role="status">{msg}</p>}
    </div>
  );
}

/** Saves the current search as a job alert. */
export function SaveAlertButton({ signedInCandidate, query }: { signedInCandidate: boolean; query: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!signedInCandidate) {
    return <a className="btn-ghost" href={`/login?next=${encodeURIComponent(`/jobs?${query}`)}`}><BellPlus size={18} aria-hidden="true" />{t('alerts.createFromSearch')}</a>;
  }
  if (!open) return <button type="button" className="btn-ghost" onClick={() => setOpen(true)}><BellPlus size={18} aria-hidden="true" />{t('alerts.createFromSearch')}</button>;
  return (
    <form className="card flex w-full flex-col gap-2 sm:flex-row sm:items-end" onSubmit={async e => {
      e.preventDefault();
      const r = await api('/api/candidate/alerts', { name, frequency, filters: parseFilters(new URLSearchParams(query)) });
      setMsg(r.ok ? { ok: true, text: t('alerts.created') } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
      if (r.ok) setOpen(false);
    }}>
      <label className="flex-1"><span className="label">{t('alerts.name')}</span><input className="input" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder={t('alerts.namePlaceholder')} /></label>
      <label><span className="label">{t('alerts.frequency')}</span>
        <select className="input" value={frequency} onChange={e => setFrequency(e.target.value)}>
          {['instant', 'daily', 'weekly'].map(f => <option key={f} value={f}>{t(`alerts.freq_${f}`)}</option>)}
        </select></label>
      <button className="btn-primary">{t('common.save')}</button>
      {msg && <p role="status" className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}
    </form>
  );
}
