import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { createToken } from '@/lib/server/auth';
import { sendSchoolEmailConfirmation } from '@/lib/server/schoolEmails';
import { allow } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin'] });
  if (isResponse(g)) return g;
  const school = await withDb(db => currentSchool(db, g.user));
  if (!school?.officialEmail || school.officialEmailVerified) return fail('school.errNoEmailToVerify');
  if (!allow(`school-email:${school.id}`, 3, 60 * 60_000)) return fail('school.errTooMany', 429);
  const token = await createToken(g.user!.id, 'verify-school-email', `${school.id}|${school.officialEmail}`);
  await sendSchoolEmailConfirmation(school.officialEmail, school, token, g.user!);
  return json({ ok: true });
}
