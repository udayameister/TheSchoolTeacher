import nodemailer, { type Transporter } from 'nodemailer';
import type { OutboxItem } from '@/types';
import { newId, nowIso, withDb } from './db';
import { sign, safeEqual } from './security';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

/*
 * Outgoing email with an outbox. Adapted from AcadeXMatch lib/server/mailer.ts (SMTP with the
 * other-port fallback, Brevo / Resend HTTPS APIs selected by EMAIL_API, EMAIL_REDIRECT_TO test
 * mode, private content not stored). New here: retries with back-off for temporary failures and
 * a signed unsubscribe link + List-Unsubscribe header on every bulk email.
 *
 * Without any email settings, messages are only recorded in the outbox (status "logged"), so the
 * whole site can still be tested.
 */

const MAX_OUTBOX = 1000;
const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 5, 30, 120, 720]; // minutes before attempt 2, 3, 4, 5

export function smtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function emailApi(): 'brevo' | 'resend' | null {
  const p = (process.env.EMAIL_API || '').toLowerCase();
  return (p === 'brevo' || p === 'resend') && process.env.EMAIL_API_KEY ? p : null;
}

export function emailConfigured(): boolean {
  return !!emailApi() || smtpConfigured();
}

export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

const transporters = new Map<number, Transporter>();
function transport(port: number): Transporter {
  let t = transporters.get(port);
  if (!t) {
    const configured = Number(process.env.SMTP_PORT || 587);
    const secure = port === configured && process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
    t = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    });
    transporters.set(port, t);
  }
  return t;
}

function parseFrom(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: from.trim() };
}

type Outgoing = { to: string; subject: string; text: string; html?: string; headers?: Record<string, string> };
class PermanentError extends Error {}

async function sendViaApi(provider: 'brevo' | 'resend', msg: Outgoing): Promise<string | undefined> {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = provider === 'brevo'
      ? await fetch(`${(process.env.EMAIL_API_URL || 'https://api.brevo.com').replace(/\/$/, '')}/v3/smtp/email`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'api-key': process.env.EMAIL_API_KEY!, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: parseFrom(from), to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text, ...(msg.html ? { htmlContent: msg.html } : {}), ...(msg.headers ? { headers: msg.headers } : {}) }),
      })
      : await fetch(`${(process.env.EMAIL_API_URL || 'https://api.resend.com').replace(/\/$/, '')}/emails`, {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, ...(msg.html ? { html: msg.html } : {}), ...(msg.headers ? { headers: msg.headers } : {}) }),
      });
    const d = await r.json().catch(() => ({})) as { message?: string; error?: string; messageId?: string; id?: string };
    if (!r.ok) {
      const err = `${provider} ${r.status}: ${d.message || d.error || r.statusText}`;
      throw r.status >= 400 && r.status < 500 && r.status !== 429 ? new PermanentError(err) : new Error(err);
    }
    return d.messageId || d.id;
  } finally {
    clearTimeout(timer);
  }
}

function portBlocked(e: unknown): boolean {
  const code = (e as { code?: string }).code || '';
  return ['EACCES', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)
    || /EACCES|ECONNREFUSED|ETIMEDOUT|Greeting never received|Connection timeout/i.test((e as Error).message || '');
}

/** Hands one message to the provider. Throws on failure (PermanentError when retrying cannot help). */
async function deliver(msg: Outgoing): Promise<string | undefined> {
  const redirect = (process.env.EMAIL_REDIRECT_TO || '').trim();
  const out = redirect ? { ...msg, to: redirect, subject: `[to ${msg.to}] ${msg.subject}` } : msg;
  const api = emailApi();
  if (api) return sendViaApi(api, out);
  const mail = { from: process.env.MAIL_FROM || process.env.SMTP_USER, ...out };
  const port = Number(process.env.SMTP_PORT || 587);
  try {
    await transport(port).sendMail(mail);
  } catch (e) {
    if (!portBlocked(e)) throw e;
    const other = port === 465 ? 587 : 465;
    try { await transport(other).sendMail(mail); } catch (e2) {
      throw new Error(`${(e as Error).message} (port ${port}); ${(e2 as Error).message} (port ${other}). The host seems to block email ports: use EMAIL_API instead (see env-settings-example.txt).`);
    }
  }
  return undefined;
}

// ------------------------------------------------------------------ unsubscribe links

export type MailList = 'alerts' | 'digest' | 'news' | 'outreach' | 'invites';

export function unsubscribeToken(email: string, list: MailList): string {
  const data = Buffer.from(`${email.toLowerCase()}|${list}`).toString('base64url');
  return `${data}.${sign(data, 'unsub')}`;
}

export function readUnsubscribeToken(token: string): { email: string; list: MailList } | null {
  const [data, sig] = String(token || '').split('.');
  if (!data || !sig || !safeEqual(sign(data, 'unsub'), sig)) return null;
  const [email, list] = Buffer.from(data, 'base64url').toString().split('|');
  return email && ['alerts', 'digest', 'news', 'outreach', 'invites'].includes(list) ? { email, list: list as MailList } : null;
}

export function unsubscribeUrl(email: string, list: MailList): string {
  return `${appUrl()}/api/unsubscribe?t=${encodeURIComponent(unsubscribeToken(email, list))}`;
}

