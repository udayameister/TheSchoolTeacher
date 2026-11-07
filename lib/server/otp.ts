import type { OtpChallenge, OtpPurpose } from '@/types';
import { withDb } from './db';
import { allow, keyedDigest, randomDigits, randomToken, retryAfter, safeEqual } from './security';
import { sendOtpEmail } from './authEmails';

/*
 * One-time sign-in codes by email (and, later, SMS: the channel is a parameter of the design, see
 * docs/ARCHITECTURE.md). Adapted from AcadeXMatch lib/server/otp.ts: 6-digit random codes, valid
 * 10 minutes, single use, only an HMAC of the code is stored, a new code replaces the previous one,
 * per-address and per-IP limits, and "decoy" challenges for unknown addresses so the answer never
 * reveals whether an account exists.
 */

const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
export const OTP_LENGTH = 6;
export const OTP_MINUTES = num(process.env.OTP_EXPIRY_MINUTES, 10);
export const OTP_RESEND_SECONDS = num(process.env.OTP_RESEND_SECONDS, 60);
const MAX_ATTEMPTS = 5;

export interface StartResult { ok: boolean; challengeId?: string; resendIn?: number; error?: string; status?: number }

/** `send` replaces the email step (tests use it to read the code; SMS can plug in the same way). */
type Sender = (to: string, name: string, code: string, minutes: number, purpose: OtpPurpose) => Promise<{ status: string }>;

export async function startChallenge(opts: { purpose: OtpPurpose; target: string; userId?: string; name?: string; ip: string; decoy?: boolean; data?: Record<string, unknown>; send?: Sender }): Promise<StartResult> {
  const t = opts.target.toLowerCase();
  if (!allow(`otp:ip:${opts.ip}`, 20, 3600_000)) return { ok: false, status: 429, error: `Too many codes requested. Try again in ${Math.ceil(retryAfter(`otp:ip:${opts.ip}`) / 60)} minutes.` };
  const last = await withDb(db => Object.values(db.otp).filter(c => c.target === t && c.purpose === opts.purpose).sort((a, b) => b.createdAt - a.createdAt)[0]);
  const wait = last ? Math.ceil((last.createdAt + OTP_RESEND_SECONDS * 1000 - Date.now()) / 1000) : 0;
  if (wait > 0) return { ok: false, status: 429, resendIn: wait, error: `Please wait ${wait} seconds before asking for another code.` };
  if (!allow(`otp:t:h:${t}`, 5, 3600_000) || !allow(`otp:t:d:${t}`, 10, 86400_000)) return { ok: false, status: 429, error: 'Too many codes were requested for this address. Try again later.' };

  const code = randomDigits(OTP_LENGTH);
  const id = randomToken(18);
  const now = Date.now();
  const ch: OtpChallenge = {
    id, purpose: opts.purpose, target: t, userId: opts.userId, codeHash: keyedDigest(code, `otp:${id}`),
    createdAt: now, expiresAt: now + OTP_MINUTES * 60_000, attempts: 0, ...(opts.decoy ? { decoy: true } : {}), ...(opts.data ? { data: opts.data } : {}),
  };
  await withDb(db => {
    for (const [k, v] of Object.entries(db.otp)) {
      if (v.expiresAt < now - 86400_000) delete db.otp[k];
      else if (v.target === t && v.purpose === opts.purpose) db.otp[k] = { ...v, expiresAt: Math.min(v.expiresAt, now - 1), codeHash: '' }; // superseded
    }
    db.otp[id] = ch;
  });
  if (!opts.decoy) {
    const sent = await (opts.send || sendOtpEmail)(t, opts.name || '', code, OTP_MINUTES, opts.purpose);
    if (sent.status === 'failed') {
      await withDb(db => { delete db.otp[id]; });
      return { ok: false, status: 502, error: 'The email could not be sent. Try again in a minute.' };
    }
  }
  return { ok: true, challengeId: id, resendIn: OTP_RESEND_SECONDS };
}

export interface VerifyResult { ok: boolean; error?: string; userId?: string; target?: string; data?: Record<string, unknown> }

export function verifyChallenge(id: string, code: string, purpose: OtpPurpose): Promise<VerifyResult> {
  const clean = String(code || '').replace(/\D/g, '');
  return withDb(db => {
    const ch = db.otp[String(id || '')];
    const generic = 'That code is not correct or has expired. Ask for a new code.';
    if (!ch || ch.purpose !== purpose || !ch.codeHash) return { ok: false, error: generic };
    if (ch.expiresAt < Date.now()) { delete db.otp[ch.id]; return { ok: false, error: 'This code has expired. Ask for a new one.' }; }
    ch.attempts++;
    const match = !ch.decoy && clean.length === OTP_LENGTH && safeEqual(keyedDigest(clean, `otp:${ch.id}`), ch.codeHash);
    if (!match) {
      if (ch.attempts >= MAX_ATTEMPTS) { delete db.otp[ch.id]; return { ok: false, error: 'Too many wrong codes. Ask for a new code.' }; }
      const left = MAX_ATTEMPTS - ch.attempts;
      return { ok: false, error: `That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.` };
    }
    delete db.otp[ch.id]; // single use
    return { ok: true, userId: ch.userId, target: ch.target, data: ch.data };
  });
}
