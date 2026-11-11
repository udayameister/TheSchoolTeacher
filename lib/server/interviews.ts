import type { Application, Interview, InterviewKind, InterviewMode, InterviewSlot, Job, UserAccount } from '@/types';
import { audit, newId, nowIso, type Store } from './db';
import { canManageSchool, managedSchools } from './schools';
import { canSeeApplication } from './pipeline';
import { can } from './team';
import { istToUtc } from '@/lib/ics';

/*
 * Interviews and demo classes (adapted from AcadeXMatch components/InterviewScheduleModal.tsx and
 * app/institute/interviews, moved to the server):
 *  1. The school creates time slots for a vacancy (in person, Google Meet, Teams or phone).
 *  2. It invites shortlisted applicants to an interview or a demo class (optionally with a topic and class).
 *     The application moves to "Demo / interview".
 *  3. The candidate books a free slot, can rebook or cancel up to CHANGE_CUTOFF_MIN before it, adds it to
 *     their calendar (.ics), and for a demo class can share a link to a short demo video.
 *  4. Reminder emails go out about 1 day and 1 hour before (the scheduler calls dueReminders()).
 *  5. Afterwards the school marks it completed or no-show.
 */

export const MODES: InterviewMode[] = ['in_person', 'google_meet', 'teams', 'phone'];
export const KINDS: InterviewKind[] = ['interview', 'demo'];
export const MAX_SLOTS_PER_BATCH = 40;
/** Candidates can book, change or cancel until this many minutes before the start. */
export const CHANGE_CUTOFF_MIN = 120;
const DAY = 86400_000;

const str = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const isHttps = (v: string) => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };
const ACTIVE = new Set(['invited', 'booked']);

/** Staff with the "interviews" permission for the vacancy's school. */
function staffJob(db: Store, user: UserAccount, jobId: string): Job | null {
  const job = db.jobs.find(j => j.id === jobId);
  return job && job.kind === 'school' && can(user, 'interviews') && canManageSchool(db, user, job.schoolId) ? job : null;
}

export interface SlotInput { jobId?: unknown; kind?: unknown; date?: unknown; times?: unknown; durationMin?: unknown; mode?: unknown; location?: unknown; capacity?: unknown }

/** Creates slots on one day at the given start times ("HH:MM", India time). */
export function createSlots(db: Store, user: UserAccount, input: SlotInput, now = Date.now()): { slots?: InterviewSlot[]; error?: string } {
  const job = staffJob(db, user, String(input.jobId || ''));
  if (!job) return { error: 'interviews.errNotFound' };
  const kind = input.kind as InterviewKind, mode = input.mode as InterviewMode;
  if (!KINDS.includes(kind)) return { error: 'interviews.errKind' };
  if (!MODES.includes(mode)) return { error: 'interviews.errMode' };
  const durationMin = Math.round(Number(input.durationMin));
  if (!(durationMin >= 10 && durationMin <= 240)) return { error: 'interviews.errDuration' };
  const capacity = Math.round(Number(input.capacity ?? 1));
  if (!(capacity >= 1 && capacity <= 50)) return { error: 'interviews.errCapacity' };
  const location = str(input.location, 300);
  if (mode === 'google_meet' || mode === 'teams') { if (!isHttps(location)) return { error: 'interviews.errLink' }; }
  else if (location.length < 3) return { error: 'interviews.errLocation' };
  const times = [...new Set((Array.isArray(input.times) ? input.times : []).map(String))].slice(0, MAX_SLOTS_PER_BATCH + 1);
  if (!times.length) return { error: 'interviews.errTimes' };
  if (times.length > MAX_SLOTS_PER_BATCH) return { error: 'interviews.errTooMany' };
  const starts: string[] = [];
  for (const t of times) {
    const iso = istToUtc(String(input.date || ''), t);
    if (!iso) return { error: 'interviews.errDate' };
    if (Date.parse(iso) < now + 60 * 60_000) return { error: 'interviews.errPast' };
    if (Date.parse(iso) > now + 180 * DAY) return { error: 'interviews.errFar' };
    starts.push(iso);
  }
  const at = nowIso();
  const slots = starts.sort().map<InterviewSlot>(start => ({ id: newId('slot'), schoolId: job.schoolId!, jobId: job.id, kind, start, durationMin, mode, location, capacity, createdBy: user.id, createdAt: at }));
  db.slots.push(...slots);
  audit(db, { actorId: user.id, action: 'interview.slots_create', target: job.id, detail: `${slots.length} × ${kind}` });
  return { slots };
}

