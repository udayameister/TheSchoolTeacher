import { lookup } from 'dns/promises';
import { isIP } from 'net';

/*
 * Polite, safe fetching for the job importer:
 *  - identifies itself (User-Agent with a link to /bot) and honours robots.txt (User-agent: * and our name);
 *  - only http(s) on the standard ports, and never private / local network addresses (the admin types
 *    the URLs, so this stops the server being used to reach internal systems); redirects are checked again;
 *  - 20-second timeout, at most 3 MB, at most 4 redirects, text responses only.
 * TST_IMPORT_ALLOW_PRIVATE=1 lifts the address check (local testing only).
 */

export const BOT_NAME = 'TheSchoolTeacherBot';
export const userAgent = () => `${BOT_NAME}/1.0 (+${(process.env.SITE_URL || process.env.APP_URL || 'https://www.theschoolteacher.in').replace(/\/$/, '')}/bot)`;
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;

export class FetchError extends Error {
  constructor(message: string, public kind: 'blocked' | 'error' = 'error') { super(message); }
}

/** Private, loopback, link-local, carrier-grade NAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

async function checkHost(u: URL): Promise<void> {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new FetchError('Only http and https addresses can be read.', 'blocked');
  if (u.username || u.password) throw new FetchError('Addresses with a user name or password are not allowed.', 'blocked');
  if (process.env.TST_IMPORT_ALLOW_PRIVATE === '1') return;
  if (u.port && !['80', '443'].includes(u.port)) throw new FetchError('Only the standard web ports (80, 443) can be read.', 'blocked');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new FetchError('Local addresses cannot be read.', 'blocked');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new FetchError(`Could not find the site ${host}.`); });
  if (!addrs.length || addrs.some(a => isPrivateAddress(a.address))) throw new FetchError('This address points to a private network and cannot be read.', 'blocked');
}

async function rawGet(url: string, accept: string): Promise<{ status: number; type: string; body: string; url: string }> {
  let current = new URL(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await checkHost(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(current, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': userAgent(), Accept: accept, 'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.6' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        current = new URL(r.headers.get('location')!, current);
        continue;
      }
      const type = (r.headers.get('content-type') || '').toLowerCase();
      const len = Number(r.headers.get('content-length') || 0);
      if (len > MAX_BYTES) throw new FetchError('The page is too large to read (over 3 MB).');
      if (!r.body) return { status: r.status, type, body: '', url: current.toString() };
      const reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) { await reader.cancel().catch(() => undefined); throw new FetchError('The page is too large to read (over 3 MB).'); }
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks);
      const charset = /charset=([\w-]+)/.exec(type)?.[1]?.toLowerCase();
      let body: string;
      try { body = new TextDecoder(charset && charset !== 'utf8' ? charset : 'utf-8').decode(buf); } catch { body = buf.toString('utf8'); }
      return { status: r.status, type, body, url: current.toString() };
    } catch (e) {
      if (e instanceof FetchError) throw e;
      throw new FetchError((e as Error).name === 'AbortError' ? 'The site did not answer in 20 seconds.' : `Could not read the page (${(e as Error).message.slice(0, 120)}).`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchError('Too many redirects.');
}

// ------------------------------------------------------------------ robots.txt

const robotsCache = new Map<string, { at: number; rules: { allow: string[]; disallow: string[] } }>();

/** The rules that apply to us: our own group if present, otherwise "User-agent: *". */
export function robotsRules(txt: string, agent = BOT_NAME): { allow: string[]; disallow: string[] } {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase(), value = m[2].trim();
    if (field === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], allow: [], disallow: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (field === 'disallow' && value) cur.disallow.push(value);
    if (field === 'allow' && value) cur.allow.push(value);
  }
  const mine = groups.filter(g => g.agents.some(a => a !== '*' && agent.toLowerCase().includes(a)));
  const pick = mine.length ? mine : groups.filter(g => g.agents.includes('*'));
  return { allow: pick.flatMap(g => g.allow), disallow: pick.flatMap(g => g.disallow) };
}

const ruleMatch = (rule: string, path: string) => {
  const re = new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
  return re.test(path);
};

/** May we read this path? The longest matching rule wins; Allow wins a tie. */
export function robotsAllows(rules: { allow: string[]; disallow: string[] }, path: string): boolean {
  const best = (list: string[]) => Math.max(-1, ...list.filter(r => ruleMatch(r, path)).map(r => r.length));
  return best(rules.allow) >= best(rules.disallow);
}

async function allowedByRobots(u: URL): Promise<boolean> {
  const key = u.origin;
  let hit = robotsCache.get(key);
  if (!hit || Date.now() - hit.at > 6 * 3600_000) {
    let rules = { allow: [] as string[], disallow: [] as string[] };
    try {
      const r = await rawGet(`${u.origin}/robots.txt`, 'text/plain,*/*;q=0.5');
      if (r.status >= 200 && r.status < 300 && !/html/.test(r.type)) rules = robotsRules(r.body);
    } catch (e) { if (e instanceof FetchError && e.kind === 'blocked') throw e; /* no robots.txt: allowed */ }
    hit = { at: Date.now(), rules };
    robotsCache.set(key, hit);
  }
  return robotsAllows(hit.rules, u.pathname + u.search);
}

/** Reads a page or feed for the importer. Throws FetchError with a plain-English reason. */
export async function fetchForImport(url: string): Promise<{ body: string; type: string; url: string }> {
  let u: URL;
  try { u = new URL(url); } catch { throw new FetchError('This is not a valid web address.', 'blocked'); }
  if (!(await allowedByRobots(u))) throw new FetchError("The site's robots.txt asks automated readers not to read this page, so it was skipped.", 'blocked');
  const r = await rawGet(u.toString(), 'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5');
  if (r.status === 404 || r.status === 410) throw new FetchError(`The page was not found (HTTP ${r.status}). It may have moved.`);
  if (r.status >= 400) throw new FetchError(`The site answered with an error (HTTP ${r.status}).`);
  if (/pdf|image|octet-stream|zip/.test(r.type)) throw new FetchError('The address is a file, not a page or feed. Add the page that links to it instead.');
  return { body: r.body, type: r.type, url: r.url };
}

export const _test = { robotsCache };
