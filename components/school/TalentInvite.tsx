'use client';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function TalentInvite({ candidateId, name, jobs, invitedCount }: { candidateId: string; name: string; jobs: { id: string; title: string }[]; invitedCount: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState(jobs[0]?.id || '');
  const [message, setMessage] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const left = jobs.filter(j => !done.includes(j.id));
  return (
    <div className="space-y-2 border-t border-line pt-2">
      {invitedCount + done.length > 0 && <p className="text-xs text-ink-muted">{t('talent.invitedCount', { n: invitedCount + done.length })}</p>}
      {left.length > 0 && !open && <button type="button" className="btn-ghost min-h-[40px] py-1" onClick={() => { setOpen(true); setJobId(left[0].id); }}><Send size={16} aria-hidden="true" />{t('talent.invite')}</button>}
      {open && left.length > 0 && (
        <form className="space-y-2" onSubmit={async e => {
          e.preventDefault();
          const r = await api('/api/school/talent', { candidateId, jobId, message });
          setMsg(r.ok ? { ok: true, text: t('talent.invited', { name }) } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
          if (r.ok) { setDone([...done, jobId]); setOpen(false); setMessage(''); }
        }}>
          <label className="block"><span className="label">{t('talent.forVacancy')}</span>
            <select className="input" value={jobId} onChange={e => setJobId(e.target.value)}>{left.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></label>
          <label className="block"><span className="label">{t('talent.message')}</span><textarea className="input min-h-[60px]" maxLength={600} value={message} onChange={e => setMessage(e.target.value)} /></label>
          <div className="flex gap-2"><button className="btn-primary">{t('talent.send')}</button><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button></div>
        </form>
      )}
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
    </div>
  );
}
