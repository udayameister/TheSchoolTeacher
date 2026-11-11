import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { draftOffer, issueOffer, saveOfferSettings, withdrawOffer } from '@/lib/server/offers';
import { sendOfferIssued, sendOfferWithdrawn } from '@/lib/server/hiringEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STAFF = { roles: ['school_admin' as const, 'school_staff' as const], limit: [200, 60 * 60_000] as [number, number] };

/**
 * { action: "settings", template, signatoryName, signatoryDesignation } · { action: "preview" | "issue", applicationId, designation, pay, joiningDate, acceptBy, reportTo }
 * { action: "withdraw", id }
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, STAFF);
  if (isResponse(g)) return g;
  const b = await readJson(req, 60_000);
  if (!b) return fail('Invalid request.');
  const me = g.user!;
  if (b.action === 'settings') {
    const r = await withDb(db => saveOfferSettings(db, me, b));
    return r.error ? fail(r.error) : json({ ok: true, unknown: r.unknown || [] });
  }
  if (b.action === 'preview') {
    const r = await withDb(db => draftOffer(db, me, b));
    return r.letter ? json({ ok: true, letter: r.letter, signatory: r.fields?.signatory || null }) : fail(r.error || 'offers.errGeneric');
  }
  if (b.action === 'issue') {
    const r = await withDb(db => {
      const out = issueOffer(db, me, b);
      return { ...out, c: out.offer && db.users.find(u => u.id === out.offer!.candidateId), j: out.offer && db.jobs.find(j => j.id === out.offer!.jobId) };
    });
    if (!r.offer) return fail(r.error || 'offers.errGeneric');
    if (r.c && r.j) await sendOfferIssued(r.c, r.offer, r.j);
    return json({ ok: true, id: r.offer.id });
  }
  if (b.action === 'withdraw') {
    const r = await withDb(db => {
      const out = withdrawOffer(db, me, String(b.id || ''));
      return { ...out, c: out.offer && db.users.find(u => u.id === out.offer!.candidateId), j: out.offer && db.jobs.find(j => j.id === out.offer!.jobId) };
    });
    if (!r.offer) return fail(r.error || 'offers.errGeneric');
    if (r.c && r.j) await sendOfferWithdrawn(r.c, r.j);
    return json({ ok: true });
  }
  return fail('Invalid request.');
}
