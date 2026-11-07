import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { lookupOf } from '@/lib/server/catalog';
import { deleteDraft, duplicateJob, saveJob, setJobStatus } from '@/lib/server/jobPosting';
import { runJobAlerts } from '@/lib/server/alerts';
import { emailConfigured } from '@/lib/server/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STAFF = { roles: ['school_admin' as const, 'school_staff' as const], limit: [300, 60 * 60_000] as [number, number] };

/** Once email works, posting needs a confirmed account email (same rule as applying). */
const needsVerified = (u: { emailVerified: boolean }) => { const v = (process.env.REQUIRE_VERIFIED_EMAIL || 'auto').toLowerCase(); return !u.emailVerified && (v === 'on' || (v !== 'off' && emailConfigured())); };

/** Create or update a vacancy ({ id?, schoolId, ...fields, publish? }). */
export async function POST(req: NextRequest) {
  const g = await guard(req, STAFF);
  if (isResponse(g)) return g;
  const b = await readJson(req, 400_000);
  if (!b) return fail('Invalid request.');
  if (b.publish === true && needsVerified(g.user!)) return fail('post.errVerifyEmail');
  const r = await withDb(db => saveJob(db, g.user!, b, lookupOf(db)));
  if (!r.job) return fail(r.error || 'post.errGeneric');
  if (r.published) runJobAlerts({ only: ['instant'] }).catch(() => undefined);
  return json({ ok: true, id: r.job.id, status: r.job.status });
}

/** { id, action: "publish" | "close" | "reopen" | "duplicate" } */
export async function PATCH(req: NextRequest) {
  const g = await guard(req, STAFF);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || typeof b.id !== 'string') return fail('Invalid request.');
  const action = String(b.action);
  if ((action === 'publish' || action === 'reopen') && needsVerified(g.user!)) return fail('post.errVerifyEmail');
  const r = await withDb(db => action === 'duplicate' ? duplicateJob(db, g.user!, b.id as string)
    : action === 'close' ? setJobStatus(db, g.user!, b.id as string, 'closed')
      : action === 'publish' || action === 'reopen' ? setJobStatus(db, g.user!, b.id as string, 'published')
        : { error: 'Invalid request.' });
  if (!r.job) return fail(r.error || 'post.errGeneric');
  if (r.published) runJobAlerts({ only: ['instant'] }).catch(() => undefined);
  return json({ ok: true, id: r.job.id, status: r.job.status });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, STAFF);
  if (isResponse(g)) return g;
  const err = await withDb(db => deleteDraft(db, g.user!, req.nextUrl.searchParams.get('id') || ''));
  return err ? fail(err) : json({ ok: true });
}
