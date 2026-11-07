import type { MasterItem, MasterKind, MetaValue } from '@/types';

/*
 * Starting values for the master data. The admin edits all of it in Admin → Master data.
 *
 * Rules:
 *  - Items get stable ids "<kind>:<CODE>", so re-seeding never duplicates anything.
 *  - Seeding only ADDS items whose code is missing. It never overwrites an admin's edit.
 *  - Anything that is an official fact (board names, TET names and validity, pay levels, prices)
 *    is seeded with verify: true and listed in docs/VERIFY_BEFORE_LAUNCH.md. The admin clears
 *    the flag after checking it.
 *  - Districts and blocks are not seeded: import them from the Local Government Directory.
 *
 * Bump SEED_VERSION when you add seed items or seed meta fields, so existing databases pick them up.
 * Meta fields that are missing on an existing item are filled in; values that exist are never changed.
 */
export const SEED_VERSION = 2;

interface SeedItem { code: string; name: string; nameHi?: string; parent?: string; verify?: boolean; meta?: Record<string, MetaValue> }

const STATES: SeedItem[] = [
  ['AP', 'Andhra Pradesh', 'आंध्र प्रदेश'], ['AR', 'Arunachal Pradesh', 'अरुणाचल प्रदेश'], ['AS', 'Assam', 'असम'],
  ['BR', 'Bihar', 'बिहार'], ['CG', 'Chhattisgarh', 'छत्तीसगढ़'], ['GA', 'Goa', 'गोवा'], ['GJ', 'Gujarat', 'गुजरात'],
  ['HR', 'Haryana', 'हरियाणा'], ['HP', 'Himachal Pradesh', 'हिमाचल प्रदेश'], ['JH', 'Jharkhand', 'झारखंड'],
  ['KA', 'Karnataka', 'कर्नाटक'], ['KL', 'Kerala', 'केरल'], ['MP', 'Madhya Pradesh', 'मध्य प्रदेश'],
  ['MH', 'Maharashtra', 'महाराष्ट्र'], ['MN', 'Manipur', 'मणिपुर'], ['ML', 'Meghalaya', 'मेघालय'], ['MZ', 'Mizoram', 'मिज़ोरम'],
  ['NL', 'Nagaland', 'नागालैंड'], ['OD', 'Odisha', 'ओडिशा'], ['PB', 'Punjab', 'पंजाब'], ['RJ', 'Rajasthan', 'राजस्थान'],
  ['SK', 'Sikkim', 'सिक्किम'], ['TN', 'Tamil Nadu', 'तमिलनाडु'], ['TS', 'Telangana', 'तेलंगाना'], ['TR', 'Tripura', 'त्रिपुरा'],
  ['UP', 'Uttar Pradesh', 'उत्तर प्रदेश'], ['UK', 'Uttarakhand', 'उत्तराखंड'], ['WB', 'West Bengal', 'पश्चिम बंगाल'],
].map(([code, name, nameHi]) => ({ code, name, nameHi, meta: { type: 'state' } }) as SeedItem).concat([
  ['AN', 'Andaman and Nicobar Islands', 'अंडमान और निकोबार द्वीपसमूह'], ['CH', 'Chandigarh', 'चंडीगढ़'],
  ['DH', 'Dadra and Nagar Haveli and Daman and Diu', 'दादरा और नगर हवेली और दमन और दीव'], ['DL', 'Delhi', 'दिल्ली'],
  ['JK', 'Jammu and Kashmir', 'जम्मू और कश्मीर'], ['LA', 'Ladakh', 'लद्दाख'], ['LD', 'Lakshadweep', 'लक्षद्वीप'], ['PY', 'Puducherry', 'पुडुचेरी'],
].map(([code, name, nameHi]) => ({ code, name, nameHi, meta: { type: 'ut' } })));

