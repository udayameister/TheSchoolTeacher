import { NextResponse, type NextRequest } from 'next/server';
import { withDb } from '@/lib/server/db';
import { getBlob } from '@/lib/server/persist';
import { currentUser } from '@/lib/server/http';
import { canManageSchool } from '@/lib/server/schools';
import { showDemo } from '@/lib/server/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** School photos are public once the school is verified (before that, only its own staff and the admin see them). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await currentUser();
  const photo = await withDb(db => {
    const s = db.schools.find(x => x.photos.some(p => p.id === id));
    if (!s) return null;
    const visible = (s.verification === 'verified' && (!s.demo || showDemo())) || canManageSchool(db, user, s.id);
    return visible ? { ...s.photos.find(p => p.id === id)!, public: s.verification === 'verified' } : null;
  });
  if (!photo) return new NextResponse('Not found', { status: 404 });
  const bytes = await getBlob(photo.blobId);
  if (!bytes) return new NextResponse('Not found', { status: 404 });
  void req;
  return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': photo.mime, 'Cache-Control': photo.public ? 'public, max-age=86400' : 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