// ------------------------------------------------------------------ layout

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Simple branded email (table layout so it renders in Gmail, Outlook and phone mail apps). */
export function emailLayout(opts: { heading: string; paragraphs: string[]; button?: { label: string; url: string }; footer?: string; unsubscribe?: string }): { html: string; text: string } {
  const text = [opts.heading, '', ...opts.paragraphs, ...(opts.button ? ['', `${opts.button.label}: ${opts.button.url}`] : []), '',
    opts.footer || `— ${SITE_NAME}`, `Questions? ${CONTACT_EMAIL}`, ...(opts.unsubscribe ? [`Unsubscribe: ${opts.unsubscribe}`] : [])].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#FFFCF5;font-family:Arial,Helvetica,sans-serif;color:#1F2A2E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #E7E1D4;border-radius:14px">
<tr><td style="padding:18px 26px;border-bottom:3px solid #F0A22B"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:10px"><img src="${esc(appUrl())}/brand/logo-email.png" width="40" height="40" alt="" style="display:block;border:0"></td><td style="font-size:20px;font-weight:bold;color:#16443F">TheSchool<span style="color:#B4670E">Teacher</span></td></tr></table></td></tr>
<tr><td style="padding:24px 26px">
<h1 style="margin:0 0 14px;font-size:20px;color:#12332F">${esc(opts.heading)}</h1>
${opts.paragraphs.map(p => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${esc(p)}</p>`).join('')}
${opts.button ? `<p style="margin:22px 0"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#1A5550;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">${esc(opts.button.label)}</a></p><p style="font-size:12px;color:#5F6B70;word-break:break-all">Or open: ${esc(opts.button.url)}</p>` : ''}
</td></tr>
<tr><td style="padding:14px 26px;border-top:1px solid #E7E1D4;font-size:12px;color:#5F6B70">${esc(opts.footer || `You received this email from ${SITE_NAME}, teacher recruitment for Indian schools.`)} Questions? <a href="mailto:${CONTACT_EMAIL}" style="color:#1A5550">${CONTACT_EMAIL}</a>${opts.unsubscribe ? ` · <a href="${esc(opts.unsubscribe)}" style="color:#1A5550">Unsubscribe</a>` : ''}</td></tr>
</table></td></tr></table></body></html>`;
  return { html, text };
}

// ------------------------------------------------------------------ sending + outbox

export interface MailInput { to: string; subject: string; text: string; html?: string; kind: string; sensitive?: boolean; list?: MailList }

function headersFor(item: { to: string; list?: string | null }): Record<string, string> | undefined {
  if (!item.list) return undefined;
  const url = unsubscribeUrl(item.to, item.list as MailList);
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}

function record(item: OutboxItem): Promise<void> {
  return withDb(db => {
    const i = db.outbox.findIndex(o => o.id === item.id);
    if (i >= 0) db.outbox[i] = item; else db.outbox.unshift(item);
    if (db.outbox.length > MAX_OUTBOX) db.outbox.length = MAX_OUTBOX;
  });
}

async function attempt(item: OutboxItem, body: Outgoing): Promise<OutboxItem> {
  item.attempts++;
  try {
    item.providerId = await deliver(body);
    item.status = 'sent';
    item.lastError = null;
    item.nextAttemptAt = null;
  } catch (e) {
    item.lastError = (e as Error).message.slice(0, 600);
    const permanent = e instanceof PermanentError;
    // Private messages (codes, links) are not kept, so they cannot be retried later: the person asks again.
    if (permanent || item.sensitive || item.attempts >= MAX_ATTEMPTS) { item.status = 'failed'; item.nextAttemptAt = null; }
    else { item.status = 'queued'; item.nextAttemptAt = Date.now() + BACKOFF_MIN[item.attempts - 1] * 60_000; }
    console.error('[TheSchoolTeacher] Email failed:', item.kind, item.lastError);
  }
  return item;
}

/**
 * Sends a message (when email is set up) and records it in the outbox. Never throws.
 * Bulk messages (with `list`) are not sent to people who unsubscribed from that list.
 */
export async function sendMail(msg: MailInput): Promise<OutboxItem> {
  const to = msg.to.trim().toLowerCase();
  if (msg.list) {
    const blocked = await withDb(db => db.users.some(u => u.email === to && u.unsubscribed?.includes(msg.list!)) || db.suppressed.includes(`${msg.list}:${to}`));
    if (blocked) return { id: '', to, subject: msg.subject, text: '', kind: msg.kind, createdAt: nowIso(), status: 'logged', attempts: 0, lastError: 'unsubscribed' };
  }
  let item: OutboxItem = {
    id: newId('mail'), to, subject: msg.subject, text: msg.text, html: msg.html, kind: msg.kind,
    createdAt: nowIso(), status: 'logged', attempts: 0, sensitive: !!msg.sensitive, list: msg.list || null,
  };
  if (emailConfigured()) item = await attempt(item, { to, subject: msg.subject, text: msg.text, html: msg.html, headers: headersFor(item) });
  // Codes may appear in the subject too ("123456 is your code"), so digits are masked there as well.
  const stored = item.sensitive ? { ...item, subject: item.subject.replace(/\d{4,}/g, '••••••'), text: '(Not stored: this email held a private link or code.)', html: undefined } : item;
  await record(stored);
  return item;
}

/** Retries queued messages that are due. Called after each send and from the admin outbox. */
export async function retryDueMail(limit = 20): Promise<number> {
  if (!emailConfigured()) return 0;
  const due = await withDb(db => db.outbox.filter(o => o.status === 'queued' && (o.nextAttemptAt || 0) <= Date.now()).slice(0, limit).map(o => ({ ...o })));
  for (const item of due) {
    await attempt(item, { to: item.to, subject: item.subject, text: item.text, html: item.html, headers: headersFor(item) });
    await record(item);
  }
  return due.length;
}
