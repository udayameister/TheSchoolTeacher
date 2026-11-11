import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/*
 * Runs every test against a throw-away file store. Environment is set before any app module loads:
 * file storage in a temp folder, no email provider, fast password hashing, a fixed signing secret.
 */
/*
 * TST_TEST_DB=1 runs the same tests against the MySQL / MariaDB database in DB_HOST … DB_NAME instead
 * (every tst_ table in that database is dropped first, so point it at an empty test database).
 */
const useDb = process.env.TST_TEST_DB === '1' && !!process.env.DB_HOST;
const dir = mkdtempSync(path.join(tmpdir(), 'tst-test-'));
Object.assign(process.env, {
  TST_STORAGE: useDb ? '' : 'file', TST_DATA_DIR: dir, PBKDF2_ITERATIONS: '2000', AUTH_SECRET: 'test-secret-test-secret-test-secret-0123',
  APP_URL: 'http://localhost:3000', GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
});
for (const k of [...(useDb ? [] : ['DB_HOST']), 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_API', 'EMAIL_API_KEY', 'EMAIL_REDIRECT_TO', 'ADMIN_EMAIL', 'ADMIN_INITIAL_PASSWORD']) delete process.env[k];

(async () => {
  if (useDb) {
    const { sql } = await import('@/lib/server/persist');
    const tables = await sql<{ t: string }[]>("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'tst\\_%'");
    for (const { t } of tables) await sql(`DROP TABLE \`${t}\``);
    const { resetSchema } = await import('@/lib/server/persist');
    resetSchema();
    console.log(`Testing against MySQL database "${process.env.DB_NAME}" (${tables.length} old tables dropped)\n`);
  }
  const { run } = await import('./harness');
  for (const f of ['security', 'store', 'masterData', 'auth', 'otp', 'mailer', 'guards', 'i18n', 'search', 'candidate', 'school', 'hiring', 'import']) await import(`./${f}.test`);
  const failed = await run();
  rmSync(dir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
