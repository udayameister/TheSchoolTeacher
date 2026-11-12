'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, FileUp } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { itemName } from '@/lib/i18n/translate';
import type { CvSuggestions } from '@/lib/cvParse';
import type { CheckResult } from '@/lib/resumeCheck';

type Names = Record<string, { name: string; nameHi?: string }>;

function ScoreCard({ r, title }: { r: CheckResult; title: string }) {
  const { t } = useI18n();
  const color = r.grade === 'strong' ? 'text-success-700' : r.grade === 'good' ? 'text-brand-700' : r.grade === 'fair' ? 'text-marigold-800' : 'text-danger-700';
  const list = (key: string, v: string | number | undefined) => String(v || '').split(',').filter(Boolean).map(k => t(`checker.${key}_${k}`)).join(', ');
  return (
    <section className="card space-y-4" aria-label={title}>
      <div className="flex flex-wrap items-center gap-4">
        <p className={`text-5xl font-bold ${color}`}>{r.score}<span className="text-xl text-ink-muted">/100</span></p>
        <div><h2 className="text-lg font-bold">{title}</h2><p className={`font-semibold ${color}`}>{t(`checker.grade_${r.grade}`)}</p><p className="hint">{t('checker.words', { n: r.words })}</p></div>
      </div>
      <ul className="space-y-2">
        {r.checks.map(c => (
          <li key={c.key} className="flex gap-2">
            {c.got >= 1 ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" /> : <CircleAlert size={20} className="mt-0.5 shrink-0 text-marigold-700" aria-hidden="true" />}
            <div>
              <p className="font-semibold">{t(`checker.c_${c.key}`)} <span className="text-sm font-normal text-ink-muted">({Math.round(c.got * c.weight)}/{c.weight})</span></p>
              {c.tip && <p className="text-sm text-ink-soft">{t(`checker.${c.tip}`, { n: c.vars?.n ?? '', total: c.vars?.total ?? '', list: c.key === 'layout' ? list('layout', c.vars?.list) : c.key === 'personal' ? list('personal', c.vars?.list) : '' })}</p>}
            </div>
          </li>
        ))}
      </ul>
      {r.jobMatch && (
        <div className="rounded-lg border border-line p-3">
          <p className="font-semibold">{t('checker.jobMatch', { n: r.jobMatch.percent })}</p>
          {r.jobMatch.found.length > 0 && <p className="text-sm"><span className="text-success-700">{t('checker.found')}:</span> {r.jobMatch.found.join(', ')}</p>}
          {r.jobMatch.missing.length > 0 && <p className="text-sm"><span className="text-danger-700">{t('checker.missing')}:</span> {r.jobMatch.missing.join(', ')}</p>}
          <p className="hint">{t('checker.jobMatchHint')}</p>
        </div>
      )}
    </section>
  );
}

export default function CvTools({ built, jobs, jobId, hide }: { built: CheckResult; jobs: { id: string; label: string }[]; jobId: string | null; hide: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ cv: CvSuggestions; check: CheckResult; names: Names } | null>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [applied, setApplied] = useState<string | null>(null);
  const nm = (names: Names, id: string | null | undefined) => (id && names[id] ? itemName(names[id], locale) : '');

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) { setErr(t('checker.chooseFile')); return; }
    setBusy(true); setErr(null); setRes(null); setApplied(null);
    const fd = new FormData();
    fd.append('file', f);
    if (jobId) fd.append('jobId', jobId);
    try {
      const r = await fetch('/api/candidate/cv', { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) setErr(j.error || t('common.somethingWrong'));
      else {
        setRes(j);
        const p: Record<string, boolean> = {};
        const cv = j.cv as CvSuggestions;
        if (cv.phone) p.phone = true;
        if (cv.summary) p.summary = false;
        cv.qualifications.forEach((_, i) => { p[`q${i}`] = true; });
        cv.tets.forEach((_, i) => { p[`t${i}`] = true; });
        cv.experience.forEach((_, i) => { p[`x${i}`] = true; });
        cv.subjectIds.forEach(id => { p[`s:${id}`] = true; });
        cv.levelIds.forEach(id => { p[`l:${id}`] = true; });
        cv.mediumIds.forEach(id => { p[`m:${id}`] = true; });
        cv.trainings.forEach((_, i) => { p[`tr${i}`] = true; });
        cv.awards.forEach((_, i) => { p[`aw${i}`] = true; });
        cv.skills.forEach((_, i) => { p[`sk${i}`] = true; });
        setPick(p);
      }
    } catch { setErr(t('common.somethingWrong')); }
    setBusy(false);
  }

  async function apply() {
    if (!res) return;
    const cv = res.cv;
    setBusy(true); setErr(null);
    const body = {
      phone: pick.phone ? cv.phone : null, summary: pick.summary ? cv.summary : null,
      qualifications: cv.qualifications.filter((_, i) => pick[`q${i}`]), tets: cv.tets.filter((_, i) => pick[`t${i}`]),
      experience: cv.experience.filter((_, i) => pick[`x${i}`]),
      subjectIds: cv.subjectIds.filter(id => pick[`s:${id}`]), levelIds: cv.levelIds.filter(id => pick[`l:${id}`]), mediumIds: cv.mediumIds.filter(id => pick[`m:${id}`]),
      trainings: cv.trainings.filter((_, i) => pick[`tr${i}`]), awards: cv.awards.filter((_, i) => pick[`aw${i}`]), skills: cv.skills.filter((_, i) => pick[`sk${i}`]),
    };
    try {
      const r = await fetch('/api/candidate/cv/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.ok) { setApplied(t('checker.applied', { n: j.completeness.percent })); router.refresh(); } else setErr(j.error || t('common.somethingWrong'));
    } catch { setErr(t('common.somethingWrong')); }
    setBusy(false);
  }

  const box = (key: string, label: React.ReactNode, sub?: string) => (
    <li key={key}><label className="flex min-h-[40px] gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={!!pick[key]} onChange={e => setPick(p => ({ ...p, [key]: e.target.checked }))} /><span>{label}{sub && <span className="block text-xs text-ink-muted">{sub}</span>}</span></label></li>
  );
  const group = (title: string, items: React.ReactNode[]) => items.length > 0 && <fieldset><legend className="label">{title}</legend><ul className="space-y-1">{items}</ul></fieldset>;

  return (
    <>
      {jobs.length > 0 && (
        <div className="card">
          <label htmlFor="ck-job" className="label">{t('checker.compareWith')}</label>
          <select id="ck-job" className="input" value={jobId || ''} onChange={e => router.replace(`/candidate/resume/check?hide=${hide}${e.target.value ? `&job=${e.target.value}` : ''}`, { scroll: false })}>
            <option value="">{t('checker.noJob')}</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.label}</option>)}
          </select>
          <p className="hint">{t('checker.compareHint')}</p>
        </div>
      )}

      <ScoreCard r={built} title={t('checker.builtTitle')} />
      <p className="text-sm"><Link href="/candidate/profile">{t('profile.edit')}</Link> · <Link href="/candidate/resume">{t('resume.title')}</Link></p>

      <section id="import" className="card space-y-4" aria-labelledby="imp-h">
        <div><h2 id="imp-h" className="text-lg font-bold">{t('checker.uploadTitle')}</h2><p className="hint">{t('checker.uploadHint')}</p></div>
        <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
          <div className="grow"><label htmlFor="cv-file" className="label">{t('checker.file')}</label><input id="cv-file" ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="input" /></div>
          <button className="btn-primary" disabled={busy}><FileUp size={18} aria-hidden="true" />{busy ? t('common.loading') : t('checker.read')}</button>
        </form>
        <div aria-live="polite">{err && <p className="text-danger-700">{err}</p>}{applied && <p className="font-semibold text-success-700">{applied} <Link href="/candidate/profile">{t('profile.edit')}</Link> · <Link href="/candidate/resume">{t('resume.title')}</Link></p>}</div>
      </section>

      {res && <ScoreCard r={res.check} title={t('checker.uploadedTitle')} />}

      {res && (
        <section className="card space-y-4" aria-labelledby="sug-h">
          <div><h2 id="sug-h" className="text-lg font-bold">{t('checker.suggestionsTitle')}</h2><p className="hint">{t('checker.suggestionsHint')}</p></div>
          {group(t('profile.personal'), [
            ...(res.cv.phone ? [box('phone', `${t('profile.phone')}: ${res.cv.phone}`)] : []),
            ...(res.cv.summary ? [box('summary', t('checker.useSummary'), res.cv.summary.slice(0, 220) + (res.cv.summary.length > 220 ? '…' : ''))] : []),
          ])}
          {group(t('profile.qualifications'), res.cv.qualifications.map((q, i) => box(`q${i}`, [nm(res.names, q.qualificationId), q.year, q.percentage != null ? `${q.percentage}%` : ''].filter(Boolean).join(' · '), q.raw)))}
          {group(t('profile.tets'), res.cv.tets.map((x, i) => box(`t${i}`, [nm(res.names, x.tetId), x.paper, x.year].filter(Boolean).join(' · '), x.raw)))}
          {group(t('profile.experience'), res.cv.experience.map((x, i) => box(`x${i}`, [nm(res.names, x.postId), x.school].filter(Boolean).join(', '), `${x.from} – ${x.current ? t('resume.present') : x.to}`)))}
          {group(t('profile.subjects'), res.cv.subjectIds.map(id => box(`s:${id}`, nm(res.names, id))))}
          {group(t('profile.levels'), res.cv.levelIds.map(id => box(`l:${id}`, nm(res.names, id))))}
          {group(t('profile.languagesKnown'), res.cv.mediumIds.map(id => box(`m:${id}`, nm(res.names, id))))}
          {group(t('profile.trainings'), res.cv.trainings.map((v, i) => box(`tr${i}`, v)))}
          {group(t('profile.awards'), res.cv.awards.map((v, i) => box(`aw${i}`, v)))}
          {group(t('profile.skills'), res.cv.skills.map((v, i) => box(`sk${i}`, v)))}
          {Object.keys(pick).length === 0 ? <p>{t('checker.nothingFound')}</p> : <button type="button" className="btn-primary" disabled={busy || !Object.values(pick).some(Boolean)} onClick={apply}>{t('checker.apply')}</button>}
          <p className="hint">{t('checker.applyHint')}</p>
        </section>
      )}
    </>
  );
}
