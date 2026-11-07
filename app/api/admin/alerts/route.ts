import type { NextRequest } from 'next/server';
import { guard, isResponse, json } from '@/lib/server/http';
import { runJobAlerts } from '@/lib/server/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Runs job alerts now, ignoring the daily/weekly schedule (each vacancy is still sent only once). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  return json({ ok: true, ...(await runJobAlerts({ force: true })) });
}
