/*
 * The MySQL table layout: one table per kind of record (users, schools, jobs, applications, …), one row per
 * record. Each table has
 *   - `id`   the record's key (primary key),
 *   - `seq`  an auto-increment number that keeps the order records were added in,
 *   - a few readable columns (email, school, job, stage, dates …), indexed for browsing and SQL reports,
 *   - `data` the complete record as JSON (the source of truth the application reads),
 *   - `row_updated_at` (when the row last changed).
 * The readable columns are copies taken from the record every time it is saved; long values are shortened.
 * Adding a column here is enough: the schema is created / extended on start-up (persist.ts).
 */

type Rec = Record<string, unknown>;
export type ColType = 'key' | 'text' | 'int' | 'num' | 'bool' | 'when';

export interface Column { name: string; type: ColType; get: (r: Rec, key: string) => unknown; index?: boolean }

export interface TableDef {
  /** Property of the in-memory store (Collections in db.ts). */
  coll: string;
  table: string;
  /** array: list of records with a key; map: object keyed by id; master: master data grouped by kind; strings: list of strings; scalar: one value. */
  shape: 'array' | 'map' | 'master' | 'strings' | 'scalar';
  /** Record → its key (array tables). */
  key?: (r: Rec) => string;
  /** Load order (newest-first lists such as the audit log are kept that way). */
  order?: 'asc' | 'desc';
  cols: Column[];
}

const f = (field: string) => (r: Rec) => r[field];
const c = (name: string, type: ColType, field?: string, index = false): Column => ({ name, type, get: f(field ?? name), index });
const ix = (name: string, type: ColType, field?: string): Column => c(name, type, field, true);
const byId = (r: Rec) => String(r.id);

