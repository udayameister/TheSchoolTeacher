import type { MasterKind, School, UserAccount } from '@/types';
import type { Lookup } from '@/lib/jobs/filters';
import { audit, newId, nowIso, type Store } from './db';
import { isEmail } from './security';
import { cleanUdise, isUdiseCode } from './udise';

/*
 * Schools: registration, editing, access rules and the admin's verification decision.
 *
 *  - A school_admin registers a school; it stays "pending" until the platform administrator checks the
 *    UDISE+ code, affiliation and official contact. Vacancies of a pending school can be drafted but are
 *    not public, and cannot be published.
 *  - A school group / trust: the first school creates a group; the group's administrator can add more
 *    branches (each with its own UDISE+ code, each verified separately) and switch between them.
 *  - After verification, the identity fields (UDISE+ code, name, management, boards, state, district) are
 *    locked for the school; changing them needs the platform administrator.
 */

export const IDENTITY_FIELDS = ['udiseCode', 'name', 'managementTypeId', 'affiliations', 'stateId', 'districtId'] as const;
const MAX_BRANCHES = 50;

const str = (v: unknown, max: number) => { const s = String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max); return s || null; };
const arr = (v: unknown, max = 40): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const ids = (lookup: Lookup, v: unknown, kind: MasterKind) => [...new Set(arr(v).map(String))].filter(id => lookup.get(id)?.kind === kind);
const oneId = (lookup: Lookup, v: unknown, kind: MasterKind) => (typeof v === 'string' && lookup.get(v)?.kind === kind ? v : null);
const intIn = (v: unknown, min: number, max: number) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const url = (v: unknown) => { const s = str(v, 300); if (!s) return null; try { const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch { return null; } };

export function slugify(name: string, city: string): string {
  return `${name} ${city}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'school';
}
function uniqueSlug(db: Store, base: string, selfId?: string): string {
  let s = base, i = 2;
  while (db.schools.some(x => x.slug === s && x.id !== selfId)) s = `${base}-${i++}`;
  return s;
}

/** Schools this user may manage (their own, or every branch of their group; the admin: all). */
export function managedSchools(db: Store, user: UserAccount | null | undefined): School[] {
  if (!user) return [];
  if (user.role === 'platform_admin') return db.schools;
  if (user.role === 'school_admin' && user.groupId) return db.schools.filter(s => s.groupId === user.groupId || s.id === user.schoolId);
  if (user.role === 'school_admin' || user.role === 'school_staff') return db.schools.filter(s => s.id === user.schoolId);
  return [];
}

export function canManageSchool(db: Store, user: UserAccount | null | undefined, schoolId: string | null | undefined): boolean {
  return !!schoolId && managedSchools(db, user).some(s => s.id === schoolId);
}

/** The school a staff member is working on now. */
export function currentSchool(db: Store, user: UserAccount | null | undefined): School | undefined {
  if (!user?.schoolId) return undefined;
  return db.schools.find(s => s.id === user.schoolId && canManageSchool(db, user, s.id));
}

/** Warning (not an error) when the first two digits do not match the state's UDISE+ prefixes. */
export function udisePrefixWarning(lookup: Lookup, code: string, stateId: string | null): string | null {
  const prefixes = String(lookup.get(stateId || '')?.meta.udisePrefix || '').split(',').map(s => s.trim()).filter(Boolean);
  return prefixes.length && !prefixes.includes(code.slice(0, 2)) ? 'school.warnUdisePrefix' : null;
}

export interface SchoolInput { [k: string]: unknown }

/**
 * Cleans the school form. `identity` = also accept the identity fields (new school, still pending, or the admin).
 * Errors are i18n keys under "school.*".
 */
export function cleanSchool(input: SchoolInput, lookup: Lookup, prev: School | null, opts: { identity: boolean }): { patch?: Partial<School>; error?: string } {
  const p: Partial<School> = {};
  if (opts.identity) {
    const code = cleanUdise(input.udiseCode);
    if (!isUdiseCode(code)) return { error: 'school.errUdise' };
    const name = str(input.name, 160);
    if (!name || name.length < 3) return { error: 'school.errName' };
    const managementTypeId = oneId(lookup, input.managementTypeId, 'managementTypes');
    if (!managementTypeId) return { error: 'school.errManagement' };
    const affiliations = arr(input.affiliations, 10).map(raw => {
      const a = (raw || {}) as Record<string, unknown>;
      return { boardId: oneId(lookup, a.boardId, 'boards') || '', number: str(a.number, 40) };
    }).filter((a, i, all) => a.boardId && all.findIndex(x => x.boardId === a.boardId) === i);
    if (!affiliations.length) return { error: 'school.errBoard' };
    const stateId = oneId(lookup, input.stateId, 'states');
    if (!stateId) return { error: 'school.errState' };
    const districtId = oneId(lookup, input.districtId, 'districts');
    if (districtId && lookup.get(districtId)?.parentId !== stateId) return { error: 'school.errDistrict' };
    Object.assign(p, { udiseCode: code, name, managementTypeId, affiliations, boardIds: affiliations.map(a => a.boardId), stateId, districtId });
  }
  const city = str(input.city, 80);
  if (!city && !prev?.city) return { error: 'school.errCity' };
  const pincode = str(input.pincode, 6);
  if (pincode && !/^[1-9]\d{5}$/.test(pincode)) return { error: 'school.errPincode' };
  const officialEmail = str(input.officialEmail, 254)?.toLowerCase() || null;
  if (officialEmail && !isEmail(officialEmail)) return { error: 'school.errEmail' };
  const phone = str(input.phone, 20);
  if (phone && !/^[+\d][\d\s-]{6,18}$/.test(phone)) return { error: 'school.errPhone' };
  if (!officialEmail && !phone) return { error: 'school.errContact' };
  const lat = input.lat === '' || input.lat == null ? null : Number(input.lat);
  const lng = input.lng === '' || input.lng == null ? null : Number(input.lng);
  if ((lat !== null || lng !== null) && !(lat !== null && lng !== null && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98)) return { error: 'school.errLocation' };
  Object.assign(p, {
    city: city || prev?.city, address: str(input.address, 300), pincode, officialEmail, phone,
    principalName: str(input.principalName, 120), website: url(input.website), about: str(input.about, 3000),
    levelIds: ids(lookup, input.levelIds, 'schoolLevels'), streamIds: ids(lookup, input.streamIds, 'streams'), mediumIds: ids(lookup, input.mediumIds, 'mediums'),
    facilityIds: ids(lookup, input.facilityIds, 'facilities'),
    benefitIds: ids(lookup, input.benefitIds, 'benefits'),
    establishedYear: intIn(input.establishedYear, 1800, new Date().getFullYear()),
    studentCount: intIn(input.studentCount, 1, 100_000), teacherCount: intIn(input.teacherCount, 1, 5_000),
    whyJoin: str(input.whyJoin, 2000), achievements: str(input.achievements, 2000),
    socialLinks: arr(input.socialLinks, 6).map(raw => { const l = (raw || {}) as Record<string, unknown>; const u = url(l.url); return u ? { label: str(l.label, 40) || new URL(u).hostname.replace(/^www\./, ''), url: u } : null; }).filter((l): l is { label: string; url: string } => !!l),
    lat: lat === null ? null : Math.round(lat * 1e5) / 1e5, lng: lng === null ? null : Math.round(lng * 1e5) / 1e5,
  });
  if (officialEmail !== (prev?.officialEmail ?? null)) p.officialEmailVerified = false;
  return { patch: p };
}

/** Another school (not rejected) already uses this UDISE+ code? */
export function udiseTaken(db: Store, code: string, selfId?: string): boolean {
  return db.schools.some(s => s.udiseCode === code && s.id !== selfId && s.verification !== 'rejected' && !s.demo);
}

/** Registers the user's first school, or a new branch of their group. */
export function registerSchool(db: Store, user: UserAccount, input: SchoolInput, lookup: Lookup, directoryName: string | null): { school?: School; error?: string } {
  if (user.role !== 'school_admin') return { error: 'school.errRole' };
  const u = db.users.find(x => x.id === user.id)!;
  const asBranch = !!u.schoolId;
  if (asBranch && !u.groupId) return { error: 'school.errAlreadyRegistered' };
  if (u.groupId && db.schools.filter(s => s.groupId === u.groupId).length >= MAX_BRANCHES) return { error: 'school.errBranchLimit' };
  const { patch, error } = cleanSchool(input, lookup, null, { identity: true });
  if (!patch) return { error };
  if (udiseTaken(db, patch.udiseCode!)) return { error: 'school.errUdiseTaken' };
  const at = nowIso();
  let groupId = u.groupId || null;
  if (!groupId && input.isGroup === true) {
    const groupName = str(input.groupName, 160) || `${patch.name} group`;
    groupId = newId('grp');
    db.groups.push({ id: groupId, name: groupName, ownerId: u.id, createdAt: at });
    u.groupId = groupId;
  }
  const school: School = {
    id: newId('sch'), slug: uniqueSlug(db, slugify(patch.name!, patch.city!)), groupId,
    ...(patch as Omit<School, 'id' | 'slug'>),
    photos: [], verification: 'pending', verificationNote: null, submittedAt: at, verifiedAt: null, reviewedBy: null,
    directoryMatch: !!directoryName, createdBy: u.id, createdAt: at, updatedAt: at,
  };
  db.schools.push(school);
  u.schoolId = school.id;
  audit(db, { actorId: u.id, action: asBranch ? 'school.branch_register' : 'school.register', target: school.id, detail: `${school.name} (${school.udiseCode})` });
  return { school };
}

/** Saves the school form. Identity fields only while pending/rejected, or by the platform administrator. */
export function updateSchool(db: Store, user: UserAccount, schoolId: string, input: SchoolInput, lookup: Lookup): { school?: School; error?: string; resubmitted?: boolean } {
  const school = db.schools.find(s => s.id === schoolId);
  if (!school || !canManageSchool(db, user, schoolId)) return { error: 'school.errNotFound' };
  if (user.role === 'school_staff') return { error: 'school.errRole' };
  const identity = user.role === 'platform_admin' || school.verification !== 'verified';
  const { patch, error } = cleanSchool(input, lookup, school, { identity });
  if (!patch) return { error };
  if (patch.udiseCode && udiseTaken(db, patch.udiseCode, school.id)) return { error: 'school.errUdiseTaken' };
  Object.assign(school, patch, { updatedAt: nowIso() });
  // A rejected school that fixes its details goes back into the queue.
  let resubmitted = false;
  if (school.verification === 'rejected' && user.role !== 'platform_admin') { school.verification = 'pending'; school.submittedAt = nowIso(); resubmitted = true; }
  audit(db, { actorId: user.id, action: resubmitted ? 'school.resubmit' : 'school.update', target: school.id });
  return { school, resubmitted };
}

/** The platform administrator's decision. A reason is required to reject. */
export function reviewSchool(db: Store, admin: UserAccount, schoolId: string, decision: 'verified' | 'rejected' | 'pending', note: string): { school?: School; error?: string } {
  const school = db.schools.find(s => s.id === schoolId);
  if (!school) return { error: 'Not found.' };
  const reason = String(note || '').trim().slice(0, 1000);
  if (decision === 'rejected' && reason.length < 5) return { error: 'Give the school a reason (at least a few words).' };
  if (decision === 'verified' && udiseTaken(db, school.udiseCode, school.id) && db.schools.some(s => s.udiseCode === school.udiseCode && s.id !== school.id && s.verification === 'verified')) {
    return { error: 'Another verified school already has this UDISE+ code.' };
  }
  school.verification = decision;
  school.verificationNote = reason || null;
  school.reviewedBy = admin.id;
  school.verifiedAt = decision === 'verified' ? nowIso() : null;
  if (decision !== 'verified') for (const j of db.jobs) if (j.schoolId === school.id && j.status === 'published') j.status = 'closed';
  audit(db, { actorId: admin.id, action: `school.${decision}`, target: school.id, detail: reason || null });
  return { school };
}

export function mapsUrl(s: Pick<School, 'lat' | 'lng' | 'name' | 'address' | 'city' | 'pincode'>): string {
  const q = s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : [s.name, s.address, s.city, s.pincode].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
