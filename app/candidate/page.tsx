import { getT } from '@/lib/i18n/server';
import { currentUser } from '@/lib/server/http';

export default async function CandidateHome() {
  const [{ t }, user] = await Promise.all([getT(), currentUser()]);
  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">{t('console.candidateTitle')}</h1>
      <p className="mt-1 text-ink-soft">{user?.name}</p>
      <div className="card mt-6"><p>{t('console.candidateIntro')}</p><p className="mt-1 text-sm text-ink-muted">{t('common.comingSoon')}</p></div>
    </div>
  );
}
