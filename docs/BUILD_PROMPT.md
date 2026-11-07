# Build prompt: TheSchoolTeacher.in — teacher recruitment platform for Indian schools

> Paste this whole file into Claude Code (or save it as `docs/BUILD_PROMPT.md` in the new repo and say "Build the app described in docs/BUILD_PROMPT.md, phase by phase").

---

## 1. Your role and the goal

You are a senior full-stack engineer. Build **TheSchoolTeacher** (www.theschoolteacher.in), a recruitment platform for **school teachers in India**. It must work for **every school board** (central, state and international) and for **government, government-aided and private schools**.

There are three kinds of users, each with its own console:

1. **Candidate**: teachers and teaching aspirants (free).
2. **School / Institute**: schools, school groups and trusts that hire (paid subscription, with an admin-controlled launch offer).
3. **Platform admin**: the TheSchoolTeacher team, who verify schools, moderate content, set prices and run the site.

**Reference implementation:** this is a sister product of **AcadeXMatch** (www.acadexmatch.com, GitHub `udayameister/acadexmatch`), a faculty-hiring platform for higher education that is already built and live. **Clone that repository and study it before writing code.** Reuse its architecture, patterns and working modules wherever they fit (auth, email, payments, ATS pipeline, interviews, committee scoring, offer letters, events, help assistant, admin console, SEO). Re-model only what differs for schools (see section 3). Do not copy AcadeXMatch's brand, colours or wording: TheSchoolTeacher has its own identity.

---

## 2. Tech stack (same as AcadeXMatch)

- **Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS 3**, `lucide-react` icons.
- **Database:** MySQL through `mysql2`, read from `DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD`. When those are not set, fall back to a local file store in `./data`, as AcadeXMatch does. All data access goes through server API routes. No business data in `localStorage`.
- **Auth:** server-side sessions (httpOnly, Secure, SameSite cookies), PBKDF2-SHA256 password hashing, email verification, forgot/reset password, email OTP login, Google OAuth, and role guards enforced **on the server** for every API route.
- **Email:** `nodemailer` over SMTP, with an HTTPS email-API fallback (Brevo / Resend), selected by `EMAIL_API`, for hosts that block SMTP. Keep an outbox table with retries and an unsubscribe link in every bulk email.
- **Payments:** Razorpay (orders, checkout, signature verification, webhook for `payment.captured`, `order.paid`, `payment.failed` and refunds), GST invoices and receipts.
- **Hosting:** GoDaddy Node.js Hosting, deployed from GitHub (laptop → GitHub → GoDaddy), exactly like AcadeXMatch. Ship an `env-settings-example.txt` that explains every variable in plain English.
- **Tests:** `tsx` test scripts for the core flows, plus `npm run typecheck`. Every phase ends green.

---

## 3. The Indian school domain (what is different from AcadeXMatch)

Model these as **admin-editable master data** (seed tables plus admin screens), never hard-coded lists. Seed with sensible values and mark anything uncertain for admin review.

**School identity**
- Use the **UDISE+ code** (11-digit school code) where AcadeXMatch uses the AISHE code. School sign-up looks up or enters the UDISE+ code, and the admin verifies it before the school can post.
- **Management type:** Central Government (e.g. KVS, NVS, Sainik, central PSU schools), State Government, Government-aided, Private unaided, Local body, Minority, Trust/Society, International.
- **Board / affiliation:** CBSE, CISCE (ICSE/ISC), NIOS, every **State Board** (all states and UTs, admin-editable), IB, Cambridge (CAIE), and Other. A school can have more than one board. Store the affiliation number.
- **School level:** Pre-primary, Primary (I–V), Upper primary (VI–VIII), Secondary (IX–X), Senior secondary (XI–XII), with streams (Science / Commerce / Humanities / Vocational).
- **Location:** State → District → Block/Mandal → City/Village, plus PIN code. Teachers search by distance and by district heavily.
- **Medium of instruction:** English, Hindi and all regional languages (admin-editable).

