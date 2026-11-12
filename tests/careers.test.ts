import { describe, eq, it, ok } from './harness';
import { withDb } from '@/lib/server/db';
import { registerUser } from '@/lib/server/auth';
import { lookupOf } from '@/lib/server/catalog';
import { cleanProfile, emptyProfile } from '@/lib/server/profile';
import { buildResume, experienceMonths } from '@/lib/server/resume';
import { resumeDocx } from '@/lib/server/resumeDocx';
import { unzip } from '@/lib/server/zip';
import { extractResume } from '@/lib/server/cvExtract';
import { checkBuilt, checkText, cvLists, mergeImport } from '@/lib/server/cvService';
import { parseCv } from '@/lib/cvParse';
import { resumeText, visibleSections } from '@/lib/resume/model';
import { salaryInsights } from '@/lib/server/careerInsights';
import { cleanSchool } from '@/lib/server/schools';
import { QUESTION_GROUPS, DEMO_CHECKLIST, DOCUMENT_CHECKLIST, PLAN_PHASES } from '@/lib/content/interviewPrep';
import { PRACTICE } from '@/lib/content/tetPractice';
import { job, profile, school } from './fixtures';
import type { UserAccount } from '@/types';

const consents = [{ purpose: 'terms' as const, version: 'v1' }, { purpose: 'privacy' as const, version: 'v1' }];
let me: UserAccount;

const CV = `CURRICULUM VITAE
Meena Kumari
Mobile: +91 98480 22334 | Email: meena.k@example.com
Career Objective
Dedicated TGT Mathematics teacher with 6 years of experience teaching Classes VI to X in CBSE schools, known for activity-based lessons and strong board results.
Educational Qualifications
B.Ed, Osmania University, 2016, 78%
B.Sc (Mathematics), Kakatiya University, 2014, 71%
CTET Paper II qualified, 2017, score 104
Work Experience
TGT Mathematics, Sri Vidya Public School, Hyderabad    June 2018 - Present
• Taught Mathematics to Classes VIII–X (4 sections)
• Achieved 100% pass in Class X board exams in 2023 and 2024
• Started a maths club with 40 students
PRT, Little Flower Convent School   Jul 2016 - May 2018
• Prepared activity-based lesson plans for Classes III–V
Trainings Attended
NISHTHA training, 2021
CBSE capacity building programme on competency-based assessment, 2023
Awards
Best Teacher Award, 2022
Skills
Smart class tools, GeoGebra, Kho-kho coaching
Languages Known
English, Hindi, Telugu
Personal Details
Date of Birth: 01-01-1992
Religion: Hindu
Marital Status: Married`;

describe('richer teacher profile', () => {
  it('cleans the new fields: links, skills, awards, training, availability, highlights', async () => {
    const r = await registerUser({ name: 'Meena Kumari', email: 'meena.careers@example.com', password: 'Chalk and board 42', role: 'candidate', consents });
    ok(r.ok, r.ok ? '' : r.error); if (!r.ok) return; me = r.user;
    const lookup = await withDb(db => lookupOf(db));
    const prev = emptyProfile(me.id);
    ok(cleanProfile({ links: [{ label: 'x', url: 'javascript:alert(1)' }] }, prev, lookup).error, 'javascript: links are refused');
    const p = cleanProfile({
      links: [{ label: '', url: 'youtube.com/watch?v=abc' }, { label: 'none', url: '' }],
      skills: ['GeoGebra', 'geogebra', '  Kho-kho   coaching ', ''], awards: [{ title: 'Best Teacher', year: 2022 }, { title: '' }],
      trainings: [{ title: 'NISHTHA', hours: 50, year: 2021 }], availability: '30d', languageIds: ['mediums:TE', 'subjects:MATHS'],
      experience: [{ school: 'A', from: '2020-01', current: true, highlights: '• Taught X\n• Led club' }],
    }, prev, lookup).profile!;
    eq(p.links!.length, 1); eq(p.links![0].url, 'https://youtube.com/watch?v=abc'); eq(p.links![0].label, 'youtube.com');
    eq(p.skills, ['GeoGebra', 'Kho-kho coaching']);
    eq(p.awards!.map(a => a.title), ['Best Teacher']);
    eq(p.trainings![0].hours, 50); eq(p.availability, '30d');
    eq(p.languageIds, ['mediums:TE'], 'only mediums');
    eq(p.experience[0].highlights, '• Taught X\n• Led club');
    eq(cleanProfile({ availability: 'someday' }, prev, lookup).profile!.availability, null);
  });
});

