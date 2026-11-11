import type { ImportItem, ImportSource, ImportSourceKind, Job, UserAccount } from '@/types';
import { audit, newId, nowIso, withDb, type Store } from './db';
import { lookupOf } from './catalog';
import { listMaster } from './masterData';
import { cleanJob } from './jobPosting';
import { fetchForImport, FetchError } from './importFetch';
import { detectLastDate, detectPosts, isRelevant, itemHash, parseFeed, parseLinks, type Candidate } from '@/lib/importParse';
import { daysLeft, todayIst } from '@/lib/jobs/dates';
import { makeT } from '@/lib/i18n/translate';

/*
 * The job importer. The platform administrator keeps a list of sources: official recruitment pages
 * (KVS, NVS, state DSC / TRB / TET boards), schools' own careers pages, and RSS / Atom feeds. The
 * scheduler reads each active source when it is due, finds links that look like teacher vacancies or
 * recruitment notices, and puts new ones in a review queue. Nothing is published automatically: the
 * administrator checks the original, writes a short listing (post, place, last date, eligibility,
 * official link) and publishes it as "Apply on official site". Listings never copy the original text
 * and never suggest that TheSchoolTeacher is the recruiting body.
 */

export const SOURCE_KINDS: ImportSourceKind[] = ['govt_page', 'school_careers', 'feed'];
export const MAX_SOURCES = 200;
export const PER_TICK = 5;
const MAX_NEW_PER_RUN = 60;
const MAX_ITEMS = 5000;

const str = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
export function cleanUrl(v: unknown): string | null {
  const s = str(v, 600);
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch { return null; }
}

// ------------------------------------------------------------------ sources

export function saveSource(db: Store, admin: UserAccount, input: Record<string, unknown>): { source?: ImportSource; error?: string } {
  const existing = input.id ? db.importSources.find(s => s.id === input.id) : undefined;
  if (input.id && !existing) return { error: 'Source not found.' };
  const name = str(input.name, 120), orgName = str(input.orgName, 160);
  const url = cleanUrl(input.url);
  const kind = input.kind as ImportSourceKind;
  if (name.length < 3) return { error: 'Give the source a name.' };
  if (!url) return { error: 'Enter the full web address, starting with https://' };
  if (!SOURCE_KINDS.includes(kind)) return { error: 'Choose the kind of source.' };
  if (orgName.length < 3) return { error: 'Enter the employer / recruiting body shown on listings.' };
  const everyHours = Math.round(Number(input.everyHours) || 24);
  if (!(everyHours >= 6 && everyHours <= 24 * 14)) return { error: 'Check every 6 hours to 14 days.' };
  const stateId = typeof input.stateId === 'string' && lookupOf(db).get(input.stateId)?.kind === 'states' ? input.stateId : null;
  if (db.importSources.some(s => s.url === url && s.id !== existing?.id)) return { error: 'This address is already a source.' };
  if (!existing && db.importSources.length >= MAX_SOURCES) return { error: `At most ${MAX_SOURCES} sources.` };
  const fields = { name, url, kind, orgName, stateId, everyHours, active: input.active === true, note: str(input.note, 500) || null, verify: existing?.verify && existing.url === url ? existing.verify : false };
  let source: ImportSource;
  if (existing) source = Object.assign(existing, fields);
  else { source = { id: newId('src'), ...fields, createdBy: admin.id, createdAt: nowIso() }; db.importSources.push(source); }
  audit(db, { actorId: admin.id, action: existing ? 'import.source_update' : 'import.source_add', target: source.id, detail: url });
  return { source };
}

export function setSourceActive(db: Store, admin: UserAccount, id: string, active: boolean): string | null {
  const s = db.importSources.find(x => x.id === id);
  if (!s) return 'Source not found.';
  s.active = active;
  if (active) s.verify = false;
  audit(db, { actorId: admin.id, action: active ? 'import.source_on' : 'import.source_off', target: s.id });
  return null;
}

