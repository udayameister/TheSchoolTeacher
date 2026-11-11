import { readFileSync } from 'fs';
import path from 'path';
import { describe, eq, it, ok } from './harness';
import { audit, withDb } from '@/lib/server/db';
import { backend, resetCaches, sql } from '@/lib/server/persist';
import { SEED_VERSION } from '@/lib/masterData/seed';

describe(`store (${backend() === 'mysql' ? 'MySQL tables' : 'file fallback'})`, () => {
  it('creates the collections and seeds master data once', async () => {
    const r = await withDb(db => ({ users: db.users.length, states: db.master.states?.length, version: db.masterSeedVersion }));
    eq(r.users, 0);
    eq(r.states, 36, '28 states + 8 UTs');
    eq(r.version, SEED_VERSION);
  });
  it('persists (db.json, or one row per record in MySQL) and survives a cache reset', async () => {
    await withDb(db => { audit(db, { actorId: null, action: 'test.persist', target: 'x' }); });
    if (backend() === 'mysql') {
      const rows = await sql<{ action: string; target: string; data: string }[]>("SELECT action, target, data FROM tst_audit_log WHERE action = 'test.persist'");
      eq(rows.length, 1);
      eq([rows[0].target, JSON.parse(rows[0].data).action], ['x', 'test.persist'], 'readable columns and the full record');
      const states = await sql<{ n: number }[]>("SELECT COUNT(*) AS n FROM tst_master_data WHERE kind = 'states'");
      eq(Number(states[0].n), 36);
    } else {
      const onDisk = JSON.parse(readFileSync(path.join(process.env.TST_DATA_DIR!, 'db.json'), 'utf8'));
      ok(onDisk.audit.some((a: { action: string }) => a.action === 'test.persist'));
    }
    resetCaches();
    ok(await withDb(db => db.audit.some(a => a.action === 'test.persist')));
  });
  it('never overwrites admin edits when re-seeding', async () => {
    await withDb(db => { db.master.boards!.find(b => b.code === 'CBSE')!.name = 'CBSE (edited)'; db.masterSeedVersion = 0; });
    const name = await withDb(db => db.master.boards!.find(b => b.code === 'CBSE')!.name);
    eq(name, 'CBSE (edited)');
    const dupes = await withDb(db => db.master.boards!.filter(b => b.code === 'CBSE').length);
    eq(dupes, 1);
  });
  it('runs operations one at a time', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => withDb(db => { db.suppressed.push(`x${i}`); })));
    eq(await withDb(db => db.suppressed.filter(s => s.startsWith('x')).length), 20);
    resetCaches();
    eq(await withDb(db => db.suppressed.filter(s => s.startsWith('x')).length), 20, 'after reloading');
    await withDb(db => { db.suppressed = []; });
  });
  it('saves only changed records, and deletes removed ones', async () => {
    await withDb(db => { db.savedJobs.push({ userId: 'u1', jobId: 'j1', at: 'a' }, { userId: 'u1', jobId: 'j2', at: 'b' }); });
    await withDb(db => { db.savedJobs = db.savedJobs.filter(s => s.jobId !== 'j1'); });
    resetCaches();
    eq(await withDb(db => db.savedJobs.map(s => s.jobId)), ['j2']);
    if (backend() === 'mysql') eq((await sql<{ id: string }[]>('SELECT id FROM tst_saved_jobs')).map(r => r.id), ['u1:j2']);
    await withDb(db => { db.savedJobs = []; });
  });
  it('keeps newest-first lists in order after reloading', async () => {
    for (const a of ['order.1', 'order.2', 'order.3']) await withDb(db => audit(db, { actorId: null, action: a }));
    resetCaches();
    eq(await withDb(db => db.audit.slice(0, 3).map(a => a.action)), ['order.3', 'order.2', 'order.1']);
  });
});
