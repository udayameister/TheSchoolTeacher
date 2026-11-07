import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { addNote, moveStage } from '@/lib/server/pipeline';
import { sendStageEmail } from '@/lib/server/schoolEmails';
import type { Stage } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STAFF = { roles: ['school_admin' as const, 'school_staff' as const], limit: [600, 60 * 60_000] as [number, number] };

/** { action: "stage", ids: string[], stage, note? } or { action: "note", id, text } */
export async function POST(req: NextRequest) {
  const g = await guard(req, STAFF);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  if (b.action === 'note') {
    const r = await withDb(db => addNote(db, g.user!, String(b.id || ''), String(b.text || '')));
    return r.note ? json({ ok: true, note: r.note }) : fail(r.error || 'ats.errGeneric');
  }
  if (b.action === 'stage') {
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const r = await withDb(db => moveStage(db, g.user!, ids, b.stage as Stage, typeof b.note === 'string' ? b.note : null));
    if (r.error) return fail(r.error);
    for (const c of r.changed) await sendStageEmail(c.candidate, c.app, c.job);
    return json({ ok: true, moved: r.moved });
  }
  return fail('Invalid request.');
}
