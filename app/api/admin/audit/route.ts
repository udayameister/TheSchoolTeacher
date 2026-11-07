import { NextResponse, type NextRequest } from 'next/server';
import { guard, isResponse, json } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { toCsvRow } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Audit log with filters; ?format=csv downloads the filtered rows. */
export async function GET(req: NextRequest) {
  const g = await guard(req, { roles: ['platform_admin'] });
  if (isResponse(g)) return g;
  const p = req.nextUrl.searchParams;
  const q = (p.get('q') || '').toLowerCase();
  const action = p.get('action') || '';
  const from = p.get('from') || '';
  const to = p.get('to') || '';
  const rows = await withDb(db => db.audit.filter(a =>
    (!action || a.action.startsWith(action)) && (!from || a.at >= from) && (!to || a.at <= `${to}T23:59:59.999Z`)
    && (!q || [a.actorEmail, a.target, a.detail, a.action].some(v => String(v || '').toLowerCase().includes(q)))));
  if (p.get('format') === 'csv') {
    const csv = [toCsvRow(['time', 'action', 'actor', 'target', 'detail', 'ip']), ...rows.map(a => toCsvRow([a.at, a.action, a.actorEmail || a.actorId || '', a.target || '', a.detail || '', a.ip || '']))].join('\r\n');
    return new NextResponse(`﻿${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
  }
  return json({ ok: true, total: rows.length, rows: rows.slice(0, 500) }, 200, { 'Cache-Control': 'no-store' });
}
