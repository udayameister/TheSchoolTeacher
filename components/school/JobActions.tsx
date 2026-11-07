'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export default function JobActions({ id, status, canPublish, canDelete }: { id: string; status: string; canPublish: boolean; canDelete: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const act = async (action: string) => {
    if (action === 'close' && !window.confirm(t('post.confirmClose'))) return;
    const r = await api<{ id: string }>('/api/school/jobs', { id, action }, 'PATCH');
    if (!r.ok) { setErr(r.error ? t(r.error) : t('common.somethingWrong')); return; }
    if (action === 'duplicate') { router.push(`/school/jobs/${r.id}/edit`); return; }
    router.refresh();
  };
  const btn = 'inline-flex min-h-[40px] items-center rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50';
  return (
    <div className="flex flex-wrap items-center gap-1">
      <a href={`/school/jobs/${id}/edit`} className={`${btn} no-underline`}>{t('post.edit')}</a>
      <a href={`/school/applicants?job=${id}`} className={`${btn} no-underline`}>{t('school.nav_applicants')}</a>
      {status === 'published' && <button type="button" className={btn} onClick={() => act('close')}>{t('post.close')}</button>}
      {status !== 'published' && canPublish && <button type="button" className={btn} onClick={() => act(status === 'draft' ? 'publish' : 'reopen')}>{status === 'draft' ? t('post.publish') : t('post.reopen')}</button>}
      <button type="button" className={btn} onClick={() => act('duplicate')}>{t('post.duplicate')}</button>
      {canDelete && <button type="button" className={`${btn} text-danger-700`} onClick={async () => {
        if (!window.confirm(t('post.confirmDelete'))) return;
        const r = await api(`/api/school/jobs?id=${id}`, undefined, 'DELETE');
        if (r.ok) router.refresh(); else setErr(r.error ? t(r.error) : t('common.somethingWrong'));
      }}>{t('profile.remove')}</button>}
      {err && <p role="alert" className="alert-error w-full">{err}</p>}
    </div>
  );
}
