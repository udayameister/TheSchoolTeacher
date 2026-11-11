import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { bookSlot, cancelBooking, setDemoVideo } from '@/lib/server/interviews';
import { sendBookingConfirmation } from '@/lib/server/hiringEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CANDIDATE = { roles: ['candidate' as const], limit: [120, 60 * 60_000] as [number, number] };

/** { action: "book", id, slotId } · { action: "cancel", id } · { action: "video", id, url } */
export async function POST(req: NextRequest) {
  const g = await guard(req, CANDIDATE);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const me = g.user!, id = String(b.id || '');
  if (b.action === 'book') {
    const r = await withDb(db => {
      const prev = db.interviews.find(i => i.id === id)?.slotId;
      const out = bookSlot(db, me, id, String(b.slotId || ''));
      return { ...out, changed: !!out.slot && out.slot.id !== prev, job: out.interview ? db.jobs.find(j => j.id === out.interview!.jobId) : undefined };
    });
    if (r.error || !r.interview || !r.slot) return fail(r.error || 'interviews.errGeneric');
    if (r.changed && r.job) await sendBookingConfirmation(me, r.interview, r.slot, r.job);
    return json({ ok: true });
  }
  const err = await withDb(db => b.action === 'cancel' ? cancelBooking(db, me, id) : b.action === 'video' ? setDemoVideo(db, me, id, b.url) : 'Invalid request.');
  return err ? fail(err) : json({ ok: true });
}
