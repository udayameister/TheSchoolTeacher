import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { registerSchool } from '@/lib/server/schools';
import { lookupOf } from '@/lib/server/catalog';
import { cleanUdise, lookupUdise, sameSchoolName } from '@/lib/server/udise';
import { createToken } from '@/lib/server/auth';
import { sendSchoolEmailConfirmation } from '@/lib/server/schoolEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Registers the school (or a new branch). It stays pending until the platform administrator verifies it. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin'], limit: [20, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const dir = await lookupUdise(cleanUdise(b.udiseCode));
  const directoryName = dir && sameSchoolName(dir.name, String(b.name || '')) ? dir.name : null;
  const r = await withDb(db => registerSchool(db, g.user!, b, lookupOf(db), directoryName));
  if (!r.school) return fail(r.error || 'school.errGeneric');
  // Confirm the official email address when it differs from the account's address.
  if (r.school.officialEmail && r.school.officialEmail !== g.user!.email) {
    const token = await createToken(g.user!.id, 'verify-school-email', `${r.school.id}|${r.school.officialEmail}`);
    await sendSchoolEmailConfirmation(r.school.officialEmail, r.school, token, g.user!);
  } else if (r.school.officialEmail && g.user!.emailVerified) {
    await withDb(db => { const s = db.schools.find(x => x.id === r.school!.id); if (s) s.officialEmailVerified = true; });
  }
  return json({ ok: true, schoolId: r.school.id });
}
