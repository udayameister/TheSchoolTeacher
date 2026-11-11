import { NextResponse, type NextRequest } from 'next/server';
import { fail, guard, isResponse } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { canSeeInterview } from '@/lib/server/interviews';
import { buildIcs } from '@/lib/ics';
import { makeT } from '@/lib/i18n/translate';
import { appUrl } from '@/lib/server/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Calendar file for a booked interview (the candidate, or school staff who can see the application). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { roles: ['candidate', 'school_admin', 'school_staff'] });
  if (isResponse(g)) return g;
  const { id } = await params;
  const r = await withDb(db => {
    const iv = db.interviews.find(i => i.id === id);
    if (!canSeeInterview(db, g.user!, iv)) return null;
    const slot = iv.slotId ? db.slots.find(s => s.id === iv.slotId) : null;
    const job = db.jobs.find(j => j.id === iv.jobId);
    return slot && job ? { iv, slot, job } : null;
  });
  if (!r) return fail('Not found.', 404);
  const t = makeT(g.user!.locale === 'hi' ? 'hi' : 'en');
  const kind = t(`interviews.kind_${r.iv.kind}`);
  const online = r.slot.mode === 'google_meet' || r.slot.mode === 'teams';
  const body = buildIcs({
    uid: r.iv.id, title: `${kind}: ${r.job.title} – ${r.job.orgName}`, start: r.slot.start, durationMin: r.slot.durationMin,
    location: online ? t(`interviews.mode_${r.slot.mode}`) : r.slot.location, cancelled: r.iv.status === 'cancelled',
    description: [r.iv.kind === 'demo' && r.iv.demoTopic ? `${t('interviews.demoTopic')}: ${r.iv.demoTopic}` : '', r.iv.kind === 'demo' && r.iv.demoClass ? `${t('interviews.demoClass')}: ${r.iv.demoClass}` : ''].filter(Boolean).join('\n') || null,
    url: online ? r.slot.location : `${appUrl()}/candidate/interviews`,
  });
  return new NextResponse(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${r.iv.kind}-${r.iv.id}.ics"`, 'Cache-Control': 'private, no-store' } });
}
