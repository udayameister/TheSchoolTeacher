import { NextResponse, type NextRequest } from 'next/server';
import { clearSessionCookie, fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { audit, withDb } from '@/lib/server/db';
import { deleteBlobPrefix } from '@/lib/server/persist';
import { eraseAccount, exportData, setMatchingConsent } from '@/lib/server/privacy';
import { verifyPassword } from '@/lib/server/security';
import { ROLES } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Download my data (JSON file). */
export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ROLES, limit: [10, 60 * 60_000] });
  if (isResponse(g)) return g;
  const data = await withDb(db => { audit(db, { actorId: g.user!.id, action: 'privacy.export', target: g.user!.id }); return exportData(db, g.user!.id); });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="theschoolteacher-my-data-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' },
  });
}

/** { action: "matching", give: boolean } or { action: "delete", password?, confirm: "DELETE" }. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ROLES, limit: [20, 60 * 60_000] });
  if (isResponse(g)) return g;
  const me = g.user!;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  if (b.action === 'matching') {
    if (me.role !== 'candidate') return fail('Only for teacher accounts.');
    await withDb(db => setMatchingConsent(db, me, b.give === true));
    return json({ ok: true });
  }
  if (b.action === 'delete') {
    if (me.role === 'platform_admin') return fail('Administrator accounts are removed by another administrator.');
    if (b.confirm !== 'DELETE') return fail('privacy.errConfirm');
    if (me.passwordHash && !(await verifyPassword(String(b.password || ''), me.passwordHash))) return fail('privacy.errPassword');
    const blobs = await withDb(db => eraseAccount(db, me.id, me.id));
    for (const id of blobs) await deleteBlobPrefix(id).catch(() => undefined);
    const res = json({ ok: true });
    clearSessionCookie(res);
    return res;
  }
  return fail('Invalid request.');
}
