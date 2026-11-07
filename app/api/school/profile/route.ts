import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { updateSchool } from '@/lib/server/schools';
import { lookupOf } from '@/lib/server/catalog';
import { createToken } from '@/lib/server/auth';
import { sendSchoolEmailConfirmation } from '@/lib/server/schoolEmails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin', 'platform_admin'], limit: [120, 60 * 60_000] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b || typeof b.schoolId !== 'string') return fail('Invalid request.');
  const before = await withDb(db => db.schools.find(s => s.id === b.schoolId)?.officialEmail ?? null);
  const r = await withDb(db => updateSchool(db, g.user!, b.schoolId as string, b, lookupOf(db)));
  if (!r.school) return fail(r.error || 'school.errGeneric');
  if (r.school.officialEmail && r.school.officialEmail !== before && r.school.officialEmail !== g.user!.email) {
    const token = await createToken(g.user!.id, 'verify-school-email', `${r.school.id}|${r.school.officialEmail}`);
    await sendSchoolEmailConfirmation(r.school.officialEmail, r.school, token, g.user!);
  }
  return json({ ok: true, resubmitted: !!r.resubmitted });
}
