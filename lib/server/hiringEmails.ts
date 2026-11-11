import type { Interview, InterviewSlot, Job, Offer, StaffInvite, TalentInvite, UserAccount } from '@/types';
import { makeT } from '@/lib/i18n/translate';
import { istDateTime } from '@/lib/ics';
import { longDate } from '@/lib/offerLetter';
import { appUrl, emailLayout, sendMail, unsubscribeUrl } from './mailer';
import { withDb } from './db';
import { dueReminders } from './interviews';

/*
 * Emails for the hiring tools (Phase 4), in the recipient's language. Never throws (sendMail records
 * failures in the outbox). Interview times are shown in India Standard Time.
 */

type Who = { locale?: string | null } | null | undefined;
const loc = (u: Who): 'en' | 'hi' => (u?.locale === 'hi' ? 'hi' : 'en');
const tFor = (u: Who) => makeT(loc(u));

export function sendStaffInvite(inv: StaffInvite, token: string, inviter: UserAccount, schoolName: string) {
  const t = makeT('en');
  const { html, text } = emailLayout({
    heading: t('emails.staffInviteHeading', { school: schoolName }),
    paragraphs: [t('emails.hello', { name: inv.name }), t('emails.staffInviteBody', { inviter: inviter.name, school: schoolName, role: t(`team.role_${inv.staffRole}`) }), t('emails.staffInviteExpiry')],
    button: { label: t('emails.staffInviteButton'), url: `${appUrl()}/join?token=${encodeURIComponent(token)}` },
  });
  return sendMail({ to: inv.email, subject: t('emails.staffInviteSubject', { school: schoolName }), text, html, kind: 'staff-invite', sensitive: true });
}

const placeLine = (t: ReturnType<typeof makeT>, slot: InterviewSlot) => `${t(`interviews.mode_${slot.mode}`)}: ${slot.location}`;

export function sendInterviewInvite(candidate: UserAccount, iv: Interview, job: Job) {
  const t = tFor(candidate);
  const kind = t(`interviews.kind_${iv.kind}`);
  const paragraphs = [t('emails.hello', { name: candidate.name }), t('emails.interviewInviteBody', { kind, job: job.title, school: job.orgName })];
  if (iv.kind === 'demo' && (iv.demoTopic || iv.demoClass)) paragraphs.push(t('emails.demoDetails', { topic: iv.demoTopic || '—', cls: iv.demoClass || '—' }));
  if (iv.message) paragraphs.push(iv.message);
  const { html, text } = emailLayout({ heading: t('emails.interviewInviteHeading', { kind }), paragraphs, button: { label: t('emails.interviewInviteButton'), url: `${appUrl()}/candidate/interviews` } });
  return sendMail({ to: candidate.email, subject: t('emails.interviewInviteSubject', { kind, school: job.orgName }), text, html, kind: 'interview-invite' });
}

export function sendBookingConfirmation(candidate: UserAccount, iv: Interview, slot: InterviewSlot, job: Job) {
  const t = tFor(candidate);
  const kind = t(`interviews.kind_${iv.kind}`), when = istDateTime(slot.start, loc(candidate));
  const { html, text } = emailLayout({
    heading: t('emails.bookedHeading', { kind }),
    paragraphs: [t('emails.hello', { name: candidate.name }), t('emails.bookedBody', { kind, job: job.title, school: job.orgName, when }), placeLine(t, slot), t('emails.bookedCalendar', { url: `${appUrl()}/api/interviews/${iv.id}/ics` })],
    button: { label: t('emails.interviewInviteButton'), url: `${appUrl()}/candidate/interviews` },
  });
  return sendMail({ to: candidate.email, subject: t('emails.bookedSubject', { kind, when }), text, html, kind: 'interview-booked' });
}

export function sendSlotCancelled(candidate: UserAccount, iv: Interview, job: Job) {
  const t = tFor(candidate);
  const kind = t(`interviews.kind_${iv.kind}`);
  const { html, text } = emailLayout({
    heading: t('emails.slotCancelledHeading'),
    paragraphs: [t('emails.hello', { name: candidate.name }), t('emails.slotCancelledBody', { kind, job: job.title, school: job.orgName })],
    button: { label: t('emails.interviewInviteButton'), url: `${appUrl()}/candidate/interviews` },
  });
  return sendMail({ to: candidate.email, subject: t('emails.slotCancelledSubject', { school: job.orgName }), text, html, kind: 'interview-slot-cancelled' });
}

