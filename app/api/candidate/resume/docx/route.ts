import { NextResponse, type NextRequest } from 'next/server';
import { guard, isResponse } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { buildResume } from '@/lib/server/resume';
import { resumeDocx, resumeFileName } from '@/lib/server/resumeDocx';
import { RESUME_TEMPLATES, cleanHidden, type ResumeTemplate } from '@/lib/resume/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The candidate's resume as a Word file (?tpl=classic|modern|compact&lang=en|hi&hide=section,…). */
export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ['candidate'], limit: [60, 60 * 60_000] });
  if (isResponse(g)) return g;
  const q = req.nextUrl.searchParams;
  const tpl = (RESUME_TEMPLATES as string[]).includes(q.get('tpl') || '') ? (q.get('tpl') as ResumeTemplate) : 'classic';
  const lang = q.get('lang') === 'hi' ? 'hi' : 'en';
  const data = await withDb(db => buildResume(db, g.user!, lang, { photo: false }));
  const bytes = resumeDocx(data, tpl, cleanHidden(q.get('hide')), lang === 'hi');
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(resumeFileName(data.name))}`,
      'Cache-Control': 'no-store',
    },
  });
}