// UDISE+ codes start with the state's census code. Seeded from the Census 2011 state codes: VERIFY.
const UDISE_PREFIX: Record<string, string> = {
  JK: '01', HP: '02', PB: '03', CH: '04', UK: '05', HR: '06', DL: '07', RJ: '08', UP: '09', BR: '10', SK: '11', AR: '12', NL: '13', MN: '14',
  MZ: '15', TR: '16', ML: '17', AS: '18', WB: '19', JH: '20', OD: '21', CG: '22', MP: '23', GJ: '24', DH: '25,26', MH: '27', AP: '28,37',
  KA: '29', GA: '30', LD: '31', KL: '32', TN: '33', PY: '34', AN: '35', TS: '36', LA: '',
};
for (const st of STATES) { st.meta = { ...st.meta, udisePrefix: UDISE_PREFIX[st.code] ?? '' }; st.verify = !!UDISE_PREFIX[st.code]; }

const FACILITIES: SeedItem[] = ([
  ['LIBRARY', 'Library', 'पुस्तकालय'], ['SCIENCE_LABS', 'Science laboratories', 'विज्ञान प्रयोगशालाएँ'], ['COMPUTER_LAB', 'Computer lab', 'कंप्यूटर लैब'],
  ['SMART_CLASSES', 'Smart classrooms', 'स्मार्ट कक्षाएँ'], ['PLAYGROUND', 'Playground', 'खेल का मैदान'], ['TRANSPORT', 'School transport', 'विद्यालय परिवहन'],
  ['HOSTEL', 'Hostel', 'छात्रावास'], ['STAFF_QUARTERS', 'Staff quarters', 'कर्मचारी आवास'], ['CAFETERIA', 'Cafeteria', 'कैंटीन'],
  ['MEDICAL_ROOM', 'Medical room', 'चिकित्सा कक्ष'], ['AUDITORIUM', 'Auditorium', 'सभागार'], ['RAMPS', 'Ramps and accessible toilets', 'रैंप और सुलभ शौचालय'],
] as string[][]).map(([code, name, nameHi]) => ({ code, name, nameHi }));

const national = (code: string, name: string, fullName: string, scope: string, website = ''): SeedItem =>
  ({ code, name, verify: true, meta: { scope, fullName, website } });
const stateBoard = (code: string, name: string, state: string, fullName: string): SeedItem =>
  ({ code, name, parent: state, verify: true, meta: { scope: 'state', fullName, website: '' } });

