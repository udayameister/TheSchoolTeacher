import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { createSlots, deleteSlot, inviteToInterview, setOutcome } from '@/lib/server/interviews';
import { sendInterviewInvite, sendSlotCancelled } from '@/lib/server/hiringEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STAFF = { roles: ['school_admin' as const, 'school_staff' as const], limit: [300, 60 * 60_000] as [number, number] };

/**
 * { action: "slots", jobId, kind, date, times[], durationMin, mode, location, capacity }
 * { action: "deleteSlot", id } · { action: "invite", ids[], kind, demoTopic?, demoClass?, message? } · { action: "outcome", id, status }
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, STAFF);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const me = g.user!;
  if (b.action === 'slots') {
    const r = await withDb(db => createSlots(db, me, b));
    return r.slots ? json({ ok: true, created: r.slots.length }) : fail(r.error || 'interviews.errGeneric');
  }
  if (b.action === 'deleteSlot') {
    const r = await withDb(db => {
      const out = deleteSlot(db, me, String(b.id || ''));
      return { ...out, mail: (out.affected || []).map(i => ({ i, c: db.users.find(u => u.id === i.candidateId), j: db.jobs.find(j => j.id === i.jobId) })) };
    });
    if (r.error) return fail(r.error);
    for (const m of r.mail) if (m.c && m.j) await sendSlotCancelled(m.c, m.i, m.j);
    return json({ ok: true, affected: r.mail.length });
  }
  if (b.action === 'invite') {
    const r = await withDb(db => {
      const out = inviteToInterview(db, me, b);
      return { ...out, mail: out.created.map(i => ({ i, c: db.users.find(u => u.id === i.candidateId), j: db.jobs.find(j => j.id === i.jobId) })) };
    });
    if (r.error) return fail(r.error);
    for (const m of r.mail) if (m.c && m.j) await sendInterviewInvite(m.c, m.i, m.j);
    return json({ ok: true, created: r.created.length, skipped: r.skipped });
  }
  if (b.action === 'outcome') {
    const r = await withDb(db => setOutcome(db, me, String(b.id || ''), b.status));
    return r.interview ? json({ ok: true }) : fail(r.error || 'interviews.errGeneric');
  }
  return fail('Invalid request.');
}