describe('resume builder', () => {
  it('builds sections from the profile, in English and Hindi, and hides sections', async () => {
    await withDb(db => { db.profiles[me.id] = profile(me.id, { about: 'I teach maths with games.', headline: 'TGT Maths', awards: [{ id: 'a', title: 'Best Teacher', year: 2022 }], experience: [{ id: 'x', school: 'Sri Vidya', postId: 'posts:TGT', from: '2018-06', to: null, current: true, levelIds: [], subjectIds: [], highlights: 'Achieved 100% pass in 2024\n- Ran maths club' }] }); });
    const en = await withDb(db => buildResume(db, me, 'en'));
    eq(en.name, 'Meena Kumari');
    ok(en.contact.includes('meena.careers@example.com') && en.contact.includes('9876543210'));
    const exp = en.sections.find(s => s.key === 'experience')!;
    ok(exp.entries![0].title.includes('Sri Vidya') && exp.entries![0].dates!.includes('Present'));
    eq(exp.entries![0].bullets, ['Achieved 100% pass in 2024', 'Ran maths club']);
    ok(en.sections.find(s => s.key === 'eligibility')!.entries![0].title.startsWith('CTET'));
    ok(!visibleSections(en, []).some(s => s.key === 'links'), 'empty sections are not shown');
    const text = resumeText(en, ['awards']);
    ok(text.includes('TEACHING EXPERIENCE') && !text.includes('Best Teacher'));
    const hi = await withDb(db => buildResume(db, me, 'hi'));
    eq(hi.sections.find(s => s.key === 'experience')!.heading, 'शिक्षण अनुभव');
    ok(hi.sections.find(s => s.key === 'teaching')!.facts!.some(f => f.value.includes('गणित')), 'master names in Hindi');
  });

  it('counts overlapping experience once', () => {
    const p = profile('z', { experience: [
      { id: 'a', school: 'A', from: '2020-01', to: '2020-12', current: false, levelIds: [], subjectIds: [] },
      { id: 'b', school: 'B', from: '2020-07', to: '2021-06', current: false, levelIds: [], subjectIds: [] },
    ] });
    eq(experienceMonths(p), 18);
  });

  it('writes a Word file that opens as a valid .docx and reads back', async () => {
    const d = await withDb(db => buildResume(db, me, 'en', { photo: false }));
    const bytes = resumeDocx(d, 'modern', ['declaration'], false);
    const files = unzip(bytes);
    for (const n of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml']) ok(files.has(n), n);
    const xml = files.get('word/document.xml')!().toString('utf8');
    ok(xml.includes('Meena Kumari') && xml.includes('Heading1') && !xml.includes('hereby declare'));
    const back = await extractResume(bytes, 'r.docx');
    ok(back.ok && back.value.text.includes('Sri Vidya') && back.value.signals.tables === 0);
    const hi = resumeDocx(await withDb(db => buildResume(db, me, 'hi', { photo: false })), 'classic', [], true);
    ok(unzip(hi).get('word/document.xml')!().toString('utf8').includes('शिक्षण अनुभव'));
  });
});

describe('CV import and checker', () => {
  it('reads a typical Indian teacher CV into profile suggestions', async () => {
    const cv = await withDb(db => parseCv(CV, cvLists(db)));
    eq(cv.phone, '98480 22334'); eq(cv.email, 'meena.k@example.com'); eq(cv.name, 'Meena Kumari');
    ok(cv.summary?.startsWith('Dedicated TGT'));
    const q = cv.qualifications.map(x => x.qualificationId);
    ok(q.includes('qualifications:BED') && q.includes('qualifications:UG'), q.join());
    eq(cv.qualifications.find(x => x.qualificationId === 'qualifications:BED')!.year, 2016);
    eq(cv.qualifications.find(x => x.qualificationId === 'qualifications:BED')!.percentage, 78);
    eq(cv.tets.length, 1); eq(cv.tets[0].tetId, 'tetExams:CTET'); ok(cv.tets[0].paper.startsWith('Paper II')); eq(cv.tets[0].year, 2017);
    eq(cv.experience.length, 2);
    eq(cv.experience[0].postId, 'posts:TGT'); ok(cv.experience[0].current); eq(cv.experience[0].from, '2018-06');
    ok(cv.experience[0].school.includes('Sri Vidya Public School'), cv.experience[0].school);
    ok(cv.experience[0].highlights.includes('100% pass'));
    eq(cv.experience[1].to, '2018-05'); eq(cv.experience[1].postId, 'posts:PRT');
    ok(cv.subjectIds.includes('subjects:MATHS'));
    eq([...cv.levelIds].sort(), ['schoolLevels:PRIMARY', 'schoolLevels:SECONDARY', 'schoolLevels:UPPER_PRIMARY'], 'Classes VI to X, VIII–X, III–V');
    ok(cv.mediumIds.includes('mediums:TE') && cv.mediumIds.includes('mediums:HI'), cv.mediumIds.join());
    eq(cv.trainings.length, 2); eq(cv.awards, ['Best Teacher Award, 2022']);
    ok(cv.skills.includes('GeoGebra'));
    ok(cv.personalDetails.includes('religion') && cv.personalDetails.includes('dob'));
  });

  it('scores a strong CV above a weak one and explains what to fix', async () => {
    const strong = await withDb(db => checkText(db, CV, { tables: 0, textBoxes: 0, images: 0, multiColumn: false, contactInHeader: false, scanned: false }));
    const weak = await withDb(db => checkText(db, 'Ravi\nravi@example.com\nI want a teaching job.', { tables: 2, textBoxes: 1, images: 0, multiColumn: true, contactInHeader: false, scanned: false }));
    ok(strong.check.score > 70, `strong ${strong.check.score}`); ok(weak.check.score < 30, `weak ${weak.check.score}`);
    eq(strong.check.checks.find(c => c.key === 'personal')!.tip, 'tipPersonal');
    const w = Object.fromEntries(weak.check.checks.map(c => [c.key, c]));
    eq(w.tet.tip, 'tipTet'); eq(w.teacherEducation.tip, 'tipTeacherEducation'); eq(w.layout.tip, 'tipLayout');
    ok(String(w.layout.vars?.list).includes('tables'));
  });

  it('compares a CV with a vacancy', async () => {
    const J = job({ title: 'PGT Physics', postId: 'posts:PGT', subjectIds: ['subjects:PHYSICS'] });
    await withDb(db => { db.jobs.push(J); });
    const r = await withDb(db => checkText(db, CV, null, J.id));
    ok(r.check.jobMatch!.found.includes('B.Ed') && r.check.jobMatch!.found.includes('CTET'), r.check.jobMatch!.found.join());
    ok(r.check.jobMatch!.missing.includes('Physics'));
  });

  it('checks the resume built from the profile', async () => {
    const r = await withDb(db => checkBuilt(db, me, 'en', [], null));
    ok(r.score > 50, String(r.score));
    ok(r.checks.find(c => c.key === 'teacherEducation')!.got === 1);
  });

  it('adds ticked suggestions to the profile without duplicates', async () => {
    const lookup = await withDb(db => lookupOf(db));
    const cv = await withDb(db => parseCv(CV, cvLists(db)));
    const prev = profile(me.id, { experience: [] });
    const raw = mergeImport(prev, { qualifications: cv.qualifications, tets: cv.tets, experience: cv.experience, trainings: cv.trainings, awards: cv.awards, skills: cv.skills, subjectIds: cv.subjectIds, mediumIds: cv.mediumIds });
    const { profile: p, error } = cleanProfile(raw, prev, lookup);
    ok(p, error || '');
    eq(p.qualifications.filter(q => q.qualificationId === 'qualifications:BED').length, 1, 'B.Ed not duplicated');
    eq(p.tets.length, 1, 'CTET not duplicated');
    eq(p.experience.length, 2); eq(p.trainings!.length, 2);
    ok(p.languageIds!.includes('mediums:TE'));
    eq(p.trainings![0].title, 'NISHTHA training'); eq(p.trainings![0].year, 2021);
    const again = cleanProfile(mergeImport(p, { experience: cv.experience, trainings: cv.trainings }), p, lookup).profile!;
    eq(again.experience.length, 2); eq(again.trainings!.length, 2);
  });

  it('refuses old Word files and empty text', async () => {
    const doc = Buffer.alloc(64); doc.writeUInt32LE(0xe011cfd0, 0);
    const r = await extractResume(doc, 'old.doc');
    ok(!r.ok && r.error.includes('.docx'));
    ok(!(await extractResume(Buffer.from('hi'), 'a.txt')).ok);
  });
});

describe('school profile', () => {
  it('keeps the new public fields within bounds', async () => {
    const lookup = await withDb(db => lookupOf(db));
    const { patch } = cleanSchool({ city: 'X', phone: '9876543210', establishedYear: '1987', studentCount: '1200', teacherCount: 0, benefitIds: ['benefits:PF', 'facilities:LIB'], whyJoin: ' Mentors for new teachers ', socialLinks: [{ label: '', url: 'www.youtube.com/@school' }, { label: 'bad', url: 'javascript:x' }] }, lookup, school(), { identity: false });
    ok(patch);
    eq(patch.establishedYear, 1987); eq(patch.studentCount, 1200); eq(patch.teacherCount, null);
    eq(patch.benefitIds, ['benefits:PF']); eq(patch.whyJoin, 'Mentors for new teachers');
    eq(patch.socialLinks, [{ label: 'youtube.com', url: 'https://www.youtube.com/@school' }]);
  });
});

describe('salary insights', () => {
  it('reports a post only with enough vacancies, by sector, as quartiles', async () => {
    const S = school();
    await withDb(db => {
      db.schools.push(S);
      for (const [min, max] of [[20000, 30000], [24000, 30000], [30000, 40000], [40000, 50000]]) db.jobs.push(job({ schoolId: S.id, postId: 'posts:PRT', pay: { mode: 'range', min, max, benefitIds: [] } }));
      db.jobs.push(job({ schoolId: S.id, postId: 'posts:PGT', pay: { mode: 'range', min: 50000, max: 60000, benefitIds: [] } }));
      db.jobs.push(job({ schoolId: S.id, postId: 'posts:PRT', status: 'draft', pay: { mode: 'range', min: 900000, max: 900000, benefitIds: [] } }));
    });
    const r = await withDb(db => salaryInsights(db));
    const prt = r.rows.find(x => x.postId === 'posts:PRT' && x.sector === 'all')!;
    ok(prt && prt.count >= 4);
    ok(prt.median >= 27000 && prt.median <= 36000, String(prt.median));
    ok(!r.rows.some(x => x.postId === 'posts:PGT'), 'one PGT vacancy is not enough');
    ok(r.payLevels.some(p => p.postNames.some(n => n.name.includes('TGT'))));
  });
});

describe('career content', () => {
  it('has English and Hindi for every item and valid answers', () => {
    const both = (x: { en: string; hi: string }) => ok(x.en.trim() && x.hi.trim() && /[ऀ-ॿ]/.test(x.hi), JSON.stringify(x));
    for (const g of QUESTION_GROUPS) { both(g.title); for (const q of g.questions) { both(q.q); both(q.tip); } }
    for (const i of [...DEMO_CHECKLIST, ...DOCUMENT_CHECKLIST]) both(i.text);
    for (const p of PLAN_PHASES) { both(p.name); both(p.prompt); }
    eq(Math.round(PLAN_PHASES.reduce((s, p) => s + p.share, 0) * 100), 100);
    for (const q of PRACTICE) { both(q.q); both(q.why); q.options.forEach(o => ok(o.en.trim() && o.hi.trim())); ok(q.answer >= 0 && q.answer < q.options.length); }
    eq(new Set(PRACTICE.map(q => q.id)).size, PRACTICE.length);
  });
});
