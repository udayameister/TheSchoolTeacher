import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { describe, eq, it, ok } from './harness';
import { withDb } from '@/lib/server/db';
import { registerUser } from '@/lib/server/auth';
import { publicJobs } from '@/lib/server/catalog';
import { datesIn, detectLastDate, detectPosts, isRelevant, parseFeed, parseLinks, relevance, textOf } from '@/lib/importParse';
import { fetchForImport, isPrivateAddress, robotsAllows, robotsRules, _test } from '@/lib/server/importFetch';
import { deleteSource, draftFromItem, extractCandidates, isDue, recordCandidates, runDueImports, runSource, saveListing, saveSource, setItemStatus, setListingStatus } from '@/lib/server/importer';
import { plusDays } from './fixtures';
import type { UserAccount } from '@/types';
import { makeT } from '@/lib/i18n/translate';

const NOTICES = `<!doctype html><html><head><title>Recruitment</title><script>var x = '<a href="/evil">teacher recruitment</a>';</script></head><body>
<nav><a href="/">Home</a> <a href="/contact">Contact us</a> <a href="/login">Login</a></nav>
<table>
<tr><td>1</td><td><a href="/docs/advt-12-2026.pdf">Recruitment of PGT and TGT (Advt. No. 12/2026) &ndash; Notification</a></td><td>Last date: 15/12/2026</td></tr>
<tr><td>2</td><td><a href="notices/prt.html">Walk-in interview for PRT (contractual) on 20-12-2026</a></td></tr>
<tr><td>3</td><td><a href="/results/tgt.pdf">Result of TGT examination 2025</a></td></tr>
<tr><td>4</td><td><a href="/tender/1.pdf">Tender for supply of furniture</a></td></tr>
<tr><td>5</td><td><a href="https://other.example.org/a">शिक्षक भर्ती विज्ञापन 2026</a></td></tr>
<tr><td>6</td><td><a href="javascript:void(0)">Teacher recruitment (script link)</a></td></tr>
</table></body></html>`;

const CAREERS = `<html><body><h1>Careers at Sunrise Public School</h1>
<ul><li><a href="/careers/maths">Maths Teacher (Classes VI–X)</a></li><li><a href="/careers/accountant">Accountant – apply now</a></li><li><a href="/about">About our school</a></li><li><a href="https://jobs.elsewhere.example/x">Jobs at our partner company</a></li></ul></body></html>`;

const FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>Notices</title>
<item><title><![CDATA[Recruitment of Special Educators &amp; TGTs]]></title><link>https://board.example.in/n/1</link><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate><description>Applications invited. Last date 30 Nov 2026.</description></item>
<item><title>Annual sports meet</title><link>https://board.example.in/n/2</link></item>
</channel></rss>`;

describe('import parsing', () => {
  it('extracts visible text and links (scripts, fragments and javascript: links ignored)', () => {
    eq(textOf('<p>PGT &amp; TGT&nbsp;<b>posts</b></p>'), 'PGT & TGT posts');
    const links = parseLinks(NOTICES, 'https://kvs.example.gov.in/en/recruitment');
    ok(!links.some(l => l.url.includes('/evil')), 'no links from scripts');
    ok(!links.some(l => l.url.startsWith('javascript')));
    const pdf = links.find(l => l.title.startsWith('Recruitment of PGT'))!;
    eq(pdf.url, 'https://kvs.example.gov.in/docs/advt-12-2026.pdf');
    ok(pdf.pdf && pdf.context.includes('Last date: 15/12/2026'), 'pdf flag and nearby text');
    eq(links.find(l => l.title.startsWith('Walk-in'))!.url, 'https://kvs.example.gov.in/en/notices/prt.html', 'relative link resolved');
  });
  it('scores teacher-recruitment links and drops results, tenders and menus', () => {
    ok(relevance('Recruitment of PGT and TGT') >= 2);
    ok(relevance('शिक्षक भर्ती विज्ञापन 2026') >= 2, 'Hindi');
    eq(relevance('Tender for supply of furniture'), 0);
    ok(!isRelevant('Result of TGT examination 2025', 'govt_page'));
    ok(!isRelevant('Contact us', 'govt_page'));
    ok(isRelevant('Accountant – apply now', 'school_careers'), 'careers pages keep any job');
    ok(!isRelevant('Accountant – apply now', 'govt_page'));
    const govt = extractCandidates('govt_page', NOTICES, 'https://kvs.example.gov.in/en/recruitment', 'text/html');
    eq(govt.map(c => c.title.split(' ').slice(0, 3).join(' ')).sort(), ['Recruitment of PGT', 'Walk-in interview for', 'शिक्षक भर्ती विज्ञापन'].sort());
    const careers = extractCandidates('school_careers', CAREERS, 'https://sunrise.example.in/careers', 'text/html');
    eq(careers.map(c => c.title), ['Maths Teacher (Classes VI–X)', 'Accountant – apply now'], 'other sites and non-jobs dropped');
  });
  it('reads RSS / Atom feeds', () => {
    const items = parseFeed(FEED, 'https://board.example.in/feed');
    eq(items.length, 2);
    eq([items[0].title, items[0].url, items[0].date], ['Recruitment of Special Educators & TGTs', 'https://board.example.in/n/1', '2026-11-09']);
    eq(extractCandidates('feed', FEED, 'https://board.example.in/feed', 'application/rss+xml').length, 1);
    const atom = parseFeed('<feed><entry><title>TGT vacancy</title><link href="/v/9"/><updated>2026-11-01T00:00:00Z</updated></entry></feed>', 'https://x.example.in/atom');
    eq([atom[0].url, atom[0].date], ['https://x.example.in/v/9', '2026-11-01']);
  });
  it('finds dates and the likely last date', () => {
    eq(datesIn('on 05/12/2026, 2026-12-20, 3rd Jan 2027 and Feb 14, 2027; not 31/02/2026'), ['2026-12-05', '2026-12-20', '2027-01-03', '2027-02-14']);
    eq(detectLastDate('Notified 01-11-2026. Last date for receipt: 30.11.2026. Exam 15.01.2027', '2026-11-11'), '2026-11-30');
    eq(detectLastDate('Walk-in on 20-12-2026', '2026-11-11'), '2026-12-20');
    eq(detectLastDate('Held on 01-01-2020', '2026-11-11'), null);
  });
  it('recognises posts from the admin’s list', () => {
    const posts = [{ id: 'posts:PGT', code: 'PGT', name: 'Post Graduate Teacher' }, { id: 'posts:TGT', code: 'TGT', name: 'Trained Graduate Teacher' }, { id: 'posts:PRINCIPAL', code: 'PRINCIPAL', name: 'Principal' }];
    eq(detectPosts('Recruitment of PGTs and TGT (Maths)', posts), ['posts:PGT', 'posts:TGT']);
    eq(detectPosts('Vice Principal and Principal', posts), ['posts:PRINCIPAL']);
  });
});

describe('safe fetching', () => {
  it('blocks private and local addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.20.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:127.0.0.1', '0.0.0.0']) ok(isPrivateAddress(ip), ip);
    for (const ip of ['8.8.8.8', '164.100.1.1', '2606:4700::1']) ok(!isPrivateAddress(ip), ip);
  });
  it('follows robots.txt (our group first, longest rule wins)', () => {
    const txt = 'User-agent: *\nDisallow: /admin\nAllow: /admin/public\n\nUser-agent: OtherBot\nDisallow: /\n';
    const r = robotsRules(txt);
    ok(robotsAllows(r, '/recruitment') && !robotsAllows(r, '/admin/x') && robotsAllows(r, '/admin/public/notices'));
    const mine = robotsRules('User-agent: *\nDisallow:\n\nUser-agent: TheSchoolTeacherBot\nDisallow: /\n');
    ok(!robotsAllows(mine, '/anything'), 'a group for our bot overrides *');
    ok(robotsAllows(robotsRules('User-agent: *\nDisallow: /*.pdf$\n'), '/notice.html') && !robotsAllows(robotsRules('User-agent: *\nDisallow: /*.pdf$\n'), '/a/b.pdf'));
  });
  it('refuses a local address unless explicitly allowed for testing', async () => {
    let err = '';
    try { await fetchForImport('http://127.0.0.1:9/x'); } catch (e) { err = (e as Error).message; }
    ok(/private|local|standard web ports/.test(err), err);
    try { await fetchForImport('ftp://example.com/x'); } catch (e) { err = (e as Error).message; }
    ok(/http/.test(err));
  });
});

describe('importer with a real web server', () => {
  let server: Server, base = '', admin: UserAccount, srcId = '', robots = 'User-agent: *\nDisallow: /private\n';
  const pages: Record<string, [string, string]> = {};
  it('starts a local site', async () => {
    process.env.TST_IMPORT_ALLOW_PRIVATE = '1';
    server = createServer((req, res) => {
      if (req.url === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(robots); return; }
      if (req.url === '/moved') { res.writeHead(301, { Location: '/notices' }); res.end(); return; }
      const p = pages[req.url || ''];
      if (!p) { res.writeHead(404); res.end('nope'); return; }
      ok(String(req.headers['user-agent']).startsWith('TheSchoolTeacherBot/1.0'), 'identifies itself');
      res.writeHead(200, { 'Content-Type': p[0] }); res.end(p[1]);
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    pages['/notices'] = ['text/html; charset=utf-8', NOTICES];
    pages['/private/notices'] = ['text/html', NOTICES];
    pages['/feed'] = ['application/rss+xml', FEED];
    const r = await registerUser({ name: 'Import Admin', email: 'imports@admin.example', password: 'Blue-sky teaching 9', role: 'candidate', consents: [{ purpose: 'terms', version: 'v1' }, { purpose: 'privacy', version: 'v1' }] });
    if (!r.ok) throw new Error(r.error);
    admin = await withDb(db => { const u = db.users.find(x => x.id === r.user.id)!; u.role = 'platform_admin'; return u; });
  });
  it('validates and saves sources', async () => {
    eq((await withDb(db => saveSource(db, admin, { name: 'X', url: base, kind: 'govt_page', orgName: 'KVS' }))).error, 'Give the source a name.');
    eq((await withDb(db => saveSource(db, admin, { name: 'KVS notices', url: 'not a url', kind: 'govt_page', orgName: 'KVS' }))).error, 'Enter the full web address, starting with https://');
    const r = await withDb(db => saveSource(db, admin, { name: 'KVS notices', url: `${base}/moved`, kind: 'govt_page', orgName: 'Kendriya Vidyalaya Sangathan', stateId: 'states:AP', everyHours: 24, active: true }));
    ok(r.source);
    srcId = r.source!.id;
    eq((await withDb(db => saveSource(db, admin, { name: 'Dup', url: `${base}/moved`, kind: 'feed', orgName: 'KVS' }))).error, 'This address is already a source.');
  });
  it('reads a page (following a redirect), queues relevant links once, and records the run', async () => {
    const r = await runSource(srcId, admin.id);
    eq([r.status, r.found, r.added], ['ok', 3, 3]);
    const items = await withDb(db => db.importItems.filter(i => i.sourceId === srcId));
    const pdf = items.find(i => i.pdf)!;
    eq([pdf.detectedDate, pdf.detectedPostIds.sort(), pdf.status], ['2026-12-15', ['posts:PGT', 'posts:TGT'], 'new']);
    eq(items.find(i => i.title.startsWith('Walk-in'))!.detectedDate, '2026-12-20', 'its own date, not the row above');
    eq((await runSource(srcId, admin.id)).added, 0, 'no duplicates on the next run');
    const s = await withDb(db => db.importSources.find(x => x.id === srcId)!);
    eq([s.lastStatus, s.lastFound, s.lastNew], ['ok', 3, 0]);
    ok(!isDue(s) && isDue(s, Date.now() + 25 * 3600_000), 'due again after everyHours');
  });
  it('honours robots.txt and reports missing pages', async () => {
    const p = await withDb(db => saveSource(db, admin, { name: 'Private page', url: `${base}/private/notices`, kind: 'govt_page', orgName: 'KVS', active: true }));
    const r = await runSource(p.source!.id);
    eq(r.status, 'blocked');
    ok(/robots\.txt/.test(r.error || ''));
    const gone = await withDb(db => saveSource(db, admin, { name: 'Gone page', url: `${base}/gone`, kind: 'govt_page', orgName: 'KVS', active: true }));
    const g = await runSource(gone.source!.id);
    ok(g.status === 'error' && /not found/.test(g.error || ''));
    await withDb(db => { deleteSource(db, admin, p.source!.id); deleteSource(db, admin, gone.source!.id); });
  });
  it('the scheduler runs only due, active sources', async () => {
    _test.robotsCache.clear();
    const f = await withDb(db => saveSource(db, admin, { name: 'Board feed', url: `${base}/feed`, kind: 'feed', orgName: 'Board of School Education', active: true }));
    const off = await withDb(db => saveSource(db, admin, { name: 'Switched off', url: `${base}/notices?x=1`, kind: 'govt_page', orgName: 'KVS', active: false }));
    eq(await runDueImports(), 1, 'only the new feed is due');
    eq(await withDb(db => db.importItems.filter(i => i.sourceId === f.source!.id).length), 1);
    eq(await withDb(db => db.importSources.find(s => s.id === off.source!.id)!.lastRunAt ?? null), null);
  });
  it('creates a listing from an item; it is public, attributed, and marks the item published', async () => {
    const item = await withDb(db => db.importItems.find(i => i.sourceId === srcId && i.pdf)!);
    const draft = (await withDb(db => draftFromItem(db, item.id)))!;
    eq([draft.kind, draft.orgName, draft.postId, draft.notificationPdfUrl], ['government', 'Kendriya Vidyalaya Sangathan', item.detectedPostIds[0], item.url]);
    const input = { ...draft, title: 'KVS PGT / TGT recruitment 2026', managementTypeId: 'managementTypes:CENTRAL_GOVT', employmentTypeId: 'employmentTypes:PERMANENT', levelIds: ['schoolLevels:SECONDARY'], subjectIds: ['subjects:MATHS'],
      vacancies: 120, lastDate: plusDays(25), description: 'Kendriya Vidyalaya Sangathan invites applications for PGT and TGT posts. Read the official notification for eligibility.', eligibility: { tetRequired: true, acceptedTetIds: ['tetExams:CTET'] }, pay: { mode: 'not_disclosed' }, publish: true };
    eq((await withDb(db => saveListing(db, admin, { ...input, externalUrl: 'javascript:alert(1)' }))).error, 'Enter the official page where candidates apply (https://…).');
    eq((await withDb(db => saveListing(db, admin, { ...input, description: 'short' }))).error, makeT('en')('post.errDescription'), 'school-form messages in plain English');
    const r = await withDb(db => saveListing(db, admin, input));
    ok(r.job, r.error);
    eq([r.job!.kind, r.job!.applyMode, r.job!.status, r.job!.sourceName, r.job!.sourceUrl], ['government', 'external', 'published', 'KVS notices', item.url]);
    ok(await withDb(db => publicJobs(db).some(j => j.id === r.job!.id)), 'public');
    eq(await withDb(db => db.importItems.find(i => i.id === item.id)!.status), 'published');
    eq(await withDb(db => setItemStatus(db, admin, item.id, 'rejected')), 'This item is already published as a listing.');
    eq(await withDb(db => setListingStatus(db, admin, r.job!.id, 'closed')), null);
    eq(await withDb(db => db.jobs.find(j => j.id === r.job!.id)!.status), 'closed');
    const notAdmin = await withDb(db => saveListing(db, { ...admin, role: 'school_admin' }, input));
    eq(notAdmin.error, 'Not allowed.');
  });
  it('marks links already listed as duplicates, and keeps the queue bounded', async () => {
    const job = await withDb(db => db.jobs.find(j => j.kind === 'government')!);
    const n = await withDb(db => recordCandidates(db, db.importSources.find(s => s.id === srcId)!, [{ title: 'Same notice, new wording for teachers recruitment', url: job.notificationPdfUrl!, context: '', pdf: true }]));
    eq(n, 1);
    eq(await withDb(db => db.importItems.find(i => i.url === job.notificationPdfUrl && i.title.startsWith('Same'))!.status), 'duplicate');
    server.close();
    delete process.env.TST_IMPORT_ALLOW_PRIVATE;
  });
});
