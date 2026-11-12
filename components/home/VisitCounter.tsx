'use client';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

const KEY = 'tst_visit_last_seen';
const GAP = 30 * 60 * 1000;

/** Total and today's visits. One browser counts once per 30 minutes of activity (adapted from AcadeXMatch). */
export default function VisitCounter({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const [s, setS] = useState<{ total: number; today: number } | null>(null);
  useEffect(() => {
    let live = true;
    let count = false;
    try {
      const now = Date.now();
      const last = Number(localStorage.getItem(KEY) || 0);
      count = !last || now - last > GAP;
      localStorage.setItem(KEY, String(now));
    } catch { /* private mode: show without counting */ }
    fetch('/api/visits', count ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' } : { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).then(d => { if (live && d && typeof d.total === 'number') setS(d); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const fmt = (n: number) => n.toLocaleString('en-IN');
  return (
    <p className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border border-maroon-200 bg-white/80 px-4 py-1.5 text-sm text-ink shadow-sm backdrop-blur ${className}`} aria-live="polite">
      <Eye size={16} className="text-maroon-600" aria-hidden="true" />
      {s ? <span><strong>{fmt(s.total)}</strong> {t('home.visitsTotal')}<span className="mx-2 text-maroon-300" aria-hidden="true">•</span><strong>{fmt(s.today)}</strong> {t('home.visitsToday')}</span>
        : <span className="text-ink-muted">{t('home.visitsLoading')}</span>}
    </p>
  );
}
