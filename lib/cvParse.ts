/*
 * CV import for teachers (rule-based, in-house; section and date logic adapted from AcadeXMatch's parser).
 * Turns CV text into suggestions for the profile: mobile number, summary, qualifications, TETs, subjects,
 * classes, experience, training, awards, skills and languages. Master-data items are recognised by their
 * name, code and the optional "aliases" meta field the admin can edit. Nothing is guessed: a field the CV
 * does not state stays empty, and the candidate reviews every suggestion before it reaches the profile.
 */
import type { MasterItem } from '@/types';

export type CvSection = 'summary' | 'experience' | 'education' | 'eligibility' | 'skills' | 'training' | 'awards' | 'languages' | 'personal' | 'other';

export interface CvSuggestions {
  name: string | null;
  email: string | null;
  phone: string | null;
  summary: string | null;
  qualifications: { qualificationId: string; label: string; institution: string; year: number | null; percentage: number | null; raw: string }[];
  tets: { tetId: string; label: string; paper: string; year: number | null; score: number | null; raw: string }[];
  subjectIds: string[];
  levelIds: string[];
  mediumIds: string[];
  experience: { school: string; postId: string | null; from: string; to: string | null; current: boolean; highlights: string; raw: string }[];
  trainings: string[];
  awards: string[];
  skills: string[];
  /** Personal details Indian CVs often carry that a resume does not need (shown as advice only). */
  personalDetails: string[];
  sectionsFound: CvSection[];
}

const HEADINGS: [CvSection, RegExp][] = [
  ['summary', /^(professional |career |personal )?(summary|profile|objective|overview|statement)$|^about( me)?$|^career objective$/],
  ['eligibility', /^(teacher )?eligibility( tests?| test details| details)?$|^(tet|ctet|stet)( details| qualifications?| scores?)?$|^competitive exams?( qualified| cleared)?$/],
  ['experience', /^(teaching |work |professional |relevant )?(experience|history)$|^employment( history| details)?$|^work history$|^positions? held$|^experience details$/],
  ['education', /^(education|educational|academic)( qualifications?| background| details| record| profile)?$|^qualifications?$|^professional qualifications?$/],
  ['skills', /^((teaching|key|core|professional|computer|it|technical|co[- ]?curricular|soft) )?(skills|competenc(y|ies)|strengths|expertise)$|^skill set$|^extra[- ]?curricular( activities)?$|^co[- ]?curricular activities$|^hobbies( and interests)?$/],
  ['training', /^(trainings?|workshops?|in[- ]?service trainings?|professional development|certifications?|courses|seminars)( (attended|completed|undergone))?( (and|&) [a-z ]+)?$/],
  ['awards', /^(awards?|honou?rs|achievements?|accomplishments|recognitions?)( (and|&) (awards?|honou?rs|achievements?|recognitions?))?$/],
  ['languages', /^languages?( known)?$/],
  ['personal', /^personal (details|information|profile|data)$|^declaration$|^references?$/],
];

function headingOf(line: string): CvSection | null {
  const raw = line.replace(/^[\s•\-–*#\d.)]+/, '').replace(/[:\-–]+$/, '').trim();
  if (!raw || raw.length > 48 || raw.split(/\s+/).length > 6) return null;
  const norm = raw.toLowerCase().replace(/&/g, 'and').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [key, re] of HEADINGS) if (re.test(norm) || re.test(norm.replace(/ and /g, ' & '))) return key;
  return null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MON = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE = `(?:${MON}\\.?,?\\s*'?\\d{4}|\\d{1,2}[/.-]\\d{4}|\\d{4})`;
const END = `(?:${DATE}|present|current|now|till date|to date|ongoing|continuing)`;
const RANGE_RE = new RegExp(`(${DATE})\\s*(?:-|–|—|to|till|until)\\s*(${END})`, 'i');
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const MOBILE = /(?:\+?91[\s-]?|0)?([6-9]\d{4})[\s-]?(\d{5})\b/;
const BULLET = /^\s*(?:[•●▪◦‣∙·*\-–➢►✓]|\d{1,2}[.)]|[a-z][.)])\s+/i;
const YEAR = /\b(19[6-9]\d|20\d{2})\b/g;

