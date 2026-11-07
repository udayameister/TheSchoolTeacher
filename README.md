# TheSchoolTeacher

Teacher recruitment for Indian schools: every board (CBSE, CISCE, NIOS, state boards, IB, Cambridge),
government, aided and private. www.theschoolteacher.in · A product of UKQAAI Technologies (www.ukqaai.com).

Status: **Phase 1 (Foundation)** done. See `docs/ARCHITECTURE.md` and `docs/VERIFY_BEFORE_LAUNCH.md`.

## Run it on your laptop
```bash
npm install
cp env-settings-example.txt .env.local   # then edit: at least AUTH_SECRET, ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD
npm run dev                               # http://localhost:3000
```
Without database settings, data is stored in `./data`. Sign in with `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD`
to create the first administrator (you will be asked to choose a new password), then open **Admin → Master data**.

## Checks
```bash
npm run typecheck   # TypeScript, strict
npm test            # 39 tests: security, store, master data, auth, email codes, outbox, guards, i18n
npm run build
```

## Deploy (GoDaddy Node.js Hosting, same as AcadeXMatch)
Laptop → GitHub → GoDaddy. Create the app from the GitHub repository, set the environment variables from
`env-settings-example.txt` in the hosting panel (the MySQL `DB_*` values are filled in by GoDaddy), build
command `npm install && npm run build`, start command `npm start`. Use `EMAIL_API` (Brevo/Resend) for email,
because GoDaddy blocks SMTP ports. A full deployment guide comes in Phase 7.
