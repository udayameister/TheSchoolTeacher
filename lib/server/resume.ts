import type { CandidateProfile, UserAccount } from '@/types';
import type { Locale } from '@/lib/i18n/config';
import { LOCALE_TAGS } from '@/lib/i18n/config';
import { makeT } from '@/lib/i18n/translate';
import { nameOf, namesOf } from '@/lib/jobs/display';
import type { ResumeData, ResumeEntry, ResumeSection } from '@/lib/resume/model';
import { lookupOf } from './catalog';
import type { Store } from './db';
import { signedDocUrl } from './documents';
import { emptyProfile } from './profile';

/*
 * Builds the resume from the candidate's profile. Nothing is invented: a section the profile does not fill
 * stays out. Master-data names are shown in the resume's language; what the candidate typed is kept as typed.
 */

/** The candidate's latest image in the "photo" category, as a short-lived signed link. */
export function photoUrlOf(db: Store, userId: string): string | null {
  const d = db.documents.filter(x => x.userId === userId && x.category === 'photo' && /^image\/(jpeg|png|webp)$/.test(x.mimeType))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
  return d ? signedDocUrl(d.id) : null;
}

export function monthLabel(ym: string | null | undefined, locale: Locale): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(LOCALE_TAGS[locale], { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Total teaching experience in whole months (overlapping jobs are counted once). */
export function experienceMonths(p: CandidateProfile, now = new Date()): number {
  const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const idx = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y * 12 + m - 1; };
  const covered = new Set<number>();
  for (const x of p.experience) {
    if (!/^\d{4}-\d{2}$/.test(x.from)) continue;
    const end = x.current || !x.to ? cur : x.to;
    for (let i = idx(x.from); i <= idx(end) && covered.size < 1200; i++) covered.add(i);
  }
  return covered.size;
}

export function buildResume(db: Store, user: UserAccount, locale: Locale, opts: { photo?: boolean } = {}): ResumeData {
  const p = db.profiles[user.id] || emptyProfile(user.id);
  const lookup = lookupOf(db);
  const t = makeT(locale);
  const nm = (id: string | null | undefined) => nameOf(lookup, id, locale);
  const nms = (ids: string[] | undefined) => namesOf(lookup, ids || [], locale);
  const H = (k: string) => t(`resume.h_${k}`);
  const sections: ResumeSection[] = [];

  const months = experienceMonths(p);
  const years = Math.floor(months / 12);
  const place = [p.city, nm(p.districtId), nm(p.stateId)].filter(Boolean).join(', ');

  sections.push({ key: 'summary', heading: H('summary'), paragraph: p.about || null });

  const teaching: { label: string; value: string }[] = [];
  if (p.subjectIds.length) teaching.push({ label: t('resume.subjects'), value: nms(p.subjectIds) });
  if (p.levelIds.length) teaching.push({ label: t('resume.classes'), value: nms(p.levelIds) });
  if (p.mediums.length) teaching.push({ label: t('resume.mediums'), value: p.mediums.map(m => `${nm(m.mediumId)} (${t(`profile.prof_${m.proficiency}`)})`).join(', ') });
  if (months >= 1) teaching.push({ label: t('resume.totalExperience'), value: years ? t('resume.years', { n: years, m: months % 12 }) : t('resume.months', { n: months }) });
  sections.push({ key: 'teaching', heading: H('teaching'), facts: teaching });

  sections.push({
    key: 'eligibility', heading: H('eligibility'),
    entries: p.tets.map((x): ResumeEntry => ({
      title: [nm(x.tetId), x.paper].filter(Boolean).join(', '),
      dates: x.year ? String(x.year) : null,
      sub: [x.score != null ? t('resume.score', { n: x.score }) : '', x.lifetime ? t('resume.validLifetime') : x.validUntil ? t('resume.validUntil', { d: x.validUntil }) : ''].filter(Boolean).join(' · ') || null,
      bullets: [],
    })),
  });

  const quals = [...p.qualifications].sort((a, b) => (b.year || 0) - (a.year || 0));
  sections.push({
    key: 'education', heading: H('education'),
    entries: quals.map(q => ({
      title: [nm(q.qualificationId), q.subjectId ? nm(q.subjectId) : ''].filter(Boolean).join(', '),
      sub: [q.institution, q.percentage != null ? `${q.percentage}%` : ''].filter(Boolean).join(' · ') || null,
      dates: q.year ? String(q.year) : null,
      bullets: [],
    })),
  });

  const exp = [...p.experience].sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || (b.to || '9999').localeCompare(a.to || '9999') || b.from.localeCompare(a.from));
  sections.push({
    key: 'experience', heading: H('experience'),
    entries: exp.map(x => ({
      title: [nm(x.postId), x.school].filter(Boolean).join(', '),
      sub: [nm(x.boardId), x.levelIds.length ? t('resume.classesShort', { v: nms(x.levelIds) }) : '', x.subjectIds.length ? nms(x.subjectIds) : ''].filter(Boolean).join(' · ') || null,
      dates: `${monthLabel(x.from, locale)} – ${x.current ? t('resume.present') : monthLabel(x.to, locale)}`,
      bullets: String(x.highlights || '').split('\n').map(l => l.replace(/^[\s•\-*–]+/, '').trim()).filter(Boolean).slice(0, 8),
    })),
  });

  sections.push({
    key: 'training', heading: H('training'),
    items: (p.trainings || []).map(x => [x.title, x.provider, x.hours ? t('resume.hours', { n: x.hours }) : '', x.year && !x.title.includes(String(x.year)) ? String(x.year) : ''].filter(Boolean).join(', ')),
  });
  sections.push({
    key: 'awards', heading: H('awards'),
    items: (p.awards || []).map(x => [x.title, x.issuer, x.year && !x.title.includes(String(x.year)) ? String(x.year) : ''].filter(Boolean).join(', ')),
  });

  const skills: string[] = [...(p.skills || [])];
  if (p.computerProficiency !== 'none') skills.push(t('resume.computer', { v: t(`profile.comp_${p.computerProficiency}`) }));
  const certs = String(p.certifications || '').split(/\n|;/).map(s => s.trim()).filter(Boolean);
  sections.push({ key: 'skills', heading: H('skills'), items: [...skills, ...certs] });

  sections.push({ key: 'languages', heading: H('languages'), items: [...new Set([...p.mediums.map(m => nm(m.mediumId)), ...(p.languageIds || []).map(nm)])].filter(Boolean), inline: true });

  const safety: string[] = [];
  if (p.childSafety.policeVerification === 'done') safety.push(t('resume.policeDone', { d: p.childSafety.policeVerificationDate || '' }).replace(/\s*\(\)\s*$/, ''));
  else if (p.childSafety.policeVerification === 'applied') safety.push(t('resume.policeApplied'));
  if (p.childSafety.selfDeclarationAt) safety.push(t('resume.selfDeclaration'));
  sections.push({ key: 'safety', heading: H('safety'), items: safety });

  sections.push({ key: 'links', heading: H('links'), items: (p.links || []).map(l => `${l.label}: ${l.url}`) });

  const extra: { label: string; value: string }[] = [];
  if (p.availability) extra.push({ label: t('profile.availability'), value: t(`profile.avail_${p.availability}`) });
  const prefs = [nms(p.preferredDistrictIds), nms(p.preferredStateIds)].filter(Boolean).join('; ');
  if (prefs) extra.push({ label: t('resume.preferred'), value: prefs });
  if (p.willingToRelocate) extra.push({ label: t('resume.relocate'), value: t('resume.yes') });
  if (p.rciNumber) extra.push({ label: t('profile.rci'), value: p.rciNumber });
  sections.push({ key: 'additional', heading: H('additional'), facts: extra });

  sections.push({ key: 'declaration', heading: H('declaration'), paragraph: t('resume.declarationText') + (place ? `\n${t('resume.place')}: ${p.city || place}` : '') + `\n${t('resume.date')}: ____________\n${user.name}` });

  return {
    name: user.name,
    headline: p.headline || null,
    contact: [p.phone || '', user.email, place].filter(Boolean),
    photoUrl: opts.photo === false ? null : photoUrlOf(db, user.id),
    sections,
  };
}

