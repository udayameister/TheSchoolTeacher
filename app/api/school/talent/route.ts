import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { inviteTalent } from '@/lib/server/talent';
import { sendTalentInvite } from '@/lib/server/hiringEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** { candidateId, jobId, message? } — invites a discoverable candidate to apply. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin', 'school_staff'], limit: [200, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const r = await withDb(db => inviteTalent(db, g.user!, b));
  if (!r.invite || !r.candidate || !r.job) return fail(r.error || 'talent.errGeneric');
  await sendTalentInvite(r.candidate, r.invite, r.job);
  return json({ ok: true });
}
