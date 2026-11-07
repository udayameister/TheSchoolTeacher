'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export function EmailPreferences({ unsubscribed, candidate }: { unsubscribed: string[]; candidate: boolean }) {
  const { t } = useI18n();
  const [off, setOff] = useState(new Set(unsubscribed));
  const lists = candidate ? ['alerts', 'digest', 'news'] : ['news'];
  return (
    <ul className="space-y-2">
      {lists.map(l => (
        <li key={l}><label className="flex gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={!off.has(l)} onChange={async e => {
          const on = e.target.checked;
          const r = await api('/api/account/notifications', { list: l, on });
          if (r.ok) setOff(prev => { const n = new Set(prev); if (on) n.delete(l); else n.add(l); return n; });
        }} /><span><span className="font-semibold">{t(`privacy.list_${l}`)}</span><span className="block text-sm text-ink-soft">{t(`privacy.list_${l}_hint`)}</span></span></label></li>
      ))}
      <li className="hint">{t('privacy.securityAlways')}</li>
    </ul>
  );
}

export function PrivacyTools({ matching, hasPassword, candidate }: { matching: boolean; hasPassword: boolean; candidate: boolean }) {
  const { t } = useI18n();
  const [consent, setConsent] = useState(matching);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold">{t('privacy.downloadTitle')}</h3>
        <p className="text-sm text-ink-soft">{t('privacy.downloadText')}</p>
        <a href="/api/account/privacy" className="btn-ghost mt-2"><Download size={18} aria-hidden="true" />{t('privacy.download')}</a>
      </div>
      {candidate && (
        <div>
          <h3 className="font-bold">{t('privacy.matchingTitle')}</h3>
          <p className="text-sm text-ink-soft">{t('privacy.matchingText')}</p>
          <p className="mt-1 text-sm">{consent ? t('privacy.matchingOn') : t('privacy.matchingOff')}</p>
          <button type="button" className="btn-ghost mt-2" onClick={async () => {
            const r = await api('/api/account/privacy', { action: 'matching', give: !consent });
            if (r.ok) setConsent(!consent);
          }}>{consent ? t('privacy.withdraw') : t('privacy.give')}</button>
        </div>
      )}
      <div>
        <h3 className="font-bold text-danger-700">{t('privacy.deleteTitle')}</h3>
        <p className="text-sm text-ink-soft">{t('privacy.deleteText')}</p>
        {!showDelete ? <button type="button" className="btn-ghost mt-2 text-danger-700" onClick={() => setShowDelete(true)}>{t('privacy.deleteStart')}</button> : (
          <form className="mt-3 space-y-3 rounded-lg border border-danger-600/30 bg-danger-50 p-3" onSubmit={async e => {
            e.preventDefault();
            const r = await api('/api/account/privacy', { action: 'delete', password, confirm });
            if (r.ok) { window.location.href = '/?deleted=1'; return; }
            setMsg({ ok: false, text: r.error && r.error !== 'network' ? t(r.error) : t('common.somethingWrong') });
          }}>
            {hasPassword && <label className="block"><span className="label">{t('account.currentPassword')}</span><input type="password" className="input" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
            <label className="block"><span className="label">{t('privacy.typeDelete')}</span><input className="input" required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" /></label>
            {msg && <p role="alert" className="alert-error">{msg.text}</p>}
            <div className="flex gap-2"><button className="btn-danger" disabled={confirm !== 'DELETE'}>{t('privacy.deleteForever')}</button><button type="button" className="btn-ghost" onClick={() => setShowDelete(false)}>{t('common.cancel')}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
