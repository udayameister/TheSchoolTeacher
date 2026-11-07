import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { reviewSchool } from '@/lib/server/schools';
import { sendVerificationDecision } from '@/lib/server/schoolEmails';
import { runJobAlerts } from '@/lib/server/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Verify, reject (with a reason) or send a school back to pending. The school's administrators are emailed. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  const decision = b?.decision;
  if (!b || typeof b.schoolId !== 'string' || !['verified', 'rejected', 'pending'].includes(String(decision))) return fail('Invalid request.');
  const r = await withDb(db => {
    const res = reviewSchool(db, g.user!, b.schoolId as string, decision as 'verified' | 'rejected' | 'pending', String(b.note || ''));
    if (!res.school) return res;
    const admins = db.users.filter(u => u.role === 'school_admin' && (u.schoolId === res.school!.id || u.id === res.school!.createdBy || (!!res.school!.groupId && u.groupId === res.school!.groupId)));
    return { ...res, admins };
  });
  if (!r.school) return fail(r.error || 'Failed.');
  if (decision !== 'pending') for (const u of (r as { admins: Parameters<typeof sendVerificationDecision>[0][] }).admins) await sendVerificationDecision(u, r.school);
  // Published vacancies of a newly verified school become public: tell instant job alerts.
  if (decision === 'verified') runJobAlerts({ only: ['instant'] }).catch(() => undefined);
  return json({ ok: true });
}
