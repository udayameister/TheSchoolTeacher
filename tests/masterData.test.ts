import { describe, eq, it, ok } from './harness';
import { withDb } from '@/lib/server/db';
import { importMasterCsv, listMaster, saveMasterItem, setMasterActive, weightsOf } from '@/lib/server/masterData';
import { KINDS } from '@/lib/masterData/kinds';

describe('master data', () => {
  it('seeds every kind the registry knows (districts/blocks start empty)', async () => {
    const counts = await withDb(db => Object.fromEntries(KINDS.map(k => [k.kind, (db.master[k.kind] || []).length])));
    for (const k of KINDS) if (k.kind !== 'districts' && k.kind !== 'blocks') ok(counts[k.kind] > 0, `${k.kind} seeded`);
    eq(counts.districts, 0);
  });
  it('flags official facts for verification and resolves parents', async () => {
    const r = await withDb(db => ({
      ctet: db.master.tetExams!.find(t => t.code === 'CTET')!,
      aptet: db.master.tetExams!.find(t => t.code === 'APTET')!,
      pay: db.master.payLevels!.find(p => p.code === 'L7')!,
      price: db.master.schoolCategories!.every(c => c.verify && c.meta.annualPrice === 0),
    }));
    ok(r.ctet.verify && r.pay.verify && r.price);
    eq(r.aptet.parentId, 'states:AP');
    eq(r.pay.meta.entryPay, 44900);
  });
  it('match weights and panel dimensions each add up to 100', async () => {
    const w = await withDb(db => weightsOf(db, 'matchWeights'));
    const { MANDATORY_CAP, ...parts } = w;
    eq(Object.values(parts).reduce((a, b) => a + b, 0), 100);
    ok(MANDATORY_CAP < 50, 'cap below 50%');
    const p = await withDb(db => weightsOf(db, 'panelDimensions'));
    eq(Object.values(p).reduce((a, b) => a + b, 0), 100);
  });
  it('validates new items', async () => {
    const e = (input: Record<string, unknown>, kind: 'districts' | 'posts' | 'payLevels' = 'districts') => withDb(db => saveMasterItem(db, kind, input, null).error);
    ok(await e({ code: 'CHITTOOR', name: 'Chittoor' }), 'district needs a state');
    ok(await e({ code: 'X', name: 'X', parentId: 'states:NOPE' }), 'unknown parent');
    ok(await e({ code: 'NTT', name: 'dup' }, 'posts'), 'duplicate code');
    ok(await e({ code: 'L99', name: 'Level 99', meta: { level: 99 } }, 'payLevels'), 'number range');
    ok(await e({ code: 'X2', name: 'X', meta: { category: 'bogus' } }, 'posts'), 'select option');
    eq(await e({ code: 'chittoor', name: 'Chittoor', parentId: 'states:AP', meta: { lgdCode: '000' } }), undefined);
    const saved = await withDb(db => db.master.districts!.find(d => d.code === 'CHITTOOR'));
    ok(saved && saved.parentId === 'states:AP' && saved.active);
  });
  it('deactivates instead of deleting', async () => {
    ok(await withDb(db => setMasterActive(db, 'districts', 'districts:CHITTOOR', false, null)));
    eq(await withDb(db => listMaster(db, 'districts').length), 0);
    eq(await withDb(db => listMaster(db, 'districts', { includeInactive: true }).length), 1);
  });
  it('imports CSV all-or-nothing and updates existing codes', async () => {
    const bad = await withDb(db => importMasterCsv(db, 'districts', 'code,name,parentCode\nTIRUPATI,Tirupati,AP\nNOWHERE,Nowhere,ZZ\n', null));
    ok(bad.errors.length === 1 && /Row 3/.test(bad.errors[0]), JSON.stringify(bad.errors));
    eq(await withDb(db => db.master.districts!.some(d => d.code === 'TIRUPATI')), false, 'nothing imported');
    const good = await withDb(db => importMasterCsv(db, 'districts', 'code,name,nameHi,parentCode,active,lgdCode\nTIRUPATI,Tirupati,तिरुपति,AP,,\nCHITTOOR,Chittoor,,AP,true,123\n', null));
    eq([good.added, good.updated, good.errors.length], [1, 1, 0]);
    const c = await withDb(db => db.master.districts!.find(d => d.code === 'CHITTOOR')!);
    ok(c.active && c.meta.lgdCode === '123');
    ok(await withDb(db => db.audit[0].action === 'master.import'));
  });
});
