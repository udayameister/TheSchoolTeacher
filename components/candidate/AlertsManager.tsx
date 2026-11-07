'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { AlertFrequency, JobAlert } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';
import { filtersToQuery } from '@/lib/jobs/filters';

type Row = JobAlert & { summary: string };

export default function AlertsManager({ initial, max, emailOff }: { initial: Row[]; max: number; emailOff: boolean }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(a: Row, patch: Partial<JobAlert>) {
    const next = { ...a, ...patch };
    setRows(prev => prev.map(r => (r.id === a.id ? next : r)));
    const r = await api('/api/candidate/alerts', { id: a.id, name: next.name, filters: next.filters, frequency: next.frequency, active: next.active });
    setMsg(r.ok ? null : r.error ? t(r.error) : t('common.somethingWrong'));
  }

  return (
    <div className="space-y-4">
      {emailOff && <p className="alert-error">{t('alerts.emailOff')} <Link href="/account#email">{t('alerts.turnOn')}</Link></p>}
      {msg && <p role="alert" className="alert-error">{msg}</p>}
      <p className="text-sm text-ink-soft">{t('alerts.howTo', { max })} <Link href="/jobs">{t('home.searchButton')}</Link></p>
      {!rows.length ? <p className="card text-ink-soft">{t('alerts.none')}</p> : (
        <ul className="space-y-3">
          {rows.map(a => (
            <li key={a.id} className="card space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-bold">{a.name}</h2>
                  <p className="text-sm text-ink-soft">{a.summary}</p>
                  {a.lastSentAt && <p className="text-xs text-ink-muted">{t('alerts.lastSent', { date: a.lastSentAt.slice(0, 10), n: a.lastSentCount ?? 0 })}</p>}
                </div>
                <Link href={`/jobs?${filtersToQuery(a.filters)}`} className="text-sm font-semibold">{t('alerts.openSearch')}</Link>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm"><span>{t('alerts.frequency')}</span>
                  <select className="input w-auto" value={a.frequency} onChange={e => save(a, { frequency: e.target.value as AlertFrequency })}>
                    {(['instant', 'daily', 'weekly'] as const).map(f => <option key={f} value={f}>{t(`alerts.freq_${f}`)}</option>)}
                  </select></label>
                <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={a.active} onChange={e => save(a, { active: e.target.checked })} />{t('alerts.active')}</label>
                <button type="button" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-danger-700" onClick={async () => {
                  if (!window.confirm(t('alerts.confirmDelete', { name: a.name }))) return;
                  const r = await api(`/api/candidate/alerts?id=${encodeURIComponent(a.id)}`, undefined, 'DELETE');
                  if (r.ok) setRows(prev => prev.filter(x => x.id !== a.id));
                }}><Trash2 size={16} aria-hidden="true" />{t('profile.remove')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
