import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { listMaster } from '@/lib/server/masterData';
import { completeness, emptyProfile } from '@/lib/server/profile';
import { matchingAllowed } from '@/lib/server/catalog';
import { photoUrlOf } from '@/lib/server/resume';
import ProfileForm from '@/components/candidate/ProfileForm';

export const metadata = { title: 'My profile' };

export default async function ProfilePage() {
  const user = await requireRole(['candidate'], '/candidate/profile');
  const { t } = await getT();
  const d = await withDb(db => {
    const profile = db.profiles[user.id] || emptyProfile(user.id);
    // Only what the form needs from each list (no meta), to keep the page light on phones.
    const lite = (k: Parameters<typeof listMaster>[1]) => listMaster(db, k).map(i => ({ ...i, meta: (k === 'tetExams' ? { papers: i.meta.papers ?? null } : {}) as Record<string, string | number | boolean | null> }));
    return {
      profile, photoUrl: photoUrlOf(db, user.id), completeness: completeness(profile, user, db.documents.filter(x => x.userId === user.id)), matching: matchingAllowed(db, user.id),
      lists: { states: lite('states'), subjects: lite('subjects'), levels: lite('schoolLevels'), mediums: lite('mediums'), qualifications: lite('qualifications'), tets: lite('tetExams'), boards: lite('boards'), posts: lite('posts') },
    };
  });
  return (
    <div className="container-page max-w-4xl py-6">
      <h1 className="mb-4 text-2xl font-bold">{t('profile.title')}</h1>
      <ProfileForm initial={d.profile} name={user.name} lists={d.lists} completeness={d.completeness} matchingConsent={d.matching} photoUrl={d.photoUrl} />
    </div>
  );
}
