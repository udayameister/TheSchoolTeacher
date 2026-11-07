import { randomBytes } from 'crypto';
import { openStore, type Db } from './persist';
import type { Application, AuditEntry, CandidateProfile, Job, JobAlert, MasterItem, MasterKind, OtpChallenge, OutboxItem, SavedJob, School, Session, StoredDocument, TokenRecord, TrackedJob, UserAccount } from '@/types';
import { seedMasterData } from '@/lib/masterData/seed';

/*
 * Typed access to the shared store. Every read and write goes through withDb(), which runs one
 * operation at a time (an in-process queue plus the MySQL lock in persist.ts) and saves whatever
 * changed. Pattern adapted from AcadeXMatch lib/server/db.ts (withDb + seed), with typed
 * collections instead of AcadeXMatch's client-side StorageService.
 */

export interface Collections {
  users: UserAccount[];
  sessions: Record<string, Session>;
  tokens: Record<string, TokenRecord>;
  otp: Record<string, OtpChallenge>;
  outbox: OutboxItem[];
  audit: AuditEntry[];
  /** "<list>:<email>" pairs for addresses without an account that unsubscribed (e.g. school outreach). */
  suppressed: string[];
  master: Partial<Record<MasterKind, MasterItem[]>>;
  schools: School[];
  jobs: Job[];
  profiles: Record<string, CandidateProfile>;
  documents: StoredDocument[];
  applications: Application[];
  savedJobs: SavedJob[];
  tracked: TrackedJob[];
  alerts: JobAlert[];
  /** Per alert: vacancies already sent and when it last ran (server-only bookkeeping). */
  /** View counts per vacancy (kept apart from the vacancies so a page view rewrites only this small record). */
  jobViews: Record<string, number>;
  alertState: Record<string, { seen: string[]; lastRunDay?: string; lastSentMs?: number }>;
  /** Version of the master-data seed that was last applied (new seed kinds are added, edits are never overwritten). */
  masterSeedVersion: number;
}

export type Store = Collections & { raw: Db };

const g = globalThis as unknown as { __tstChain?: Promise<unknown> };

function queue<T>(fn: () => Promise<T>): Promise<T> {
  const run = (g.__tstChain || Promise.resolve()).then(fn, fn);
  g.__tstChain = run.catch(() => undefined);
  return run;
}

function ensureShape(db: Db): void {
  for (const k of ['users', 'outbox', 'audit', 'suppressed', 'schools', 'jobs', 'documents', 'applications', 'savedJobs', 'tracked', 'alerts'] as const) if (!Array.isArray(db[k])) db[k] = [];
  for (const k of ['sessions', 'tokens', 'otp', 'master', 'profiles', 'alertState', 'jobViews'] as const) if (!db[k] || typeof db[k] !== 'object' || Array.isArray(db[k])) db[k] = {};
  if (typeof db.masterSeedVersion !== 'number') db.masterSeedVersion = 0;
  seedMasterData(db as unknown as Collections);
}

/** Runs fn against the store; the store is saved afterwards if anything in it changed. */
export function withDb<T>(fn: (db: Store) => T | Promise<T>): Promise<T> {
  return queue(async () => {
    const session = await openStore();
    try {
      const data = session.data;
      ensureShape(data);
      const store = new Proxy(data, {
        get: (t, p) => (p === 'raw' ? t : t[p as string]),
        set: (t, p, v) => { t[p as string] = v; return true; },
      }) as unknown as Store;
      const result = await fn(store);
      await session.save();
      return result;
    } finally {
      await session.close();
    }
  });
}

/** Short random id with a readable prefix, e.g. "usr_k3j9x2m1q8". */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(5).toString('hex')}`;
}

export const nowIso = () => new Date().toISOString();

const MAX_AUDIT = 5000;

/** Appends to the audit log (newest first, capped). Call inside withDb. */
export function audit(db: Store, entry: Omit<AuditEntry, 'id' | 'at'>): void {
  const actor = entry.actorId ? db.users.find(u => u.id === entry.actorId) : undefined;
  db.audit.unshift({ id: newId('aud'), at: nowIso(), actorEmail: actor?.email ?? entry.actorEmail ?? null, ...entry });
  if (db.audit.length > MAX_AUDIT) db.audit.length = MAX_AUDIT;
}