/** Removes a source and the items still waiting for review (published listings stay). */
export function deleteSource(db: Store, admin: UserAccount, id: string): string | null {
  const s = db.importSources.find(x => x.id === id);
  if (!s) return 'Source not found.';
  db.importSources = db.importSources.filter(x => x.id !== id);
  db.importItems = db.importItems.filter(i => i.sourceId !== id || i.status === 'published');
  audit(db, { actorId: admin.id, action: 'import.source_delete', target: id, detail: s.url });
  return null;
}

export const isDue = (s: ImportSource, now = Date.now()) => s.active && (!s.lastRunAt || Date.parse(s.lastRunAt) + s.everyHours * 3600_000 <= now);

// ------------------------------------------------------------------ running

export interface RunResult { found: number; added: number; status: 'ok' | 'error' | 'blocked'; error?: string }

/** Picks out teacher-job candidates from a fetched page or feed. */
export function extractCandidates(kind: ImportSourceKind, body: string, url: string, type: string): Candidate[] {
  const isFeed = kind === 'feed' || /xml|rss|atom/.test(type) || /^\s*<\?xml|<rss[\s>]|<feed[\s>]/i.test(body.slice(0, 500));
  const all = isFeed ? parseFeed(body, url) : parseLinks(body, url);
  const sameOrigin = (u: string) => { try { return new URL(u).origin === new URL(url).origin; } catch { return false; } };
  return all.filter(c => isRelevant(isFeed ? `${c.title} ${c.context.slice(0, 200)}` : c.title, kind) && (isFeed || c.pdf || sameOrigin(c.url) || kind === 'govt_page'));
}

/** Adds new candidates to the queue (de-duplicated). Call inside withDb. */
export function recordCandidates(db: Store, source: ImportSource, candidates: Candidate[], now = new Date()): number {
  const today = todayIst(now);
  const posts = listMaster(db, 'posts').map(p => ({ id: p.id, code: p.code, name: p.name }));
  const known = new Set(db.importItems.map(i => i.hash));
  const listed = new Set(db.jobs.flatMap(j => [j.externalUrl, j.notificationPdfUrl, j.sourceUrl]).filter(Boolean) as string[]);
  const at = now.toISOString();
  let added = 0;
  for (const c of candidates) {
    const hash = itemHash(c.url, c.title);
    if (known.has(hash)) { const it = db.importItems.find(i => i.hash === hash); if (it) it.lastSeenAt = at; continue; }
    if (added >= MAX_NEW_PER_RUN) break;
    known.add(hash);
    const text = `${c.title} ${c.context}`;
    db.importItems.push({
      id: newId('imp'), sourceId: source.id, hash, title: c.title, url: c.url, pdf: c.pdf, excerpt: c.context.slice(0, 500) || null,
      // A date in the link's own text wins over dates in neighbouring rows of the page.
      detectedDate: detectLastDate(c.title, today) || detectLastDate(text, today) || (c.date && c.date >= today ? c.date : null), detectedPostIds: detectPosts(c.title, posts),
      status: listed.has(c.url) ? 'duplicate' : 'new', jobId: null, firstSeenAt: at, lastSeenAt: at,
    });
    added++;
  }
  // Keep the queue bounded: drop the oldest reviewed items first.
  if (db.importItems.length > MAX_ITEMS) {
    const drop = new Set(db.importItems.filter(i => i.status !== 'new' && i.status !== 'published').sort((a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt)).slice(0, db.importItems.length - MAX_ITEMS).map(i => i.id));
    db.importItems = db.importItems.filter(i => !drop.has(i.id));
  }
  return added;
}

