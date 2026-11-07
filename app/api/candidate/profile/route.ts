import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { audit, withDb } from '@/lib/server/db';
import { lookupOf } from '@/lib/server/catalog';
import { cleanProfile, completeness, emptyProfile } from '@/lib/server/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'] });
  if (isResponse(g)) return g;
  const me = g.user!;
  const r = await withDb(db => {
    const p = db.profiles[me.id] || emptyProfile(me.id);
    return { profile: p, completeness: completeness(p, me, db.documents.filter(d => d.userId === me.id)) };
  });
  return json({ ok: true, ...r }, 200, { 'Cache-Control': 'no-store' });
}

/** Saves the whole profile (the browser sends every section; the server cleans and validates it). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'], limit: [120, 60 * 60_000] });
  if (isResponse(g)) return g;
  const me = g.user!;
  const b = await readJson(req, 300_000);
  if (!b) return fail('Invalid request.');
  const r = await withDb(db => {
    const prev = db.profiles[me.id] || emptyProfile(me.id);
    const { profile, error } = cleanProfile(b, prev, lookupOf(db));
    if (!profile) return { error };
    // Talent search needs matching consent: the toggle cannot be on while matching is withdrawn.
    const matching = me.consents.some(c => c.purpose === 'matching' && !c.withdrawnAt);
    if (profile.discoverable && !matching) profile.discoverable = false;
    db.profiles[me.id] = profile;
    const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    const u = db.users.find(x => x.id === me.id);
    if (u && name.length >= 2) u.name = name;
    if (prev.discoverable !== profile.discoverable) audit(db, { actorId: me.id, action: profile.discoverable ? 'profile.discoverable_on' : 'profile.discoverable_off', target: me.id });
    if (!prev.childSafety.selfDeclarationAt && profile.childSafety.selfDeclarationAt) audit(db, { actorId: me.id, action: 'profile.child_safety_declaration', target: me.id });
    return { profile, completeness: completeness(profile, me, db.documents.filter(d => d.userId === me.id)) };
  });
  return r.error ? fail(r.error) : json({ ok: true, ...r });
}
