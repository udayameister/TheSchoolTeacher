import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { currentSchool } from '@/lib/server/schools';
import { schoolFormLists } from '@/lib/server/schoolLists';
import SchoolForm from '@/components/school/SchoolForm';
import PhotoManager from '@/components/school/PhotoManager';
import VerificationStatus from '@/components/school/VerificationStatus';
import ResendSchoolEmail from '@/components/school/ResendSchoolEmail';

export const metadata = { title: 'School profile' };

export default async function SchoolProfile() {
  const user = await requireRole(['school_admin', 'school_staff'], '/school/profile');
  const { t } = await getT();
  const d = await withDb(db => ({ lists: schoolFormLists(db), school: currentSchool(db, user) }));
  if (!d.school) redirect(user.role === 'school_admin' ? '/school/register' : '/school');
  const s = d.school;
  return (
    <div className="container-page max-w-4xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">{s.name}</h1>
        <p className="text-sm text-ink-muted">UDISE+ {s.udiseCode}</p>
      </div>
      <VerificationStatus school={s} t={t} />
      {s.officialEmail && (
        <p className="text-sm">{t('school.officialEmail')}: {s.officialEmail} · {s.officialEmailVerified ? t('account.verified') : <>{t('account.notVerified')} {user.role === 'school_admin' && <ResendSchoolEmail />}</>}</p>
      )}
      {user.role === 'school_admin'
        ? <SchoolForm mode="edit" school={s} lists={d.lists} identityLocked={s.verification === 'verified'} canCreateGroup={false} />
        : <p className="card text-ink-soft">{t('school.staffReadOnly')}</p>}
      {user.role === 'school_admin' && (
        <section className="card space-y-3" aria-labelledby="ph-h">
          <h2 id="ph-h" className="text-lg font-bold">{t('school.photos')}</h2>
          <PhotoManager schoolId={s.id} initial={s.photos.map(p => ({ id: p.id, caption: p.caption, url: `/api/schools/photo/${p.id}` }))} />
        </section>
      )}
    </div>
  );
}