const BOARDS: SeedItem[] = [
  national('CBSE', 'CBSE', 'Central Board of Secondary Education', 'national', 'https://www.cbse.gov.in'),
  national('CISCE', 'CISCE (ICSE / ISC)', 'Council for the Indian School Certificate Examinations', 'national', 'https://cisce.org'),
  national('NIOS', 'NIOS', 'National Institute of Open Schooling', 'national', 'https://www.nios.ac.in'),
  national('IB', 'IB', 'International Baccalaureate', 'international', 'https://www.ibo.org'),
  national('CAIE', 'Cambridge (CAIE)', 'Cambridge Assessment International Education', 'international', 'https://www.cambridgeinternational.org'),
  stateBoard('BSEAP', 'BSE Andhra Pradesh', 'AP', 'Board of Secondary Education, Andhra Pradesh'),
  stateBoard('BIEAP', 'BIE Andhra Pradesh', 'AP', 'Board of Intermediate Education, Andhra Pradesh'),
  stateBoard('BSETS', 'BSE Telangana', 'TS', 'Board of Secondary Education, Telangana'),
  stateBoard('TSBIE', 'BIE Telangana', 'TS', 'Telangana State Board of Intermediate Education'),
  stateBoard('TNDGE', 'Tamil Nadu State Board', 'TN', 'Directorate of Government Examinations, Tamil Nadu'),
  stateBoard('KSEAB', 'KSEAB (Karnataka)', 'KA', 'Karnataka School Examination and Assessment Board'),
  stateBoard('KBPE', 'Kerala State Board', 'KL', 'Kerala Board of Public Examinations / Directorate of Higher Secondary Education'),
  stateBoard('MSBSHSE', 'Maharashtra State Board', 'MH', 'Maharashtra State Board of Secondary and Higher Secondary Education'),
  stateBoard('GSEB', 'GSEB (Gujarat)', 'GJ', 'Gujarat Secondary and Higher Secondary Education Board'),
  stateBoard('RBSE', 'RBSE (Rajasthan)', 'RJ', 'Board of Secondary Education, Rajasthan'),
  stateBoard('MPBSE', 'MPBSE (Madhya Pradesh)', 'MP', 'Board of Secondary Education, Madhya Pradesh'),
  stateBoard('UPMSP', 'UP Board (UPMSP)', 'UP', 'Uttar Pradesh Madhyamik Shiksha Parishad'),
  stateBoard('BSEB', 'BSEB (Bihar)', 'BR', 'Bihar School Examination Board'),
  stateBoard('WBBSE', 'WBBSE (West Bengal)', 'WB', 'West Bengal Board of Secondary Education'),
  stateBoard('WBCHSE', 'WBCHSE (West Bengal)', 'WB', 'West Bengal Council of Higher Secondary Education'),
  stateBoard('BSEODISHA', 'BSE Odisha', 'OD', 'Board of Secondary Education, Odisha'),
  stateBoard('CHSEODISHA', 'CHSE Odisha', 'OD', 'Council of Higher Secondary Education, Odisha'),
  stateBoard('PSEB', 'PSEB (Punjab)', 'PB', 'Punjab School Education Board'),
  stateBoard('BSEH', 'BSEH (Haryana)', 'HR', 'Board of School Education, Haryana'),
  stateBoard('HPBOSE', 'HPBOSE (Himachal Pradesh)', 'HP', 'Himachal Pradesh Board of School Education'),
  stateBoard('JKBOSE', 'JKBOSE (Jammu & Kashmir)', 'JK', 'Jammu and Kashmir Board of School Education'),
  stateBoard('UBSE', 'Uttarakhand Board', 'UK', 'Uttarakhand Board of School Education'),
  stateBoard('JAC', 'JAC (Jharkhand)', 'JH', 'Jharkhand Academic Council'),
  stateBoard('CGBSE', 'CGBSE (Chhattisgarh)', 'CG', 'Chhattisgarh Board of Secondary Education'),
  stateBoard('ASSEB', 'Assam State Board', 'AS', 'Assam State School Education Board'),
  stateBoard('GBSHSE', 'Goa Board', 'GA', 'Goa Board of Secondary and Higher Secondary Education'),
  stateBoard('BOSEM', 'BOSEM (Manipur)', 'MN', 'Board of Secondary Education, Manipur'),
  stateBoard('COHSEM', 'COHSEM (Manipur)', 'MN', 'Council of Higher Secondary Education, Manipur'),
  stateBoard('MBOSE', 'MBOSE (Meghalaya)', 'ML', 'Meghalaya Board of School Education'),
  stateBoard('MBSE', 'MBSE (Mizoram)', 'MZ', 'Mizoram Board of School Education'),
  stateBoard('NBSE', 'NBSE (Nagaland)', 'NL', 'Nagaland Board of School Education'),
  stateBoard('TBSE', 'TBSE (Tripura)', 'TR', 'Tripura Board of Secondary Education'),
  stateBoard('DBSE', 'DBSE (Delhi)', 'DL', 'Delhi Board of School Education'),
  { code: 'OTHER', name: 'Other board', nameHi: 'अन्य बोर्ड', meta: { scope: 'other', fullName: '', website: '' } },
];

const MANAGEMENT: SeedItem[] = [
  { code: 'CENTRAL_GOVT', name: 'Central Government (KVS, NVS, Sainik, central PSU schools)', nameHi: 'केंद्र सरकार', meta: { sector: 'government' } },
  { code: 'STATE_GOVT', name: 'State Government', nameHi: 'राज्य सरकार', meta: { sector: 'government' } },
  { code: 'LOCAL_BODY', name: 'Local body', nameHi: 'स्थानीय निकाय', meta: { sector: 'government' } },
  { code: 'GOVT_AIDED', name: 'Government-aided', nameHi: 'सरकारी सहायता प्राप्त', meta: { sector: 'aided' } },
  { code: 'PRIVATE_UNAIDED', name: 'Private unaided', nameHi: 'निजी गैर-सहायता प्राप्त', meta: { sector: 'private' } },
  { code: 'MINORITY', name: 'Minority institution', nameHi: 'अल्पसंख्यक संस्था', meta: { sector: 'private' } },
  { code: 'TRUST_SOCIETY', name: 'Trust / Society', nameHi: 'ट्रस्ट / सोसाइटी', meta: { sector: 'private' } },
  { code: 'INTERNATIONAL', name: 'International school', nameHi: 'अंतरराष्ट्रीय विद्यालय', meta: { sector: 'private' } },
];