export const TABLES: TableDef[] = [
  { coll: 'users', table: 'tst_users', shape: 'array', key: byId, cols: [ix('email', 'key'), c('name', 'text'), ix('role', 'key'), c('staff_role', 'key', 'staffRole'), c('status', 'key'), ix('school_id', 'key', 'schoolId'), c('group_id', 'key', 'groupId'), c('email_verified', 'bool', 'emailVerified'), c('created_at', 'when', 'createdAt'), c('last_login_at', 'when', 'lastLoginAt')] },
  { coll: 'sessions', table: 'tst_sessions', shape: 'map', cols: [ix('user_id', 'key', 'userId'), c('expires_at', 'int', 'expiresAt'), c('device', 'text')] },
  { coll: 'tokens', table: 'tst_tokens', shape: 'map', cols: [ix('user_id', 'key', 'userId'), c('type', 'key'), c('expires_at', 'int', 'expiresAt')] },
  { coll: 'otp', table: 'tst_otp_challenges', shape: 'map', cols: [c('purpose', 'key'), c('user_id', 'key', 'userId'), c('expires_at', 'int', 'expiresAt')] },
  { coll: 'outbox', table: 'tst_email_outbox', shape: 'array', key: byId, order: 'desc', cols: [ix('to_address', 'key', 'to'), c('subject', 'text'), c('kind', 'key'), ix('status', 'key'), c('attempts', 'int'), c('created_at', 'when', 'createdAt')] },
  { coll: 'audit', table: 'tst_audit_log', shape: 'array', key: byId, order: 'desc', cols: [ix('at', 'when'), ix('actor_id', 'key', 'actorId'), c('actor_email', 'key', 'actorEmail'), ix('action', 'key'), c('target', 'key'), c('detail', 'text')] },
  { coll: 'suppressed', table: 'tst_email_suppressed', shape: 'strings', cols: [] },
  { coll: 'master', table: 'tst_master_data', shape: 'master', cols: [ix('kind', 'key'), c('code', 'key'), c('name', 'text'), c('parent_id', 'key', 'parentId'), c('active', 'bool'), c('needs_verify', 'bool', 'verify'), c('sort_order', 'int', 'sortOrder')] },
  { coll: 'masterSeedVersion', table: 'tst_settings', shape: 'scalar', cols: [] },
  { coll: 'schools', table: 'tst_schools', shape: 'array', key: byId, cols: [ix('slug', 'key'), c('name', 'text'), ix('udise_code', 'key', 'udiseCode'), c('group_id', 'key', 'groupId'), c('state_id', 'key', 'stateId'), c('district_id', 'key', 'districtId'), c('city', 'text'), ix('verification', 'key'), c('created_at', 'when', 'createdAt')] },
  { coll: 'groups', table: 'tst_school_groups', shape: 'array', key: byId, cols: [c('name', 'text'), c('owner_id', 'key', 'ownerId')] },
  { coll: 'jobs', table: 'tst_jobs', shape: 'array', key: byId, cols: [ix('kind', 'key'), ix('school_id', 'key', 'schoolId'), c('org_name', 'text', 'orgName'), c('title', 'text'), c('post_id', 'key', 'postId'), c('state_id', 'key', 'stateId'), c('district_id', 'key', 'districtId'), ix('status', 'key'), ix('last_date', 'key', 'lastDate'), c('published_at', 'when', 'publishedAt'), c('created_at', 'when', 'createdAt')] },
  { coll: 'jobViews', table: 'tst_job_views', shape: 'map', cols: [{ name: 'views', type: 'int', get: r => (typeof r === 'number' ? r : null) }] },
  { coll: 'profiles', table: 'tst_candidate_profiles', shape: 'map', cols: [c('discoverable', 'bool'), c('state_id', 'key', 'stateId'), c('district_id', 'key', 'districtId'), c('updated_at', 'when', 'updatedAt')] },
  { coll: 'documents', table: 'tst_documents', shape: 'array', key: byId, cols: [ix('user_id', 'key', 'userId'), c('category', 'key'), c('file_name', 'text', 'fileName'), c('size', 'int'), c('uploaded_at', 'when', 'uploadedAt')] },
  { coll: 'applications', table: 'tst_applications', shape: 'array', key: byId, cols: [ix('job_id', 'key', 'jobId'), ix('candidate_id', 'key', 'candidateId'), ix('school_id', 'key', 'schoolId'), ix('stage', 'key'), c('match_score', 'num', 'matchScore'), c('applied_at', 'when', 'appliedAt'), c('updated_at', 'when', 'updatedAt')] },
  { coll: 'appNotes', table: 'tst_application_notes', shape: 'array', key: byId, cols: [ix('application_id', 'key', 'applicationId'), c('author_id', 'key', 'authorId'), c('at', 'when')] },
  { coll: 'savedJobs', table: 'tst_saved_jobs', shape: 'array', key: r => `${r.userId}:${r.jobId}`, cols: [ix('user_id', 'key', 'userId'), c('job_id', 'key', 'jobId'), c('at', 'when')] },
  { coll: 'tracked', table: 'tst_tracked_jobs', shape: 'array', key: byId, cols: [ix('user_id', 'key', 'userId'), c('job_id', 'key', 'jobId'), c('title', 'text'), c('status', 'key'), c('last_date', 'key', 'lastDate')] },
  { coll: 'alerts', table: 'tst_job_alerts', shape: 'array', key: byId, cols: [ix('user_id', 'key', 'userId'), c('name', 'text'), c('frequency', 'key'), c('active', 'bool'), c('last_sent_at', 'when', 'lastSentAt')] },
  { coll: 'alertState', table: 'tst_job_alert_state', shape: 'map', cols: [] },
  { coll: 'staffInvites', table: 'tst_staff_invites', shape: 'array', key: byId, cols: [ix('school_id', 'key', 'schoolId'), c('email', 'key'), c('staff_role', 'key', 'staffRole'), c('expires_at', 'when', 'expiresAt'), c('accepted_at', 'when', 'acceptedAt')] },
  { coll: 'slots', table: 'tst_interview_slots', shape: 'array', key: byId, cols: [ix('school_id', 'key', 'schoolId'), ix('job_id', 'key', 'jobId'), c('kind', 'key'), ix('start_at', 'when', 'start'), c('duration_min', 'int', 'durationMin'), c('mode', 'key'), c('capacity', 'int')] },
  { coll: 'interviews', table: 'tst_interviews', shape: 'array', key: byId, cols: [ix('application_id', 'key', 'applicationId'), c('school_id', 'key', 'schoolId'), c('job_id', 'key', 'jobId'), ix('candidate_id', 'key', 'candidateId'), c('kind', 'key'), ix('status', 'key'), c('slot_id', 'key', 'slotId')] },
  { coll: 'panelScores', table: 'tst_panel_scores', shape: 'array', key: byId, cols: [ix('application_id', 'key', 'applicationId'), c('job_id', 'key', 'jobId'), c('member_id', 'key', 'memberId'), c('total', 'num'), c('recommendation', 'key')] },
  { coll: 'offers', table: 'tst_offers', shape: 'array', key: byId, cols: [ix('application_id', 'key', 'applicationId'), c('school_id', 'key', 'schoolId'), c('job_id', 'key', 'jobId'), ix('candidate_id', 'key', 'candidateId'), ix('status', 'key'), c('accept_by', 'key', 'acceptBy'), c('issued_at', 'when', 'issuedAt')] },
  { coll: 'talentInvites', table: 'tst_talent_invites', shape: 'array', key: byId, cols: [ix('school_id', 'key', 'schoolId'), c('job_id', 'key', 'jobId'), ix('candidate_id', 'key', 'candidateId'), c('at', 'when')] },
  { coll: 'importSources', table: 'tst_import_sources', shape: 'array', key: byId, cols: [c('name', 'text'), c('kind', 'key'), c('url', 'text'), c('active', 'bool'), c('last_run_at', 'when', 'lastRunAt'), c('last_status', 'key', 'lastStatus')] },
  { coll: 'importItems', table: 'tst_import_items', shape: 'array', key: byId, cols: [ix('source_id', 'key', 'sourceId'), ix('hash', 'key'), c('title', 'text'), c('url', 'text'), ix('status', 'key'), c('detected_date', 'key', 'detectedDate'), c('first_seen_at', 'when', 'firstSeenAt')] },
];

