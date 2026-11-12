'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FileDown, Gauge, Pencil, Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { OPTIONAL_SECTIONS, RESUME_TEMPLATES, hasContent, type ResumeData, type ResumeTemplate } from '@/lib/resume/model';
import ResumeSheet from './ResumeSheet';

export default function ResumeBuilder({ data, lang }: { data: ResumeData; lang: 'en' | 'hi' }) {
  const { t } = useI18n();
  const router = useRouter();
  const [tpl, setTpl] = useState<ResumeTemplate>('modern');
  const [hidden, setHidden] = useState<string[]>([]);
  const [photo, setPhoto] = useState(false);
  const present = OPTIONAL_SECTIONS.filter(k => data.sections.some(s => s.key === k && hasContent(s)));
  const empty = OPTIONAL_SECTIONS.filter(k => !present.includes(k) && k !== 'declaration');
  const q = `tpl=${tpl}&lang=${lang}&hide=${hidden.join(',')}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 print:hidden">
        <section className="card space-y-3" aria-labelledby="rb-design">
          <h2 id="rb-design" className="font-bold">{t('resume.design')}</h2>
          <fieldset>
            <legend className="label">{t('resume.template')}</legend>
            {RESUME_TEMPLATES.map(v => (
              <label key={v} className="flex min-h-[40px] items-center gap-2 text-sm"><input type="radio" name="tpl" className="h-5 w-5" checked={tpl === v} onChange={() => setTpl(v)} />{t(`resume.tpl_${v}`)}</label>
            ))}
          </fieldset>
          <div>
            <label htmlFor="rb-lang" className="label">{t('resume.language')}</label>
            <select id="rb-lang" className="input" value={lang} onChange={e => router.replace(`/candidate/resume?lang=${e.target.value}`, { scroll: false })}>
              <option value="en">English</option><option value="hi">हिन्दी</option>
            </select>
            <p className="hint">{t('resume.languageHint')}</p>
          </div>
          <label className="flex min-h-[40px] items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={photo && !!data.photoUrl} disabled={!data.photoUrl} onChange={e => setPhoto(e.target.checked)} />{t('resume.showPhoto')}
          </label>
          <p className="hint">{data.photoUrl ? t('resume.photoHint') : t('resume.noPhotoHint')}</p>
        </section>

        <section className="card space-y-2" aria-labelledby="rb-sections">
          <h2 id="rb-sections" className="font-bold">{t('resume.sections')}</h2>
          {present.map(k => (
            <label key={k} className="flex min-h-[36px] items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={!hidden.includes(k)} onChange={() => setHidden(h => (h.includes(k) ? h.filter(x => x !== k) : [...h, k]))} />{t(`resume.h_${k}`)}
            </label>
          ))}
          {empty.length > 0 && <p className="hint">{t('resume.emptySections', { list: empty.map(k => t(`resume.h_${k}`)).join(', ') })}</p>}
        </section>

        <div className="flex flex-col gap-2">
          <button type="button" className="btn-primary" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />{t('resume.printPdf')}</button>
          <a className="btn-ghost" href={`/api/candidate/resume/docx?${q}`}><FileDown size={18} aria-hidden="true" />{t('resume.downloadWord')}</a>
          <Link className="btn-ghost" href={`/candidate/resume/check?hide=${hidden.join(',')}`}><Gauge size={18} aria-hidden="true" />{t('resume.checkIt')}</Link>
          <Link className="btn-ghost" href="/candidate/profile"><Pencil size={18} aria-hidden="true" />{t('profile.edit')}</Link>
        </div>
        <p className="hint">{t('resume.printHint')}</p>
      </aside>

      <div className="min-w-0 overflow-x-auto rounded-xl bg-line/40 p-2 sm:p-6 print:overflow-visible print:bg-transparent print:p-0">
        <ResumeSheet data={data} template={tpl} hidden={hidden} photo={photo} lang={lang} />
      </div>
    </div>
  );
}
