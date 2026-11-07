import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { withDb } from '@/lib/server/db';
import { docView } from '@/lib/server/documents';
import DocumentsManager from '@/components/candidate/DocumentsManager';

export const metadata = { title: 'My documents' };

export default async function DocumentsPage() {
  const user = await requireRole(['candidate'], '/candidate/documents');
  const { t } = await getT();
  const docs = await withDb(db => db.documents.filter(d => d.userId === user.id).map(docView));
  return (
    <div className="container-page max-w-3xl py-6">
      <h1 className="text-2xl font-bold">{t('documents.title')}</h1>
      <p className="mb-4 mt-1 text-ink-soft">{t('documents.intro')}</p>
      <DocumentsManager initial={docs} />
    </div>
  );
}