const LEVELS: SeedItem[] = [
  { code: 'PRE_PRIMARY', name: 'Pre-primary', nameHi: 'पूर्व-प्राथमिक', meta: { fromClass: 0, toClass: 0 } },
  { code: 'PRIMARY', name: 'Primary (I–V)', nameHi: 'प्राथमिक (I–V)', meta: { fromClass: 1, toClass: 5 } },
  { code: 'UPPER_PRIMARY', name: 'Upper primary (VI–VIII)', nameHi: 'उच्च प्राथमिक (VI–VIII)', meta: { fromClass: 6, toClass: 8 } },
  { code: 'SECONDARY', name: 'Secondary (IX–X)', nameHi: 'माध्यमिक (IX–X)', meta: { fromClass: 9, toClass: 10 } },
  { code: 'SENIOR_SECONDARY', name: 'Senior secondary (XI–XII)', nameHi: 'उच्च माध्यमिक (XI–XII)', meta: { fromClass: 11, toClass: 12 } },
];

const STREAMS: SeedItem[] = [
  { code: 'SCIENCE', name: 'Science', nameHi: 'विज्ञान' }, { code: 'COMMERCE', name: 'Commerce', nameHi: 'वाणिज्य' },
  { code: 'HUMANITIES', name: 'Humanities', nameHi: 'मानविकी' }, { code: 'VOCATIONAL', name: 'Vocational', nameHi: 'व्यावसायिक' },
];

const MEDIUMS: SeedItem[] = ([
  ['EN', 'English', 'अंग्रेज़ी', 'Latin'], ['HI', 'Hindi', 'हिन्दी', 'Devanagari'], ['AS', 'Assamese', 'असमिया', 'Bengali–Assamese'],
  ['BN', 'Bengali', 'बांग्ला', 'Bengali'], ['BRX', 'Bodo', 'बोडो', 'Devanagari'], ['DOI', 'Dogri', 'डोगरी', 'Devanagari'],
  ['GU', 'Gujarati', 'गुजराती', 'Gujarati'], ['KN', 'Kannada', 'कन्नड़', 'Kannada'], ['KS', 'Kashmiri', 'कश्मीरी', 'Perso-Arabic'],
  ['KOK', 'Konkani', 'कोंकणी', 'Devanagari'], ['MAI', 'Maithili', 'मैथिली', 'Devanagari'], ['ML', 'Malayalam', 'मलयालम', 'Malayalam'],
  ['MNI', 'Manipuri', 'मणिपुरी', 'Meitei / Bengali'], ['MR', 'Marathi', 'मराठी', 'Devanagari'], ['NE', 'Nepali', 'नेपाली', 'Devanagari'],
  ['OR', 'Odia', 'ओड़िया', 'Odia'], ['PA', 'Punjabi', 'पंजाबी', 'Gurmukhi'], ['SA', 'Sanskrit', 'संस्कृत', 'Devanagari'],
  ['SAT', 'Santali', 'संथाली', 'Ol Chiki'], ['SD', 'Sindhi', 'सिंधी', 'Perso-Arabic / Devanagari'], ['TA', 'Tamil', 'तमिल', 'Tamil'],
  ['TE', 'Telugu', 'तेलुगु', 'Telugu'], ['UR', 'Urdu', 'उर्दू', 'Perso-Arabic'],
] as string[][]).map(([code, name, nameHi, script]) => ({ code, name, nameHi, meta: { script } }));

const post = (code: string, name: string, nameHi: string, category: string, subjectWise = false, typicalLevels = ''): SeedItem =>
  ({ code, name, nameHi, meta: { category, subjectWise, typicalLevels } });
