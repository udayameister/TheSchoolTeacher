import { NextResponse, type NextRequest } from 'next/server';
import { fail, guard, isResponse } from '@/lib/server/http';
import { audit, withDb } from '@/lib/server/db';
import { applicationsCsv, schoolReport, vacanciesCsv } from '@/lib/server/reports';
import { todayIst } from '@/lib/jobs/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** CSV export: ?type=vacancies|applications&range=30|90|365|0 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ['school_admin', 'school_staff'], limit: [60, 60 * 60_000] });
  if (isResponse(g)) return g;
  const type = req.nextUrl.searchParams.get('type') === 'applications' ? 'applications' : 'vacancies';
  const range = Number(req.nextUrl.searchParams.get('range') ?? 90);
  const csv = await withDb(db => {
    const out = type === 'applications' ? applicationsCsv(db, g.user!, range) : (() => { const r = schoolReport(db, g.user!, range); return r && vacanciesCsv(r); })();
    if (out) audit(db, { actorId: g.user!.id, action: 'reports.export', target: g.user!.schoolId || null, detail: `${type} (${range || 'all'} days)` });
    return out;
  });
  if (!csv) return fail('You do not have permission to do this.', 403);
  return new NextResponse(`﻿${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-${todayIst()}.csv"`, 'Cache-Control': 'private, no-store' } });
}
