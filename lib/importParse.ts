import { createHash } from 'crypto';

/*
 * Parsing for the job importer (pure functions, no network): RSS / Atom feeds, and links on HTML pages
 * (official notice pages, school careers pages). Only short facts are kept for the admin's review: the
 * link, its text, a short piece of nearby text, a date and post names found in it. Nothing is published
 * without the admin, who writes the listing's own description and links to the original.
 * Approach adapted from the AcadeXMatch crawler / notice parser (link harvesting + keyword scoring).
 */

export interface Candidate { title: string; url: string; context: string; date?: string | null; pdf: boolean }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Visible text of an HTML fragment, on one line. */
export function textOf(html: string): string {
  return decodeEntities(html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Absolute http(s) URL, or null. Fragments are removed. */
export function absUrl(href: string, base: string): string | null {
  try {
    const u = new URL(decodeEntities(href.trim()), base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.toString();
  } catch { return null; }
}

// ------------------------------------------------------------------ is this about teacher recruitment?

/** Words that suggest a teacher vacancy or recruitment notice (English, Hindi and common acronyms). */
const STRONG = /\b(teachers?|teaching staff|faculty|PRTs?|TGTs?|PGTs?|NTTs?|lecturers?|headmasters?|headmistress(es)?|principals?|vice[- ]principals?|D\.?S\.?C|T\.?R\.?B|TET|CTET|special educators?|counsell?ors?|librarians?|PET|physical education)\b|शिक्षक|अध्यापक|प्रवक्ता|प्रधानाचार्य|शिक्षिका/i;
const HIRING = /\b(recruitment|vacanc(y|ies)|walk[- ]?in|appointment|notification|advertisement|advt\.?|apply|applications? (are )?invited|engagement|selection|hiring|careers?|openings?|posts?|jobs?|interview)\b|भर्ती|रिक्ति|रिक्तियां|विज्ञापन|आवेदन|नियुक्ति|साक्षात्कार/i;
/** Links that are never vacancies. */
const NOISE = /\b(results?|answer key|admit card|syllabus|tender|quotation|rti|login|sign ?in|home|contact|sitemap|gallery|photo|feedback|privacy|terms|disclaimer|copyright|screen reader|skip to)\b/i;

/** 0 = not relevant, higher = more likely a teacher vacancy / recruitment notice. */
export function relevance(text: string): number {
  if (!text || text.length < 6) return 0;
  const strong = STRONG.test(text), hiring = HIRING.test(text);
  if (!strong && !hiring) return 0;
  let s = (strong ? 2 : 0) + (hiring ? 1 : 0);
  if (NOISE.test(text) && !hiring) s -= 2;
  if (/\b(result|answer key|admit card)\b/i.test(text)) s -= 1;
  return Math.max(0, s);
}

/** On a school's own careers page every job counts; elsewhere a link must mention teaching. */
export function isRelevant(text: string, kind: 'govt_page' | 'school_careers' | 'feed'): boolean {
  const r = relevance(text);
  return kind === 'school_careers' ? r >= 1 : r >= 2;
}

// ------------------------------------------------------------------ dates and posts

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y: number, m: number, d: number) => {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2100 ? dt.toISOString().slice(0, 10) : null;
};

/** All dates in a text (Indian day-first formats, "12 Nov 2026", ISO). */
export function datesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/g)) { const d = iso(+m[3], +m[2], +m[1]); if (d) out.push(d); }
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) { const d = iso(+m[1], +m[2], +m[3]); if (d) out.push(d); }
  for (const m of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?[\s.-]*(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s.,-]*(\d{4})\b/gi)) { const d = iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]); if (d) out.push(d); }
  for (const m of text.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi)) { const d = iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]); if (d) out.push(d); }
  return out;
}

/**
 * The most likely last date: a date right after "last date" / "closing date" / "on or before", otherwise the
 * latest date in the text that is not in the past (unconfirmed: the admin checks it).
 */
export function detectLastDate(text: string, today: string): string | null {
  const m = text.match(/(last\s*date|closing\s*date|on\s*or\s*before|apply\s*(?:by|before)|अंतिम\s*तिथि|अन्तिम\s*तिथि)[^0-9a-z]{0,20}([\s\S]{0,40})/i);
  if (m) { const d = datesIn(m[2])[0]; if (d) return d; }
  const future = datesIn(text).filter(d => d >= today).sort();
  return future.length ? future[future.length - 1] : null;
}

/** Post codes recognised in the text, matched against the admin's post list (codes like PRT, TGT, PGT). */
export function detectPosts(text: string, posts: { id: string; code: string; name: string }[]): string[] {
  const found = new Set<string>();
  for (const p of posts) {
    const code = p.code.replace(/_/g, ' ');
    const re = new RegExp(`\\b(${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})s?\\b`, 'i');
    if (code.length >= 2 && re.test(text)) found.add(p.id);
  }
  return [...found].slice(0, 6);
}

export const itemHash = (url: string, title: string) => createHash('sha256').update(`${url.toLowerCase()}|${title.toLowerCase().replace(/\s+/g, ' ').trim()}`).digest('hex').slice(0, 32);

// ------------------------------------------------------------------ feeds and pages

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

/** Items of an RSS 2.0 or Atom feed. */
export function parseFeed(xml: string, base: string): Candidate[] {
  const out: Candidate[] = [];
  const blocks = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi), ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map(m => m[0]);
  for (const b of blocks.slice(0, 300)) {
    const title = textOf(tag(b, 'title'));
    let link = textOf(tag(b, 'link'));
    if (!link) { const h = b.match(/<link[^>]*href=["']([^"']+)["']/i); link = h ? h[1] : ''; }
    const url = link ? absUrl(link, base) : null;
    if (!title || !url) continue;
    const summary = textOf(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 600);
    const when = textOf(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date'));
    const pub = when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString().slice(0, 10) : null;
    out.push({ title: title.slice(0, 300), url, context: summary, date: pub, pdf: /\.pdf($|\?)/i.test(url) });
  }
  return out;
}

/** Links on an HTML page with their text and a little of the text around them. */
export function parseLinks(html: string, base: string): Candidate[] {
  const body = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const baseTag = body.match(/<base[^>]*href=["']([^"']+)["']/i);
  const baseUrl = (baseTag && absUrl(baseTag[1], base)) || base;
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].match(/href\s*=\s*["']([^"']+)["']|href\s*=\s*([^\s>]+)/i);
    if (!href) continue;
    const url = absUrl(href[1] || href[2], baseUrl);
    if (!url) continue;
    let title = textOf(m[2]);
    const attrTitle = m[1].match(/title\s*=\s*["']([^"']+)["']/i);
    if ((!title || title.length < 6) && attrTitle) title = decodeEntities(attrTitle[1]).trim();
    if (!title || title.length < 6) continue;
    const at = m.index ?? 0;
    // Nearby text (e.g. the table row with dates), without the markup.
    const context = textOf(body.slice(Math.max(0, at - 400), Math.min(body.length, at + m[0].length + 400))).slice(0, 600);
    const key = `${url}|${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: title.slice(0, 300), url, context, pdf: /\.pdf($|\?)/i.test(url) });
  }
  return out;
}
