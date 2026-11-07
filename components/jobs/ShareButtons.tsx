'use client';
import { useState } from 'react';
import { Link2, MessageCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

/** WhatsApp share (a plain link, no WhatsApp script loaded) and copy link. */
export default function ShareButtons({ title, url }: { title: string; url: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={18} aria-hidden="true" />{t('jobs.shareWhatsApp')}<span className="sr-only"> ({t('apply.newTab')})</span>
      </a>
      <button type="button" className="btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* clipboard blocked */ } }}>
        <Link2 size={18} aria-hidden="true" />{copied ? t('jobs.copied') : t('jobs.copyLink')}
      </button>
    </div>
  );
}
