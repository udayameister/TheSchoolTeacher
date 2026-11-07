'use client';
import { useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { api } from '@/lib/clientApi';

type Photo = { id: string; caption?: string | null; url: string };

export default function PhotoManager({ schoolId, initial }: { schoolId: string; initial: Photo[] }) {
  const { t } = useI18n();
  const [photos, setPhotos] = useState(initial);
  const [caption, setCaption] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map(p => (
          <li key={p.id} className="overflow-hidden rounded-lg border border-line bg-paper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption || t('school.photo')} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <div className="flex items-center justify-between gap-1 p-2 text-xs">
              <span className="truncate">{p.caption}</span>
              <button type="button" aria-label={`${t('profile.remove')} ${p.caption || ''}`} className="text-danger-700" onClick={async () => {
                const r = await api(`/api/school/photos?schoolId=${schoolId}&id=${p.id}`, undefined, 'DELETE');
                if (r.ok) setPhotos(x => x.filter(y => y.id !== p.id));
              }}><Trash2 size={16} aria-hidden="true" /></button>
            </div>
          </li>
        ))}
      </ul>
      {photos.length < 8 && (
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={async e => {
          e.preventDefault();
          const file = ref.current?.files?.[0];
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) { setMsg(t('school.errPhotoSize')); return; }
          setBusy(true); setMsg(null);
          const fd = new FormData(); fd.set('schoolId', schoolId); fd.set('file', file); fd.set('caption', caption);
          const r = await fetch('/api/school/photos', { method: 'POST', body: fd, credentials: 'same-origin' });
          const d = await r.json().catch(() => ({}));
          setBusy(false);
          if (!r.ok) { setMsg(d.error ? t(d.error) : t('common.somethingWrong')); return; }
          setPhotos(x => [...x, d.photo]); setCaption(''); if (ref.current) ref.current.value = '';
        }}>
          <label><span className="label">{t('school.photo')}</span><input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" required className="input py-2" /></label>
          <label><span className="label">{t('school.caption')}</span><input className="input" maxLength={120} value={caption} onChange={e => setCaption(e.target.value)} /></label>
          <button className="btn-ghost" disabled={busy}><Upload size={18} aria-hidden="true" />{t('documents.uploadButton')}</button>
        </form>
      )}
      <p className="hint">{t('school.photoHint')}</p>
      {msg && <p role="alert" className="alert-error">{msg}</p>}
    </div>
  );
}
