'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { inr } from '@/lib/jobs/display';

/**
 * Gross monthly pay = basic + DA + HRA + transport allowance. Rates change with government orders, so the
 * reader enters them (the page links nowhere it cannot verify); deductions are left out on purpose.
 */
export default function PayEstimator({ levels, start }: { levels: { id: string; label: string; basic: number }[]; start?: string }) {
  const { t } = useI18n();
  const first = levels.find(l => l.id === start) || levels[0];
  const [levelId, setLevelId] = useState(first?.id || '');
  const [basic, setBasic] = useState<number | ''>(first?.basic || '');
  const [da, setDa] = useState<number | ''>('');
  const [hra, setHra] = useState<number | ''>('');
  const [ta, setTa] = useState<number | ''>('');
  const b = Number(basic) || 0;
  const daAmt = Math.round(b * (Number(da) || 0) / 100);
  const hraAmt = Math.round(b * (Number(hra) || 0) / 100);
  const taAmt = Math.round(Number(ta) || 0);
  const num = (id: string, label: string, v: number | '', on: (v: number | '') => void, hint?: string, max = 1_000_000) => (
    <div><label htmlFor={id} className="label">{label}</label><input id={id} className="input" type="number" inputMode="decimal" min={0} max={max} value={v} onChange={e => on(e.target.value === '' ? '' : Number(e.target.value))} />{hint && <p className="hint">{hint}</p>}</div>
  );
  return (
    <div className="card grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><label htmlFor="pe-level" className="label">{t('career.payLevel')}</label>
        <select id="pe-level" className="input" value={levelId} onChange={e => { setLevelId(e.target.value); const l = levels.find(x => x.id === e.target.value); if (l) setBasic(l.basic); }}>
          {levels.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}<option value="">{t('career.customBasic')}</option>
        </select></div>
      {num('pe-basic', t('career.basic'), basic, setBasic)}
      {num('pe-da', t('career.daPercent'), da, setDa, t('career.daHint'), 300)}
      {num('pe-hra', t('career.hraPercent'), hra, setHra, t('career.hraHint'), 50)}
      {num('pe-ta', t('career.ta'), ta, setTa, t('career.taHint'))}
      <dl className="rounded-lg bg-brand-50 p-4 sm:col-span-2">
        <div className="flex justify-between"><dt>{t('career.basic')}</dt><dd>{inr(b)}</dd></div>
        <div className="flex justify-between"><dt>DA</dt><dd>{inr(daAmt)}</dd></div>
        <div className="flex justify-between"><dt>HRA</dt><dd>{inr(hraAmt)}</dd></div>
        <div className="flex justify-between"><dt>{t('career.taShort')}</dt><dd>{inr(taAmt)}</dd></div>
        <div className="mt-2 flex justify-between border-t border-brand-200 pt-2 text-lg font-bold"><dt>{t('career.gross')}</dt><dd>{inr(b + daAmt + hraAmt + taAmt)}</dd></div>
      </dl>
      <p className="hint sm:col-span-2">{t('career.estimatorNote')}</p>
    </div>
  );
}