/** Reads one source now (network outside the store lock) and records what it found. */
export async function runSource(sourceId: string, actorId: string | null = null): Promise<RunResult> {
  const source = await withDb(db => db.importSources.find(s => s.id === sourceId) ?? null);
  if (!source) return { found: 0, added: 0, status: 'error', error: 'Source not found.' };
  let result: RunResult;
  let candidates: Candidate[] = [];
  try {
    const page = await fetchForImport(source.url);
    candidates = extractCandidates(source.kind, page.body, page.url, page.type);
    result = { found: candidates.length, added: 0, status: 'ok' };
  } catch (e) {
    result = { found: 0, added: 0, status: e instanceof FetchError ? e.kind : 'error', error: (e as Error).message.slice(0, 300) };
  }
  return withDb(db => {
    const s = db.importSources.find(x => x.id === sourceId);
    if (!s) return result;
    if (result.status === 'ok') result.added = recordCandidates(db, s, candidates);
    Object.assign(s, { lastRunAt: nowIso(), lastStatus: result.status, lastError: result.error || null, lastFound: result.found, lastNew: result.added });
    audit(db, { actorId, action: 'import.run', target: s.id, detail: `${result.status}: ${result.found} found, ${result.added} new${result.error ? ` (${result.error.slice(0, 80)})` : ''}` });
    return result;
  });
}

/** Runs the sources that are due (a few per call, oldest first). Called by the scheduler. */
export async function runDueImports(now = Date.now()): Promise<number> {
  if (process.env.TST_DISABLE_IMPORTS === '1') return 0;
  const due = await withDb(db => db.importSources.filter(s => isDue(s, now)).sort((a, b) => (a.lastRunAt || '').localeCompare(b.lastRunAt || '')).slice(0, PER_TICK).map(s => s.id));
  for (const id of due) await runSource(id);
  return due.length;
}

// ------------------------------------------------------------------ review queue

export function setItemStatus(db: Store, admin: UserAccount, id: string, status: 'rejected' | 'duplicate' | 'new'): string | null {
  const it = db.importItems.find(i => i.id === id);
  if (!it) return 'Item not found.';
  if (it.status === 'published') return 'This item is already published as a listing.';
  it.status = status;
  it.reviewedBy = admin.id;
  it.reviewedAt = nowIso();
  return null;
}

/** Marks many items at once (e.g. reject everything not relevant on a page). */
export function bulkStatus(db: Store, admin: UserAccount, ids: unknown, status: 'rejected' | 'duplicate'): number {
  let n = 0;
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, 500)) if (!setItemStatus(db, admin, String(id), status)) n++;
  if (n) audit(db, { actorId: admin.id, action: `import.${status}`, detail: `${n} item(s)` });
  return n;
}

// ------------------------------------------------------------------ listings (government notices and external vacancies)

/**
 * Creates or updates an "Apply on official site" listing (kind government or external) written by the admin,
 * optionally from an import item. Uses the same checks as a school's vacancy form for the shared fields.
 */