/** Deletes a slot. People who had booked it go back to "invited" (they are emailed to pick another time). */
export function deleteSlot(db: Store, user: UserAccount, slotId: string): { affected?: Interview[]; error?: string } {
  const slot = db.slots.find(s => s.id === slotId);
  if (!slot || !staffJob(db, user, slot.jobId)) return { error: 'interviews.errNotFound' };
  const affected = db.interviews.filter(i => i.slotId === slot.id && i.status === 'booked');
  const at = nowIso();
  for (const i of affected) { i.slotId = null; i.status = 'invited'; i.reminders = []; i.updatedAt = at; }
  db.slots = db.slots.filter(s => s.id !== slotId);
  audit(db, { actorId: user.id, action: 'interview.slot_delete', target: slot.jobId, detail: `${slot.start} (${affected.length} booked)` });
  return { affected };
}

export interface InviteInput { ids?: unknown; kind?: unknown; demoTopic?: unknown; demoClass?: unknown; message?: unknown }

/** Invites applications to book an interview / demo class. Applicants who already have an open one of that kind are skipped. */
export function inviteToInterview(db: Store, user: UserAccount, input: InviteInput): { created: Interview[]; skipped: number; error?: string } {
  if (!can(user, 'interviews')) return { created: [], skipped: 0, error: 'team.errPermission' };
  const kind = input.kind as InterviewKind;
  if (!KINDS.includes(kind)) return { created: [], skipped: 0, error: 'interviews.errKind' };
  const ids = [...new Set((Array.isArray(input.ids) ? input.ids : []).map(String))].slice(0, 200);
  const apps = ids.map(id => db.applications.find(a => a.id === id));
  if (!apps.length || apps.some(a => !canSeeApplication(db, user, a))) return { created: [], skipped: 0, error: 'ats.errNotFound' };
  const demoTopic = kind === 'demo' ? str(input.demoTopic, 200) || null : null;
  const demoClass = kind === 'demo' ? str(input.demoClass, 60) || null : null;
  const message = str(input.message, 1000) || null;
  const at = nowIso();
  const created: Interview[] = [];
  let skipped = 0;
  for (const a of apps as Application[]) {
    if (a.stage === 'withdrawn' || a.stage === 'not_selected' || db.interviews.some(i => i.applicationId === a.id && i.kind === kind && ACTIVE.has(i.status))) { skipped++; continue; }
    const iv: Interview = {
      id: newId('ivw'), applicationId: a.id, schoolId: a.schoolId!, jobId: a.jobId, candidateId: a.candidateId, kind, status: 'invited', slotId: null,
      demoTopic, demoClass, demoVideoUrl: null, message, reminders: [], invitedBy: user.id, createdAt: at, updatedAt: at,
    };
    db.interviews.push(iv);
    created.push(iv);
    // Earlier stages move to "Demo / interview" (the invitation email replaces the stage email).
    if (['applied', 'screening', 'eligible', 'shortlisted'].includes(a.stage)) {
      a.stage = 'interview';
      a.history.push({ stage: 'interview', at, by: user.id, note: null });
      a.updatedAt = at;
    }
    audit(db, { actorId: user.id, action: 'interview.invite', target: a.id, detail: kind });
  }
  return { created, skipped };
}

