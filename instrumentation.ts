/*
 * Background jobs inside the web server (GoDaddy Node.js hosting has no separate cron):
 * job alerts and email retries every 10 minutes. TST_DISABLE_SCHEDULER=1 turns this off
 * (e.g. when an external cron calls the admin endpoints instead).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.TST_DISABLE_SCHEDULER === '1') return;
  const g = globalThis as unknown as { __tstScheduler?: boolean };
  if (g.__tstScheduler) return;
  g.__tstScheduler = true;
  const { runJobAlerts } = await import('./lib/server/alerts');
  const { retryDueMail } = await import('./lib/server/mailer');
  const tick = async () => {
    try { await runJobAlerts(); } catch (e) { console.error('[TheSchoolTeacher] Job alerts failed:', (e as Error).message); }
    try { await retryDueMail(); } catch (e) { console.error('[TheSchoolTeacher] Email retry failed:', (e as Error).message); }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 10 * 60_000);
}
