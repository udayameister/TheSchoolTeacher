import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { applyToJob } from '@/lib/server/applications';
import { emailConfigured } from '@/lib/server/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Applying needs a confirmed email once email works (REQUIRE_VERIFIED_EMAIL=on|off overrides). */
const requireVerified = () => { const v = (process.env.REQUIRE_VERIFIED_EMAIL || 'auto').toLowerCase(); return v === 'on' || (v !== 'off' && emailConfigured()); };

export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'], limit: [60, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || typeof b.jobId !== 'string') return fail('Invalid request.');
  const r = await withDb(db => applyToJob(db, g.user!, b.jobId as string, b.answers, { requireVerifiedEmail: requireVerified() }));
  return r.ok ? json({ ok: true, applicationId: r.application.id }) : fail(r.error, 400);
}
