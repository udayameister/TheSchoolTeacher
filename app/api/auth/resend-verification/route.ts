import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json } from '@/lib/server/http';
import { createToken } from '@/lib/server/auth';
import { sendVerificationEmail } from '@/lib/server/authEmails';
import { allow } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate', 'school_admin', 'school_staff', 'platform_admin'] });
  if (isResponse(g)) return g;
  const me = g.user!;
  if (me.emailVerified) return json({ ok: true, already: true });
  if (!allow(`resend-verify:${me.id}`, 3, 60 * 60_000)) return fail('You asked for several emails already. Please check your inbox and spam folder, or try again in an hour.', 429);
  const token = await createToken(me.id, 'verify-email');
  const sent = await sendVerificationEmail(me.email, me.name, token);
  return json({ ok: true, delivered: sent.status === 'sent', logged: sent.status === 'logged' });
}
