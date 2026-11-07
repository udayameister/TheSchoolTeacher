import type { Application, Job, School, Stage, UserAccount } from '@/types';
import { makeT } from '@/lib/i18n/translate';
import { appUrl, emailLayout, sendMail } from './mailer';

/* Emails about schools and applications, in the recipient's language. */

const tFor = (u: { locale?: string | null } | null | undefined) => makeT(u?.locale === 'hi' ? 'hi' : 'en');

export function sendSchoolEmailConfirmation(to: string, school: School, token: string, requester: UserAccount) {
  const t = tFor(requester);
  const { html, text } = emailLayout({
    heading: t('emails.schoolEmailHeading'),
    paragraphs: [t('emails.schoolEmailBody', { name: requester.name, school: school.name, udise: school.udiseCode })],
    button: { label: t('emails.schoolEmailButton'), url: `${appUrl()}/api/school/verify-email?token=${encodeURIComponent(token)}` },
    footer: t('emails.schoolEmailFooter'),
  });
  return sendMail({ to, subject: t('emails.schoolEmailSubject', { school: school.name }), text, html, kind: 'school-email', sensitive: true });
}

export function sendVerificationDecision(user: UserAccount, school: School) {
  const t = tFor(user);
  const ok = school.verification === 'verified';
  const { html, text } = emailLayout({
    heading: t(ok ? 'emails.verifiedHeading' : 'emails.rejectedHeading', { school: school.name }),
    paragraphs: [t('emails.hello', { name: user.name }), t(ok ? 'emails.verifiedBody' : 'emails.rejectedBody'), ...(!ok && school.verificationNote ? [t('emails.reason', { reason: school.verificationNote })] : [])],
    button: { label: t(ok ? 'emails.verifiedButton' : 'emails.rejectedButton'), url: `${appUrl()}${ok ? '/school/jobs/new' : '/school/register'}` },
  });
  return sendMail({ to: user.email, subject: t(ok ? 'emails.verifiedSubject' : 'emails.rejectedSubject', { school: school.name }), text, html, kind: `school-${school.verification}` });
}

/** Stages the candidate is told about by email. Internal steps (screening, eligible, panel review) are only shown in the app. */
export const NOTIFY_STAGES: Stage[] = ['shortlisted', 'interview', 'not_selected'];

export function sendStageEmail(candidate: UserAccount, app: Application, job: Job) {
  const t = tFor(candidate);
  const { html, text } = emailLayout({
    heading: t(`emails.stage_${app.stage}_heading`, { job: job.title }),
    paragraphs: [t('emails.hello', { name: candidate.name }), t(`emails.stage_${app.stage}_body`, { job: job.title, school: job.orgName })],
    button: { label: t('emails.stageButton'), url: `${appUrl()}/candidate/applications` },
  });
  return sendMail({ to: candidate.email, subject: t(`emails.stage_${app.stage}_subject`, { job: job.title, school: job.orgName }), text, html, kind: `stage-${app.stage}` });
}
