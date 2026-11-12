import type { NextRequest } from 'next/server';
import { guard, isResponse, json } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { isBotAgent, recordVisit, visitStats } from '@/lib/server/visits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  return json(await withDb(db => visitStats(db)), 200, NO_STORE);
}

/** Counts one visit (the browser calls this at most once per 30 minutes). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { limit: [12, 60 * 60_000] });
  if (isResponse(g)) return json(await withDb(db => visitStats(db)), 200, NO_STORE);
  const bot = isBotAgent(req.headers.get('user-agent'));
  return json(await withDb(db => { if (!bot) recordVisit(db); return visitStats(db); }), 200, NO_STORE);
}
