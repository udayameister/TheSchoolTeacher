'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function OfferSettings({ template, defaultTemplate, fields, signatory }: { template: string; defaultTemplate: string; fields: string[]; signatory: { name: string; designation: string } | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [tpl, setTpl] = useState(template || defaultTemplate);
  const [name, setName] = useState(signatory?.name || '');
  const [designation, setDesignation] = useState(signatory?.designation || '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="card space-y-3" aria-labelledby="ot-h" onSubmit={async e => {
      e.preventDefault();
      const r = await api<{ unknown: string[] }>('/api/school/offers', { action: 'settings', template: tpl.trim() === defaultTemplate.trim() ? '' : tpl, signatoryName: name, signatoryDesignation: designation });
      setMsg(r.ok ? { ok: true, text: r.unknown?.length ? t('offers.savedUnknown', { list: r.unknown.map(x => `{${x}}`).join(', ') }) : t('common.saved') } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
      if (r.ok) router.refresh();
    }}>
      <h2 id="ot-h" className="text-lg font-bold">{t('offers.settingsTitle')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">{t('offers.signatoryName')}</span><input className="input" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
        <label><span className="label">{t('offers.signatoryDesignation')}</span><input className="input" required maxLength={120} placeholder={t('offers.signatoryHint')} value={designation} onChange={e => setDesignation(e.target.value)} /></label>
      </div>
      <label className="block"><span className="label">{t('offers.template')}</span>
        <textarea className="input min-h-[320px] font-mono text-sm" maxLength={8000} value={tpl} onChange={e => setTpl(e.target.value)} /></label>
      <p className="hint">{t('offers.fieldsHint')} {fields.map(f => <code key={f} className="mr-1 rounded bg-ivory px-1">{`{${f}}`}</code>)}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary">{t('common.save')}</button>
        <button type="button" className="btn-ghost" onClick={() => setTpl(defaultTemplate)}>{t('offers.useDefault')}</button>
      </div>
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
    </form>
  );
}