const POSTS: SeedItem[] = [
  post('NTT', 'NTT / Pre-primary teacher', 'पूर्व-प्राथमिक शिक्षक (NTT)', 'teaching', false, 'PRE_PRIMARY'),
  post('PRT', 'Primary Teacher (PRT)', 'प्राथमिक शिक्षक (PRT)', 'teaching', false, 'PRIMARY'),
  post('TGT', 'Trained Graduate Teacher (TGT)', 'प्रशिक्षित स्नातक शिक्षक (TGT)', 'teaching', true, 'UPPER_PRIMARY,SECONDARY'),
  post('PGT', 'Post Graduate Teacher (PGT)', 'स्नातकोत्तर शिक्षक (PGT)', 'teaching', true, 'SENIOR_SECONDARY'),
  post('SPECIAL_EDUCATOR', 'Special Educator', 'विशेष शिक्षक', 'teaching'),
  post('PET', 'Physical Education Teacher', 'शारीरिक शिक्षा शिक्षक', 'teaching'),
  post('ART_TEACHER', 'Art Teacher', 'कला शिक्षक', 'teaching'),
  post('MUSIC_TEACHER', 'Music Teacher', 'संगीत शिक्षक', 'teaching'),
  post('DANCE_TEACHER', 'Dance Teacher', 'नृत्य शिक्षक', 'teaching'),
  post('COMPUTER_TEACHER', 'Computer Teacher', 'कंप्यूटर शिक्षक', 'teaching'),
  post('COUNSELLOR', 'Counsellor', 'परामर्शदाता', 'teaching'),
  post('LIBRARIAN', 'Librarian', 'पुस्तकालयाध्यक्ष', 'teaching'),
  post('PRINCIPAL', 'Principal', 'प्रधानाचार्य', 'leadership'),
  post('VICE_PRINCIPAL', 'Vice Principal', 'उप-प्रधानाचार्य', 'leadership'),
  post('HEADMASTER', 'Headmaster / Headmistress', 'प्रधानाध्यापक / प्रधानाध्यापिका', 'leadership'),
  post('ACADEMIC_COORDINATOR', 'Academic Coordinator', 'शैक्षणिक समन्वयक', 'leadership'),
  post('HOD', 'Head of Department', 'विभागाध्यक्ष', 'leadership', true),
  post('LAB_ASSISTANT', 'Lab Assistant', 'प्रयोगशाला सहायक', 'non_teaching'),
  post('OFFICE_STAFF', 'Office Staff', 'कार्यालय कर्मचारी', 'non_teaching'),
  post('ACCOUNTANT', 'Accountant', 'लेखाकार', 'non_teaching'),
  post('ADMIN_OFFICER', 'Admin Officer', 'प्रशासनिक अधिकारी', 'non_teaching'),
];

