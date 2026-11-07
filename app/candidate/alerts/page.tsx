import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { lookupOf } from '@/lib/server/catalog';
import { describeFilters } from '@/lib/jobs/display';
import { MAX_ALERTS } from '@/lib/server/alerts';
import AlertsManager from '@/components/candidate/AlertsManager';

export const metadata = { title: 'Job alerts' };

export default async function AlertsPage() {
  const user = await requireRole(['candidate'], '/candidate/alerts');
  const { t, locale } = await getT();
  const rows = await withDb(db => {
    const lookup = lookupOf(db);
    return db.alerts.filter(a => a.userId === user.id).map(a => ({ ...a, summary: describeFilters(a.filters, lookup, t, locale) }));
  });
  return (
    <div className="container-page max-w-4xl py-6">
      <h1 className="text-2xl font-bold">{t('alerts.title')}</h1>
      <div className="mt-4"><AlertsManager initial={rows} max={MAX_ALERTS} emailOff={!!user.unsubscribed?.includes('alerts')} /></div>
    </div>
  );
}
