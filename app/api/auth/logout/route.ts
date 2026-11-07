import type { NextRequest } from 'next/server';
import { clearSessionCookie, guard, isResponse, json } from '@/lib/server/http';
import { deleteSession } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (isResponse(g)) return g;
  await deleteSession(g.token);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
}
