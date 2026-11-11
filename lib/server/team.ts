import type { StaffInvite, StaffRole, UserAccount } from '@/types';
import { STAFF_ROLES } from '@/types';
import { audit, newId, nowIso, type Store } from './db';
import { digest, isEmail, randomToken } from './security';
import { normEmail } from './auth';
import { currentSchool } from './schools';

/*
 * School teams. The school_admin (who registered the school) invites staff by email and gives each a
 * role. A role decides which parts of the school console the person can use:
 *
 *   principal, hr  – vacancies, applicants, interviews, offers, talent search, reports, all panel scores
 *   coordinator    – vacancies, applicants, interviews, talent search
 *   panel          – only the applicants of vacancies whose selection panel they sit on (to score them)
 *
 * Anyone in the team (including the school_admin) can be put on a vacancy's selection panel. Roles are
 * enforced on the server: API routes call can(), and the applicant lists are filtered (pipeline.ts).
 * Adapted from AcadeXMatch's institute team / committee members, with invitations stored server-side.
 */

export type Perm = 'jobs' | 'pipeline' | 'interviews' | 'scoresAll' | 'offers' | 'talent' | 'reports' | 'team';

const BY_ROLE: Record<StaffRole, Perm[]> = {
  principal: ['jobs', 'pipeline', 'interviews', 'scoresAll', 'offers', 'talent', 'reports'],
  hr: ['jobs', 'pipeline', 'interviews', 'scoresAll', 'offers', 'talent', 'reports'],
  coordinator: ['jobs', 'pipeline', 'interviews', 'talent'],
  panel: [],
};

export const staffRoleOf = (u: UserAccount): StaffRole => (u.staffRole && STAFF_ROLES.includes(u.staffRole) ? u.staffRole : 'hr');

export function can(user: UserAccount | null | undefined, perm: Perm): boolean {
  if (!user) return false;
  if (user.role === 'school_admin' || user.role === 'platform_admin') return true;
  if (user.role !== 'school_staff') return false;
  return BY_ROLE[staffRoleOf(user)].includes(perm);
}

export const INVITE_DAYS = 7;
const MAX_TEAM = 50;

export interface TeamMember { id: string; name: string; email: string; role: 'school_admin' | StaffRole; status: string; lastLoginAt?: string | null; self: boolean }

/** Everyone who can work on the user's current school, and the open invitations. */
export function listTeam(db: Store, user: UserAccount): { members: TeamMember[]; invites: Omit<StaffInvite, 'tokenDigest'>[] } | null {
  const school = currentSchool(db, user);
  if (!school) return null;
  const admins = db.users.filter(u => u.role === 'school_admin' && (u.schoolId === school.id || (!!school.groupId && u.groupId === school.groupId)));
  const staff = db.users.filter(u => u.role === 'school_staff' && u.schoolId === school.id);
  const members: TeamMember[] = [
    ...admins.map(u => ({ id: u.id, name: u.name, email: u.email, role: 'school_admin' as const, status: u.status, lastLoginAt: u.lastLoginAt, self: u.id === user.id })),
    ...staff.map(u => ({ id: u.id, name: u.name, email: u.email, role: staffRoleOf(u), status: u.status, lastLoginAt: u.lastLoginAt, self: u.id === user.id })),
  ];
  const now = new Date().toISOString();
  const invites = db.staffInvites.filter(i => i.schoolId === school.id && !i.acceptedAt && i.expiresAt > now).map(({ tokenDigest, ...i }) => i);
  return { members, invites };
}

/** Team members who can sit on a selection panel for a school (admins and staff). */
export function panelCandidates(db: Store, schoolId: string): { id: string; name: string }[] {
  const school = db.schools.find(s => s.id === schoolId);
  if (!school) return [];
  return db.users.filter(u => u.status === 'active' && (
    (u.role === 'school_staff' && u.schoolId === schoolId) ||
    (u.role === 'school_admin' && (u.schoolId === schoolId || (!!school.groupId && u.groupId === school.groupId)))
  )).map(u => ({ id: u.id, name: u.name }));
}

/** Creates an invitation. Returns the one-time link token (sent by email and shown once to the inviter). */
export function inviteStaff(db: Store, user: UserAccount, input: { email?: unknown; name?: unknown; staffRole?: unknown }): { invite?: StaffInvite; token?: string; error?: string } {
  if (!can(user, 'team')) return { error: 'team.errPermission' };
  const school = currentSchool(db, user);
  if (!school) return { error: 'team.errNoSchool' };
  const email = normEmail(input.email);
  const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const staffRole = input.staffRole as StaffRole;
  if (!isEmail(email)) return { error: 'team.errEmail' };
  if (name.length < 2) return { error: 'team.errName' };
  if (!STAFF_ROLES.includes(staffRole)) return { error: 'team.errRole' };
  const existing = db.users.find(u => u.email === email);
  if (existing && !(existing.role === 'school_staff' && !existing.schoolId)) {
    return { error: existing.role === 'school_staff' && existing.schoolId === school.id ? 'team.errAlreadyMember' : 'team.errOtherAccount' };
  }
  const team = db.users.filter(u => u.role === 'school_staff' && u.schoolId === school.id).length;
  const now = nowIso();
  const open = db.staffInvites.filter(i => i.schoolId === school.id && !i.acceptedAt && i.expiresAt > now);
  if (team + open.length >= MAX_TEAM) return { error: 'team.errLimit' };
  // A new invitation to the same address replaces the old one (the old link stops working).
  db.staffInvites = db.staffInvites.filter(i => !(i.schoolId === school.id && i.email === email && !i.acceptedAt));
  const token = randomToken(32);
  const invite: StaffInvite = {
    id: newId('inv'), schoolId: school.id, email, name, staffRole, tokenDigest: digest(token), invitedBy: user.id,
    createdAt: now, expiresAt: new Date(Date.now() + INVITE_DAYS * 86400_000).toISOString(), acceptedAt: null,
  };
  db.staffInvites.push(invite);
  audit(db, { actorId: user.id, action: 'team.invite', target: school.id, detail: `${email} (${staffRole})` });
  return { invite, token };
}

