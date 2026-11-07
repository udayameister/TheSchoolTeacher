import type { CandidateProfile, Job, School } from '@/types';
import { emptyProfile } from '@/lib/server/profile';

const id = (k: string, c: string) => `${k}:${c}`;
const plus = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
let n = 0;

export function school(o: Partial<School> = {}): School {
  return { id: `sch_t${++n}`, name: 'Test School', udiseCode: '12345678901', managementTypeId: id('managementTypes', 'PRIVATE_UNAIDED'), boardIds: [id('boards', 'CBSE')], levelIds: [], mediumIds: [], stateId: id('states', 'AP'), districtId: id('districts', 'CHITTOOR'), city: 'Madanapalle', verification: 'verified', createdAt: new Date().toISOString(), ...o };
}

export function job(o: Partial<Job> = {}): Job {
  const at = new Date().toISOString();
  return {
    id: `job_t${++n}`, kind: 'school', schoolId: null, orgName: 'Test School', title: 'TGT Mathematics', postId: id('posts', 'TGT'), subjectIds: [id('subjects', 'MATHS')],
    levelIds: [id('schoolLevels', 'SECONDARY')], streamIds: [], employmentTypeId: id('employmentTypes', 'PERMANENT'), boardIds: [id('boards', 'CBSE')],
    managementTypeId: id('managementTypes', 'PRIVATE_UNAIDED'), stateId: id('states', 'AP'), districtId: id('districts', 'CHITTOOR'), city: 'Madanapalle',
    lat: 13.55, lng: 78.5, vacancies: 1, description: 'Teach maths.',
    eligibility: { requiredQualificationIds: [id('qualifications', 'BED')], preferredQualificationIds: [], tetRequired: true, acceptedTetIds: [id('tetExams', 'CTET')], tetPaper: null, minExperienceYears: 2, minPercentage: null, mediumIds: [id('mediums', 'EN')], policeVerificationRequired: false },
    pay: { mode: 'range', min: 30000, max: 40000, benefitIds: [] }, applyMode: 'platform', premium: false,
    screeningQuestions: [{ id: 'q1', text: 'Join in 30 days?', type: 'yesno', required: true }], keyDates: [], lastDate: plus(10),
    status: 'published', publishedAt: at, createdAt: at, updatedAt: at, views: 0, ...o,
  };
}

export function profile(userId: string, o: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    ...emptyProfile(userId), phone: '9876543210', stateId: id('states', 'AP'), districtId: id('districts', 'CHITTOOR'),
    qualifications: [{ id: 'q1', qualificationId: id('qualifications', 'BED'), institution: 'SVU', year: 2018, percentage: 72 }],
    tets: [{ id: 't1', tetId: id('tetExams', 'CTET'), paper: 'Paper II', year: 2019, lifetime: true }],
    subjectIds: [id('subjects', 'MATHS')], levelIds: [id('schoolLevels', 'SECONDARY')], mediums: [{ mediumId: id('mediums', 'EN'), proficiency: 'fluent' }],
    experience: [{ id: 'x1', school: 'Old School', from: '2020-06', to: '2024-05', current: false, levelIds: [], subjectIds: [] }],
    expectedSalary: 35000, ...o,
  };
}

export const plusDays = plus;
