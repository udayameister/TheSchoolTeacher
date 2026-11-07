import path from 'path';
import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json } from '@/lib/server/http';
import { audit, newId, nowIso, withDb } from '@/lib/server/db';
import { deleteBlobPrefix, putBlob } from '@/lib/server/persist';
import { DOC_CATEGORIES, MAX_DOCS_PER_USER, MAX_FILE_BYTES, MAX_PHOTO_BYTES, blobIdFor, docView, sniff } from '@/lib/server/documents';
import { scanUpload } from '@/lib/server/scan';
import type { DocumentCategory, StoredDocument } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANDIDATE = { roles: ['candidate' as const] };

export async function GET(req: NextRequest) {
  const g = await guard(req, CANDIDATE);
  if (isResponse(g)) return g;
  const docs = await withDb(db => db.documents.filter(d => d.userId === g.user!.id).map(docView));
  return json({ ok: true, documents: docs }, 200, { 'Cache-Control': 'no-store' });
}

/** Upload one file (multipart/form-data: file, category, label). The photo replaces the previous photo. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { ...CANDIDATE, form: true, limit: [60, 60 * 60_000] });
  if (isResponse(g)) return g;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const category = String(form?.get('category') || '') as DocumentCategory;
  if (!form || !file || typeof file === 'string' || !DOC_CATEGORIES.includes(category)) return fail('Choose a file and a document type.');
  const limit = category === 'photo' ? MAX_PHOTO_BYTES : MAX_FILE_BYTES;
  if (file.size > limit) return fail(`The file is larger than ${limit / 1024 / 1024} MB.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || (category === 'photo' && mime === 'application/pdf')) return fail(category === 'photo' ? 'Upload a JPG, PNG or WebP image.' : 'Upload a PDF, JPG, PNG or WebP file.');
  const scan = await scanUpload(bytes, mime);
  if (!scan.ok) return fail(scan.reason || 'The file was refused.');

  const me = g.user!;
  const count = await withDb(db => db.documents.filter(d => d.userId === me.id).length);
  if (count >= MAX_DOCS_PER_USER) return fail(`You can keep up to ${MAX_DOCS_PER_USER} documents. Delete one first.`);
  const id = newId('doc');
  const blobId = blobIdFor(me.id, id, mime);
  await putBlob(blobId, mime, bytes);
  const doc: StoredDocument = {
    id, userId: me.id, category, blobId, mimeType: mime, size: bytes.length, uploadedAt: nowIso(),
    label: String(form.get('label') || '').trim().slice(0, 120) || path.basename(file.name).slice(0, 120),
    fileName: path.basename(file.name).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150),
  };
  const replaced = await withDb(db => {
    const old = category === 'photo' ? db.documents.filter(d => d.userId === me.id && d.category === 'photo') : [];
    db.documents = db.documents.filter(d => !old.includes(d));
    db.documents.push(doc);
    audit(db, { actorId: me.id, action: 'document.upload', target: id, detail: category });
    return old;
  });
  for (const o of replaced) await deleteBlobPrefix(o.blobId).catch(() => undefined);
  return json({ ok: true, document: docView(doc) });
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, CANDIDATE);
  if (isResponse(g)) return g;
  const id = req.nextUrl.searchParams.get('id') || '';
  const doc = await withDb(db => {
    const d = db.documents.find(x => x.id === id && x.userId === g.user!.id);
    if (d) { db.documents = db.documents.filter(x => x !== d); audit(db, { actorId: g.user!.id, action: 'document.delete', target: id }); }
    return d;
  });
  if (!doc) return fail('Document not found.', 404);
  await deleteBlobPrefix(doc.blobId).catch(() => undefined);
  return json({ ok: true });
}
