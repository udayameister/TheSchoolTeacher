# Architecture (Phases 1–3: Foundation, Candidate core, School core)

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

## Phase 2: Candidate core
- **Vacancy model** (`types/index.ts` `Job`): school vacancies and government notices share one model;
  `applyMode` is `platform` (apply here) or `external` ("Apply on official site" + track it). A vacancy is
  public only when published and either a government notice or from a *verified* school (`lib/server/catalog.ts`).
- **Search** (`lib/jobs/filters.ts`, `app/jobs/page.tsx`): readable URLs with master-data codes
  (`/jobs?board=CBSE&post=PGT&state=AP`), full-text over title, school, place and the English/Hindi names of
  every linked item, facet counts that ignore their own filter, salary / closing-date / distance filters
  ("Near me" uses the browser's location against the school's coordinates), six sort orders. The filter form
  is a plain GET form, so it works without JavaScript.
- **Job page** (`app/jobs/[id]`): server-rendered with schema.org `JobPosting`, apply panel, save, track,
  WhatsApp share, and "Why this match?".
- **Match score** (`lib/jobs/match.ts`): six weighted parts from Master data → Match-score weights; capped at
  `MANDATORY_CAP` when a required qualification or TET is missing or expired; reasons are i18n keys. Shown only
  when the candidate gave matching consent.
- **Profile** (`lib/server/profile.ts`): every field cleaned on the server; unknown master-data ids dropped;
  completeness meter; child-safety section (police verification, dated self-declaration); discoverable toggle
  (needs matching consent).
- **Documents** (`lib/server/documents.ts`, `lib/server/scan.ts`): magic-byte type check, size limits, PDF
  script/embedded-file check, optional ClamAV, served only via 15-minute signed URLs **and** a session that may
  see them (owner, admin, or staff of a school the candidate applied to).
- **Applications** (`lib/server/applications.ts`): open + platform + one per vacancy + required screening
  answers + minimum profile; withdraw only while Applied/Screening; applying also adds the vacancy to the tracker.
- **Tracker** (`lib/server/tracker.ts`): this site's vacancies and jobs from other sites, by last date.
- **Job alerts** (`lib/server/alerts.ts`, `instrumentation.ts`): up to 10, instant / daily / weekly, each vacancy
  sent once, first run silent, emails on the `alerts` list with unsubscribe; run every 10 minutes inside the server.
- **DPDP** (`lib/server/privacy.ts`, `/account#privacy`): download my data (JSON), withdraw/give matching
  consent, email preferences, erase account (documents deleted, audit entries anonymised).
- **Sample data**: `npm run seed:demo` (local file store only) + `TST_SHOW_DEMO=1`; `-- --clear` removes it.

Not in Phase 2 (still to schedule): CV import, resume checker and builder (spec §4.3), interview booking and
demo-video links (Phase 4), interview preparation (§4.10), offer letters (Phase 4).

| Phase 2 file | Came from AcadeXMatch | Changes |
|---|---|---|
| `lib/server/alerts.ts` | `lib/server/jobAlerts.ts` | school filters, mailing-list unsubscribe, testable `collectDue` |
| `app/api/candidate/documents`, `lib/server/documents.ts` | `app/api/documents/route.ts`, `lib/documents.ts` | signed URLs, scan hook, school-specific categories |
| `lib/jobs/filters.ts` | idea of `lib/jobFilter.ts` | rewritten for school facets, distance and Hindi search |

## Phase 3: School core
- **Registration** (`lib/server/schools.ts`, `/school/register`): UDISE+ code (11 digits, checked against the
  imported directory and the state's UDISE+ prefix as a warning), management type, boards with affiliation
  numbers, location (optional map point for "near me"), official email (confirmation link sent when it differs
  from the account email) and phone. A code already used by another school is refused.
- **School groups / trusts**: the first school can be registered as a group; the group administrator then adds
  branches (each with its own UDISE+ code, verified separately) and switches between them in the school console.
- **Verification** (`/admin/schools`): pending / verified / rejected tabs with directory match, prefix warning,
  duplicate codes, contact and account details. Rejecting needs a reason, which is emailed; a rejected school that
  saves its details goes back to pending. Verified schools have their identity fields locked. Rejecting or
  un-verifying closes the school's published vacancies.
- **UDISE+ directory** (`lib/server/udise.ts`, `/admin/udise`): CSV import into table `tst_udise` (or
  `data/udise.json`); never public. Pattern from AcadeXMatch's AISHE directory.
- **Public school page** (`/schools/[slug]`, `/schools`): verified schools only; about, boards with affiliation
  numbers, classes, streams, medium, facilities, photos (up to 8, public only after verification), map link,
  open vacancies and schema.org `School` (a kind of `EducationalOrganization`) data. Added to the sitemap.
- **Vacancies** (`lib/server/jobPosting.ts`, `/school/jobs`): full form (post, subjects, classes, streams,
  employment type, posts, last date, eligibility incl. accepted TETs, pay as range / CPC level / state scale /
  hidden, benefits, up to 10 screening questions with an expected answer, premium option). Location, boards and
  management come from the school. Drafts while pending; publish only when verified; close / reopen / duplicate;
  delete only drafts without applications; view and applicant counts. Publishing triggers instant job alerts.
- **Applicant pipeline** (`lib/server/pipeline.ts`, `/school/applicants`): board (kanban) and list views, filters by
  vacancy / stage / name, single and bulk moves through a "Move to" menu (keyboard- and screen-reader-friendly
  instead of drag-and-drop). Candidates are emailed on Shortlisted, Demo / interview and Not selected.
- **Applicant dossier** (`/school/applicants/[id]`): contact, screening answers with flags, full profile incl.
  child-safety status, documents (signed links), match explanation (only with the candidate's matching consent),
  history and internal notes. Each view is written to the audit log. A withdrawn application hides contact
  details and documents and can no longer be moved.
- Access: every school route checks `canManageSchool` / `managedSchools` on the server.

Deferred to Phase 4 as planned: staff accounts with roles (HR, Principal, panel members), interviews and demo
slots, panel scoring, offer letters, talent search, reports. Subscription gating of posting comes in Phase 5.

## Next phases
2 Candidate core · 3 School core · 4 Hiring tools · 5 Money · 6 Government notices & growth · 7 Hardening
(see the build prompt). AcadeXMatch modules earmarked for reuse: resume parser/checker/builder, ATS
pipeline, interview slots + ICS, selection committee, offer letters, events, payments (Razorpay),
crawler + notice parser, help bot, SEO helpers.
