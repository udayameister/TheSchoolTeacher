import type { NextRequest } from 'next/server';
import { fail, json } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { listMaster } from '@/lib/server/masterData';
import { isMasterKind } from '@/lib/masterData/kinds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Active master-data items for forms and filters (public; prices are internal, so school categories are not served here). */
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind');
  if (!isMasterKind(kind) || kind === 'schoolCategories') return fail('Unknown list.', 404);
  const parent = req.nextUrl.searchParams.get('parent');
  const items = await withDb(db => listMaster(db, kind).filter(i => !parent || i.parentId === parent)
    .map(i => ({ id: i.id, code: i.code, name: i.name, nameHi: i.nameHi, parentId: i.parentId, meta: i.meta })));
  return json({ ok: true, items }, 200, { 'Cache-Control': 'public, max-age=300' });
}
