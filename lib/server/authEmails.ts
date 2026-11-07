import { appUrl, emailLayout, sendMail } from './mailer';
import type { OtpPurpose } from '@/types';
import { SITE_NAME } from '@/lib/site';

/* Account security emails. These are always sent (no unsubscribe), and their links/codes are never stored. */

export function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${appUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const { html, text } = emailLayout({
    heading: 'Confirm your email address',
    paragraphs: [`Hello ${name},`, `Welcome to ${SITE_NAME}. Please confirm that this is your email address. The link works for 72 hours.`],
    button: { label: 'Confirm my email', url },
    footer: 'If you did not create this account, you can ignore this email.',
  });
  return sendMail({ to, subject: `Confirm your email for ${SITE_NAME}`, text, html, kind: 'verify-email', sensitive: true });
}

export function sendResetEmail(to: string, name: string, token: string) {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const { html, text } = emailLayout({
    heading: 'Reset your password',
    paragraphs: [`Hello ${name},`, 'Someone (hopefully you) asked to reset the password of your account. The link works for 30 minutes and can be used once.'],
    button: { label: 'Choose a new password', url },
    footer: 'If you did not ask for this, ignore this email: your password stays the same.',
  });
  return sendMail({ to, subject: `Reset your ${SITE_NAME} password`, text, html, kind: 'reset-password', sensitive: true });
}

export function sendOtpEmail(to: string, name: string, code: string, minutes: number, purpose: OtpPurpose) {
  const { html, text } = emailLayout({
    heading: purpose === 'admin-mfa' ? 'Your administrator sign-in code' : 'Your sign-in code',
    paragraphs: [name ? `Hello ${name},` : 'Hello,', `Your ${SITE_NAME} code is ${code}. It is valid for ${minutes} minutes and can be used once.`, 'Never share this code. Our team will never ask you for it.'],
    footer: 'If you did not try to sign in, you can ignore this email.',
  });
  return sendMail({ to, subject: `${code} is your ${SITE_NAME} code`, text, html, kind: `otp-${purpose}`, sensitive: true });
}

export function sendPasswordChangedEmail(to: string, name: string) {
  const { html, text } = emailLayout({
    heading: 'Your password was changed',
    paragraphs: [`Hello ${name},`, 'The password of your account was just changed and other devices were signed out.', 'If this was not you, reset your password now and contact us.'],
    button: { label: 'Reset password', url: `${appUrl()}/forgot-password` },
  });
  return sendMail({ to, subject: `Your ${SITE_NAME} password was changed`, text, html, kind: 'password-changed' });
}