export function saveListing(db: Store, admin: UserAccount, input: Record<string, unknown>): { job?: Job; error?: string } {
  if (admin.role !== 'platform_admin') return { error: 'Not allowed.' };
  const lookup = lookupOf(db);
  const existing = typeof input.id === 'string' && input.id ? db.jobs.find(j => j.id === input.id && j.kind !== 'school') : undefined;
  if (input.id && !existing) return { error: 'Listing not found.' };
  const { fields, error } = cleanJob({ ...input, screeningQuestions: [], premium: false }, lookup);
  if (!fields) return { error: error ? makeT('en')(error) : 'Check the form.' };
  const kind = input.kind === 'external' ? 'external' : input.kind === 'government' ? 'government' : null;
  if (!kind) return { error: 'Choose government notice or external vacancy.' };
  const orgName = str(input.orgName, 160);
  if (orgName.length < 3) return { error: 'Enter the recruiting body / school name.' };
  const managementTypeId = typeof input.managementTypeId === 'string' && lookup.get(input.managementTypeId)?.kind === 'managementTypes' ? input.managementTypeId : null;
  if (!managementTypeId) return { error: 'Choose the management type.' };
  const stateId = typeof input.stateId === 'string' && lookup.get(input.stateId)?.kind === 'states' ? input.stateId : null;
  if (!stateId) return { error: 'Choose the state.' };
  const districtId = typeof input.districtId === 'string' && lookup.get(input.districtId)?.kind === 'districts' ? input.districtId : null;
  if (districtId && lookup.get(districtId)?.parentId !== stateId) return { error: 'The district is not in that state.' };
  const externalUrl = cleanUrl(input.externalUrl);
  if (!externalUrl) return { error: 'Enter the official page where candidates apply (https://…).' };
  const notificationPdfUrl = input.notificationPdfUrl ? cleanUrl(input.notificationPdfUrl) : null;
  if (input.notificationPdfUrl && !notificationPdfUrl) return { error: 'The notification link is not a valid web address.' };
  const boardIds = [...new Set((Array.isArray(input.boardIds) ? input.boardIds : []).map(String))].filter(id => lookup.get(id)?.kind === 'boards');
  const publish = input.publish === true;
  if (publish && (daysLeft(fields.lastDate) ?? -1) < 0) return { error: 'The last date has passed.' };
  const item = typeof input.importItemId === 'string' ? db.importItems.find(i => i.id === input.importItemId) : undefined;
  const source = item ? db.importSources.find(s => s.id === item.sourceId) : undefined;
  const at = nowIso();
  const own = {
    kind, schoolId: null, orgName, boardIds, managementTypeId, stateId, districtId, city: str(input.city, 80), pincode: null, lat: null, lng: null,
    applyMode: 'external' as const, externalUrl, notificationPdfUrl, keyDates: [],
    sourceName: source?.name ?? existing?.sourceName ?? null, sourceUrl: item?.url ?? existing?.sourceUrl ?? null, importItemId: item?.id ?? existing?.importItemId ?? null,
  };
  let job: Job;
  if (existing) {
    Object.assign(existing, fields, own, { updatedAt: at });
    if (publish && existing.status !== 'published') { existing.status = 'published'; existing.publishedAt ||= at; }
    job = existing;
  } else {
    job = { id: newId('job'), ...own, ...fields, status: publish ? 'published' : 'draft', publishedAt: publish ? at : null, createdAt: at, updatedAt: at, createdBy: admin.id, views: 0 } as Job;
    db.jobs.push(job);
  }
  if (item) { item.status = 'published'; item.jobId = job.id; item.reviewedBy = admin.id; item.reviewedAt = at; }
  audit(db, { actorId: admin.id, action: existing ? 'listing.update' : 'listing.create', target: job.id, detail: `${job.title} (${job.status})${item ? ' from import' : ''}` });
  return { job };
}

/** Closes a published listing early, or reopens it. */
export function setListingStatus(db: Store, admin: UserAccount, id: string, status: 'closed' | 'published'): string | null {
  const job = db.jobs.find(j => j.id === id && j.kind !== 'school');
  if (!job) return 'Listing not found.';
  if (status === 'published' && (daysLeft(job.lastDate) ?? -1) < 0) return 'The last date has passed; change it first.';
  job.status = status;
  if (status === 'published') job.publishedAt ||= nowIso();
  job.updatedAt = nowIso();
  audit(db, { actorId: admin.id, action: `listing.${status}`, target: job.id });
  return null;
}

/** Prefilled listing values from an import item (the admin completes and checks them). */
export function draftFromItem(db: Store, itemId: string): Record<string, unknown> | null {
  const it = db.importItems.find(i => i.id === itemId);
  if (!it) return null;
  const src = db.importSources.find(s => s.id === it.sourceId);
  return {
    importItemId: it.id, kind: src?.kind === 'govt_page' ? 'government' : 'external', title: it.title.slice(0, 160), orgName: src?.orgName || '',
    stateId: src?.stateId || '', postId: it.detectedPostIds[0] || '', lastDate: it.detectedDate || '',
    externalUrl: it.pdf ? (src?.url || it.url) : it.url, notificationPdfUrl: it.pdf ? it.url : '',
  };
}