function ym(s: string, now: Date): { v: string; current: boolean } | null {
  const t = s.toLowerCase().replace(/'/g, '').trim();
  if (/present|current|now|till date|to date|ongoing|continuing/.test(t)) return { v: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, current: true };
  let m = t.match(new RegExp(`^(${MON})\\.?,?\\s*(\\d{4})$`));
  if (m) return { v: `${m[2]}-${String(MONTHS[m[1].slice(0, 3)] || 1).padStart(2, '0')}`, current: false };
  m = t.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return { v: `${m[2]}-${String(Math.min(12, Math.max(1, +m[1]))).padStart(2, '0')}`, current: false };
  m = t.match(/^(\d{4})$/);
  if (m) return { v: `${m[1]}-06`, current: false };
  return null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9ऀ-ॿ]+/g, '');
const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9.+ऀ-ॿ]+/g, ' ')} `;
const strip = (l: string) => l.replace(BULLET, '').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ways a master item can be written: name (and the part before "("), Hindi name, code, admin aliases. */
function namesFor(i: MasterItem): string[] {
  // Two-letter codes (EN, HI, AS …) are left out: they are ordinary words in a CV.
  const out = [i.name, i.name.replace(/\s*\(.*\)\s*/g, ' ').trim(), i.code.length >= 3 ? i.code.replace(/_/g, ' ') : '', i.nameHi || ''];
  const inner = i.name.match(/\(([^)]+)\)/)?.[1];
  if (inner && inner.length > 3) out.push(inner);
  for (const a of String(i.meta?.aliases || '').split(',')) out.push(a);
  return [...new Set(out.map(s => s.trim()).filter(s => s.length >= 2))];
}

/** Generic degree spellings for the "subject degree" qualification codes (used only when those codes exist). */
const GENERIC_DEGREES: Record<string, RegExp> = {
  PHD: /\b(ph\.?\s?d|doctorate)\b/i,
  MPHIL: /\bm\.?\s?phil\b/i,
  PG: /\b(m\.?\s?a\b|m\.a\.|m\.?\s?sc|m\.?\s?com|mca|m\.?\s?tech|master(?:'s)?\s+(of|in)|post[- ]?graduat)/i,
  UG: /\b(b\.?\s?a\b|b\.a\.|b\.?\s?sc|b\.?\s?com|bca|b\.?\s?tech|b\.?\s?e\b|bachelor(?:'s)?\s+(of|in)|graduat(e|ion)\b)/i,
  SENIOR_SECONDARY: /\b(12th|xii|hsc|intermediate|higher secondary|senior secondary|class 12|puc)\b/i,
};

/**
 * Items mentioned in a line, best first: an item whose full name appears ("B.Ed (Special Education)") beats one
 * found only by a short form ("B.Ed"); among short-form matches the plainer (shorter) name wins.
 */
function matcher(items: MasterItem[]): (line: string) => MasterItem[] {
  const toPat = (n: string) => {
    const compact = norm(n);
    // Short codes and dotted abbreviations (B.Ed, D.El.Ed, CTET) are matched on the compacted text.
    return compact.length <= 8 ? { compact, re: null as RegExp | null } : { compact: '', re: new RegExp(`(^|[^a-z])${esc(n.toLowerCase()).replace(/\s+/g, '\\s+')}($|[^a-z])`, 'i') };
  };
  const pats = items.map(i => ({ i, full: toPat(i.name), res: namesFor(i).map(toPat) }));
  return line => {
    const w = words(line);
    const tokens = w.trim().split(/\s+/);
    const joined = new Set<string>();
    for (let a = 0; a < tokens.length; a++) for (let b = a; b < Math.min(tokens.length, a + 4); b++) joined.add(norm(tokens.slice(a, b + 1).join('')));
    const hit = (r: { compact: string; re: RegExp | null }) => (r.re ? r.re.test(line) : r.compact.length >= 2 && joined.has(r.compact));
    return pats.filter(p => p.res.some(hit))
      .map(p => ({ i: p.i, full: hit(p.full) && /\(/.test(p.i.name) ? 1 : 0 }))
      .sort((a, b) => b.full - a.full || a.i.name.length - b.i.name.length)
      .map(x => x.i);
  };
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
const classNo = (v: string) => (/^\d+$/.test(v) ? Number(v) : ROMAN[v.toLowerCase()] || 0);

/** "Classes VI to X", "Class 3–5", "classes VIII-X" → the school levels (meta fromClass / toClass) they overlap. */
export function levelsFromClasses(text: string, levels: MasterItem[]): string[] {
  const out = new Set<string>();
  const re = /\bclass(?:es)?\s+((?:x{0,1}(?:ix|iv|v?i{0,3}))|\d{1,2})\s*(?:-|–|—|to)\s*((?:x{0,1}(?:ix|iv|v?i{0,3}))|\d{1,2})\b/gi;
  for (const m of text.matchAll(re)) {
    const a = classNo(m[1]), b = classNo(m[2]);
    if (!a || !b || a > b || b > 12) continue;
    for (const l of levels) {
      const from = Number(l.meta?.fromClass), to = Number(l.meta?.toClass);
      if (Number.isFinite(from) && Number.isFinite(to) && to >= 1 && from <= b && to >= a) out.add(l.id);
    }
  }
  return [...out];
}

export interface CvLists { qualifications: MasterItem[]; tets: MasterItem[]; subjects: MasterItem[]; levels: MasterItem[]; mediums: MasterItem[]; posts: MasterItem[] }

export function parseCv(text: string, lists: CvLists, now = new Date()): CvSuggestions {
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+/g, ' ').trim());
  const nonEmpty = lines.filter(Boolean);

  const sections: { key: CvSection; lines: string[] }[] = [];
  let cur: { key: CvSection; lines: string[] } = { key: 'other', lines: [] };
  for (const l of lines) {
    const h = l ? headingOf(l) : null;
    if (h) { if (cur.lines.some(Boolean)) sections.push(cur); cur = { key: h, lines: [] }; } else cur.lines.push(l);
  }
  if (cur.lines.some(Boolean)) sections.push(cur);
  const sec = (k: CvSection) => sections.filter(s => s.key === k).flatMap(s => s.lines).filter(Boolean);

  const email = text.match(EMAIL)?.[0] || null;
  const mob = nonEmpty.slice(0, 40).map(l => l.replace(EMAIL, '')).map(l => l.match(MOBILE)).find(Boolean);
  const phone = mob ? `${mob[1]} ${mob[2]}` : null;
  const name = nonEmpty.slice(0, 6).map(l => l.replace(/^(curriculum vitae|resume|résumé|bio[- ]?data|cv)\s*[:\-–]?\s*/i, '').trim())
    .find(l => l && l.length <= 50 && /^[A-Za-z][A-Za-z.' -]+$/.test(l) && l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 5 && !headingOf(l) && !/curriculum|resume|vitae|bio-?data/i.test(l)) || null;

  const summaryLines = sec('summary');
  const summary = summaryLines.length ? summaryLines.map(strip).join(' ').slice(0, 2000) : null;

  // Qualifications: every line in the education section (or anywhere, for teacher-education degrees).
  const qMatch = matcher(lists.qualifications);
  const qualifications: CvSuggestions['qualifications'] = [];
  const eduLines = sec('education').length ? sec('education') : nonEmpty;
  for (const raw of eduLines) {
    const l = strip(raw);
    if (l.length > 220 || RANGE_RE.test(l) && !/\b(b\.?ed|d\.?el|m\.?ed|degree|university)\b/i.test(l)) continue;
    let found = qMatch(l);
    if (!found.length) {
      const code = Object.keys(GENERIC_DEGREES).find(c => GENERIC_DEGREES[c].test(l));
      const item = code && lists.qualifications.find(i => i.code === code);
      if (item) found = [item];
    }
    const best = found[0];
    if (!best || qualifications.some(q => q.qualificationId === best.id)) continue;
    const years = [...l.matchAll(YEAR)].map(m => +m[1]).filter(y => y <= now.getFullYear() + 1);
    const pct = l.match(/(\d{2}(?:\.\d{1,2})?)\s*%/)?.[1];
    const institution = l.split(/\s*[|,–—]\s*|\s+-\s+/).find(s => /universit|college|institute|board|school|vidyalaya|vidyapeeth|nios|cbse|icse/i.test(s)) || '';
    qualifications.push({ qualificationId: best.id, label: best.name, institution: institution.slice(0, 160), year: years.length ? Math.max(...years) : null, percentage: pct ? Math.min(100, +pct) : null, raw: l.slice(0, 200) });
    if (qualifications.length >= 12) break;
  }

  // TETs: anywhere in the CV (often listed under education).
  const tMatch = matcher(lists.tets);
  const tets: CvSuggestions['tets'] = [];
  for (const raw of nonEmpty) {
    const l = strip(raw);
    if (l.length > 220) continue;
    for (const item of tMatch(l)) {
      if (tets.some(x => x.tetId === item.id)) continue;
      if (/\b(preparing|appearing|will appear|awaited|not qualified)\b/i.test(l)) continue;
      const paper = l.match(/\bpaper\s*[-–:]?\s*(i{1,2}|1|2|one|two)\b/i)?.[1];
      const papers = String(item.meta?.papers || '').split(',').map(s => s.trim()).filter(Boolean);
      const want = paper ? (/^(ii|2|two)$/i.test(paper) ? 1 : 0) : -1;
      const years = [...l.matchAll(YEAR)].map(m => +m[1]);
      const score = l.match(/\b(?:score|marks)\s*[:\-]?\s*(\d{2,3}(?:\.\d+)?)/i)?.[1];
      tets.push({ tetId: item.id, label: item.name, paper: want >= 0 ? papers[want] || `Paper ${want ? 'II' : 'I'}` : '', year: years.length ? Math.max(...years) : null, score: score ? +score : null, raw: l.slice(0, 200) });
    }
  }

  // Experience: lines with a date range in the experience section (or anywhere, when there is no such section).
  const pMatch = matcher(lists.posts);
  const expLines = sec('experience').length ? sec('experience') : nonEmpty.filter(l => !/\b(b\.?ed|d\.?el|degree|university|board)\b/i.test(l));
  const experience: CvSuggestions['experience'] = [];
  for (let i = 0; i < expLines.length; i++) {
    const l = strip(expLines[i]);
    const m = l.match(RANGE_RE);
    if (!m) continue;
    const from = ym(m[1], now), to = ym(m[2], now);
    if (!from || !to || to.v < from.v) continue;
    let rest = l.replace(m[0], '').replace(/[()|,–—:-]+\s*$/, '').replace(/^\s*[()|,–—:-]+/, '').replace(/\s*\(\s*\)\s*/, ' ').trim();
    if (rest.length < 3 && i > 0) rest = strip(expLines[i - 1]);
    const post = pMatch(rest)[0] || pMatch(expLines[i + 1] || '')[0] || null;
    const school = (rest.split(/\s*(?:\||,|–|—| - | at | @ )\s*/i).find(s => /school|vidyalaya|academy|public|convent|college|institute|mandir|niketan|ashram|kendriya|navodaya/i.test(s)) || rest)
      .replace(/^(worked|working)\s+(as|at)\s+/i, '').slice(0, 160).trim();
    const bullets: string[] = [];
    for (let k = i + 1; k < expLines.length && bullets.length < 8; k++) {
      if (RANGE_RE.test(expLines[k])) break;
      if (BULLET.test(expLines[k])) bullets.push(strip(expLines[k]));
    }
    if (school) experience.push({ school, postId: post?.id || null, from: from.v, to: to.current ? null : to.v, current: to.current, highlights: bullets.join('\n'), raw: l.slice(0, 200) });
    if (experience.length >= 15) break;
  }

  const all = nonEmpty.join('\n');
  const teachingText = [...sec('summary'), ...sec('experience'), ...sec('skills'), ...nonEmpty.slice(0, 8)].join('\n') || all;
  const subjectIds = [...new Set(matcher(lists.subjects)(teachingText).map(i => i.id))].slice(0, 15);
  const levelIds = [...new Set([...matcher(lists.levels)(teachingText).map(i => i.id), ...levelsFromClasses(teachingText, lists.levels)])].slice(0, 10);
  const langLines = sec('languages').join(', ');
  const mediumIds = langLines ? [...new Set(matcher(lists.mediums)(langLines).map(i => i.id))] : [];

  const items = (k: CvSection) => sec(k).flatMap(l => (BULLET.test(l) || l.length < 120 ? [strip(l)] : l.split(/;\s*/))).map(s => s.trim()).filter(s => s.length > 2 && s.length <= 200);
  const skills = [...new Set(sec('skills').flatMap(l => strip(l).split(/\s*[,;|•]\s*/)).map(s => s.replace(/\.$/, '').trim()).filter(s => s.length > 1 && s.length <= 60))].slice(0, 30);

  const personalDetails = [
    [/\b(date of birth|d\.?o\.?b\.?)\b/i, 'dob'], [/\breligion\b/i, 'religion'], [/\bcaste\b/i, 'caste'], [/\bmarital status\b/i, 'marital'],
    [/\b(father'?s|husband'?s|mother'?s) name\b/i, 'family'], [/\bnationality\b/i, 'nationality'], [/\bgender|sex\b/i, 'gender'],
  ].filter(([re]) => (re as RegExp).test(all)).map(([, k]) => k as string);

  return {
    name, email, phone, summary, qualifications, tets, subjectIds, levelIds, mediumIds, experience,
    trainings: items('training').slice(0, 20), awards: items('awards').slice(0, 15), skills, personalDetails,
    sectionsFound: [...new Set(sections.map(s => s.key))].filter(k => k !== 'other'),
  };
}
