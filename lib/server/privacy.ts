import type { UserAccount } from '@/types';
import { audit, nowIso, type Store } from './db';
import { toPublicUser } from './auth';
import { PRIVACY_VERSION } from '@/lib/site';

/*
 * DPDP Act, 2023 tools: data export, account erasure, consent withdrawal and email preferences.
 */

/** Everything the platform holds about the person, as JSON (documents are listed; the files are downloaded separately). */
export function exportData(db: Store, userId: string) {
  const u = db.users.find(x => x.id === userId);
  if (!u) return null;
  return {
    exportedAt: nowIso(),
    note: 'Personal data held by TheSchoolTeacher about you. Uploaded files are listed under "documents"; download them from your Documents page.',
    account: toPublicUser(u),
    profile: db.profiles[userId] || null,
    documents: db.documents.filter(d => d.userId === userId).map(({ blobId, ...d }) => d),
    applications: db.applications.filter(a => a.candidateId === userId).map(a => ({ ...a, job: db.jobs.find(j => j.id === a.jobId)?.title ?? null })),
    savedJobs: db.savedJobs.filter(s => s.userId === userId),
    tracker: db.tracked.filter(t => t.userId === userId),
    jobAlerts: db.alerts.filter(a => a.userId === userId),
    securityLog: db.audit.filter(a => a.actorId === userId).slice(0, 500),
  };
}

/** Erases the account and everything linked to it. Returns the document blob ids to delete afterwards. */
export function eraseAccount(db: Store, userId: string, actorId: string): string[] {
  const blobs = db.documents.filter(d => d.userId === userId).map(d => d.blobId);
  db.documents = db.documents.filter(d => d.userId !== userId);
  delete db.profiles[userId];
  db.applications = db.applications.filter(a => a.candidateId !== userId);
  db.savedJobs = db.savedJobs.filter(s => s.userId !== userId);
  db.tracked = db.tracked.filter(t => t.userId !== userId);
  const alertIds = new Set(db.alerts.filter(a => a.userId === userId).map(a => a.id));
  db.alerts = db.alerts.filter(a => a.userId !== userId);
  for (const id of alertIds) delete db.alertState[id];
  for (const [k, s] of Object.entries(db.sessions)) if (s.userId === userId) delete db.sessions[k];
  for (const [k, t] of Object.entries(db.tokens)) if (t.userId === userId) delete db.tokens[k];
  const email = db.users.find(u => u.id === userId)?.email;
  db.users = db.users.filter(u => u.id !== userId);
  // The audit log keeps that an account was erased, but not who the person was.
  for (const a of db.audit) if (a.actorId === userId) a.actorEmail = '[erased]';
  if (email) for (const o of db.outbox) if (o.to === email) { o.to = '[erased]'; o.text = '(erased)'; o.html = undefined; }
  audit(db, { actorId: actorId === userId ? null : actorId, action: 'privacy.account_erased', target: userId });
  return blobs;
}

/** Gives or withdraws consent for matching. Withdrawing also turns off the discoverable profile. */
export function setMatchingConsent(db: Store, user: UserAccount, give: boolean): void {
  const u = db.users.find(x => x.id === user.id);
  if (!u) return;
  const current = u.consents.find(c => c.purpose === 'matching' && !c.withdrawnAt);
  if (give && !current) u.consents.push({ purpose: 'matching', version: PRIVACY_VERSION, givenAt: nowIso(), withdrawnAt: null });
  if (!give && current) {
    current.withdrawnAt = nowIso();
    const p = db.profiles[u.id];
    if (p) p.discoverable = false;
  }
  audit(db, { actorId: u.id, action: give ? 'privacy.matching_given' : 'privacy.matching_withdrawn', target: u.id });
}

export const EMAIL_LISTS = ['alerts', 'digest', 'news'] as const;
export type EmailList = (typeof EMAIL_LISTS)[number];

export function setEmailPreference(db: Store, userId: string, list: EmailList, on: boolean): void {
  const u = db.users.find(x => x.id === userId);
  if (!u) return;
  const set = new Set(u.unsubscribed || []);
  if (on) set.delete(list); else set.add(list);
  u.unsubscribed = [...set];
}
