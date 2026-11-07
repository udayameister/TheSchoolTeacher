import { NextResponse, type NextRequest } from 'next/server';
import { consumeTokenData } from '@/lib/server/auth';
import { audit, withDb } from '@/lib/server/db';
import { allow, clientIp, publicOrigin } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Link sent to the school's official email address. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  if (!allow(`school-verify:${clientIp(req)}`, 30, 15 * 60_000)) return NextResponse.redirect(new URL('/school?email=busy', origin));
  const t = await consumeTokenData(req.nextUrl.searchParams.get('token') || '', 'verify-school-email');
  const [schoolId, email] = (t?.data || '').split('|');
  const ok = !!t && await withDb(db => {
    const s = db.schools.find(x => x.id === schoolId);
    if (!s || s.officialEmail !== email) return false;
    s.officialEmailVerified = true;
    audit(db, { actorId: t.userId, action: 'school.official_email_verified', target: s.id, detail: email });
    return true;
  });
  return NextResponse.redirect(new URL(`/school?email=${ok ? 'ok' : 'invalid'}`, origin));
}
