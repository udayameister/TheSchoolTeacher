import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { createToken, findByEmail, normEmail } from '@/lib/server/auth';
import { sendResetEmail } from '@/lib/server/authEmails';
import { withDb } from '@/lib/server/db';
import { allow } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Always gives the same answer, so it cannot be used to find out who has an account. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { limit: [10, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const email = normEmail(b.email);
  if (email && allow(`forgot:${email}`, 3, 60 * 60_000)) {
    const user = await withDb(db => findByEmail(db, email));
    if (user && user.status === 'active') {
      const token = await createToken(user.id, 'reset-password');
      await sendResetEmail(user.email, user.name, token);
    }
  }
  return json({ ok: true });
}
