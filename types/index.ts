/*
 * Shared types for TheSchoolTeacher. Server-only fields (password hashes, token digests) live in
 * UserAccount; anything sent to a browser goes through toPublicUser().
 */

export type Role = 'candidate' | 'school_admin' | 'school_staff' | 'platform_admin';
/** What a school_staff member may do (the school_admin may do everything). See lib/server/team.ts. */
export type StaffRole = 'principal' | 'hr' | 'coordinator' | 'panel';
export const STAFF_ROLES: StaffRole[] = ['principal', 'hr', 'coordinator', 'panel'];
export const ROLES: Role[] = ['candidate', 'school_admin', 'school_staff', 'platform_admin'];

export type AccountStatus = 'active' | 'suspended';

/** A consent the person gave (DPDP Act, 2023): what, which version of the text, and when. */
export interface ConsentRecord {
  purpose: 'terms' | 'privacy' | 'matching' | 'marketing';
  version: string;
  givenAt: string;
  withdrawnAt?: string | null;
}

export interface LinkedIdentity {
  provider: 'google';
  subject: string;
  email?: string;
  linkedAt: string;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  emailVerified: boolean;
  /** "pbkdf2_sha256$<iterations>$<salt>$<hash>"; empty for accounts that only use Google or email codes. */
  passwordHash: string;
  mustChangePassword?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  /** For school_admin / school_staff: the school the account is working on (a group admin can switch branches). */
  schoolId?: string | null;
  /** For school_staff: their role in the school (decides which parts of the school console they can use). */
  staffRole?: StaffRole | null;
  /** For the administrator of a school group / trust: every school with this groupId can be managed. */
  groupId?: string | null;
  identities?: LinkedIdentity[];
  consents: ConsentRecord[];
  /** Mailing lists the person unsubscribed from ("alerts", "digest", "news"). */
  unsubscribed?: string[];
  locale?: 'en' | 'hi';
  createdAt: string;
  lastLoginAt?: string | null;
}

/** What the browser may see about a user. */
export type PublicUser = Omit<UserAccount, 'passwordHash' | 'identities'> & { hasPassword: boolean; linkedProviders: string[] };

export interface Session {
  userId: string;
  createdAt: number;
  expiresAt: number;
  lastSeen: number;
  device?: string;
  ip?: string;
  method?: string;
}

export type TokenType = 'verify-email' | 'reset-password' | 'verify-school-email';
export interface TokenRecord { userId: string; type: TokenType; expiresAt: number; data?: string }

export type OtpPurpose = 'login' | 'admin-mfa';
export interface OtpChallenge {
  id: string;
  purpose: OtpPurpose;
  target: string;
  userId?: string;
  codeHash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  /** For an address with no account: answers like a real challenge but can never succeed. */
  decoy?: boolean;
  data?: Record<string, unknown>;
}

export type OutboxStatus = 'logged' | 'queued' | 'sent' | 'failed';
export interface OutboxItem {
  id: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  kind: string;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt?: number | null;
  lastError?: string | null;
  /** The message held a private link or code; its content is not kept after sending. */
  sensitive?: boolean;
  /** Bulk mail carries an unsubscribe link and List-Unsubscribe header. */
  list?: string | null;
  providerId?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  detail?: string | null;
  ip?: string | null;
}

// ------------------------------------------------------------------ master data

export type MasterKind =
  | 'states' | 'districts' | 'blocks'
  | 'boards' | 'managementTypes' | 'schoolLevels' | 'streams' | 'mediums'
  | 'posts' | 'subjects' | 'qualifications' | 'tetExams' | 'employmentTypes' | 'benefits'
  | 'payLevels' | 'matchWeights' | 'panelDimensions' | 'schoolCategories' | 'facilities';

export type MetaValue = string | number | boolean | null;

export interface MasterItem {
  id: string;
  kind: MasterKind;
  /** Short stable code (e.g. "CBSE", "TGT", "TN"). Unique within the kind. */
  code: string;
  name: string;
  /** Hindi name; the English name is shown when it is empty. */
  nameHi?: string;
  /** Parent item (district → state, block → district, state board → state). */
  parentId?: string | null;
  active: boolean;
  /** Seeded value that must be checked before launch (listed in docs/VERIFY_BEFORE_LAUNCH.md). */
  verify: boolean;
  sortOrder: number;
  meta: Record<string, MetaValue>;
  updatedAt: string;
  updatedBy?: string | null;
}

// ------------------------------------------------------------------ schools (Phase 3 adds registration and verification)

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface SchoolGroup { id: string; name: string; ownerId: string; createdAt: string }

export interface SchoolPhoto { id: string; blobId: string; mime: string; caption?: string | null }

