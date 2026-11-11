import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { cancelInvite, changeStaffRole, inviteStaff, removeStaff } from '@/lib/server/team';
import { sendStaffInvite } from '@/lib/server/hiringEmails';
import { appUrl, emailConfigured } from '@/lib/server/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ADMIN = { roles: ['school_admin' as const], limit: [100, 60 * 60_000] as [number, number] };

/**
 * { action: "invite", email, name, staffRole } → also returns the join link, so the administrator can share it
 * themselves (e.g. on WhatsApp) while email is not set up. { action: "cancel", id } · { action: "role", id, staffRole } · { action: "remove", id }
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, ADMIN);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const id = String(b.id || '');
  if (b.action === 'invite') {
    const r = await withDb(db => {
      const out = inviteStaff(db, g.user!, b);
      return { ...out, school: db.schools.find(s => s.id === out.invite?.schoolId)?.name || '' };
    });
    if (!r.invite || !r.token) return fail(r.error || 'team.errGeneric');
    const mail = await sendStaffInvite(r.invite, r.token, g.user!, r.school);
    return json({ ok: true, link: `${appUrl()}/join?token=${encodeURIComponent(r.token)}`, emailed: emailConfigured() && mail.status === 'sent' });
  }
  const err = await withDb(db => b.action === 'cancel' ? cancelInvite(db, g.user!, id) : b.action === 'role' ? changeStaffRole(db, g.user!, id, b.staffRole) : b.action === 'remove' ? removeStaff(db, g.user!, id) : 'Invalid request.');
  return err ? fail(err) : json({ ok: true });
}