const subj = (area: string, rows: [string, string, string][]): SeedItem[] => rows.map(([code, name, nameHi]) => ({ code, name, nameHi, meta: { area } }));
const SUBJECTS: SeedItem[] = [
  ...subj('general', [['ALL_PRIMARY', 'All subjects (primary)', 'सभी विषय (प्राथमिक)'], ['EVS', 'Environmental Studies (EVS)', 'पर्यावरण अध्ययन']]),
  ...subj('language', [
    ['ENGLISH', 'English', 'अंग्रेज़ी'], ['HINDI', 'Hindi', 'हिन्दी'], ['SANSKRIT', 'Sanskrit', 'संस्कृत'], ['URDU', 'Urdu', 'उर्दू'],
    ['TELUGU', 'Telugu', 'तेलुगु'], ['TAMIL', 'Tamil', 'तमिल'], ['KANNADA', 'Kannada', 'कन्नड़'], ['MALAYALAM', 'Malayalam', 'मलयालम'],
    ['MARATHI', 'Marathi', 'मराठी'], ['BENGALI', 'Bengali', 'बांग्ला'], ['GUJARATI', 'Gujarati', 'गुजराती'], ['PUNJABI', 'Punjabi', 'पंजाबी'],
    ['ODIA', 'Odia', 'ओड़िया'], ['ASSAMESE', 'Assamese', 'असमिया'], ['FRENCH', 'French', 'फ़्रेंच'], ['GERMAN', 'German', 'जर्मन'],
  ]),
  ...subj('science', [
    ['MATHS', 'Mathematics', 'गणित'], ['SCIENCE', 'Science', 'विज्ञान'], ['PHYSICS', 'Physics', 'भौतिकी'], ['CHEMISTRY', 'Chemistry', 'रसायन विज्ञान'],
    ['BIOLOGY', 'Biology', 'जीव विज्ञान'], ['BIOTECH', 'Biotechnology', 'जैव प्रौद्योगिकी'], ['HOME_SCIENCE', 'Home Science', 'गृह विज्ञान'],
  ]),
  ...subj('social', [
    ['SOCIAL_SCIENCE', 'Social Science', 'सामाजिक विज्ञान'], ['HISTORY', 'History', 'इतिहास'], ['GEOGRAPHY', 'Geography', 'भूगोल'],
    ['POLITICAL_SCIENCE', 'Political Science', 'राजनीति विज्ञान'], ['ECONOMICS', 'Economics', 'अर्थशास्त्र'], ['SOCIOLOGY', 'Sociology', 'समाजशास्त्र'],
    ['PSYCHOLOGY', 'Psychology', 'मनोविज्ञान'],
  ]),
  ...subj('commerce', [['ACCOUNTANCY', 'Accountancy', 'लेखाशास्त्र'], ['BUSINESS_STUDIES', 'Business Studies', 'व्यवसाय अध्ययन'], ['ENTREPRENEURSHIP', 'Entrepreneurship', 'उद्यमिता']]),
  ...subj('computer', [['COMPUTER_SCIENCE', 'Computer Science', 'कंप्यूटर विज्ञान'], ['INFORMATICS_PRACTICES', 'Informatics Practices', 'सूचना विज्ञान अभ्यास']]),
  ...subj('arts', [['PHYSICAL_EDUCATION', 'Physical Education', 'शारीरिक शिक्षा'], ['FINE_ARTS', 'Fine Arts / Art', 'ललित कला'], ['MUSIC', 'Music', 'संगीत'], ['DANCE', 'Dance', 'नृत्य']]),
];

const qual = (code: string, name: string, type: string, recordPercentage = true): SeedItem => ({ code, name, meta: { type, recordPercentage } });
const QUALIFICATIONS: SeedItem[] = [
  qual('DELED', 'D.El.Ed (Diploma in Elementary Education)', 'teacher_education'),
  qual('DED', 'D.Ed', 'teacher_education'),
  qual('BELED', 'B.El.Ed', 'teacher_education'),
  qual('BED', 'B.Ed', 'teacher_education'),
  qual('ITEP', 'ITEP (4-year Integrated Teacher Education Programme)', 'teacher_education'),
  qual('MED', 'M.Ed', 'teacher_education'),
  qual('BPED', 'B.P.Ed', 'teacher_education'),
  qual('MPED', 'M.P.Ed', 'teacher_education'),
  qual('BED_SPL', 'B.Ed (Special Education)', 'teacher_education'),
  qual('DED_SPL', 'D.Ed (Special Education)', 'teacher_education'),
  qual('NTT_DIP', 'NTT diploma', 'diploma'),
  qual('ECCE_DIP', 'ECCE diploma', 'diploma'),
  qual('SENIOR_SECONDARY', 'Senior secondary (Class XII)', 'academic'),
  qual('UG', 'Graduate (UG) in the subject', 'academic'),
  qual('PG', 'Post-graduate (PG) in the subject', 'academic'),
  qual('MPHIL', 'M.Phil', 'academic'),
  qual('PHD', 'Ph.D', 'academic', false),
];

const tet = (code: string, name: string, state: string | undefined, conductedBy = '', papers = 'Paper I (Classes I–V),Paper II (Classes VI–VIII)'): SeedItem =>
  ({ code, name, parent: state, verify: true, meta: { scope: state ? 'state' : 'central', papers, validity: '', conductedBy, website: '' } });