**Posts (admin-editable)**
- Teaching: NTT / Pre-primary teacher, PRT, TGT, PGT (by subject), Special Educator, Physical Education Teacher, Art / Music / Dance / Computer teacher, Counsellor, Librarian.
- Leadership: Principal, Vice Principal, Headmaster/Headmistress, Academic Coordinator, Head of Department.
- Non-teaching (optional category): Lab assistant, Office staff, Accountant, Admin officer.
- Employment type: Permanent, Contract, Guest / Part-time, Ad-hoc, Tutor.

**Eligibility the job form must capture, and the candidate profile must hold**
- Qualifications: D.El.Ed / D.Ed, B.Ed, M.Ed, B.P.Ed, NTT / ECCE diploma, UG/PG in the subject, with percentage.
- **Teacher Eligibility Tests:** CTET (Paper I / II, year and score), each **State TET** (admin-editable list), and other qualifying exams the admin adds. Record validity dates.
- Subjects the candidate can teach, and the classes or level.
- Languages they can teach in (the medium), plus proficiency.
- Experience: school, board, classes taught, subjects, dates.
- Optional: computer proficiency, special-education (RCI) registration, sports or arts certifications.
- **Child-safety compliance** (important for schools): police verification status, a self-declaration, and an optional POCSO-awareness training certificate upload.

**Pay**
- Government and KVS-style posts: show the **7th CPC pay level** (admin-editable map of post to level and entry pay; seed it, mark it "verify before launch"). State-government posts: free-text pay scale.
- Private schools: monthly salary range, plus benefits (accommodation, transport, child-fee concession, PF/ESI).
- A **Salary calculator** page, like AcadeXMatch's, for the central pay matrix.

**Government recruitment notices**
- Central and state teacher recruitments (KVS, NVS, state DSC / TRB / TET notifications, etc.) are **not posted by schools**. The admin posts them, or imports them with a scraper / notice parser (reuse the AcadeXMatch crawler and notice parser).
- These are shown as "Apply on official site" listings with key dates, posts, eligibility and a link to the official notification PDF. Never imply the platform is the recruiting authority.

---

## 4. Candidate console (all free; there is no paid tier for candidates)

1. **Sign-up / login:** email + password, email OTP, Google sign-in. Mobile number with OTP-ready design.
2. **Teacher profile:** personal details, qualifications, TETs, subjects × classes, medium, experience, preferred districts / states, expected salary, photo, documents (certificates, TET scorecard, ID proof, police verification). It shows a completeness meter.
3. **CV import and resume tools:** reuse the AcadeXMatch resume parser, checker (ATS score), and builder with PDF / DOCX download, adapted to school CVs.
4. **Job search:** full-text search plus facets for board, state / district / distance, post, subject, class level, medium, management type, employment type, salary, government vs private, and last date. Results can be saved.
5. **Explainable match score** for every vacancy. Suggested weights (admin-editable): qualification & TET 35, subject & class fit 25, experience 15, medium / language 10, location 10, salary fit 5. Cap the score below 50% when a mandatory requirement (e.g. TET, B.Ed) is unmet. "Why this match?" explains each part.
6. **Apply in one click** with screening questions, duplicate protection and deadline checks. For external / government listings: "Apply on official site", then "Track it".
7. **Applications and tracker:** a stage timeline (same stages as the school ATS), withdraw while in screening, and a deadline tracker that also holds jobs from other sites.
8. **Job alerts:** saved searches emailed instantly, daily or weekly (up to 10 alerts), plus an optional WhatsApp-share button on each job.
9. **Interviews and demo classes:** book a slot, add it to the calendar (ICS), and get reminders 1 day and 1 hour before. **Demo-lesson** support: the school can ask for a topic and class, and the candidate can upload a short demo video link.
10. **Interview preparation:** checklists, a question bank by post and subject, a lesson-plan template and a demo-class planner, plus a TET preparation section (links and practice; no copyrighted papers).
11. **Offer letters:** view and accept / decline inside the app.
12. **Discoverable profile toggle:** opt in to talent search. Contact details and documents stay hidden until the candidate applies.
13. **Privacy (DPDP Act, 2023):** download my data, delete my account, withdraw consent for matching, and notification preferences.

