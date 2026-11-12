/*
 * Resume model shared by the on-screen preview, print/PDF and the Word file. The server builds a
 * ResumeData from the candidate's profile (lib/server/resume.ts); the templates only change how it looks.
 */

export type ResumeTemplate = 'classic' | 'modern' | 'compact';
export const RESUME_TEMPLATES: ResumeTemplate[] = ['classic', 'modern', 'compact'];

export type ResumeSectionKey =
  | 'summary' | 'teaching' | 'eligibility' | 'education' | 'experience' | 'training' | 'awards' | 'skills'
  | 'languages' | 'safety' | 'links' | 'additional' | 'declaration';

/** Sections the candidate can hide (the header is always shown). */
export const OPTIONAL_SECTIONS: ResumeSectionKey[] = ['summary', 'teaching', 'eligibility', 'education', 'experience', 'training', 'awards', 'skills', 'languages', 'safety', 'links', 'additional', 'declaration'];

export interface ResumeEntry { title: string; sub?: string | null; dates?: string | null; bullets: string[] }

export interface ResumeSection {
  key: ResumeSectionKey;
  heading: string;
  paragraph?: string | null;
  /** Short items shown inline ("Mathematics, Science") or as a list. */
  items?: string[];
  inline?: boolean;
  /** Label: value rows. */
  facts?: { label: string; value: string }[];
  entries?: ResumeEntry[];
}

export interface ResumeData {
  name: string;
  headline: string | null;
  contact: string[];
  photoUrl: string | null;
  sections: ResumeSection[];
}

export function visibleSections(d: ResumeData, hidden: Iterable<string>): ResumeSection[] {
  const h = new Set(hidden);
  return d.sections.filter(s => !h.has(s.key) && hasContent(s));
}

export function hasContent(s: ResumeSection): boolean {
  return !!(s.paragraph || s.items?.length || s.facts?.length || s.entries?.length);
}

/** Plain text of the resume (used by the checker, so it scores exactly what the candidate would send). */
export function resumeText(d: ResumeData, hidden: Iterable<string> = []): string {
  const out: string[] = [d.name, d.headline || '', d.contact.join(' | ')];
  for (const s of visibleSections(d, hidden)) {
    out.push('', s.heading.toUpperCase());
    if (s.paragraph) out.push(s.paragraph);
    if (s.items?.length) out.push(...(s.inline ? [s.items.join(', ')] : s.items.map(i => `• ${i}`)));
    for (const f of s.facts || []) out.push(`${f.label}: ${f.value}`);
    for (const e of s.entries || []) {
      out.push(`${e.title}${e.dates ? `    ${e.dates}` : ''}`);
      if (e.sub) out.push(e.sub);
      out.push(...e.bullets.map(b => `• ${b}`));
    }
  }
  return out.filter((l, i, a) => l || a[i - 1]).join('\n').trim();
}

export function cleanHidden(v: string | null | undefined): ResumeSectionKey[] {
  return String(v || '').split(',').filter((k): k is ResumeSectionKey => (OPTIONAL_SECTIONS as string[]).includes(k));
}