const bookedCount = (db: Store, slotId: string) => db.interviews.filter(i => i.slotId === slotId && i.status === 'booked').length;

/** Free slots the candidate can choose for this interview. */
export function openSlotsFor(db: Store, iv: Interview, now = Date.now()): InterviewSlot[] {
  return db.slots
    .filter(s => s.jobId === iv.jobId && s.kind === iv.kind && Date.parse(s.start) > now + CHANGE_CUTOFF_MIN * 60_000 && (s.id === iv.slotId || bookedCount(db, s.id) < s.capacity))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function ownInterview(db: Store, me: UserAccount, id: string): Interview | null {
  const iv = db.interviews.find(i => i.id === id && i.candidateId === me.id);
  return iv && ACTIVE.has(iv.status) ? iv : null;
}

const locked = (db: Store, iv: Interview, now: number) => {
  const slot = iv.slotId ? db.slots.find(s => s.id === iv.slotId) : null;
  return !!slot && Date.parse(slot.start) <= now + CHANGE_CUTOFF_MIN * 60_000;
};

/** The candidate books (or changes to) a slot. */
export function bookSlot(db: Store, me: UserAccount, interviewId: string, slotId: string, now = Date.now()): { interview?: Interview; slot?: InterviewSlot; error?: string } {
  const iv = ownInterview(db, me, interviewId);
  if (!iv) return { error: 'interviews.errNotFound' };
  if (locked(db, iv, now)) return { error: 'interviews.errTooLate' };
  const slot = openSlotsFor(db, iv, now).find(s => s.id === slotId);
  if (!slot) return { error: 'interviews.errSlotTaken' };
  if (iv.slotId === slot.id) return { interview: iv, slot };
  iv.slotId = slot.id;
  iv.status = 'booked';
  iv.reminders = [];
  iv.updatedAt = nowIso();
  audit(db, { actorId: me.id, action: 'interview.book', target: iv.id, detail: slot.start });
  return { interview: iv, slot };
}

/** The candidate gives up the booked time (they can pick another one later). */
export function cancelBooking(db: Store, me: UserAccount, interviewId: string, now = Date.now()): string | null {
  const iv = ownInterview(db, me, interviewId);
  if (!iv || iv.status !== 'booked') return 'interviews.errNotFound';
  if (locked(db, iv, now)) return 'interviews.errTooLate';
  iv.slotId = null;
  iv.status = 'invited';
  iv.reminders = [];
  iv.updatedAt = nowIso();
  audit(db, { actorId: me.id, action: 'interview.cancel_booking', target: iv.id });
  return null;
}

/** A link to the candidate's demo-lesson video (https only; empty clears it). */
export function setDemoVideo(db: Store, me: UserAccount, interviewId: string, url: unknown): string | null {
  const iv = ownInterview(db, me, interviewId);
  if (!iv || iv.kind !== 'demo') return 'interviews.errNotFound';
  const u = str(url, 500);
  if (u && !isHttps(u)) return 'interviews.errVideo';
  iv.demoVideoUrl = u || null;
  iv.updatedAt = nowIso();
  return null;
}

/** The school records what happened (or cancels the invitation). */
export function setOutcome(db: Store, user: UserAccount, interviewId: string, status: unknown): { interview?: Interview; error?: string } {
  const iv = db.interviews.find(i => i.id === interviewId);
  if (!iv || !staffJob(db, user, iv.jobId)) return { error: 'interviews.errNotFound' };
  if (!['completed', 'no_show', 'cancelled'].includes(String(status))) return { error: 'interviews.errStatus' };
  iv.status = status as Interview['status'];
  iv.updatedAt = nowIso();
  audit(db, { actorId: user.id, action: `interview.${iv.status}`, target: iv.id });
  return { interview: iv };
}


export interface Reminder { interview: Interview; slot: InterviewSlot; which: '1d' | '1h' }

/** Booked interviews that need a reminder now; they are marked as reminded (call inside withDb, email afterwards). */
export function dueReminders(db: Store, now = Date.now()): Reminder[] {
  const out: Reminder[] = [];
  for (const iv of db.interviews) {
    if (iv.status !== 'booked' || !iv.slotId) continue;
    const slot = db.slots.find(s => s.id === iv.slotId);
    if (!slot) continue;
    const left = Date.parse(slot.start) - now;
    if (left <= 0) continue;
    if (left <= 60 * 60_000 && !iv.reminders.includes('1h')) { iv.reminders.push('1h'); if (!iv.reminders.includes('1d')) iv.reminders.push('1d'); out.push({ interview: iv, slot, which: '1h' }); }
    else if (left <= DAY && left > 60 * 60_000 && !iv.reminders.includes('1d')) { iv.reminders.push('1d'); out.push({ interview: iv, slot, which: '1d' }); }
  }
  return out;
}

// ------------------------------------------------------------------ views

export interface SlotView extends InterviewSlot { booked: { interviewId: string; candidateName: string; applicationId: string }[] }
export interface InterviewView extends Interview { candidateName: string; jobTitle: string; slot: InterviewSlot | null }

/** The school's slots and interviews (for the vacancies the user can schedule for). */
export function schoolSchedule(db: Store, user: UserAccount, jobId?: string | null): { slots: SlotView[]; interviews: InterviewView[] } {
  if (!can(user, 'interviews')) return { slots: [], interviews: [] };
  const mine = new Set(managedSchools(db, user).map(s => s.id));
  const name = (id: string) => db.users.find(u => u.id === id)?.name || '—';
  const slots = db.slots.filter(s => mine.has(s.schoolId) && (!jobId || s.jobId === jobId)).sort((a, b) => a.start.localeCompare(b.start)).map(s => ({
    ...s, booked: db.interviews.filter(i => i.slotId === s.id && i.status === 'booked').map(i => ({ interviewId: i.id, candidateName: name(i.candidateId), applicationId: i.applicationId })),
  }));
  const interviews = db.interviews.filter(i => mine.has(i.schoolId) && (!jobId || i.jobId === jobId)).map(i => ({
    ...i, candidateName: name(i.candidateId), jobTitle: db.jobs.find(j => j.id === i.jobId)?.title || '', slot: i.slotId ? db.slots.find(s => s.id === i.slotId) || null : null,
  })).sort((a, b) => (a.slot?.start || 'z').localeCompare(b.slot?.start || 'z') || b.createdAt.localeCompare(a.createdAt));
  return { slots, interviews };
}

export interface CandidateInterview extends Interview { jobTitle: string; orgName: string; slot: InterviewSlot | null; openSlots: InterviewSlot[]; canChange: boolean }

export function candidateInterviews(db: Store, me: UserAccount, now = Date.now()): CandidateInterview[] {
  return db.interviews.filter(i => i.candidateId === me.id).map(i => {
    const job = db.jobs.find(j => j.id === i.jobId);
    return {
      ...i, jobTitle: job?.title || '', orgName: job?.orgName || '', slot: i.slotId ? db.slots.find(s => s.id === i.slotId) || null : null,
      openSlots: ACTIVE.has(i.status) ? openSlotsFor(db, i, now) : [], canChange: ACTIVE.has(i.status) && !locked(db, i, now),
    };
  }).sort((a, b) => (a.slot?.start || 'z').localeCompare(b.slot?.start || 'z') || b.createdAt.localeCompare(a.createdAt));
}

/** May this user download the interview's calendar file? (the candidate, or staff who can see the application) */
export function canSeeInterview(db: Store, user: UserAccount, iv: Interview | undefined): iv is Interview {
  if (!iv) return false;
  if (iv.candidateId === user.id) return true;
  return canSeeApplication(db, user, db.applications.find(a => a.id === iv.applicationId));
}
