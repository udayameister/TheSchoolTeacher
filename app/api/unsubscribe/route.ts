import { NextResponse, type NextRequest } from 'next/server';
import { readUnsubscribeToken } from '@/lib/server/mailer';
import { audit, withDb } from '@/lib/server/db';
import { publicOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function unsubscribe(token: string): Promise<boolean> {
  const t = readUnsubscribeToken(token);
  if (!t) return false;
  await withDb(db => {
    const u = db.users.find(x => x.email === t.email);
    if (u && !u.unsubscribed?.includes(t.list)) {
      u.unsubscribed = [...(u.unsubscribed || []), t.list];
      audit(db, { actorId: u.id, action: 'email.unsubscribe', target: t.list });
    }
    // Addresses without an account (school outreach) are remembered too, so they are never mailed again.
    const key = `${t.list}:${t.email}`;
    if (!u && !db.suppressed.includes(key)) db.suppressed.push(key);
  });
  return true;
}

/** Link in the email footer: shows a confirmation page. */
export async function GET(req: NextRequest) {
  const ok = await unsubscribe(req.nextUrl.searchParams.get('t') || '');
  return NextResponse.redirect(new URL(`/unsubscribed?status=${ok ? 'ok' : 'invalid'}`, publicOrigin(req)));
}

/** RFC 8058 one-click unsubscribe (mail apps POST to the List-Unsubscribe address). */
export async function POST(req: NextRequest) {
  const ok = await unsubscribe(req.nextUrl.searchParams.get('t') || '');
  return new NextResponse(null, { status: ok ? 200 : 400 });
}
