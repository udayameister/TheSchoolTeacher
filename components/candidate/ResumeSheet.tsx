import type { ResumeData, ResumeSection, ResumeTemplate } from '@/lib/resume/model';
import { visibleSections } from '@/lib/resume/model';

/* One A4-like resume page. Works on screen and in print (Save as PDF). */

const STYLE: Record<ResumeTemplate, { wrap: string; name: string; head: string; h2: string; body: string }> = {
  classic: { wrap: '', name: 'text-3xl font-bold', head: 'border-b-2 border-ink pb-3 text-center', h2: 'mt-5 border-b border-ink/40 pb-0.5 text-sm font-bold uppercase tracking-wider', body: 'text-[14px] leading-relaxed' },
  modern: { wrap: '', name: 'text-3xl font-bold text-brand-800', head: 'border-l-4 border-marigold-400 pl-4', h2: 'mt-5 border-b border-brand-200 pb-0.5 text-sm font-bold uppercase tracking-wider text-brand-800', body: 'text-[14px] leading-relaxed' },
  compact: { wrap: '', name: 'text-2xl font-bold', head: 'border-b border-line pb-2', h2: 'mt-3 text-[13px] font-bold uppercase tracking-wide text-ink-soft', body: 'text-[13px] leading-snug' },
};

function Section({ s, tpl }: { s: ResumeSection; tpl: ResumeTemplate }) {
  const st = STYLE[tpl];
  return (
    <section className="break-inside-avoid-page">
      <h2 className={st.h2}>{s.heading}</h2>
      <div className="mt-1.5 space-y-1.5">
        {s.paragraph && s.paragraph.split('\n').map((l, i) => <p key={i}>{l}</p>)}
        {s.items?.length ? (s.inline ? <p>{s.items.join(', ')}</p> : <ul className="list-disc space-y-0.5 pl-5">{s.items.map((i, k) => <li key={k}>{i}</li>)}</ul>) : null}
        {s.facts?.length ? <dl className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[max-content_1fr]">{s.facts.map((f, k) => <div key={k} className="contents"><dt className="font-semibold">{f.label}</dt><dd>{f.value}</dd></div>)}</dl> : null}
        {s.entries?.map((e, k) => (
          <div key={k} className="break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3"><p className="font-semibold">{e.title}</p>{e.dates && <p className="text-ink-soft">{e.dates}</p>}</div>
            {e.sub && <p className="italic text-ink-soft">{e.sub}</p>}
            {e.bullets.length > 0 && <ul className="mt-0.5 list-disc space-y-0.5 pl-5">{e.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ResumeSheet({ data, template, hidden, photo, lang }: { data: ResumeData; template: ResumeTemplate; hidden: string[]; photo: boolean; lang: string }) {
  const st = STYLE[template];
  const sections = visibleSections(data, hidden);
  return (
    <article lang={lang === 'hi' ? 'hi' : 'en'} className={`resume-sheet mx-auto max-w-[210mm] bg-white p-6 text-ink shadow-lg sm:p-10 print:max-w-none print:p-0 print:shadow-none ${st.wrap} ${st.body}`}>
      <header className={`flex items-center gap-5 ${st.head} ${template === 'classic' ? 'flex-col sm:flex-row sm:justify-center' : ''}`}>
        {photo && data.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.photoUrl} alt="" className="h-24 w-20 shrink-0 rounded border border-line object-cover" />
        )}
        <div className={template === 'classic' ? 'text-center sm:text-left' : ''}>
          <h1 className={st.name}>{data.name}</h1>
          {data.headline && <p className="mt-0.5 font-semibold">{data.headline}</p>}
          {data.contact.length > 0 && <p className="mt-1 text-ink-soft">{data.contact.join('  |  ')}</p>}
        </div>
      </header>
      {sections.map(s => <Section key={s.key} s={s} tpl={template} />)}
    </article>
  );
}
