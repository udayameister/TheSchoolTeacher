'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AlertTriangle, Columns3, List } from 'lucide-react';
import type { Stage } from '@/types';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

export interface PipelineRow { id: string; name: string; jobId: string; jobTitle: string; stage: Stage; appliedAt: string; match: number | null; flagged: number; years: number }

const PIPELINE: Stage[] = ['applied', 'screening', 'eligible', 'shortlisted', 'interview', 'panel_review', 'offer', 'joined', 'not_selected'];

/**
 * Applicant pipeline. Cards are moved with a "Move to" menu (works with keyboard and screen readers,
 * unlike drag-and-drop). Select several to move them together.
 */
export default function Pipeline({ rows, initialView }: { rows: PipelineRow[]; initialView: 'kanban' | 'list' }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<Stage | ''>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const byStage = useMemo(() => Object.fromEntries(PIPELINE.map(s => [s, rows.filter(r => r.stage === s)])), [rows]);

  async function move(ids: string[], stage: Stage) {
    if (!ids.length) return;
    if (stage === 'not_selected' && !window.confirm(t('ats.confirmNotSelected', { n: ids.length }))) return;
    setBusy(true);
    const r = await api<{ moved: number }>('/api/school/applications', { action: 'stage', ids, stage });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: t('ats.moved', { n: r.moved, stage: t(`stages.${stage}`) }) } : { ok: false, text: r.error ? t(r.error) : t('common.somethingWrong') });
    setSelected(new Set()); setBulkStage('');
    router.refresh();
  }
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const moveSelect = (r: PipelineRow) => r.stage === 'withdrawn' ? <span className="text-xs text-ink-muted">{t('stages.withdrawn')}</span> : (
    <label className="block"><span className="sr-only">{t('ats.moveTo')} ({r.name})</span>
      <select className="input min-h-[36px] py-1 text-sm" value="" disabled={busy} onChange={e => e.target.value && move([r.id], e.target.value as Stage)}>
        <option value="">{t('ats.moveTo')}…</option>
        {PIPELINE.filter(s => s !== r.stage).map(s => <option key={s} value={s}>{t(`stages.${s}`)}</option>)}
      </select></label>
  );
  const meta = (r: PipelineRow) => (
    <span className="flex flex-wrap gap-x-2 text-xs text-ink-muted">
      {r.match !== null && <span>{t('match.badge', { score: r.match })}</span>}
      <span>{t('ats.years', { n: r.years })}</span>
      <span>{fmt(r.appliedAt)}</span>
      {r.flagged > 0 && <span className="inline-flex items-center gap-0.5 font-semibold text-danger-700"><AlertTriangle size={12} aria-hidden="true" />{t('ats.flagged', { n: r.flagged })}</span>}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('ats.view')} className="flex rounded-lg border border-line bg-paper p-0.5">
          <button type="button" aria-pressed={view === 'kanban'} className={`inline-flex min-h-[40px] items-center gap-1 rounded-md px-3 text-sm font-semibold ${view === 'kanban' ? 'bg-brand-700 text-white' : 'text-brand-800'}`} onClick={() => setView('kanban')}><Columns3 size={16} aria-hidden="true" />{t('ats.kanban')}</button>
          <button type="button" aria-pressed={view === 'list'} className={`inline-flex min-h-[40px] items-center gap-1 rounded-md px-3 text-sm font-semibold ${view === 'list' ? 'bg-brand-700 text-white' : 'text-brand-800'}`} onClick={() => setView('list')}><List size={16} aria-hidden="true" />{t('ats.list')}</button>
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1">
            <span className="text-sm font-semibold">{t('ats.selected', { n: selected.size })}</span>
            <label><span className="sr-only">{t('ats.moveTo')}</span><select className="input min-h-[36px] py-1 text-sm" value={bulkStage} onChange={e => setBulkStage(e.target.value as Stage)}><option value="">{t('ats.moveTo')}…</option>{PIPELINE.map(s => <option key={s} value={s}>{t(`stages.${s}`)}</option>)}</select></label>
            <button type="button" className="btn-primary min-h-[36px] py-1" disabled={!bulkStage || busy} onClick={() => bulkStage && move([...selected], bulkStage)}>{t('ats.apply')}</button>
            <button type="button" className="text-sm font-semibold text-brand-700 underline" onClick={() => setSelected(new Set())}>{t('common.cancel')}</button>
          </div>
        )}
      </div>
      <div aria-live="polite">{msg && <p className={msg.ok ? 'alert-ok' : 'alert-error'}>{msg.text}</p>}</div>

      {!rows.length ? <p className="card text-ink-soft">{t('school.noApplicants')}</p> : view === 'kanban' ? (
        <div className="-mx-4 relative overflow-x-auto px-4 pb-2">
          <ol className="flex gap-3" style={{ minWidth: `${PIPELINE.length * 236}px` }}>
            {PIPELINE.map(s => (
              <li key={s} className="w-56 shrink-0 rounded-xl border border-line bg-brand-50/50 p-2" aria-label={`${t(`stages.${s}`)} (${byStage[s].length})`}>
                <h2 className="mb-2 flex justify-between px-1 text-sm font-bold text-brand-900"><span>{t(`stages.${s}`)}</span><span className="rounded-full bg-paper px-2">{byStage[s].length}</span></h2>
                <ul className="space-y-2">
                  {byStage[s].map(r => (
                    <li key={r.id} className="rounded-lg border border-line bg-paper p-2 shadow-card">
                      <div className="flex items-start gap-2">
                        <input type="checkbox" aria-label={`${t('ats.select')} ${r.name}`} className="mt-1 h-4 w-4 shrink-0" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                        <div className="min-w-0">
                          <Link href={`/school/applicants/${r.id}`} className="block truncate font-semibold">{r.name}</Link>
                          <span className="block truncate text-xs text-ink-soft">{r.jobTitle}</span>
                          {meta(r)}
                        </div>
                      </div>
                      <div className="mt-2">{moveSelect(r)}</div>
                    </li>
                  ))}
                  {!byStage[s].length && <li className="px-1 text-xs text-ink-muted">{t('ats.empty')}</li>}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="table">
            <thead><tr>
              <th scope="col"><input type="checkbox" aria-label={t('ats.selectAll')} className="h-4 w-4" checked={selected.size === rows.filter(r => r.stage !== 'withdrawn').length && selected.size > 0} onChange={e => setSelected(new Set(e.target.checked ? rows.filter(r => r.stage !== 'withdrawn').map(r => r.id) : []))} /></th>
              <th scope="col">{t('common.name')}</th><th scope="col">{t('jobs.post')}</th><th scope="col">{t('ats.stage')}</th><th scope="col">{t('ats.details')}</th><th scope="col"><span className="sr-only">{t('ats.moveTo')}</span></th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={r.stage === 'withdrawn' ? 'text-ink-muted' : ''}>
                  <td>{r.stage !== 'withdrawn' && <input type="checkbox" aria-label={`${t('ats.select')} ${r.name}`} className="h-4 w-4" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}</td>
                  <td><Link href={`/school/applicants/${r.id}`} className="font-semibold">{r.name}</Link></td>
                  <td>{r.jobTitle}</td>
                  <td className="whitespace-nowrap">{t(`stages.${r.stage}`)}</td>
                  <td>{meta(r)}</td>
                  <td className="min-w-[160px]">{moveSelect(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
