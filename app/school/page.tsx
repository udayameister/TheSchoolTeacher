import { getT } from '@/lib/i18n/server';
import { currentUser } from '@/lib/server/http';

export default async function SchoolHome() {
  const [{ t }, user] = await Promise.all([getT(), currentUser()]);
  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">{t('console.schoolTitle')}</h1>
      <p className="mt-1 text-ink-soft">{user?.name}</p>
      {!user?.schoolId && <p className="alert-error mt-6" role="status">{t('console.schoolPending')}</p>}
    </div>
  );
}
