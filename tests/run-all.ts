import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/*
 * Runs every test against a throw-away file store. Environment is set before any app module loads:
 * file storage in a temp folder, no email provider, fast password hashing, a fixed signing secret.
 */
const dir = mkdtempSync(path.join(tmpdir(), 'tst-test-'));
Object.assign(process.env, {
  TST_STORAGE: 'file', TST_DATA_DIR: dir, PBKDF2_ITERATIONS: '2000', AUTH_SECRET: 'test-secret-test-secret-test-secret-0123',
  APP_URL: 'http://localhost:3000', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
});
for (const k of ['DB_HOST', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_API', 'EMAIL_API_KEY', 'EMAIL_REDIRECT_TO', 'ADMIN_EMAIL', 'ADMIN_INITIAL_PASSWORD']) delete process.env[k];

(async () => {
  const { run } = await import('./harness');
  for (const f of ['security', 'store', 'masterData', 'auth', 'otp', 'mailer', 'guards', 'i18n', 'search', 'candidate', 'school']) await import(`./${f}.test`);
  const failed = await run();
  rmSync(dir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