const TETS: SeedItem[] = [
  { ...tet('CTET', 'CTET (Central Teacher Eligibility Test)', undefined, 'CBSE'), meta: { scope: 'central', papers: 'Paper I (Classes I–V),Paper II (Classes VI–VIII)', validity: 'Lifetime (NCTE decision, 2021)', conductedBy: 'CBSE', website: 'https://ctet.nic.in' } },
  tet('APTET', 'AP TET', 'AP'), tet('TSTET', 'TS TET', 'TS'), tet('TNTET', 'TNTET', 'TN'), tet('KARTET', 'KARTET', 'KA'),
  tet('KTET', 'K-TET (Kerala)', 'KL'), tet('MAHATET', 'MAHA TET', 'MH'), tet('GTET', 'Gujarat TET', 'GJ'), tet('REET', 'REET (Rajasthan)', 'RJ'),
  tet('MPTET', 'MP TET', 'MP'), tet('UPTET', 'UPTET', 'UP'), tet('BTET', 'Bihar TET / STET', 'BR'), tet('WBTET', 'WB TET', 'WB'),
  tet('OTET', 'OTET (Odisha)', 'OD'), tet('PSTET', 'PSTET (Punjab)', 'PB'), tet('HTET', 'HTET (Haryana)', 'HR'), tet('HPTET', 'HP TET', 'HP'),
  tet('JTET', 'JTET (Jharkhand)', 'JH'), tet('CGTET', 'CG TET', 'CG'), tet('UTET', 'UTET (Uttarakhand)', 'UK'), tet('ASSAMTET', 'Assam TET', 'AS'),
  tet('GOATET', 'Goa TET', 'GA'), tet('TRTET', 'Tripura TET', 'TR'),
];

const EMPLOYMENT: SeedItem[] = [
  { code: 'PERMANENT', name: 'Permanent', nameHi: 'स्थायी' }, { code: 'CONTRACT', name: 'Contract', nameHi: 'संविदा' },
  { code: 'GUEST', name: 'Guest / Part-time', nameHi: 'अतिथि / अंशकालिक' }, { code: 'ADHOC', name: 'Ad-hoc', nameHi: 'तदर्थ' },
  { code: 'TUTOR', name: 'Tutor', nameHi: 'ट्यूटर' },
];

const BENEFITS: SeedItem[] = [
  { code: 'ACCOMMODATION', name: 'Accommodation', nameHi: 'आवास' }, { code: 'TRANSPORT', name: 'Transport', nameHi: 'परिवहन' },
  { code: 'CHILD_FEE', name: 'Child-fee concession', nameHi: 'बच्चों की फ़ीस में छूट' }, { code: 'PF', name: 'Provident Fund (PF)', nameHi: 'भविष्य निधि (PF)' },
  { code: 'ESI', name: 'ESI', nameHi: 'ईएसआई' }, { code: 'MEDICAL', name: 'Medical insurance', nameHi: 'चिकित्सा बीमा' },
];

// Central (7th CPC) pay matrix: level → entry basic pay. Post mapping is the usual KVS pattern. VERIFY all.
const PAY_LEVELS: SeedItem[] = ([
  [1, 18000, ''], [2, 19900, ''], [3, 21700, ''], [4, 25500, ''], [5, 29200, ''], [6, 35400, 'PRT'], [7, 44900, 'TGT,LIBRARIAN'],
  [8, 47600, 'PGT'], [9, 53100, ''], [10, 56100, 'VICE_PRINCIPAL'], [11, 67700, ''], [12, 78800, 'PRINCIPAL'], [13, 123100, ''], [14, 144200, ''],
] as [number, number, string][]).map(([level, entryPay, posts]) => ({ code: `L${level}`, name: `Pay Level ${level}`, nameHi: `वेतन स्तर ${level}`, verify: true, meta: { level, entryPay, posts } }));

const MATCH_WEIGHTS: SeedItem[] = [
  { code: 'QUAL_TET', name: 'Qualification & TET', nameHi: 'योग्यता और TET', meta: { weight: 35 } },
  { code: 'SUBJECT_CLASS', name: 'Subject & class fit', nameHi: 'विषय और कक्षा', meta: { weight: 25 } },
  { code: 'EXPERIENCE', name: 'Experience', nameHi: 'अनुभव', meta: { weight: 15 } },
  { code: 'MEDIUM', name: 'Medium / language', nameHi: 'माध्यम / भाषा', meta: { weight: 10 } },
  { code: 'LOCATION', name: 'Location', nameHi: 'स्थान', meta: { weight: 10 } },
  { code: 'SALARY', name: 'Salary fit', nameHi: 'वेतन', meta: { weight: 5 } },
  { code: 'MANDATORY_CAP', name: 'Highest score while a mandatory requirement is unmet', nameHi: 'अनिवार्य शर्त पूरी न होने पर अधिकतम स्कोर', meta: { weight: 49 } },
];

