'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/client';

/** Tick-list; ticks are remembered in this browser only (nothing is sent to the server). */
export default function Checklist({ items, storageKey }: { items: { id: string; text: string }[]; storageKey: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { /* private mode */ } }, [storageKey]);
  const toggle = (id: string) => setDone(d => {
    const next = d.includes(id) ? d.filter(x => x !== id) : [...d, id];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  return (
    <div className="card">
      <p className="mb-2 text-sm font-semibold text-brand-800">{t('career.doneOf', { n: done.filter(id => items.some(i => i.id === id)).length, total: items.length })}</p>
      <ul className="space-y-1">
        {items.map(i => <li key={i.id}><label className="flex min-h-[40px] gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={done.includes(i.id)} onChange={() => toggle(i.id)} /><span className={done.includes(i.id) ? 'text-ink-muted line-through' : ''}>{i.text}</span></label></li>)}
      </ul>
    </div>
  );
}
