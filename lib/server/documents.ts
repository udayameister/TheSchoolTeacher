import type { DocumentCategory, StoredDocument, UserAccount } from '@/types';
import type { Store } from './db';
import { safeEqual, sign } from './security';

/*
 * Candidate documents. Adapted from AcadeXMatch app/api/documents (magic-byte type check, size limits,
 * single profile photo). Files are served only through short-lived signed URLs that ALSO require a
 * session allowed to see them: the owner, a platform administrator, or staff of a school the candidate
 * applied to.
 */

export const DOC_CATEGORIES: DocumentCategory[] = ['photo', 'qualification', 'tet', 'experience', 'id_proof', 'police_verification', 'pocso', 'other'];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_DOCS_PER_USER = 40;
const URL_TTL_SECONDS = 15 * 60;

export function sniff(b: Buffer): string | null {
  if (b.length > 4 && b.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
export const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export const blobIdFor = (userId: string, docId: string, mime: string) => `documents/${userId.replace(/[^A-Za-z0-9_-]/g, '')}/${docId.replace(/[^A-Za-z0-9_-]/g, '')}.${EXT[mime]}`;

/** Who may open a candidate's documents. */
export function canViewDocuments(db: Store, viewer: UserAccount | null | undefined, ownerId: string): boolean {
  if (!viewer) return false;
  if (viewer.id === ownerId || viewer.role === 'platform_admin') return true;
  if ((viewer.role === 'school_admin' || viewer.role === 'school_staff') && viewer.schoolId) {
    return db.applications.some(a => a.candidateId === ownerId && a.schoolId === viewer.schoolId && a.stage !== 'withdrawn');
  }
  return false;
}

export function signedDocUrl(docId: string, now = Date.now()): string {
  const e = Math.floor(now / 1000) + URL_TTL_SECONDS;
  return `/api/documents/${encodeURIComponent(docId)}?e=${e}&s=${sign(`${docId}.${e}`, 'doc')}`;
}

export function checkDocSignature(docId: string, e: string | null, s: string | null, now = Date.now()): boolean {
  const exp = Number(e);
  if (!Number.isInteger(exp) || exp < Math.floor(now / 1000) || !s) return false;
  return safeEqual(sign(`${docId}.${exp}`, 'doc'), s);
}

export interface DocView { id: string; category: DocumentCategory; label: string; fileName: string; mimeType: string; size: number; uploadedAt: string; url: string }
export const docView = (d: StoredDocument): DocView => ({ id: d.id, category: d.category, label: d.label, fileName: d.fileName, mimeType: d.mimeType, size: d.size, uploadedAt: d.uploadedAt, url: signedDocUrl(d.id) });
