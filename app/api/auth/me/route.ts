import type { NextRequest } from 'next/server';
import { guard, isResponse, json } from '@/lib/server/http';
import { toPublicUser } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (isResponse(g)) return g;
  return json({ ok: true, user: g.user ? toPublicUser(g.user) : null }, 200, { 'Cache-Control': 'no-store' });
}
