import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json, readJson } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { bulkStatus, deleteSource, runSource, saveSource, setItemStatus, setSourceActive } from '@/lib/server/importer';
import { SUGGESTED_SOURCES } from '@/lib/importSuggestions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const ADMIN = { roles: ['platform_admin' as const], limit: [300, 60 * 60_000] as [number, number] };

/**
 * { action: "saveSource", …fields } · { action: "toggle", id, active } · { action: "deleteSource", id } · { action: "run", id }
 * { action: "suggest", index } · { action: "item", id, status } · { action: "bulk", ids, status }
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, ADMIN);
  if (isResponse(g)) return g;
  const b = await readJson(req);
  if (!b) return fail('Invalid request.');
  const me = g.user!;
  switch (b.action) {
    case 'saveSource': { const r = await withDb(db => saveSource(db, me, b)); return r.source ? json({ ok: true, id: r.source.id }) : fail(r.error || 'Could not save.'); }
    case 'suggest': {
      const s = SUGGESTED_SOURCES[Number(b.index)];
      if (!s) return fail('Unknown suggestion.');
      const r = await withDb(db => {
        const out = saveSource(db, me, { ...s, stateId: s.stateCode ? `states:${s.stateCode}` : null, everyHours: 24, active: false });
        if (out.source) out.source.verify = true;
        return out;
      });
      return r.source ? json({ ok: true, id: r.source.id }) : fail(r.error || 'Could not add.');
    }
    case 'toggle': { const e = await withDb(db => setSourceActive(db, me, String(b.id || ''), b.active === true)); return e ? fail(e) : json({ ok: true }); }
    case 'deleteSource': { const e = await withDb(db => deleteSource(db, me, String(b.id || ''))); return e ? fail(e) : json({ ok: true }); }
    case 'run': { const r = await runSource(String(b.id || ''), me.id); return json({ ok: r.status === 'ok', ...r, error: r.error }); }
    case 'item': {
      const status = b.status === 'rejected' || b.status === 'duplicate' || b.status === 'new' ? b.status : null;
      if (!status) return fail('Invalid status.');
      const e = await withDb(db => setItemStatus(db, me, String(b.id || ''), status));
      return e ? fail(e) : json({ ok: true });
    }
    case 'bulk': {
      const status = b.status === 'rejected' || b.status === 'duplicate' ? b.status : null;
      if (!status) return fail('Invalid status.');
      const n = await withDb(db => bulkStatus(db, me, b.ids, status));
      return json({ ok: true, changed: n });
    }
  }
  return fail('Invalid request.');
}
