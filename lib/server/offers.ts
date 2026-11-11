import type { Offer, UserAccount } from '@/types';
import { audit, newId, nowIso, type Store } from './db';
import { canManageSchool, currentSchool } from './schools';
import { canSeeApplication } from './pipeline';
import { lookupOf } from './catalog';
import { nameOf } from '@/lib/jobs/display';
import { isIsoDate, todayIst } from '@/lib/jobs/dates';
import { MAX_TEMPLATE, longDate, renderOffer, unknownFields } from '@/lib/offerLetter';
import { can } from './team';

/*
 * Offer letters: the school keeps a template with merge fields and a signatory; staff with the "offers"
 * permission issue an offer from an applicant's dossier. The letter is filled in and frozen at issue time.
 * The candidate reads it in the app and accepts or declines (with an optional note) until the accept-by date.
 * Issuing moves the application to "Offer"; the school marks "Joined" when the teacher joins.
 */

const str = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max);

export function saveOfferSettings(db: Store, user: UserAccount, input: { template?: unknown; signatoryName?: unknown; signatoryDesignation?: unknown }): { error?: string; unknown?: string[] } {
  if (!can(user, 'offers')) return { error: 'team.errPermission' };
  const school = currentSchool(db, user);
  if (!school) return { error: 'team.errNoSchool' };
  const template = String(input.template ?? '').replace(/\r\n/g, '\n').trim();
  if (template.length > MAX_TEMPLATE) return { error: 'offers.errTemplateLong' };
  const name = str(input.signatoryName, 120), designation = str(input.signatoryDesignation, 120);
  if (!name || !designation) return { error: 'offers.errSignatory' };
  school.offerTemplate = template || null;
  school.offerSignatory = { name, designation };
  school.updatedAt = nowIso();
  audit(db, { actorId: user.id, action: 'offers.settings', target: school.id });
  return { unknown: unknownFields(template) };
}

export interface OfferInput { applicationId?: unknown; designation?: unknown; pay?: unknown; joiningDate?: unknown; acceptBy?: unknown; reportTo?: unknown }

/** Fills the school's template for an applicant (used for the preview and when issuing). */
export function draftOffer(db: Store, user: UserAccount, input: OfferInput, locale: 'en' | 'hi' = 'en'): { letter?: string; error?: string; fields?: Omit<Offer, 'id' | 'letter' | 'status' | 'issuedBy' | 'issuedAt' | 'signatory'> & { signatory: Offer['signatory'] | null } } {
  if (!can(user, 'offers')) return { error: 'team.errPermission' };
  const app = db.applications.find(a => a.id === String(input.applicationId || ''));
  if (!canSeeApplication(db, user, app)) return { error: 'ats.errNotFound' };
  const job = db.jobs.find(j => j.id === app.jobId);
  const school = db.schools.find(s => s.id === app.schoolId);
  const cand = db.users.find(u => u.id === app.candidateId);
  if (!job || !school || !cand) return { error: 'ats.errNotFound' };
  const designation = str(input.designation, 150) || job.title;
  const pay = str(input.pay, 300);
  const joiningDate = str(input.joiningDate, 10), acceptBy = str(input.acceptBy, 10);
  if (!pay) return { error: 'offers.errPay' };
  if (!isIsoDate(joiningDate) || !isIsoDate(acceptBy)) return { error: 'offers.errDates' };
  const today = todayIst();
  if (acceptBy < today) return { error: 'offers.errAcceptPast' };
  if (joiningDate < acceptBy) return { error: 'offers.errJoinBeforeAccept' };
  const reportTo = str(input.reportTo, 150) || null;
  const lookup = lookupOf(db);
  const letter = renderOffer(school.offerTemplate, {
    candidateName: cand.name, designation, jobTitle: job.title, school: school.name, udise: school.udiseCode,
    board: school.boardIds.map(b => nameOf(lookup, b, locale)).filter(Boolean).join(', '), city: school.city, pay,
    joiningDate: longDate(joiningDate, locale), acceptBy: longDate(acceptBy, locale), reportTo: reportTo || (locale === 'hi' ? 'प्रधानाचार्य' : 'the Principal'), date: longDate(today, locale),
  });
  return { letter, fields: { applicationId: app.id, schoolId: school.id, jobId: job.id, candidateId: cand.id, designation, pay, joiningDate, acceptBy, reportTo, signatory: school.offerSignatory || null } };
}

/** Issues the offer. Only one open (issued or accepted) offer per application. */
export function issueOffer(db: Store, user: UserAccount, input: OfferInput): { offer?: Offer; error?: string } {
  const d = draftOffer(db, user, input);
  if (!d.fields || !d.letter) return { error: d.error };
  if (!d.fields.signatory) return { error: 'offers.errNoSignatory' };
  const app = db.applications.find(a => a.id === d.fields!.applicationId)!;
  if (app.stage === 'withdrawn' || app.stage === 'not_selected') return { error: 'offers.errStage' };
  if (db.offers.some(o => o.applicationId === app.id && (o.status === 'issued' || o.status === 'accepted'))) return { error: 'offers.errExists' };
  const at = nowIso();
  const offer: Offer = { id: newId('ofr'), ...d.fields, signatory: d.fields.signatory, letter: d.letter, status: 'issued', issuedBy: user.id, issuedAt: at, respondedAt: null, responseNote: null };
  db.offers.push(offer);
  if (app.stage !== 'offer' && app.stage !== 'joined') {
    app.stage = 'offer';
    app.history.push({ stage: 'offer', at, by: user.id, note: null });
    app.updatedAt = at;
  }
  audit(db, { actorId: user.id, action: 'offer.issue', target: app.id, detail: offer.id });
  return { offer };
}

/** The school withdraws an offer the candidate has not answered yet. */
export function withdrawOffer(db: Store, user: UserAccount, offerId: string): { offer?: Offer; error?: string } {
  const o = db.offers.find(x => x.id === offerId);
  if (!o || !can(user, 'offers') || !canManageSchool(db, user, o.schoolId)) return { error: 'offers.errNotFound' };
  if (o.status !== 'issued') return { error: 'offers.errAnswered' };
  o.status = 'withdrawn';
  o.respondedAt = nowIso();
  audit(db, { actorId: user.id, action: 'offer.withdraw', target: o.applicationId, detail: o.id });
  return { offer: o };
}

export const isExpired = (o: Offer, today = todayIst()) => o.status === 'issued' && o.acceptBy < today;

/** The candidate accepts or declines. */
export function respondOffer(db: Store, me: UserAccount, offerId: string, accept: boolean, note: unknown): { offer?: Offer; error?: string } {
  const o = db.offers.find(x => x.id === offerId && x.candidateId === me.id);
  if (!o) return { error: 'offers.errNotFound' };
  if (o.status !== 'issued') return { error: 'offers.errAnswered' };
  if (isExpired(o)) return { error: 'offers.errExpired' };
  o.status = accept ? 'accepted' : 'declined';
  o.respondedAt = nowIso();
  o.responseNote = str(note, 1000) || null;
  audit(db, { actorId: me.id, action: accept ? 'offer.accept' : 'offer.decline', target: o.applicationId, detail: o.id });
  return { offer: o };
}


/** School staff to tell about a candidate's answer: the person who issued it and the school administrators. */
export function offerRecipients(db: Store, o: Offer): UserAccount[] {
  const school = db.schools.find(s => s.id === o.schoolId);
  return db.users.filter(u => u.status === 'active' && (u.id === o.issuedBy || (u.role === 'school_admin' && (u.schoolId === o.schoolId || (!!school?.groupId && u.groupId === school.groupId)))));
}