export function cancelInvite(db: Store, user: UserAccount, inviteId: string): string | null {
  if (!can(user, 'team')) return 'team.errPermission';
  const school = currentSchool(db, user);
  const inv = db.staffInvites.find(i => i.id === inviteId && i.schoolId === school?.id && !i.acceptedAt);
  if (!inv) return 'team.errNotFound';
  db.staffInvites = db.staffInvites.filter(i => i.id !== inviteId);
  audit(db, { actorId: user.id, action: 'team.invite_cancel', target: inv.schoolId, detail: inv.email });
  return null;
}

/** Finds an open invitation by its link token (without using it up). */
export function findInvite(db: Store, token: string): StaffInvite | null {
  if (!token || token.length > 200) return null;
  const d = digest(token);
  const inv = db.staffInvites.find(i => i.tokenDigest === d);
  if (!inv || inv.acceptedAt || inv.expiresAt < nowIso()) return null;
  return db.schools.some(s => s.id === inv.schoolId) ? inv : null;
}

/**
 * Accepts an invitation. A new person gets a school_staff account (the link proves the email address, so it
 * counts as verified); `passwordHash` is prepared by the caller. A staff account that was removed from its
 * school earlier is linked again only when that person is signed in.
 */
export function acceptInvite(db: Store, token: string, opts: { name?: string; passwordHash?: string; signedIn?: UserAccount | null; ip?: string }): { user?: UserAccount; error?: string } {
  const inv = findInvite(db, token);
  if (!inv) return { error: 'team.errInviteInvalid' };
  const at = nowIso();
  let u = db.users.find(x => x.email === inv.email);
  if (u) {
    if (!(u.role === 'school_staff' && !u.schoolId)) return { error: 'team.errOtherAccount' };
    if (opts.signedIn?.id !== u.id) return { error: 'team.errSignInFirst' };
  } else {
    if (!opts.passwordHash) return { error: 'team.errPassword' };
    const name = String(opts.name || inv.name).replace(/\s+/g, ' ').trim().slice(0, 120) || inv.name;
    u = {
      id: newId('usr'), email: inv.email, name, role: 'school_staff', status: 'active', emailVerified: true, passwordHash: opts.passwordHash,
      schoolId: null, identities: [], consents: [{ purpose: 'terms', version: 'staff-invite', givenAt: at }, { purpose: 'privacy', version: 'staff-invite', givenAt: at }],
      locale: 'en', createdAt: at, lastLoginAt: null,
    };
    db.users.push(u);
    audit(db, { actorId: u.id, action: 'account.register', target: u.id, detail: 'school_staff (invitation)', ip: opts.ip });
  }
  u.schoolId = inv.schoolId;
  u.staffRole = inv.staffRole;
  u.emailVerified = true;
  inv.acceptedAt = at;
  audit(db, { actorId: u.id, action: 'team.join', target: inv.schoolId, detail: inv.staffRole });
  return { user: u };
}

export function changeStaffRole(db: Store, user: UserAccount, memberId: string, staffRole: unknown): string | null {
  if (!can(user, 'team')) return 'team.errPermission';
  const school = currentSchool(db, user);
  const m = db.users.find(u => u.id === memberId && u.role === 'school_staff' && u.schoolId === school?.id);
  if (!m) return 'team.errNotFound';
  if (!STAFF_ROLES.includes(staffRole as StaffRole)) return 'team.errRole';
  m.staffRole = staffRole as StaffRole;
  audit(db, { actorId: user.id, action: 'team.role', target: m.id, detail: String(staffRole) });
  return null;
}

/** Removes a staff member from the school: they lose access at once (sessions end) and leave every panel. */
export function removeStaff(db: Store, user: UserAccount, memberId: string): string | null {
  if (!can(user, 'team')) return 'team.errPermission';
  const school = currentSchool(db, user);
  const m = db.users.find(u => u.id === memberId && u.role === 'school_staff' && u.schoolId === school?.id);
  if (!m) return 'team.errNotFound';
  m.schoolId = null;
  m.staffRole = null;
  for (const j of db.jobs) if (j.schoolId === school!.id && j.panel) j.panel = j.panel.filter(p => p.userId !== m.id);
  for (const [k, s] of Object.entries(db.sessions)) if (s.userId === m.id) delete db.sessions[k];
  audit(db, { actorId: user.id, action: 'team.remove', target: m.id, detail: school!.id });
  return null;
}
