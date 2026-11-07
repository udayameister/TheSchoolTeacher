import type { NextRequest } from 'next/server';
import { guard, isResponse, json } from '@/lib/server/http';
import { revokeSessions } from '@/lib/server/auth';
import { ROLES } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Signs out every other device. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ROLES });
  if (isResponse(g)) return g;
  const n = await revokeSessions(g.user!.id, g.token);
  return json({ ok: true, signedOut: n });
}
