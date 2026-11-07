/*
 * Shared types for TheSchoolTeacher. Server-only fields (password hashes, token digests) live in
 * UserAccount; anything sent to a browser goes through toPublicUser().
 */

export type Role = 'candidate' | 'school_admin' | 'school_staff' | 'platform_admin';
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
  /** For school_admin / school_staff: the school (or school group) the account belongs to. Set in Phase 3. */
  schoolId?: string | null;
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

export type TokenType = 'verify-email' | 'reset-password';
export interface TokenRecord { userId: string; type: TokenType; expiresAt: number }

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
  | 'payLevels' | 'matchWeights' | 'panelDimensions' | 'schoolCategories';

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