---

## 5. School / Institute console

1. **Registration and verification:** search or enter the UDISE+ code, board(s), affiliation number, management type and an official email or phone. The account stays **pending** until the admin verifies it. A school group / trust can manage several branches under one account, each with its own UDISE+ code.
2. **School profile page (public):** about, boards, classes, medium, facilities, photos, location map link, and open vacancies, with a verified badge.
3. **Post vacancies:** the fields from section 3, screening questions, number of posts, last date, and a "Premium vacancy" option (apply only through the platform). Close / reopen, duplicate a post, and see view counts.
4. **Applicant pipeline (ATS):** Applied → Screening → Eligible → Shortlisted → Demo / Interview → Panel review → Offer → Joined, plus Not selected. Kanban and list views, bulk actions, and an applicant dossier (profile, documents, match score, screening answers, notes).
5. **Interviews and demo classes:** create slots (in person / Google Meet / Teams), let candidates self-book, and send reminders automatically.
6. **Selection panel scoring:** confidential scores from panel members (Principal, Coordinator, Subject expert, Management nominee). Suggested dimensions: subject knowledge 30, demo-class / pedagogy 30, communication 20, interview 20 (admin-editable). The scores are combined into a ranking.
7. **Offer letters:** a template with merge fields, a signatory, and online issue and response.
8. **Talent search:** filter opted-in candidates (subject, TET, qualification, experience, district, medium) and invite them to apply.
9. **Reports:** hiring funnel, time to hire, results by vacancy, and CSV export.
10. **Team:** add staff users (HR, Principal, panel members) with roles.
11. **Subscription and billing:** see section 7.
12. **Event advertisements:** workshops, teacher-training programmes, CBSE / board capacity-building sessions and education fairs, listed on the home page (paid per listing, with an admin-controlled free period). Reuse the AcadeXMatch events module.

---

## 6. Platform admin console

- **Verification queue** for schools (UDISE+ check), with approve / reject and a reason.
- **Master data** screens: boards, states / districts / blocks, posts, subjects, TET exams, mediums, pay-level map, management types and match-score weights.
- **Government recruitment notices:** create / import / scrape, review, publish and expire.
- **Moderation:** jobs, events, school profiles, reported content.
- **Users:** search, impersonate (read-only, audited), suspend, link staff to schools, and the data-rights request desk.
- **Plans and pricing:** every price, plan length, launch offer (on/off, free-until date, which school categories it covers), event-listing prices and free period. All of this is controlled by the admin, as in AcadeXMatch.
- **Payments:** transactions ledger, record offline / bank payments, refunds, invoices with GST.
- **Email:** outbox, templates, new-vacancy digest to candidates, bulk outreach to unregistered schools through a separate sender account, and unsubscribe handling.
- **Content:** home-page announcements, advisory-board members, "Our customers" logos, FAQ / help-assistant answers.
- **Analytics:** sign-ups, active jobs, applications, conversion and visits.
- **Audit log** with filters and CSV export, plus database backup / export.

---

## 7. Business model (all values admin-editable)

- **Candidates:** everything free.
- **Schools:** an annual subscription, priced by a category the admin defines. Suggested starting categories: Government / aided, Private (up to Class VIII), Private (up to Class XII), International / multi-branch group. **Leave every price as an admin setting with placeholder values**; do not hard-code amounts.
- **Launch offer:** free for a period the admin sets, applying **only after admin verification and approval**.
- **Paid event listings** on the home page, with an admin-set free period.
- **Voluntary donations** box on the home page (amount range set by the admin).
- Payment through Razorpay, with invoices / receipts under My account.

