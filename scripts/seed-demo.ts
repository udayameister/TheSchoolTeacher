/*
 * Sample vacancies for trying the candidate screens on a LOCAL copy before schools can post (Phase 3).
 *
 *   npm run seed:demo          add sample schools and vacancies (marked demo: true)
 *   npm run seed:demo -- --clear   remove them again
 *
 * Then start the app with TST_SHOW_DEMO=1 (e.g. `TST_SHOW_DEMO=1 npm run dev`) to see them.
 * Every name says "Sample" so nobody mistakes them for real schools. The script refuses to run
 * against MySQL or in production.
 */
import { backend } from '../lib/server/persist';
import { newId, nowIso, withDb } from '../lib/server/db';
import { saveMasterItem } from '../lib/server/masterData';
import type { Job, School } from '../types';

if (backend() !== 'file' || process.env.NODE_ENV === 'production') {
  console.error('Refusing to add sample data: this only runs on the local file store (no DB_HOST), never in production.');
  process.exit(1);
}

const clear = process.argv.includes('--clear');
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const id = (k: string, c: string) => `${k}:${c}`;

(async () => {
  if (clear) {
    const n = await withDb(db => {
      const before = db.jobs.length + db.schools.length;
      db.jobs = db.jobs.filter(j => !j.demo);
      db.schools = db.schools.filter(s => !s.demo);
      return before - db.jobs.length - db.schools.length;
    });
    console.log(`Removed ${n} sample records.`);
    return;
  }

  await withDb(db => {
    for (const [code, name, state] of [['CHITTOOR', 'Chittoor', 'AP'], ['TIRUPATI', 'Tirupati', 'AP'], ['PUNE', 'Pune', 'MH'], ['LUCKNOW', 'Lucknow', 'UP'], ['BENGALURU_URBAN', 'Bengaluru Urban', 'KA']]) {
      if (!db.master.districts?.some(d => d.code === code)) saveMasterItem(db, 'districts', { code, name, parentId: id('states', state) }, 'seed-demo');
    }
  });

  const at = nowIso();
  const school = (name: string, district: string, state: string, city: string, mgmt: string, boards: string[], lat: number, lng: number): School => ({
    id: newId('sch'), name, udiseCode: '00000000000', managementTypeId: id('managementTypes', mgmt), boardIds: boards.map(b => id('boards', b)),
    levelIds: ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY', 'SENIOR_SECONDARY'].map(l => id('schoolLevels', l)), mediumIds: [id('mediums', 'EN')],
    stateId: id('states', state), districtId: id('districts', district), city, pincode: null, lat, lng, verification: 'verified', verifiedAt: at, createdAt: at, demo: true,
  });
  const schools = [
    school('Sample Public School (demo)', 'CHITTOOR', 'AP', 'Madanapalle', 'PRIVATE_UNAIDED', ['CBSE'], 13.5503, 78.5029),
    school('Sample Vidya Niketan (demo)', 'PUNE', 'MH', 'Pune', 'TRUST_SOCIETY', ['MSBSHSE', 'CBSE'], 18.5204, 73.8567),
    school('Sample International Academy (demo)', 'BENGALURU_URBAN', 'KA', 'Bengaluru', 'INTERNATIONAL', ['IB', 'CAIE'], 12.9716, 77.5946),
    school('Sample Government-aided High School (demo)', 'LUCKNOW', 'UP', 'Lucknow', 'GOVT_AIDED', ['UPMSP'], 26.8467, 80.9462),
  ];

  const base = (s: School, o: Partial<Job>): Job => ({
    id: newId('job'), kind: 'school', schoolId: s.id, orgName: s.name, title: '', postId: id('posts', 'TGT'), subjectIds: [], levelIds: [], streamIds: [],
    employmentTypeId: id('employmentTypes', 'PERMANENT'), boardIds: s.boardIds, managementTypeId: s.managementTypeId, stateId: s.stateId, districtId: s.districtId,
    city: s.city, pincode: null, lat: s.lat, lng: s.lng, vacancies: 1,
    description: 'Sample vacancy for testing TheSchoolTeacher. This is not a real job.\n\nResponsibilities: plan and teach lessons, assess students, take part in school activities and parent meetings.',
    eligibility: { requiredQualificationIds: [id('qualifications', 'BED')], preferredQualificationIds: [], tetRequired: false, acceptedTetIds: [], tetPaper: null, minExperienceYears: 0, minPercentage: null, mediumIds: [id('mediums', 'EN')], policeVerificationRequired: true, otherRequirements: null },
    pay: { mode: 'range', min: 25000, max: 35000, payLevelId: null, scaleText: null, benefitIds: [id('benefits', 'PF')] },
    applyMode: 'platform', externalUrl: null, notificationPdfUrl: null, premium: false,
    screeningQuestions: [{ id: 'q1', text: 'Can you join within 30 days?', type: 'yesno', required: true, mustAnswer: 'yes' }],
    keyDates: [], lastDate: plusDays(20), status: 'published', publishedAt: at, createdAt: at, updatedAt: at, createdBy: 'seed-demo', views: 0, demo: true, ...o,
  });

  const [a, b, c, d] = schools;
  const jobs: Job[] = [
    base(a, { title: 'PGT Physics (sample)', postId: id('posts', 'PGT'), subjectIds: [id('subjects', 'PHYSICS')], levelIds: [id('schoolLevels', 'SENIOR_SECONDARY')], streamIds: [id('streams', 'SCIENCE')], eligibility: { ...base(a, {}).eligibility, requiredQualificationIds: [id('qualifications', 'PG'), id('qualifications', 'BED')], minExperienceYears: 2, minPercentage: 50 }, pay: { mode: 'range', min: 40000, max: 55000, payLevelId: null, scaleText: null, benefitIds: [id('benefits', 'PF'), id('benefits', 'CHILD_FEE')] } }),
    base(a, { title: 'PRT – all subjects (sample)', postId: id('posts', 'PRT'), subjectIds: [id('subjects', 'ALL_PRIMARY')], levelIds: [id('schoolLevels', 'PRIMARY')], eligibility: { ...base(a, {}).eligibility, requiredQualificationIds: [id('qualifications', 'DELED')], tetRequired: true, acceptedTetIds: [id('tetExams', 'CTET'), id('tetExams', 'APTET')], tetPaper: 'Paper I (Classes I–V)', mediumIds: [id('mediums', 'EN'), id('mediums', 'TE')] }, lastDate: plusDays(4), vacancies: 3 }),
    base(b, { title: 'TGT Mathematics (sample)', subjectIds: [id('subjects', 'MATHS')], levelIds: [id('schoolLevels', 'UPPER_PRIMARY'), id('schoolLevels', 'SECONDARY')], eligibility: { ...base(b, {}).eligibility, requiredQualificationIds: [id('qualifications', 'UG'), id('qualifications', 'BED')], tetRequired: true, acceptedTetIds: [id('tetExams', 'CTET'), id('tetExams', 'MAHATET')], mediumIds: [id('mediums', 'EN'), id('mediums', 'MR')] } }),
    base(b, { title: 'Special Educator (sample)', postId: id('posts', 'SPECIAL_EDUCATOR'), employmentTypeId: id('employmentTypes', 'CONTRACT'), eligibility: { ...base(b, {}).eligibility, requiredQualificationIds: [id('qualifications', 'BED_SPL')], otherRequirements: 'Valid RCI registration.' } }),
    base(c, { title: 'IB DP English Teacher (sample)', postId: id('posts', 'PGT'), subjectIds: [id('subjects', 'ENGLISH')], levelIds: [id('schoolLevels', 'SENIOR_SECONDARY')], premium: true, pay: { mode: 'range', min: 70000, max: 95000, payLevelId: null, scaleText: null, benefitIds: [id('benefits', 'ACCOMMODATION'), id('benefits', 'MEDICAL')] }, eligibility: { ...base(c, {}).eligibility, requiredQualificationIds: [id('qualifications', 'PG')], preferredQualificationIds: [id('qualifications', 'BED')], minExperienceYears: 3 } }),
    base(c, { title: 'Computer Teacher (sample)', postId: id('posts', 'COMPUTER_TEACHER'), subjectIds: [id('subjects', 'COMPUTER_SCIENCE')], levelIds: [id('schoolLevels', 'UPPER_PRIMARY'), id('schoolLevels', 'SECONDARY')], pay: { mode: 'not_disclosed', min: null, max: null, payLevelId: null, scaleText: null, benefitIds: [] } }),
    base(d, { title: 'TGT Hindi (sample)', subjectIds: [id('subjects', 'HINDI')], levelIds: [id('schoolLevels', 'SECONDARY')], pay: { mode: 'state_scale', scaleText: 'As per state pay scale (sample)', min: null, max: null, payLevelId: null, benefitIds: [] }, eligibility: { ...base(d, {}).eligibility, tetRequired: true, acceptedTetIds: [id('tetExams', 'UPTET'), id('tetExams', 'CTET')], mediumIds: [id('mediums', 'HI')] } }),
    base(d, { title: 'Principal (sample)', postId: id('posts', 'PRINCIPAL'), eligibility: { ...base(d, {}).eligibility, requiredQualificationIds: [id('qualifications', 'PG'), id('qualifications', 'BED')], minExperienceYears: 10 }, lastDate: plusDays(-3) }),
    {
      ...base(a, {}), kind: 'government', schoolId: null, orgName: 'Sample Central School Organisation (demo)', title: 'Sample notice: TGT and PGT recruitment (demo)',
      stateId: id('states', 'DL'), districtId: null, city: 'New Delhi', lat: null, lng: null, managementTypeId: id('managementTypes', 'CENTRAL_GOVT'), boardIds: [id('boards', 'CBSE')],
      postId: id('posts', 'TGT'), vacancies: 120, applyMode: 'external', externalUrl: 'https://example.org/sample-notice', notificationPdfUrl: 'https://example.org/sample-notice.pdf',
      screeningQuestions: [], pay: { mode: 'cpc', payLevelId: id('payLevels', 'L7'), min: null, max: null, scaleText: null, benefitIds: [] },
      keyDates: [{ label: 'Online application opens', date: plusDays(-5) }, { label: 'Written exam (tentative)', date: plusDays(60) }],
      eligibility: { ...base(a, {}).eligibility, requiredQualificationIds: [id('qualifications', 'UG'), id('qualifications', 'BED')], tetRequired: true, acceptedTetIds: [id('tetExams', 'CTET')], tetPaper: 'Paper II (Classes VI–VIII)', mediumIds: [id('mediums', 'EN'), id('mediums', 'HI')] },
      description: 'Sample government notice for testing. Not a real recruitment. Read the official notification before applying.',
    },
  ];

  await withDb(db => {
    db.schools = db.schools.filter(s => !s.demo).concat(schools);
    db.jobs = db.jobs.filter(j => !j.demo).concat(jobs);
  });
  console.log(`Added ${schools.length} sample schools and ${jobs.length} sample vacancies. Start the app with TST_SHOW_DEMO=1 to see them.`);
})();
