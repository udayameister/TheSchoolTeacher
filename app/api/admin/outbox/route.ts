import type { NextRequest } from 'next/server';
import { guard, isResponse, json } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { emailConfigured, retryDueMail } from '@/lib/server/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  const items = await withDb(db => db.outbox.slice(0, 200).map(o => ({ ...o, html: undefined })));
  return json({ ok: true, configured: emailConfigured(), items }, 200, { 'Cache-Control': 'no-store' });
}

/** Retries queued messages now (instead of waiting for their next attempt time). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  await withDb(db => { for (const o of db.outbox) if (o.status === 'queued') o.nextAttemptAt = 0; });
  const n = await retryDueMail(50);
  return json({ ok: true, retried: n });
}