---

## 8. Cross-cutting requirements

- **Multilingual:** the interface is built i18n-ready from day one. Ship **English and Hindi**, with keys structured so regional languages (Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, etc.) can be added through translation files only.
- **Mobile-first and low-bandwidth:** most teachers use phones on slow connections. Pages must stay fast (server components, image optimisation, no heavy client bundles). Core flows must work at 360 px width.
- **Accessibility:** WCAG 2.1 AA (labels, contrast, keyboard use, focus states).
- **SEO** (reuse the AcadeXMatch setup): server-rendered job pages with schema.org `JobPosting`, `EducationalOrganization` and `Event` data, sitemap.xml, robots.txt, canonical URLs, IndexNow, and Google / Bing verification variables. SEO landing pages for "teacher jobs in <district>", "<board> teacher jobs" and "<subject> TGT/PGT jobs".
- **Security:** server-side authorization on every route, rate limiting on auth and OTP, CSRF protection, validated uploads (type, size, virus-scan hook), signed private URLs for documents, secrets only in `.env.local`, and an audit log of sensitive actions.
- **Privacy:** comply with India's **Digital Personal Data Protection Act, 2023**: consent records, purpose limitation, data export / erasure, and retention rules. Candidate documents are visible only to the schools a candidate applied to.
- **Help assistant:** a rule-based FAQ bot like AcadeXMatch's, rewritten for schools and teachers.
- **Legal pages:** Terms, Privacy, Refund policy and Contact, with the footer credit "A product of UKQAAI Technologies (www.ukqaai.com)".

---

## 9. Brand and UI

- A new identity for TheSchoolTeacher: warm, trustworthy and school-friendly, clearly different from AcadeXMatch's maroon and gold. Propose a palette and logo mark in `tailwind.config.ts`, with an `ivory`-style light background, one primary, one accent and accessible contrast.
- Font: one clean sans-serif that supports Devanagari (e.g. Noto Sans with Noto Sans Devanagari).
- Home page: search bar (post / subject / district), quick filters by board and state, a government-notices strip, latest jobs, upcoming events, "For schools" call to action, trust badges (verified schools), FAQ and footer.

---

## 10. Delivery plan: build in phases, and stop for review after each

1. **Foundation:** repo setup, stack, DB layer with file fallback, auth and roles, master-data tables and admin screens, layout, i18n scaffolding, brand.
2. **Candidate core:** profile, documents, job search with facets, job pages, apply, applications, tracker, alerts.
3. **School core:** registration and UDISE+ verification, profile page, post vacancy, ATS pipeline, applicant dossier.
4. **Hiring tools:** interviews / demo slots, panel scoring, offer letters, talent search, reports, team users.
5. **Money:** plans, launch offer, Razorpay, invoices, event listings, donations.
6. **Government notices and growth:** notice import / scraper, SEO landing pages, email digests, outreach, help assistant.
7. **Hardening:** security review, DPDP flows, accessibility pass, performance on mobile, full test run, deployment guide for GoDaddy.

For each phase: list the files you will create or change, implement them, add tests, run `npm run typecheck` and `npm test`, and summarise what is done and what is left.

---

## 11. Rules for you while building

- Read the AcadeXMatch code first and **reuse before rewriting**. When you adapt a module, say which AcadeXMatch file it came from.
- Never hard-code prices, posts, boards, TET exams or pay levels; they live in master data that the admin edits.
- Don't invent official facts (fees, pay levels, exam rules). Seed with placeholders marked `VERIFY` and list them in `docs/VERIFY_BEFORE_LAUNCH.md`.
- No fake testimonials, invented statistics or placeholder schools shown as real customers.
- Keep the code typed, small and documented. Explain every environment variable in `env-settings-example.txt`.
- Ask me before adding a new paid third-party service.