export function sendInterviewReminder(candidate: UserAccount, iv: Interview, slot: InterviewSlot, job: Job, which: '1d' | '1h') {
  const t = tFor(candidate);
  const kind = t(`interviews.kind_${iv.kind}`), when = istDateTime(slot.start, loc(candidate));
  const paragraphs = [t('emails.hello', { name: candidate.name }), t(which === '1h' ? 'emails.reminder1h' : 'emails.reminder1d', { kind, job: job.title, school: job.orgName, when }), placeLine(t, slot)];
  if (iv.kind === 'demo' && (iv.demoTopic || iv.demoClass)) paragraphs.push(t('emails.demoDetails', { topic: iv.demoTopic || '—', cls: iv.demoClass || '—' }));
  const { html, text } = emailLayout({ heading: t('emails.reminderHeading', { kind }), paragraphs, button: { label: t('emails.interviewInviteButton'), url: `${appUrl()}/candidate/interviews` } });
  return sendMail({ to: candidate.email, subject: t('emails.reminderSubject', { kind, when }), text, html, kind: `interview-reminder-${which}` });
}

export function sendOfferIssued(candidate: UserAccount, offer: Offer, job: Job) {
  const t = tFor(candidate);
  const { html, text } = emailLayout({
    heading: t('emails.offerHeading', { school: job.orgName }),
    paragraphs: [t('emails.hello', { name: candidate.name }), t('emails.offerBody', { job: job.title, school: job.orgName, date: longDate(offer.acceptBy, loc(candidate)) })],
    button: { label: t('emails.offerButton'), url: `${appUrl()}/candidate/offers/${offer.id}` },
  });
  return sendMail({ to: candidate.email, subject: t('emails.offerSubject', { school: job.orgName }), text, html, kind: 'offer-issued' });
}

export function sendOfferWithdrawn(candidate: UserAccount, job: Job) {
  const t = tFor(candidate);
  const { html, text } = emailLayout({
    heading: t('emails.offerWithdrawnHeading'),
    paragraphs: [t('emails.hello', { name: candidate.name }), t('emails.offerWithdrawnBody', { job: job.title, school: job.orgName })],
  });
  return sendMail({ to: candidate.email, subject: t('emails.offerWithdrawnSubject', { school: job.orgName }), text, html, kind: 'offer-withdrawn' });
}

export function sendOfferResponse(staff: UserAccount, offer: Offer, candidateName: string, job: Job) {
  const t = tFor(staff);
  const key = offer.status === 'accepted' ? 'Accepted' : 'Declined';
  const paragraphs = [t('emails.hello', { name: staff.name }), t(`emails.offer${key}Body`, { name: candidateName, job: job.title })];
  if (offer.responseNote) paragraphs.push(t('emails.offerNote', { note: offer.responseNote }));
  const { html, text } = emailLayout({ heading: t(`emails.offer${key}Heading`, { name: candidateName }), paragraphs, button: { label: t('emails.offerOpenApplicant'), url: `${appUrl()}/school/applicants/${offer.applicationId}` } });
  return sendMail({ to: staff.email, subject: t(`emails.offer${key}Subject`, { name: candidateName, job: job.title }), text, html, kind: `offer-${offer.status}` });
}

export function sendTalentInvite(candidate: UserAccount, inv: TalentInvite, job: Job) {
  const t = tFor(candidate);
  const paragraphs = [t('emails.hello', { name: candidate.name }), t('emails.talentBody', { school: job.orgName, job: job.title, date: longDate(job.lastDate, loc(candidate)) })];
  if (inv.message) paragraphs.push(inv.message);
  paragraphs.push(t('emails.talentWhy'));
  const unsubscribe = unsubscribeUrl(candidate.email, 'invites');
  const { html, text } = emailLayout({ heading: t('emails.talentHeading', { school: job.orgName }), paragraphs, button: { label: t('emails.talentButton'), url: `${appUrl()}/jobs/${job.id}` }, unsubscribe });
  return sendMail({ to: candidate.email, subject: t('emails.talentSubject', { school: job.orgName, job: job.title }), text, html, kind: 'talent-invite', list: 'invites' });
}

/** Sends due interview reminders (1 day and 1 hour before). Called by the scheduler every 10 minutes. */
export async function runInterviewReminders(now = Date.now()): Promise<number> {
  const due = await withDb(db => dueReminders(db, now).map(r => ({ ...r, candidate: db.users.find(u => u.id === r.interview.candidateId), job: db.jobs.find(j => j.id === r.interview.jobId) })));
  let sent = 0;
  for (const r of due) if (r.candidate && r.job) { await sendInterviewReminder(r.candidate, r.interview, r.slot, r.job, r.which); sent++; }
  return sent;
}
