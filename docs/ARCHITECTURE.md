# Architecture (Phase 1: Foundation)

## Stack
Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind 3 · lucide-react · mysql2 · nodemailer.
Fonts are self-hosted from `@fontsource` (Noto Sans + Noto Sans Devanagari, three weights each), so no
request goes to Google Fonts and Hindi renders on every phone.

## Data
- `lib/server/persist.ts`: key → JSON collections in MySQL table `tst_kv` (plus `tst_blobs` for files
  and `tst_meta` for a version counter), or `./data/db.json` when `DB_HOST` is not set.
- `lib/server/db.ts`: `withDb(fn)` runs one operation at a time (in-process queue + MySQL `GET_LOCK`),
  gives typed collections (`users`, `sessions`, `tokens`, `otp`, `outbox`, `audit`, `master`, …) and
  saves only what changed. **Never call `withDb` inside another `withDb` callback** (it would wait for itself).
- Business data never goes to `localStorage`. Pages read on the server; the browser changes data only
  through `/api/*` routes.

## Security
- Passwords: PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte salt; hashes are upgraded at sign-in when
  the iteration count rises.
- Sessions: random 256-bit token in an httpOnly, SameSite=Lax, Secure (on https) cookie `tst_session`;
  only its SHA-256 digest is stored. 30 days ("keep me signed in") or 12 hours. A password change or a
  suspension signs out every device.
- Every API route starts with `guard(req, { roles, limit })` (`lib/server/http.ts`): CSRF check (same
  origin via `Origin` / `Sec-Fetch-Site`, JSON-only bodies), server-side role check, optional per-IP rate
  limit. Console pages use `requireRole()` in their layouts.
- Email codes: 6 digits, 10 minutes, single use, 5 tries, HMAC-stored, resend wait, per-address and
  per-IP limits, decoys for unknown addresses. Administrators: password + email code once email works.
- Audit log of sign-ins, registrations, password changes, suspensions, master-data edits and imports;
  filterable, CSV export (with formula-injection protection).

## Email
`lib/server/mailer.ts`: SMTP (with the other-port fallback) or the Brevo / Resend API (`EMAIL_API`).
Every message is recorded in the outbox; temporary failures are retried with back-off (1, 5, 30, 120,
720 min, 5 attempts); codes and private links are never stored. Bulk mail (`list`) carries a signed
unsubscribe link and RFC 8058 `List-Unsubscribe` headers, and is not sent to unsubscribed addresses.

## Master data
`lib/masterData/kinds.ts` is the registry of every admin-editable list and its extra fields; the admin
editor (`components/admin/MasterEditor.tsx`) and the server validation (`lib/server/masterData.ts`) are
generated from it. `lib/masterData/seed.ts` adds missing seed items only (never overwrites edits); items
are deactivated, never deleted. CSV import is all-or-nothing.

## i18n
`messages/en.json` and `messages/hi.json` with identical keys (a test enforces it). The language comes
from the `tst_lang` cookie, else the browser's `Accept-Language`. To add Tamil, Telugu, etc.: add the
code in `lib/i18n/config.ts`, add `messages/<code>.json`, and import it in `lib/i18n/translate.ts`.
Master-data items carry `nameHi`; more name columns can be added the same way. The admin console is
English-only by design.

## Reused from AcadeXMatch
| TheSchoolTeacher file | Came from (udayameister/acadexmatch) | Changes |
|---|---|---|
| `lib/server/persist.ts` | `lib/server/persist.ts` | `tst_` tables, configurable data dir, no job reporting table / legacy migration |
| `lib/server/db.ts` | `lib/server/db.ts` (`withDb`, lock, seed) | typed collections instead of the client-side StorageService + RPC |
| `lib/server/security.ts` | `lib/server/security.ts` | PBKDF2-SHA256 (spec) instead of scrypt; added password policy, `sign()`, `maskIp()` |
| `lib/server/auth.ts` | sessions in `lib/server/db.ts`, tokens in `lib/server/mailer.ts` | framework-free, testable |
| `lib/server/otp.ts` | `lib/server/otp.ts` | email channel; sender injectable (SMS-ready) |
| `lib/server/oidc.ts`, `app/api/auth/google/*` | `lib/server/oidc.ts`, `app/api/auth/oauth/[provider]/*` | Google only |
| `lib/server/mailer.ts` | `lib/server/mailer.ts` | outbox retries, unsubscribe links, new brand |
| `lib/server/http.ts` | `lib/server/auth.ts` (`sameOrigin`, cookies) | one `guard()` for CSRF + roles + limits |
| `next.config.mjs`, `app/robots.ts` | same files | private-route list for this product |
| `env-settings-example.txt` | same file | rewritten for this product |

## Next phases
2 Candidate core · 3 School core · 4 Hiring tools · 5 Money · 6 Government notices & growth · 7 Hardening
(see the build prompt). AcadeXMatch modules earmarked for reuse: resume parser/checker/builder, ATS
pipeline, interview slots + ICS, selection committee, offer letters, events, payments (Razorpay),
crawler + notice parser, help bot, SEO helpers.
