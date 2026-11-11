/*
 * Offer-letter template with {merge fields}. Adapted from AcadeXMatch lib/offerLetter.ts (school wording,
 * UDISE+ / board instead of department / advertisement number, and the signatory below the letter).
 */

export const OFFER_FIELDS = ['candidateName', 'designation', 'jobTitle', 'school', 'udise', 'board', 'city', 'pay', 'joiningDate', 'acceptBy', 'reportTo', 'date'] as const;
export type OfferField = (typeof OFFER_FIELDS)[number];

export const DEFAULT_OFFER_TEMPLATE = `Dear {candidateName},

With reference to your application for the post of {jobTitle}, and the recommendation of our selection panel, we are pleased to offer you appointment as {designation} at {school}, {city}.

Pay: {pay}.

Please join on or before {joiningDate} and report to {reportTo}. Kindly confirm your acceptance by {acceptBy}.

At the time of joining, please bring the originals of your educational and teacher-education qualifications, Teacher Eligibility Test certificate(s), experience certificates, identity proof and police verification certificate, along with a relieving letter from your current employer, if applicable.

This offer is subject to verification of your documents and to the service rules of the school in force from time to time.

We look forward to welcoming you to {school}.`;

export const MAX_TEMPLATE = 8000;

/** "16 November 2026" from YYYY-MM-DD. */
export function longDate(iso?: string | null, locale: 'en' | 'hi' = 'en'): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Fills the template. Unknown fields are left as they are, so a typo is visible in the preview. */
export function renderOffer(template: string | null | undefined, values: Partial<Record<OfferField, string>>): string {
  const tpl = (template || '').trim() || DEFAULT_OFFER_TEMPLATE;
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => ((OFFER_FIELDS as readonly string[]).includes(k) ? values[k as OfferField] ?? '' : m));
}

/** Merge fields in a template that are not known (shown as a warning before saving). */
export const unknownFields = (template: string) => [...new Set([...template.matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(k => !(OFFER_FIELDS as readonly string[]).includes(k)))];