export interface School {
  id: string;
  /** URL name for the public page: /schools/<slug>. */
  slug: string;
  name: string;
  /** 11-digit UDISE+ school code. */
  udiseCode: string;
  groupId?: string | null;
  managementTypeId: string;
  /** Boards with the school's affiliation number for each. */
  affiliations: { boardId: string; number?: string | null }[];
  boardIds: string[];
  levelIds: string[];
  streamIds: string[];
  mediumIds: string[];
  stateId: string;
  districtId?: string | null;
  blockId?: string | null;
  city: string;
  address?: string | null;
  pincode?: string | null;
  lat?: number | null;
  lng?: number | null;
  officialEmail?: string | null;
  officialEmailVerified?: boolean;
  phone?: string | null;
  principalName?: string | null;
  website?: string | null;
  about?: string | null;
  facilityIds: string[];
  photos: SchoolPhoto[];
  /** Offer-letter template with {merge fields}; empty = the default template. */
  offerTemplate?: string | null;
  /** Who signs offer letters. */
  offerSignatory?: { name: string; designation: string } | null;
  verification: VerificationStatus;
  verificationNote?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  reviewedBy?: string | null;
  /** The UDISE+ code was found in the admin-imported directory with the same name. */
  directoryMatch?: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  /** Sample data created by `npm run seed:demo` on a local copy. Never shown in production. */
  demo?: boolean;
}

/** One row of the UDISE+ school directory (reference data the admin imports). */
export interface UdiseRecord { code: string; name: string; state?: string | null; district?: string | null; block?: string | null; management?: string | null; category?: string | null }

// ------------------------------------------------------------------ vacancies

/**
 * school: posted by a verified school on the platform. government: an official recruitment notice (KVS, NVS,
 * state DSC / TRB …). external: a vacancy published elsewhere (a school's own careers page or a feed), listed
 * with a link to the original. government and external listings are added by the admin (often from the importer).
 */
export type JobKind = 'school' | 'government' | 'external';
export type JobStatus = 'draft' | 'published' | 'closed';
export type ApplyMode = 'platform' | 'external';
export type PayMode = 'cpc' | 'state_scale' | 'range' | 'not_disclosed';

export interface ScreeningQuestion {
  id: string;
  text: string;
  type: 'yesno' | 'text' | 'number';
  required: boolean;
  /** For yes/no questions: the answer a candidate must give to be considered (e.g. "yes" to "Can you join by June?"). */
  mustAnswer?: 'yes' | 'no' | null;
}

export interface JobEligibility {
  /** All of these are mandatory (e.g. B.Ed). */
  requiredQualificationIds: string[];
  /** Nice to have; counted in the match score, never mandatory. */
  preferredQualificationIds: string[];
  tetRequired: boolean;
  /** Any one of these TETs is accepted; empty with tetRequired = any TET. */
  acceptedTetIds: string[];
  /** e.g. "Paper II"; free text because papers differ between exams. */
  tetPaper?: string | null;
  minExperienceYears: number;
  minPercentage?: number | null;
  /** Languages the teacher must be able to teach in. */
  mediumIds: string[];
  policeVerificationRequired: boolean;
  otherRequirements?: string | null;
}

export interface JobPay {
  mode: PayMode;
  payLevelId?: string | null;
  scaleText?: string | null;
  /** Monthly, in rupees. */
  min?: number | null;
  max?: number | null;
  benefitIds: string[];
}

export interface KeyDate { label: string; date: string }

export interface Job {
  id: string;
  kind: JobKind;
  /** The posting school (kind = school). */
  schoolId?: string | null;
  /** Shown name of the employer / recruiting body (school name, or e.g. "Kendriya Vidyalaya Sangathan"). */
  orgName: string;
  title: string;
  postId: string;
  subjectIds: string[];
  levelIds: string[];
  streamIds: string[];
  employmentTypeId: string;
  boardIds: string[];
  managementTypeId: string;
  stateId: string;
  districtId?: string | null;
  city: string;
  pincode?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Number of posts. */
  vacancies: number;
  description: string;
  eligibility: JobEligibility;
  pay: JobPay;
  applyMode: ApplyMode;
  externalUrl?: string | null;
  notificationPdfUrl?: string | null;
  /** "Premium vacancy": applications only through the platform. */
  premium: boolean;
  screeningQuestions: ScreeningQuestion[];
  keyDates: KeyDate[];
  /** Last date to apply, YYYY-MM-DD (India time). */
  lastDate: string;
  status: JobStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  views: number;
  /** Where an imported / admin-added listing was found (shown as "Source"). */
  sourceName?: string | null;
  sourceUrl?: string | null;
  importItemId?: string | null;
  /** Selection panel for this vacancy: staff members who score applicants (confidentially). */
  panel?: PanelMember[];
  demo?: boolean;
}

