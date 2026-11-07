import { describe, eq, it, ok } from './harness';
import { withDb } from '@/lib/server/db';
import { lookupOf } from '@/lib/server/catalog';
import { distanceKm, facetCounts, filtersToQuery, matchesFilters, parseFilters, sortJobs, textScore } from '@/lib/jobs/filters';
import { computeMatch, experienceYears } from '@/lib/jobs/match';
import { job, plusDays, profile } from './fixtures';

describe('job search', () => {
  it('parses URL filters safely and round-trips them', () => {
    const f = parseFilters(new URLSearchParams('q=pgt%20physics&place=Chittoor&board=cbse,IB&state=AP&type=school&minSalary=25000&closing=7&lat=13.55&lng=78.5&km=10&evil=<x>'));
    eq(f.q, 'pgt physics Chittoor');
    eq(f.board, ['CBSE', 'IB']);
    eq([f.state, f.kind, f.minSalary, f.closingDays, f.km], ['AP', 'school', 25000, 7, 10]);
    eq(parseFilters(new URLSearchParams(filtersToQuery(f))), f);
    eq(parseFilters(new URLSearchParams('lat=999&lng=1&type=hack')), {}, 'out-of-India coordinates and bad values dropped');
  });
  it('matches facets, text (incl. Hindi names), salary, deadline and distance', async () => {
    const lookup = await withDb(db => lookupOf(db));
    const j = job();
    ok(matchesFilters(j, parseFilters(new URLSearchParams('board=CBSE&post=TGT&subject=MATHS&state=AP&district=CHITTOOR&sector=private')), lookup));
    ok(!matchesFilters(j, parseFilters(new URLSearchParams('board=IB')), lookup));
    ok(!matchesFilters(j, parseFilters(new URLSearchParams('sector=government')), lookup));
    ok(textScore(j, 'maths madanapalle', lookup) > 0);
    ok(textScore(j, 'गणित', lookup) > 0, 'Hindi subject name');
    eq(textScore(j, 'physics', lookup), 0);
    ok(matchesFilters(j, { minSalary: 40000 }, lookup) && !matchesFilters(j, { minSalary: 45000 }, lookup));
    ok(matchesFilters(j, { closingDays: 15 }, lookup) && !matchesFilters(j, { closingDays: 5 }, lookup));
    ok(matchesFilters(j, { lat: 13.6, lng: 78.5, km: 10 }, lookup) && !matchesFilters(j, { lat: 17.4, lng: 78.5, km: 50 }, lookup));
    ok(Math.abs(distanceKm(28.61, 77.21, 19.08, 72.88) - 1150) < 25, 'Delhi–Mumbai ≈ 1150 km');
  });
  it('counts facets ignoring their own filter, and sorts', async () => {
    const lookup = await withDb(db => lookupOf(db));
    const jobs = [job({ boardIds: ['boards:CBSE'], lastDate: plusDays(3) }), job({ boardIds: ['boards:IB'], pay: { mode: 'range', min: 90000, max: 90000, benefitIds: [] } }), job({ boardIds: ['boards:CBSE'], postId: 'posts:PGT' })];
    const fc = facetCounts(jobs, { board: ['CBSE'] }, lookup);
    eq(fc.board!.find(x => x.code === 'IB')!.count, 1, 'other boards still counted');
    eq(fc.post!.find(x => x.code === 'TGT')!.count, 1, 'posts counted within CBSE only');
    eq(sortJobs(jobs, 'salary', { f: {}, lookup })[0].id, jobs[1].id);
    eq(sortJobs(jobs, 'deadline', { f: {}, lookup })[0].id, jobs[0].id);
  });
});

describe('match score', () => {
  it('scores a strong match high and explains every part', async () => {
    const lookup = await withDb(db => lookupOf(db));
    const m = computeMatch(job(), profile('u1'), lookup);
    ok(m.score >= 85, `score ${m.score}`);
    eq(m.parts.map(p => p.key), ['QUAL_TET', 'SUBJECT_CLASS', 'EXPERIENCE', 'MEDIUM', 'LOCATION', 'SALARY']);
    ok(m.parts.every(p => p.reasons.length > 0));
    eq(m.unmet.length, 0);
  });
  it('caps the score below 50% when a mandatory requirement is missing', async () => {
    const lookup = await withDb(db => lookupOf(db));
    const noTet = computeMatch(job(), profile('u1', { tets: [] }), lookup);
    ok(noTet.capped && noTet.score === 49 && noTet.unmet.some(r => r.key === 'match.tetMissing'));
    const expired = computeMatch(job(), profile('u1', { tets: [{ id: 't', tetId: 'tetExams:CTET', paper: '', validUntil: '2020-01-01' }] }), lookup);
    ok(expired.unmet.some(r => r.key === 'match.tetExpired'));
    const noBed = computeMatch(job(), profile('u1', { qualifications: [] }), lookup);
    ok(noBed.score <= 49 && noBed.unmet.some(r => r.key === 'match.qualMissing'));
  });
  it('uses admin weights', async () => {
    const lookup = await withDb(db => lookupOf(db));
    const m = computeMatch(job({ eligibility: { ...job().eligibility, mediumIds: ['mediums:TA'] } }), profile('u1'), lookup, { MEDIUM: 0 });
    eq(m.parts.find(p => p.key === 'MEDIUM')!.weight, 0);
  });
  it('counts experience in years', () => {
    eq(experienceYears(profile('u', { experience: [{ id: 'a', school: 's', from: '2020-01', to: '2021-12', current: false, levelIds: [], subjectIds: [] }] })), 2);
  });
});