const PANEL: SeedItem[] = [
  { code: 'SUBJECT_KNOWLEDGE', name: 'Subject knowledge', nameHi: 'विषय ज्ञान', meta: { weight: 30 } },
  { code: 'DEMO_PEDAGOGY', name: 'Demo class / pedagogy', nameHi: 'डेमो कक्षा / शिक्षण कौशल', meta: { weight: 30 } },
  { code: 'COMMUNICATION', name: 'Communication', nameHi: 'संवाद कौशल', meta: { weight: 20 } },
  { code: 'INTERVIEW', name: 'Interview', nameHi: 'साक्षात्कार', meta: { weight: 20 } },
];

const SCHOOL_CATEGORIES: SeedItem[] = [
  { code: 'GOVT_AIDED', name: 'Government / aided', verify: true, meta: { annualPrice: 0, maxBranches: 1 } },
  { code: 'PRIVATE_UPTO_VIII', name: 'Private (up to Class VIII)', verify: true, meta: { annualPrice: 0, maxBranches: 1 } },
  { code: 'PRIVATE_UPTO_XII', name: 'Private (up to Class XII)', verify: true, meta: { annualPrice: 0, maxBranches: 1 } },
  { code: 'INTERNATIONAL_GROUP', name: 'International / multi-branch group', verify: true, meta: { annualPrice: 0, maxBranches: 10 } },
];

export const SEED: Partial<Record<MasterKind, SeedItem[]>> = {
  states: STATES, boards: BOARDS, managementTypes: MANAGEMENT, schoolLevels: LEVELS, streams: STREAMS, mediums: MEDIUMS,
  posts: POSTS, subjects: SUBJECTS, qualifications: QUALIFICATIONS, tetExams: TETS, employmentTypes: EMPLOYMENT, benefits: BENEFITS,
  payLevels: PAY_LEVELS, matchWeights: MATCH_WEIGHTS, panelDimensions: PANEL, schoolCategories: SCHOOL_CATEGORIES,
  districts: [], blocks: [], facilities: FACILITIES,
};

/** Parent kind used to resolve a seed item's `parent` code. */
const SEED_PARENT: Partial<Record<MasterKind, MasterKind>> = { boards: 'states', tetExams: 'states', districts: 'states', blocks: 'districts' };

export const masterId = (kind: MasterKind, code: string) => `${kind}:${code}`;

/** Adds missing seed items. Returns true when something was added. */
export function seedMasterData(db: { master: Partial<Record<MasterKind, MasterItem[]>>; masterSeedVersion: number }): boolean {
  if (db.masterSeedVersion >= SEED_VERSION) return false;
  const at = new Date().toISOString();
  for (const [kind, items] of Object.entries(SEED) as [MasterKind, SeedItem[]][]) {
    const list = (db.master[kind] ||= []);
    const byCode = new Map(list.map(i => [i.code, i]));
    items.forEach((s, i) => {
      const existing = byCode.get(s.code);
      if (existing) {
        // Fill in meta fields added in a later seed version; never overwrite an existing value.
        for (const [k, v] of Object.entries(s.meta || {})) if (existing.meta[k] === undefined) existing.meta[k] = v;
        if (s.code in UDISE_PREFIX && kind === 'states' && existing.meta.udisePrefix && !existing.verify && existing.updatedBy === 'seed') existing.verify = true;
        return;
      }
      const parentKind = SEED_PARENT[kind];
      list.push({
        id: masterId(kind, s.code), kind, code: s.code, name: s.name, ...(s.nameHi ? { nameHi: s.nameHi } : {}),
        parentId: s.parent && parentKind ? masterId(parentKind, s.parent) : null,
        active: true, verify: !!s.verify, sortOrder: (i + 1) * 10, meta: { ...(s.meta || {}) }, updatedAt: at, updatedBy: 'seed',
      });
    });
  }
  db.masterSeedVersion = SEED_VERSION;
  return true;
}
