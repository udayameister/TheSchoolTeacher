import type { NextRequest } from 'next/server';
import { fail, guard, isResponse, json } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { extractResume, RESUME_MAX_BYTES } from '@/lib/server/cvExtract';
import { checkText } from '@/lib/server/cvService';
import { lookupOf } from '@/lib/server/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reads an uploaded CV (PDF, DOCX or TXT; multipart field "file", optional "jobId"), and returns the
 * suggestions for the profile and the checker's score. The file is read in memory and not stored.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'], form: true, limit: [30, 60 * 60_000] });
  if (isResponse(g)) return g;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !file || typeof file === 'string') return fail('Choose a PDF, Word (.docx) or text file.');
  if (file.size > RESUME_MAX_BYTES) return fail('The file is larger than 5 MB.');
  const r = await extractResume(Buffer.from(await file.arrayBuffer()), file.name);
  if (!r.ok) return fail(r.error);
  const jobId = String(form.get('jobId') || '').slice(0, 60) || null;
  const out = await withDb(db => {
    const res = checkText(db, r.value.text, r.value.signals, jobId);
    // Names of every master item the suggestions point to, for the review screen.
    const lookup = lookupOf(db);
    const ids = [...res.cv.subjectIds, ...res.cv.levelIds, ...res.cv.mediumIds, ...res.cv.experience.map(x => x.postId || ''), ...res.cv.qualifications.map(x => x.qualificationId), ...res.cv.tets.map(x => x.tetId)];
    const names: Record<string, { name: string; nameHi?: string }> = {};
    for (const id of ids) { const it = id ? lookup.get(id) : undefined; if (it) names[id] = { name: it.name, nameHi: it.nameHi }; }
    return { ...res, names };
  });
  return json({ ok: true, format: r.value.format, pages: r.value.pages, ...out }, 200, { 'Cache-Control': 'no-store' });
}
