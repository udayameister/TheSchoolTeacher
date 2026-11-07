import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { canManageSchool } from '@/lib/server/schools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A group administrator switches the branch they are working on. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin'] });
  if (isResponse(g)) return g;
  const b = await readJson(req);
  const ok = await withDb(db => {
    if (typeof b?.schoolId !== 'string' || !canManageSchool(db, g.user, b.schoolId)) return false;
    db.users.find(u => u.id === g.user!.id)!.schoolId = b.schoolId;
    return true;
  });
  return ok ? json({ ok: true }) : fail('school.errNotFound', 404);
}
