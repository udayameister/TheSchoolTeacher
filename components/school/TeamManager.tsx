'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import type { StaffInvite, StaffRole } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

const ROLES: StaffRole[] = ['principal', 'hr', 'coordinator', 'panel'];
interface Member { id: string; name: string; email: string; role: 'school_admin' | StaffRole; status: string; lastLoginAt?: string | null; self: boolean }

export default function TeamManager({ members, invites }: { members: Member[]; invites: Omit<StaffInvite, 'tokenDigest'>[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', staffRole: 'coordinator' as StaffRole });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : t('team.never');
  const err = (e?: string) => setMsg({ ok: false, text: e ? t(e) : t('common.somethingWrong') });

  async function act(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await api('/api/school/team', body);
    if (r.ok) { setMsg({ ok: true, text: t('common.saved') }); router.refresh(); } else err(r.error);
  }

  return (
    <div className="space-y-6">
      <section className="card" aria-labelledby="members-h">
        <h2 id="members-h" className="text-lg font-bold">{t('team.members')}</h2>
        <div className="relative mt-2 overflow-x-auto">
          <table className="table">
            <thead><tr><th scope="col">{t('common.name')}</th><th scope="col">{t('team.role')}</th><th scope="col">{t('team.lastSignIn')}</th><th scope="col"><span className="sr-only">{t('team.actions')}</span></th></tr></thead>
            <tbody>{members.map(m => (
              <tr key={m.id}>
                <td><span className="font-semibold">{m.name}</span>{m.self && <span className="text-ink-muted"> ({t('team.you')})</span>}<span className="block text-xs text-ink-muted">{m.email}</span></td>
                <td>{m.role === 'school_admin' ? t('team.role_school_admin') : (
                  <label><span className="sr-only">{t('team.role')} ({m.name})</span>
                    <select className="input min-h-[36px] py-1 text-sm" value={m.role} onChange={e => act({ action: 'role', id: m.id, staffRole: e.target.value })}>
                      {ROLES.map(r => <option key={r} value={r}>{t(`team.role_${r}`)}</option>)}
                    </select></label>
                )}</td>
                <td className="whitespace-nowrap text-sm">{fmt(m.lastLoginAt)}</td>
                <td>{m.role !== 'school_admin' && <button type="button" className="text-sm font-semibold text-danger-700 underline" onClick={() => act({ action: 'remove', id: m.id }, t('team.confirmRemove', { name: m.name }))}>{t('team.remove')}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-3" aria-labelledby="invite-h">
        <h2 id="invite-h" className="flex items-center gap-2 text-lg font-bold"><UserPlus size={20} aria-hidden="true" />{t('team.inviteTitle')}</h2>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={async e => {
          e.preventDefault();
          setBusy(true); setLink(null); setMsg(null);
          const r = await api<{ link: string; emailed: boolean }>('/api/school/team', { action: 'invite', ...form });
          setBusy(false);
          if (!r.ok) return err(r.error);
          setLink(r.link);
          setMsg({ ok: true, text: r.emailed ? t('team.invitedEmailed', { email: form.email }) : t('team.invitedNoEmail') });
          setForm({ name: '', email: '', staffRole: form.staffRole });
          router.refresh();
        }}>
          <label><span className="label">{t('common.name')}</span><input className="input" required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label><span className="label">{t('common.email')}</span><input className="input" type="email" required maxLength={254} autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <label><span className="label">{t('team.role')}</span>
            <select className="input" value={form.staffRole} onChange={e => setForm({ ...form, staffRole: e.target.value as StaffRole })}>{ROLES.map(r => <option key={r} value={r}>{t(`team.role_${r}`)}</option>)}</select></label>
          <div className="sm:col-span-3"><button className="btn-primary" disabled={busy}>{t('team.sendInvite')}</button></div>
        </form>
        <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>
        {link && (
          <div className="space-y-1">
            <label className="block"><span className="label">{t('team.inviteLink')}</span><input className="input text-sm" readOnly value={link} onFocus={e => e.target.select()} /></label>
            <button type="button" className="btn-ghost min-h-[36px] py-1 text-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg({ ok: true, text: t('team.copied') }))}><Copy size={16} aria-hidden="true" />{t('team.copyLink')}</button>
            <p className="hint">{t('team.linkHint')}</p>
          </div>
        )}
      </section>

      {invites.length > 0 && (
        <section className="card" aria-labelledby="pending-h">
          <h2 id="pending-h" className="text-lg font-bold">{t('team.pending')}</h2>
          <ul className="mt-2 divide-y divide-line">{invites.map(i => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><span className="font-semibold">{i.name}</span> · {i.email} · {t(`team.role_${i.staffRole}`)} · {t('team.expires', { date: fmt(i.expiresAt) })}</span>
              <button type="button" className="font-semibold text-danger-700 underline" onClick={() => act({ action: 'cancel', id: i.id })}>{t('team.cancelInvite')}</button>
            </li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
