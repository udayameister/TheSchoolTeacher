import { getT } from '@/lib/i18n/server';

/** Shared frame for the legal pages. The texts are drafts and say so until a lawyer has reviewed them. */
export default async function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  const { t } = await getT();
  return (
    <article className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">Last updated: {updated}</p>
      <p className="alert-error mt-4" role="note">{t('legal.draftNotice')}</p>
      <div className="mt-6 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </article>
  );
}
