import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { acceptInvite, findInvite } from '@/lib/server/team';
import { hashPassword, passwordProblem } from '@/lib/server/security';
import { completeSignIn } from '@/lib/server/signin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Accepts a team invitation: { token, name, password } for a new account, or { token } while signed in to a removed staff account. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { limit: [20, 15 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const token = String(b.token || '');
  let passwordHash: string | undefined;
  if (!g.user) {
    const email = await withDb(db => findInvite(db, token)?.email);
    if (!email) return fail('team.errInviteInvalid');
    const problem = passwordProblem(String(b.password || ''), email);
    if (problem) return fail(problem);
    passwordHash = await hashPassword(String(b.password));
  }
  const r = await withDb(db => acceptInvite(db, token, { name: String(b.name || ''), passwordHash, signedIn: g.user, ip: g.ip }));
  if (!r.user) return fail(r.error || 'team.errInviteInvalid');
  if (g.user?.id === r.user.id) return json({ ok: true, next: '/school' });
  return completeSignIn(req, r.user, 'invitation', { remember: true, next: '/school' });
}
