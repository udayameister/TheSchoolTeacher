'use client';
import { useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import type { DocumentCategory } from '@/types';
import type { DocView } from '@/lib/server/documents';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

const CATS: DocumentCategory[] = ['photo', 'qualification', 'tet', 'experience', 'id_proof', 'police_verification', 'pocso', 'other'];
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export default function DocumentsManager({ initial }: { initial: DocView[] }) {
  const { t } = useI18n();
  const [docs, setDocs] = useState(initial);
  const [category, setCategory] = useState<DocumentCategory>('qualification');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const max = category === 'photo' ? 2 : 5;
    if (file.size > max * 1024 * 1024) { setMsg({ ok: false, text: t('documents.tooBig', { mb: max }) }); return; }
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set('file', file); fd.set('category', category); fd.set('label', label);
    try {
      const r = await fetch('/api/candidate/documents', { method: 'POST', body: fd, credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || t('common.somethingWrong'));
      setDocs(prev => [...(category === 'photo' ? prev.filter(x => x.category !== 'photo') : prev), d.document]);
      setMsg({ ok: true, text: t('documents.uploaded') });
      setLabel(''); if (fileRef.current) fileRef.current.value = '';
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    setBusy(false);
  }

  async function remove(d: DocView) {
    if (!window.confirm(t('documents.confirmDelete', { name: d.label }))) return;
    const r = await api(`/api/candidate/documents?id=${encodeURIComponent(d.id)}`, undefined, 'DELETE');
    if (r.ok) setDocs(prev => prev.filter(x => x.id !== d.id));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="card grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">{t('documents.upload')}</h2>
        <div><label htmlFor="doc-cat" className="label">{t('documents.type')}</label>
          <select id="doc-cat" className="input" value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
            {CATS.map(c => <option key={c} value={c}>{t(`documents.cat_${c}`)}</option>)}
          </select></div>
        <div><label htmlFor="doc-label" className="label">{t('documents.label')}</label>
          <input id="doc-label" className="input" maxLength={120} placeholder={t('documents.labelPlaceholder')} value={label} onChange={e => setLabel(e.target.value)} /></div>
        <div className="sm:col-span-2"><label htmlFor="doc-file" className="label">{t('documents.file')}</label>
          <input id="doc-file" ref={fileRef} type="file" required accept={category === 'photo' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp'} className="input py-2" />
          <p className="hint">{category === 'photo' ? t('documents.photoHint') : t('documents.fileHint')}</p></div>
        {msg && <p role="status" className={`sm:col-span-2 ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.text}</p>}
        <button className="btn-primary sm:col-span-2 sm:justify-self-start" disabled={busy}><Upload size={18} aria-hidden="true" />{busy ? t('common.loading') : t('documents.uploadButton')}</button>
      </form>

      {CATS.filter(c => docs.some(d => d.category === c)).map(c => (
        <section key={c} aria-labelledby={`h-${c}`}>
          <h2 id={`h-${c}`} className="mb-2 text-base font-bold">{t(`documents.cat_${c}`)}</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
            {docs.filter(d => d.category === c).map(d => (
              <li key={d.id} className="flex items-center gap-3 p-3">
                {d.mimeType === 'application/pdf' ? <FileText size={22} className="shrink-0 text-brand-700" aria-hidden="true" /> : <ImageIcon size={22} className="shrink-0 text-brand-700" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <a href={`${d.url}&view=1`} target="_blank" rel="noopener" className="block truncate font-semibold">{d.label}</a>
                  <span className="text-xs text-ink-muted">{d.fileName} · {kb(d.size)} · {d.uploadedAt.slice(0, 10)}</span>
                </div>
                <button type="button" className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-danger-700 hover:bg-danger-50" onClick={() => remove(d)}><Trash2 size={16} aria-hidden="true" /><span className="sr-only sm:not-sr-only">{t('profile.remove')}</span></button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!docs.length && <p className="card text-ink-soft">{t('documents.none')}</p>}
      <p className="hint">{t('documents.privacy')}</p>
    </div>
  );
}