export type PanelRole = 'principal' | 'coordinator' | 'subject_expert' | 'management_nominee' | 'other';
export interface PanelMember { userId: string; role: PanelRole }

// ------------------------------------------------------------------ candidates

export type Proficiency = 'basic' | 'fluent' | 'native';
export type PoliceVerification = 'not_done' | 'applied' | 'done';

export interface QualificationEntry { id: string; qualificationId: string; subjectId?: string | null; institution: string; year?: number | null; percentage?: number | null }
export interface TetEntry { id: string; tetId: string; paper: string; year?: number | null; score?: number | null; validUntil?: string | null; lifetime?: boolean }
export interface ExperienceEntry { id: string; school: string; boardId?: string | null; postId?: string | null; from: string; to?: string | null; current: boolean; levelIds: string[]; subjectIds: string[] }

export interface CandidateProfile {
  userId: string;
  phone?: string | null;
  headline?: string | null;
  about?: string | null;
  stateId?: string | null;
  districtId?: string | null;
  city?: string | null;
  pincode?: string | null;
  qualifications: QualificationEntry[];
  tets: TetEntry[];
  subjectIds: string[];
  levelIds: string[];
  mediums: { mediumId: string; proficiency: Proficiency }[];
  experience: ExperienceEntry[];
  preferredStateIds: string[];
  preferredDistrictIds: string[];
  willingToRelocate: boolean;
  /** Expected monthly salary in rupees. */
  expectedSalary?: number | null;
  computerProficiency: 'none' | 'basic' | 'good' | 'advanced';
  rciNumber?: string | null;
  certifications?: string | null;
  childSafety: {
    policeVerification: PoliceVerification;
    policeVerificationDate?: string | null;
    /** When the candidate accepted the child-safety self-declaration (null = not accepted). */
    selfDeclarationAt?: string | null;
  };
  /** Opt-in to talent search. Contact details and documents stay hidden until the candidate applies. */
  discoverable: boolean;
  updatedAt: string;
}

export type DocumentCategory = 'photo' | 'qualification' | 'tet' | 'experience' | 'id_proof' | 'police_verification' | 'pocso' | 'other';

export interface StoredDocument {
  id: string;
  userId: string;
  category: DocumentCategory;
  label: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  blobId: string;
}

// ------------------------------------------------------------------ applications, saved jobs, tracker, alerts

export type Stage = 'applied' | 'screening' | 'eligible' | 'shortlisted' | 'interview' | 'panel_review' | 'offer' | 'joined' | 'not_selected' | 'withdrawn';

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  schoolId?: string | null;
  stage: Stage;
  history: { stage: Stage; at: string; by?: string | null; note?: string | null }[];
  answers: { questionId: string; answer: string }[];
  /** Match score at the time of applying (0–100), when the candidate allowed matching. */
  matchScore?: number | null;
  appliedAt: string;
  updatedAt: string;
}

export interface ApplicationNote { id: string; applicationId: string; authorId: string; authorName: string; text: string; at: string }

export interface SavedJob { userId: string; jobId: string; at: string }

