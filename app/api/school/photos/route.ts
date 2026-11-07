import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json } from '@/lib/server/http';
import { audit, newId, withDb } from '@/lib/server/db';
import { deleteBlobPrefix, putBlob } from '@/lib/server/persist';
import { canManageSchool } from '@/lib/server/schools';
import { EXT, sniff } from '@/lib/server/documents';
import { scanUpload } from '@/lib/server/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PHOTOS = 8;
const MAX_BYTES = 2 * 1024 * 1024;

/** Upload a photo for the public school page (JPG, PNG or WebP, up to 2 MB, up to 8 photos). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin', 'platform_admin'], form: true, limit: [60, 60 * 60_000] });
  if (isResponse(g)) return g;
  const form = await req.formData().catch(() => null);
  const schoolId = String(form?.get('schoolId') || '');
  const file = form?.get('file');
  if (!file || typeof file === 'string') return fail('school.errPhoto');
  if (file.size > MAX_BYTES) return fail('school.errPhotoSize');
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || mime === 'application/pdf') return fail('school.errPhoto');
  const scan = await scanUpload(bytes, mime);
  if (!scan.ok) return fail(scan.reason || 'school.errPhoto');
  const allowed = await withDb(db => canManageSchool(db, g.user, schoolId) && (db.schools.find(s => s.id === schoolId)?.photos.length ?? MAX_PHOTOS) < MAX_PHOTOS);
  if (!allowed) return fail('school.errPhotoLimit');
  const id = newId('ph');
  const blobId = `school-photos/${schoolId.replace(/[^A-Za-z0-9_-]/g, '')}/${id}.${EXT[mime]}`;
  await putBlob(blobId, mime, bytes);
  const photo = { id, blobId, mime, caption: String(form?.get('caption') || '').trim().slice(0, 120) || null };
  await withDb(db => { db.schools.find(s => s.id === schoolId)!.photos.push(photo); audit(db, { actorId: g.user!.id, action: 'school.photo_add', target: schoolId }); });
  return json({ ok: true, photo: { id, caption: photo.caption, url: `/api/schools/photo/${id}` } });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin', 'platform_admin'] });
  if (isResponse(g)) return g;
  const schoolId = req.nextUrl.searchParams.get('schoolId') || '';
  const id = req.nextUrl.searchParams.get('id') || '';
  const photo = await withDb(db => {
    if (!canManageSchool(db, g.user, schoolId)) return null;
    const s = db.schools.find(x => x.id === schoolId)!;
    const p = s.photos.find(x => x.id === id);
    if (p) s.photos = s.photos.filter(x => x !== p);
    return p || null;
  });
  if (!photo) return fail('school.errNotFound', 404);
  await deleteBlobPrefix(photo.blobId).catch(() => undefined);
  return json({ ok: true });
}