export const TABLE_BY_COLL = new Map(TABLES.map(t => [t.coll, t]));

const SQL_TYPE: Record<ColType, string> = { key: 'VARCHAR(191)', text: 'VARCHAR(500)', int: 'BIGINT', num: 'DOUBLE', bool: 'TINYINT(1)', when: 'VARCHAR(40)' };
export const sqlType = (t: ColType) => SQL_TYPE[t];

/** A value for a readable column (shortened to fit; never throws). */
export function colValue(col: Column, rec: unknown, key: string): string | number | null {
  let v: unknown;
  try { v = col.get(rec as Rec, key); } catch { v = null; }
  if (v === undefined || v === null || v === '') return null;
  switch (col.type) {
    case 'int': { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; }
    case 'num': { const n = Number(v); return Number.isFinite(n) ? n : null; }
    case 'bool': return v ? 1 : 0;
    case 'key': return String(v).slice(0, 191);
    case 'when': return String(v).slice(0, 40);
    default: return String(v).slice(0, 500);
  }
}

/** CREATE TABLE statement for a table. */
export function createSql(t: TableDef): string {
  const cols = t.cols.map(col => `\`${col.name}\` ${SQL_TYPE[col.type]} NULL`);
  const idx = t.cols.filter(col => col.index).map(col => `KEY \`ix_${col.name}\` (\`${col.name}\`)`);
  return `CREATE TABLE IF NOT EXISTS \`${t.table}\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`seq\` BIGINT NOT NULL AUTO_INCREMENT,
  ${[...cols, '`data` LONGTEXT NOT NULL', '`row_updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'PRIMARY KEY (`id`)', 'UNIQUE KEY `ux_seq` (`seq`)', ...idx].join(',\n  ')}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
}

/** Rows (key → record) of one collection as it is held in memory. */
export function rowsOf(t: TableDef, value: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (value === undefined || value === null) return out;
  switch (t.shape) {
    case 'array': for (const r of Array.isArray(value) ? value : []) out.set(t.key!(r as Rec), r); break;
    case 'map': for (const [k, v] of Object.entries(value as Rec)) out.set(k, v); break;
    case 'master': for (const list of Object.values(value as Rec)) for (const r of Array.isArray(list) ? list : []) out.set(String((r as Rec).id), r); break;
    case 'strings': for (const s of Array.isArray(value) ? value : []) out.set(String(s), s); break;
    case 'scalar': out.set(t.coll, value); break;
  }
  return out;
}

/** The in-memory value of a collection rebuilt from its rows (in table order). */
export function valueOf(t: TableDef, rows: [string, unknown][]): unknown {
  switch (t.shape) {
    case 'array': case 'strings': return rows.map(([, v]) => v);
    case 'map': return Object.fromEntries(rows);
    case 'master': {
      const m: Record<string, unknown[]> = {};
      for (const [, v] of rows) { const kind = String((v as Rec).kind); (m[kind] ||= []).push(v); }
      return m;
    }
    case 'scalar': return rows.find(([k]) => k === t.coll)?.[1];
  }
}
