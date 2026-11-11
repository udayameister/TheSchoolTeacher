import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { currentUser } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { findInvite } from '@/lib/server/team';
import JoinForm from '@/components/school/JoinForm';

export const metadata = { title: 'Join your school team', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ t }, q, me] = await Promise.all([getT(), searchParams, currentUser()]);
  const token = String(q.token || '');
  const inv = await withDb(db => {
    const i = findInvite(db, token);
    if (!i) return null;
    const existing = db.users.find(u => u.email === i.email);
    return { email: i.email, name: i.name, role: i.staffRole, school: db.schools.find(s => s.id === i.schoolId)?.name || '', existing: existing ? { id: existing.id, linkable: existing.role === 'school_staff' && !existing.schoolId } : null };
  });
  return (
    <div className="container-page max-w-lg py-10">
      <div className="card space-y-4">
        <h1 className="text-2xl font-bold">{t('team.joinTitle')}</h1>
        {!inv ? <p className="alert-error">{t('team.errInviteInvalid')}</p>
          : inv.existing && !inv.existing.linkable ? <p className="alert-error">{t('team.errOtherAccount')}</p>
          : inv.existing && me?.id !== inv.existing.id ? <><p>{t('team.joinSignIn', { email: inv.email })}</p><Link className="btn-primary" href={`/login?next=${encodeURIComponent(`/join?token=${token}`)}`}>{t('nav.signIn')}</Link></>
          : <>
            <p>{t('team.joinIntro', { school: inv.school, role: t(`team.role_${inv.role}`) })}</p>
            <JoinForm token={token} email={inv.email} name={inv.name} existing={!!inv.existing} />
          </>}
      </div>
    </div>
  );
}
