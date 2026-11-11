import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { offerRecipients, respondOffer } from '@/lib/server/offers';
import { sendOfferResponse } from '@/lib/server/hiringEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** { id, accept: boolean, note? } */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'], limit: [30, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || typeof b.accept !== 'boolean') return fail('Invalid request.');
  const r = await withDb(db => {
    const out = respondOffer(db, g.user!, String(b.id || ''), b.accept as boolean, b.note);
    return { ...out, staff: out.offer ? offerRecipients(db, out.offer) : [], j: out.offer && db.jobs.find(j => j.id === out.offer!.jobId) };
  });
  if (!r.offer) return fail(r.error || 'offers.errGeneric');
  if (r.j) for (const s of r.staff) await sendOfferResponse(s, r.offer, g.user!.name, r.j);
  return json({ ok: true, status: r.offer.status });
}