export type TrackStatus = 'interested' | 'applied' | 'exam' | 'interview' | 'result' | 'closed';
export interface TrackedJob {
  id: string;
  userId: string;
  /** Set for listings on this site; empty for jobs from other sites. */
  jobId?: string | null;
  title: string;
  organisation: string;
  url?: string | null;
  lastDate?: string | null;
  status: TrackStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Search filters, using master-data codes (as in the URL). */
export interface JobFilters {
  q?: string;
  kind?: JobKind;
  board?: string[];
  state?: string;
  district?: string;
  post?: string[];
  subject?: string[];
  level?: string[];
  medium?: string[];
  management?: string[];
  employment?: string[];
  sector?: 'government' | 'aided' | 'private';
  minSalary?: number;
  closingDays?: number;
  lat?: number;
  lng?: number;
  km?: number;
}

export type AlertFrequency = 'instant' | 'daily' | 'weekly';
export interface JobAlert {
  id: string;
  userId: string;
  name: string;
  filters: JobFilters;
  frequency: AlertFrequency;
  active: boolean;
  createdAt: string;
  lastSentAt?: string | null;
  lastSentCount?: number | null;
}

// ------------------------------------------------------------------ hiring tools (Phase 4)

/** An invitation for someone to join a school's team; only the digest of the link token is stored. */
export interface StaffInvite {
  id: string;
  schoolId: string;
  email: string;
  name: string;
  staffRole: StaffRole;
  tokenDigest: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
}

export type InterviewMode = 'in_person' | 'google_meet' | 'teams' | 'phone';
export type InterviewKind = 'interview' | 'demo';

/** A time a school offers for interviews or demo classes for one vacancy. Times are stored in UTC. */
export interface InterviewSlot {
  id: string;
  schoolId: string;
  jobId: string;
  kind: InterviewKind;
  start: string;
  durationMin: number;
  mode: InterviewMode;
  /** Address / room for in-person, meeting link for online, number for phone. */
  location: string;
  /** How many candidates can book this slot (1 for one-to-one). */
  capacity: number;
  createdBy: string;
  createdAt: string;
}

export type InterviewStatus = 'invited' | 'booked' | 'cancelled' | 'completed' | 'no_show';

/** One candidate's interview / demo class for one application. */
export interface Interview {
  id: string;
  applicationId: string;
  schoolId: string;
  jobId: string;
  candidateId: string;
  kind: InterviewKind;
  status: InterviewStatus;
  slotId?: string | null;
  /** Demo class requested by the school. */
  demoTopic?: string | null;
  demoClass?: string | null;
  /** Link to a short demo video the candidate shares (YouTube, Drive, …). */
  demoVideoUrl?: string | null;
  message?: string | null;
  /** Reminder emails already sent: "1d" and "1h". */
  reminders: string[];
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type Recommendation = 'strongly_recommend' | 'recommend' | 'reservations' | 'not_recommend';

/** One panel member's confidential score for one applicant. */
export interface PanelScore {
  id: string;
  applicationId: string;
  jobId: string;
  schoolId: string;
  memberId: string;
  panelRole: PanelRole;
  /** Marks out of 10 per score dimension (master-data id). */
  marks: Record<string, number>;
  /** The dimension weights when the score was saved, so later weight changes do not change past scores. */
  weights: Record<string, number>;
  /** Weighted total out of 100. */
  total: number;
  recommendation: Recommendation;
  comments?: string | null;
  submittedAt: string;
  updatedAt: string;
}

export type OfferStatus = 'issued' | 'accepted' | 'declined' | 'withdrawn';

export interface Offer {
  id: string;
  applicationId: string;
  schoolId: string;
  jobId: string;
  candidateId: string;
  designation: string;
  pay: string;
  joiningDate: string;
  acceptBy: string;
  reportTo?: string | null;
  /** The letter as issued (the template filled in); it does not change if the template changes later. */
  letter: string;
  signatory: { name: string; designation: string };
  status: OfferStatus;
  issuedBy: string;
  issuedAt: string;
  respondedAt?: string | null;
  responseNote?: string | null;
}

/** A school invited a discoverable candidate to apply for a vacancy. */
export interface TalentInvite {
  id: string;
  schoolId: string;
  jobId: string;
  candidateId: string;
  message?: string | null;
  invitedBy: string;
  at: string;
}

// ------------------------------------------------------------------ job import (external sources)

/** govt_page: an official recruitment / notices page. school_careers: a school's careers page. feed: an RSS or Atom feed. */
export type ImportSourceKind = 'govt_page' | 'school_careers' | 'feed';

export interface ImportSource {
  id: string;
  name: string;
  kind: ImportSourceKind;
  url: string;
  /** Employer shown on listings made from this source (e.g. "Kendriya Vidyalaya Sangathan"). */
  orgName: string;
  stateId?: string | null;
  active: boolean;
  /** How often it is checked. */
  everyHours: number;
  /** Seeded suggestion whose address must be checked before switching it on. */
  verify?: boolean;
  note?: string | null;
  lastRunAt?: string | null;
  lastStatus?: 'ok' | 'error' | 'blocked' | null;
  lastError?: string | null;
  lastFound?: number | null;
  lastNew?: number | null;
  createdBy?: string | null;
  createdAt: string;
}

export type ImportStatus = 'new' | 'published' | 'rejected' | 'duplicate';

/** One possible teacher vacancy / notice found by the importer, waiting for the admin's review. */
export interface ImportItem {
  id: string;
  sourceId: string;
  /** De-duplication key (link + title). */
  hash: string;
  title: string;
  url: string;
  /** The link points at a PDF notification. */
  pdf: boolean;
  /** A short piece of the text around the link, to help the reviewer (never published). */
  excerpt?: string | null;
  /** Last date or other date found near the link (YYYY-MM-DD), unconfirmed. */
  detectedDate?: string | null;
  /** Post master-data ids recognised in the title (PRT, TGT, PGT …). */
  detectedPostIds: string[];
  status: ImportStatus;
  jobId?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}
