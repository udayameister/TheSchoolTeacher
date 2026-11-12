import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { audit, withDb } from '@/lib/server/db';
import { lookupOf } from '@/lib/server/catalog';
import { cleanProfile, completeness, emptyProfile } from '@/lib/server/profile';
import { mergeImport, type ApplyInput } from '@/lib/server/cvService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Adds the CV suggestions the candidate ticked to their profile. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'], limit: [30, 60 * 60_000] });
  if (isResponse(g)) return g;
  const me = g.user!;
  const b = await readJson<ApplyInput>(req, 200_000);
  if (!b) return fail('Invalid request.');
  const r = await withDb(db => {
    const prev = db.profiles[me.id] || emptyProfile(me.id);
    const { profile, error } = cleanProfile(mergeImport(prev, b), prev, lookupOf(db));
    if (!profile) return { error };
    profile.discoverable = prev.discoverable;
    db.profiles[me.id] = profile;
    audit(db, { actorId: me.id, action: 'profile.cv_import', target: me.id });
    return { completeness: completeness(profile, me, db.documents.filter(d => d.userId === me.id)) };
  });
  return r.error ? fail(r.error) : json({ ok: true, ...r });
}
