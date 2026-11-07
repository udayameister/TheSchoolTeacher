import { NextResponse, type NextRequest } from 'next/server';
import { guard, isResponse, fail } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { getBlob } from '@/lib/server/persist';
import { canViewDocuments, checkDocSignature } from '@/lib/server/documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Serves a document: the signed link must be valid (15 minutes) AND the signed-in user must be allowed to see it. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const q = req.nextUrl.searchParams;
  if (!checkDocSignature(id, q.get('e'), q.get('s'))) return fail('This link has expired. Reload the page to get a new one.', 403);
  const g = await guard(req, { roles: ['candidate', 'school_admin', 'school_staff', 'platform_admin'] });
  if (isResponse(g)) return g;
  const doc = await withDb(db => {
    const d = db.documents.find(x => x.id === id);
    return d && canViewDocuments(db, g.user, d.userId) ? d : null;
  });
  if (!doc) return fail('Not found.', 404);
  const bytes = await getBlob(doc.blobId);
  if (!bytes) return fail('Not found.', 404);
  const inline = doc.mimeType !== 'application/pdf' || q.get('view') === '1';
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
