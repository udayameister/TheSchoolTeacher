import { readFileSync } from 'fs';
import path from 'path';
import { describe, eq, it, ok } from './harness';
import { audit, withDb } from '@/lib/server/db';
import { resetCaches } from '@/lib/server/persist';
import { SEED_VERSION } from '@/lib/masterData/seed';

describe('store (file fallback)', () => {
  it('creates the collections and seeds master data once', async () => {
    const r = await withDb(db => ({ users: db.users.length, states: db.master.states?.length, version: db.masterSeedVersion }));
    eq(r.users, 0);
    eq(r.states, 36, '28 states + 8 UTs');
    eq(r.version, SEED_VERSION);
  });
  it('persists to ./data/db.json and survives a cache reset', async () => {
    await withDb(db => { audit(db, { actorId: null, action: 'test.persist', target: 'x' }); });
    const onDisk = JSON.parse(readFileSync(path.join(process.env.TST_DATA_DIR!, 'db.json'), 'utf8'));
    ok(onDisk.audit.some((a: { action: string }) => a.action === 'test.persist'));
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
    await Promise.all(Array.from({ length: 20 }, () => withDb(db => { db.suppressed.push('x'); })));
    eq(await withDb(db => db.suppressed.filter(s => s === 'x').length), 20);
    await withDb(db => { db.suppressed = []; });
  });
});
