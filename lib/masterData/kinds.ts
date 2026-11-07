import type { MasterKind } from '@/types';

/*
 * The master-data registry: every admin-editable list in the product, with the extra fields
 * ("meta") each item may carry. The admin screens and the server validation are both generated
 * from this list, so adding a field here is enough to make it editable.
 */

export type MetaFieldType = 'text' | 'number' | 'boolean' | 'select';

export interface MetaField {
  key: string;
  label: string;
  type: MetaFieldType;
  options?: { value: string; label: string }[];
  hint?: string;
  min?: number;
  max?: number;
}

export interface KindDef {
  kind: MasterKind;
  label: string;
  group: 'Location' | 'School' | 'Posts & eligibility' | 'Pay & scoring' | 'Business';
  description: string;
  /** Items of this kind may (or must) point at an item of the parent kind. */
  parent?: { kind: MasterKind; required: boolean; label: string };
  meta: MetaField[];
}

const yesNo = (key: string, label: string, hint?: string): MetaField => ({ key, label, type: 'boolean', hint });

export const KINDS: KindDef[] = [
  {
    kind: 'states', label: 'States & union territories', group: 'Location',
    description: 'All 28 states and 8 union territories. Districts and state boards hang under these.',
    meta: [{ key: 'type', label: 'Type', type: 'select', options: [{ value: 'state', label: 'State' }, { value: 'ut', label: 'Union territory' }] }],
  },
  {
    kind: 'districts', label: 'Districts', group: 'Location',
    description: 'Import from the Local Government Directory (lgdirectory.gov.in) as CSV. Teachers search by district.',
    parent: { kind: 'states', required: true, label: 'State / UT' },
    meta: [{ key: 'lgdCode', label: 'LGD district code', type: 'text' }],
  },
  {
    kind: 'blocks', label: 'Blocks / mandals / talukas', group: 'Location',
    description: 'Sub-district units. Import from the Local Government Directory as CSV.',
    parent: { kind: 'districts', required: true, label: 'District' },
    meta: [{ key: 'lgdCode', label: 'LGD code', type: 'text' }],
  },
  {
    kind: 'boards', label: 'Boards & affiliations', group: 'School',
    description: 'CBSE, CISCE, NIOS, IB, Cambridge, every state board, and Other. A school can have several.',
    parent: { kind: 'states', required: false, label: 'State (state boards only)' },
    meta: [
      { key: 'scope', label: 'Scope', type: 'select', options: [{ value: 'national', label: 'National' }, { value: 'state', label: 'State' }, { value: 'international', label: 'International' }, { value: 'other', label: 'Other' }] },
      { key: 'fullName', label: 'Full official name', type: 'text' },
      { key: 'website', label: 'Official website', type: 'text' },
    ],
  },
  {
    kind: 'managementTypes', label: 'Management types', group: 'School',
    description: 'Who runs the school. Drives "government vs private" filters and plan categories.',
    meta: [{ key: 'sector', label: 'Sector', type: 'select', options: [{ value: 'government', label: 'Government' }, { value: 'aided', label: 'Government-aided' }, { value: 'private', label: 'Private' }] }],
  },
  {
    kind: 'schoolLevels', label: 'School levels', group: 'School',
    description: 'Pre-primary to senior secondary, with the classes each covers.',
    meta: [
      { key: 'fromClass', label: 'From class (0 = pre-primary)', type: 'number', min: 0, max: 12 },
      { key: 'toClass', label: 'To class', type: 'number', min: 0, max: 12 },
    ],
  },
  { kind: 'streams', label: 'Streams (classes XI–XII)', group: 'School', description: 'Science, Commerce, Humanities, Vocational.', meta: [] },
  {
    kind: 'mediums', label: 'Mediums of instruction / languages', group: 'School',
    description: 'English, Hindi and regional languages. Used for school medium and the languages a teacher can teach in.',
    meta: [{ key: 'script', label: 'Script', type: 'text' }],
  },
  {
    kind: 'posts', label: 'Posts', group: 'Posts & eligibility',
    description: 'Teaching, leadership and non-teaching posts schools hire for.',
    meta: [
      { key: 'category', label: 'Category', type: 'select', options: [{ value: 'teaching', label: 'Teaching' }, { value: 'leadership', label: 'Leadership' }, { value: 'non_teaching', label: 'Non-teaching' }] },
      yesNo('subjectWise', 'Advertised by subject (e.g. PGT Physics)'),
      { key: 'typicalLevels', label: 'Typical levels (codes, comma separated)', type: 'text', hint: 'e.g. PRIMARY or SECONDARY,SENIOR_SECONDARY' },
    ],
  },
  {
    kind: 'subjects', label: 'Subjects', group: 'Posts & eligibility',
    description: 'Subjects a vacancy is for and a teacher can teach.',
    meta: [{ key: 'area', label: 'Area', type: 'select', options: [{ value: 'language', label: 'Language' }, { value: 'science', label: 'Science & maths' }, { value: 'social', label: 'Social sciences' }, { value: 'commerce', label: 'Commerce' }, { value: 'arts', label: 'Arts, sports & co-curricular' }, { value: 'computer', label: 'Computer' }, { value: 'general', label: 'General / primary' }] }],
  },
  {
    kind: 'qualifications', label: 'Qualifications', group: 'Posts & eligibility',
    description: 'Teacher-education and academic qualifications (D.El.Ed, B.Ed, …).',
    meta: [
      { key: 'type', label: 'Type', type: 'select', options: [{ value: 'teacher_education', label: 'Teacher education' }, { value: 'academic', label: 'Academic degree' }, { value: 'diploma', label: 'Diploma / certificate' }] },
      yesNo('recordPercentage', 'Ask for percentage'),
    ],
  },
  {
    kind: 'tetExams', label: 'Teacher Eligibility Tests', group: 'Posts & eligibility',
    description: 'CTET, each state TET and other qualifying exams. Add new ones here; candidates record papers, year, score and validity.',
    parent: { kind: 'states', required: false, label: 'State (state TETs only)' },
    meta: [
      { key: 'scope', label: 'Scope', type: 'select', options: [{ value: 'central', label: 'Central' }, { value: 'state', label: 'State' }, { value: 'other', label: 'Other qualifying exam' }] },
      { key: 'papers', label: 'Papers (comma separated)', type: 'text', hint: 'e.g. Paper I (Classes I–V),Paper II (Classes VI–VIII)' },
      { key: 'validity', label: 'Certificate validity (as published)', type: 'text' },
      { key: 'conductedBy', label: 'Conducted by', type: 'text' },
      { key: 'website', label: 'Official website', type: 'text' },
    ],
  },
  { kind: 'employmentTypes', label: 'Employment types', group: 'Posts & eligibility', description: 'Permanent, contract, guest / part-time, ad-hoc, tutor.', meta: [] },
  { kind: 'benefits', label: 'Benefits', group: 'Pay & scoring', description: 'Benefits a private school can offer with the salary.', meta: [] },
  {
    kind: 'payLevels', label: '7th CPC pay levels', group: 'Pay & scoring',
    description: 'Central pay matrix levels and entry pay, mapped to posts (KVS-style posts). Used on job pages and the salary calculator.',
    meta: [
      { key: 'level', label: 'Pay level', type: 'number', min: 1, max: 18 },
      { key: 'entryPay', label: 'Entry basic pay (₹ / month)', type: 'number', min: 0 },
      { key: 'posts', label: 'Typical posts (codes, comma separated)', type: 'text' },
    ],
  },
  {
    kind: 'matchWeights', label: 'Match-score weights', group: 'Pay & scoring',
    description: 'Weights of the explainable match score. They should add up to 100. "MANDATORY_CAP" is the highest score a candidate can get while a mandatory requirement is unmet.',
    meta: [{ key: 'weight', label: 'Weight / value', type: 'number', min: 0, max: 100 }],
  },
  {
    kind: 'panelDimensions', label: 'Selection-panel score dimensions', group: 'Pay & scoring',
    description: 'What panel members score and the weight of each (should add up to 100).',
    meta: [{ key: 'weight', label: 'Weight', type: 'number', min: 0, max: 100 }],
  },
  {
    kind: 'schoolCategories', label: 'School subscription categories', group: 'Business',
    description: 'Categories that set a school’s annual subscription. Prices are placeholders until you set them.',
    meta: [
      { key: 'annualPrice', label: 'Annual price (₹, before GST)', type: 'number', min: 0 },
      { key: 'maxBranches', label: 'Branches included', type: 'number', min: 1 },
    ],
  },
];

export const KIND_MAP: Record<MasterKind, KindDef> = Object.fromEntries(KINDS.map(k => [k.kind, k])) as Record<MasterKind, KindDef>;

export function isMasterKind(v: unknown): v is MasterKind {
  return typeof v === 'string' && v in KIND_MAP;
}
