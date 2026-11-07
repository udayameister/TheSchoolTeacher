import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, FileText, Mail, Phone } from 'lucide-react';
import { getT } from '@/lib/i18n/server';
import { requireRole } from '@/lib/server/http';
import { audit, withDb } from '@/lib/server/db';
import { dossier } from '@/lib/server/pipeline';
import { lookupOf } from '@/lib/server/catalog';
import { experienceYears, tetValid } from '@/lib/jobs/match';
import { nameOf, namesOf } from '@/lib/jobs/display';
import MatchExplain from '@/components/jobs/MatchExplain';
import { Notes, StageControl } from '@/components/school/DossierActions';

export const metadata = { title: 'Applicant' };

export default async function ApplicantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(['school_admin', 'school_staff'], `/school/applicants/${id}`);
  const { t, locale } = await getT();
  const r = await withDb(db => {
    const d = dossier(db, user, id);
    // Viewing a candidate's personal data is logged (DPDP accountability).
    if (d) audit(db, { actorId: user.id, action: 'application.view', target: id });
    return d ? { d, lookup: lookupOf(db) } : null;
  });
  if (!r) notFound();
  const { d, lookup } = r;
  const p = d.profile;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const row = (label: string, value: React.ReactNode) => value ? <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-2"><dt className="text-sm font-semibold text-ink-soft">{label}</dt><dd className="sm:col-span-2">{value}</dd></div> : null;

  return (
    <div className="container-page py-6">
      <p className="text-sm"><Link href={`/school/applicants?job=${d.job.id}`} className="inline-flex items-center gap-1"><ArrowLeft size={16} aria-hidden="true" />{t('school.nav_applicants')}</Link></p>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold">{d.candidate.name}</h1>
            <p className="text-ink-soft">{d.job.title} · {t('applications.appliedOn', { date: fmt(d.app.appliedAt) })}</p>
            <span className="badge border-brand-300 bg-brand-50 px-3 py-1 text-sm text-brand-800">{t(`stages.${d.app.stage}`)}</span>
            {p?.headline && <p className="pt-2">{p.headline}</p>}
          </header>

          {d.app.stage !== 'withdrawn' && (
            <section className="card flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6" aria-label={t('ats.contact')}>
              {d.candidate.email && <a href={`mailto:${d.candidate.email}`} className="inline-flex items-center gap-2"><Mail size={18} aria-hidden="true" />{d.candidate.email}</a>}
              {p?.phone && <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2"><Phone size={18} aria-hidden="true" />{p.phone}</a>}
            </section>
          )}

          {d.answers.length > 0 && (
            <section className="card" aria-labelledby="ans-h">
              <h2 id="ans-h" className="text-lg font-bold">{t('apply.questions')}</h2>
              <dl className="mt-2 divide-y divide-line">{d.answers.map((a, i) => (
                <div key={i} className="py-2"><dt className="text-sm font-semibold text-ink-soft">{a.question}</dt>
                  <dd className={a.flagged ? 'flex items-center gap-1 font-semibold text-danger-700' : ''}>{a.flagged && <AlertTriangle size={16} aria-hidden="true" />}{a.answer ? (a.answer === 'yes' || a.answer === 'no' ? t(`common.${a.answer}`) : a.answer) : '—'}{a.flagged && <span className="sr-only"> ({t('ats.notExpected')})</span>}</dd></div>
              ))}</dl>
            </section>
          )}

          {p ? (
            <section className="card" aria-labelledby="prof-h">
              <h2 id="prof-h" className="text-lg font-bold">{t('ats.profile')}</h2>
              <dl className="mt-2 divide-y divide-line">
                {row(t('profile.qualifications'), p.qualifications.length ? <ul>{p.qualifications.map(q => <li key={q.id}>{nameOf(lookup, q.qualificationId, locale)}{q.subjectId ? ` (${nameOf(lookup, q.subjectId, locale)})` : ''}{q.institution ? ` – ${q.institution}` : ''}{q.year ? `, ${q.year}` : ''}{q.percentage != null ? `, ${q.percentage}%` : ''}</li>)}</ul> : '—')}
                {row(t('profile.tets'), p.tets.length ? <ul>{p.tets.map(x => <li key={x.id}>{nameOf(lookup, x.tetId, locale)}{x.paper ? ` – ${x.paper}` : ''}{x.year ? `, ${x.year}` : ''}{x.score != null ? `, ${t('profile.score')} ${x.score}` : ''} · {x.lifetime ? t('profile.lifetime') : x.validUntil ? `${t('profile.validUntil')} ${x.validUntil}` : ''}{!tetValid(x) && <span className="ml-1 font-semibold text-danger-700">({t('ats.expired')})</span>}</li>)}</ul> : '—')}
                {row(t('profile.subjects'), namesOf(lookup, p.subjectIds, locale))}
                {row(t('profile.levels'), namesOf(lookup, p.levelIds, locale))}
                {row(t('profile.mediums'), p.mediums.map(m => `${nameOf(lookup, m.mediumId, locale)} (${t(`profile.prof_${m.proficiency}`)})`).join(', '))}
                {row(t('profile.experience'), p.experience.length ? <><p className="text-sm text-ink-muted">{t('ats.years', { n: experienceYears(p) })}</p><ul className="mt-1 space-y-1">{p.experience.map(x => <li key={x.id}><span className="font-semibold">{x.school}</span>{x.postId ? ` · ${nameOf(lookup, x.postId, locale)}` : ''}{x.boardId ? ` · ${nameOf(lookup, x.boardId, locale)}` : ''} <span className="text-sm text-ink-muted">({x.from} – {x.current ? t('ats.present') : x.to})</span></li>)}</ul></> : t('ats.noExperience'))}
                {row(t('profile.location'), [p.city, nameOf(lookup, p.districtId, locale), nameOf(lookup, p.stateId, locale)].filter(Boolean).join(', '))}
                {row(t('profile.preferences'), [namesOf(lookup, [...p.preferredDistrictIds, ...p.preferredStateIds], locale), p.willingToRelocate ? t('profile.relocate') : ''].filter(Boolean).join(' · '))}
                {row(t('profile.computer'), t(`profile.comp_${p.computerProficiency}`))}
                {row(t('profile.rci'), p.rciNumber)}
                {row(t('profile.certifications'), p.certifications)}
                {row(t('profile.childSafety'), <ul>
                  <li>{t('profile.policeVerification')}: {t(`profile.police_${p.childSafety.policeVerification}`)}{p.childSafety.policeVerificationDate ? ` (${p.childSafety.policeVerificationDate})` : ''}</li>
                  <li>{p.childSafety.selfDeclarationAt ? t('ats.declared', { date: fmt(p.childSafety.selfDeclarationAt) }) : <span className="text-danger-700">{t('ats.notDeclared')}</span>}</li>
                </ul>)}
                {row(t('profile.about'), p.about && <p className="whitespace-pre-line">{p.about}</p>)}
              </dl>
              {p.expectedSalary ? <p className="hint mt-2">{t('ats.salaryHidden')}</p> : null}
            </section>
          ) : <p className="card text-ink-soft">{t('ats.noProfile')}</p>}

          <section className="card" aria-labelledby="docs-h">
            <h2 id="docs-h" className="text-lg font-bold">{t('candidate.nav_documents')}</h2>
            {d.documents.length ? <ul className="mt-2 divide-y divide-line">{d.documents.map(doc => (
              <li key={doc.id} className="flex items-center gap-2 py-2"><FileText size={18} className="shrink-0 text-brand-700" aria-hidden="true" />
                <a href={`${doc.url}&view=1`} target="_blank" rel="noopener" className="font-semibold">{doc.label}</a><span className="text-xs text-ink-muted">{t(`documents.cat_${doc.category}`)}</span></li>
            ))}</ul> : <p className="mt-2 text-ink-soft">{t('documents.none')}</p>}
            <p className="hint mt-2">{t('ats.docsHint')}</p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="card" aria-labelledby="stage-h"><h2 id="stage-h" className="mb-2 text-lg font-bold">{t('ats.stage')}</h2><StageControl id={d.app.id} stage={d.app.stage} /></section>
          {d.match ? <MatchExplain m={d.match} t={t} /> : <p className="card text-sm text-ink-soft">{t('ats.noMatch')}</p>}
          <section className="card" aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-lg font-bold">{t('ats.history')}</h2>
            <ol className="mt-2 space-y-1 text-sm">{d.app.history.map((h, i) => <li key={i}><span className="font-semibold">{t(`stages.${h.stage}`)}</span> · {fmt(h.at)}{h.note ? ` – ${h.note}` : ''}</li>)}</ol>
          </section>
          <section className="card" aria-labelledby="notes-h"><h2 id="notes-h" className="mb-2 text-lg font-bold">{t('ats.notes')}</h2><Notes id={d.app.id} initial={d.notes} /></section>
        </aside>
      </div>
    </div>
  );
}
