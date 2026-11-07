import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { audit, withDb } from '@/lib/server/db';
import { toPublicUser } from '@/lib/server/auth';
import { maskIp } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  const role = req.nextUrl.searchParams.get('role');
  const users = await withDb(db => db.users
    .filter(u => (!q || u.email.includes(q) || u.name.toLowerCase().includes(q)) && (!role || u.role === role))
    .slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200).map(toPublicUser));
  return json({ ok: true, users }, 200, { 'Cache-Control': 'no-store' });
}

/** Suspend / reactivate an account. Suspending also signs it out everywhere. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || typeof b.id !== 'string' || !['suspend', 'activate'].includes(String(b.action))) return fail('Invalid request.');
  if (b.id === g.user!.id) return fail('You cannot suspend your own account.');
  const r = await withDb(db => {
    const u = db.users.find(x => x.id === b.id);
    if (!u) return 'Account not found.';
    if (u.role === 'platform_admin' && b.action === 'suspend' && db.users.filter(x => x.role === 'platform_admin' && x.status === 'active').length <= 1) return 'The last administrator cannot be suspended.';
    u.status = b.action === 'suspend' ? 'suspended' : 'active';
    if (u.status === 'suspended') for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k];
    audit(db, { actorId: g.user!.id, action: `admin.user_${b.action}`, target: u.id, detail: typeof b.reason === 'string' ? b.reason.slice(0, 300) : null, ip: maskIp(g.ip) });
    return null;
  });
  return r ? fail(r) : json({ ok: true });
}
