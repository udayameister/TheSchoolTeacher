'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@/types';
import { api } from '@/lib/clientApi';

const ROLE_LABEL: Record<string, string> = { candidate: 'Teacher', school_admin: 'School admin', school_staff: 'School staff', platform_admin: 'Administrator' };

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ users: PublicUser[] }>(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`);
    setUsers(r.ok ? r.users : []);
  }, [q, role]);
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  async function act(u: PublicUser, action: 'suspend' | 'activate') {
    const reason = action === 'suspend' ? window.prompt(`Reason for suspending ${u.email} (kept in the audit log):`) : '';
    if (action === 'suspend' && reason === null) return;
    const r = await api('/api/admin/users', { id: u.id, action, reason });
    setMsg(r.ok ? { ok: true, text: `${u.email} ${action === 'suspend' ? 'suspended and signed out' : 'reactivated'}.` } : { ok: false, text: r.error || 'Failed.' });
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      {msg && <p role="status" className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="min-w-[220px] flex-1"><span className="sr-only">Search</span><input className="input" type="search" placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label><span className="sr-only">Role</span><select className="input" value={role} onChange={e => setRole(e.target.value)}><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      {users === null ? <p>Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="table">
            <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="font-semibold">{u.name}</td>
                  <td>{u.email} {!u.emailVerified && <span className="badge border-marigold-400 bg-marigold-50 text-marigold-800">unconfirmed</span>}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td className="whitespace-nowrap">{u.createdAt.slice(0, 10)}</td>
                  <td>{u.status === 'active' ? 'Active' : <span className="badge border-danger-600/30 bg-danger-50 text-danger-700">Suspended</span>}</td>
                  <td>{u.status === 'active'
                    ? <button type="button" className="font-semibold text-danger-700 underline" onClick={() => act(u, 'suspend')}>Suspend</button>
                    : <button type="button" className="font-semibold text-brand-700 underline" onClick={() => act(u, 'activate')}>Reactivate</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && <p className="p-3 text-ink-soft">No accounts found.</p>}
        </div>
      )}
      <p className="hint">Read-only impersonation, linking staff to schools and the data-rights desk arrive with the school and candidate modules.</p>
    </div>
  );
}
