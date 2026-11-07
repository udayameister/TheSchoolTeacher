'use client';
import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

/** Save / unsave. Visitors who are not signed in are sent to sign in and come back. */
export default function SaveJobButton({ jobId, saved: initial, signedIn, compact = false }: { jobId: string; saved: boolean; signedIn: boolean; compact?: boolean }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const label = saved ? t('jobs.saved') : t('jobs.save');
  return (
    <button type="button" aria-pressed={saved} disabled={busy} className={compact ? 'inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50' : 'btn-ghost'}
      onClick={async () => {
        if (!signedIn) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; return; }
        setBusy(true);
        const r = await api('/api/candidate/saved', { jobId, saved: !saved });
        setBusy(false);
        if (r.ok) setSaved(!saved);
      }}>
      {saved ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}
