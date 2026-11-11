'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { PanelMember, PanelRole } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

const ROLES: PanelRole[] = ['principal', 'coordinator', 'subject_expert', 'management_nominee', 'other'];

export default function PanelEditor({ jobId, team, initial }: { jobId: string; team: { id: string; name: string }[]; initial: PanelMember[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [members, setMembers] = useState<PanelMember[]>(initial);
  const [add, setAdd] = useState({ userId: '', role: 'subject_expert' as PanelRole });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const name = (id: string) => team.find(m => m.id === id)?.name || '—';
  const free = team.filter(m => !members.some(x => x.userId === m.id));
  return (
    <div className="space-y-3">
      {members.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {members.map((m, i) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-2 p-2">
              <span className="min-w-0 flex-1 font-semibold">{name(m.userId)}</span>
              <label><span className="sr-only">{t('panel.role')} ({name(m.userId)})</span>
                <select className="input min-h-[36px] py-1 text-sm" value={m.role} onChange={e => setMembers(members.map((x, j) => j === i ? { ...x, role: e.target.value as PanelRole } : x))}>
                  {ROLES.map(r => <option key={r} value={r}>{t(`panel.role_${r}`)}</option>)}
                </select></label>
              <button type="button" aria-label={`${t('team.remove')} ${name(m.userId)}`} className="rounded p-2 text-danger-700 hover:bg-danger-50" onClick={() => setMembers(members.filter((_, j) => j !== i))}><Trash2 size={18} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ink-soft">{t('panel.empty')}</p>}
      {free.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1"><span className="label">{t('panel.addMember')}</span>
            <select className="input" value={add.userId} onChange={e => setAdd({ ...add, userId: e.target.value })}><option value="">—</option>{free.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label><span className="label">{t('panel.role')}</span>
            <select className="input" value={add.role} onChange={e => setAdd({ ...add, role: e.target.value as PanelRole })}>{ROLES.map(r => <option key={r} value={r}>{t(`panel.role_${r}`)}</option>)}</select></label>
          <button type="button" className="btn-ghost" disabled={!add.userId} onClick={() => { setMembers([...members, add]); setAdd({ ...add, userId: '' }); }}>{t('panel.add')}</button>
        </div>
      )}
      <p className="hint">{t('panel.teamHint')}</p>
      <button type="button" className="btn-primary" onClick={async () => {
        const r = await api('/api/school/panel', { action: 'panel', jobId, members });
        setMsg(r.ok ? { ok: true, text: t('common.saved') } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
        if (r.ok) router.refresh();
      }}>{t('panel.save')}</button>
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
    </div>
  );
}
