import { promises as fs } from 'fs';
import path from 'path';
import type { UdiseRecord } from '@/types';
import { backend, dataDir, sql } from './persist';
import { parseCsv } from '@/lib/csv';

/*
 * UDISE+ school directory: reference data the administrator imports from UDISE+ reports (CSV), so a
 * school that registers can be matched against it ("directory match" in the verification queue) and the
 * sign-up form can fill in the name from the code. Pattern adapted from AcadeXMatch lib/server/aishe.ts.
 * Rows are matched by UDISE+ code; a newer file updates existing rows and adds new ones; nothing is deleted.
 *
 * It can be large (lakhs of rows), so it lives outside the main store: table tst_udise in MySQL, or
 * data/udise.json locally.
 */

const DDL = `CREATE TABLE IF NOT EXISTS tst_udise (
  code CHAR(11) NOT NULL PRIMARY KEY,
  name VARCHAR(300) NOT NULL,
  state VARCHAR(120) NULL,
  district VARCHAR(120) NULL,
  block VARCHAR(120) NULL,
  management VARCHAR(160) NULL,
  category VARCHAR(160) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name(80))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const FILE = () => path.join(dataDir(), 'udise.json');
const g = globalThis as unknown as { __tstUdiseTable?: Promise<unknown>; __tstUdise?: Record<string, UdiseRecord> };

export const isUdiseCode = (v: string) => /^\d{11}$/.test(v);
export const cleanUdise = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(0, 11);

async function table() { g.__tstUdiseTable ||= sql(DDL).catch(e => { g.__tstUdiseTable = undefined; throw e; }); return g.__tstUdiseTable; }
async function fileData(): Promise<Record<string, UdiseRecord>> {
  if (!g.__tstUdise) { try { g.__tstUdise = JSON.parse(await fs.readFile(FILE(), 'utf8')); } catch { g.__tstUdise = {}; } }
  return g.__tstUdise!;
}

export async function lookupUdise(code: string): Promise<UdiseRecord | null> {
  if (!isUdiseCode(code)) return null;
  if (backend() === 'file') return (await fileData())[code] || null;
  await table();
  const rows = await sql<UdiseRecord[]>('SELECT code, name, state, district, block, management, category FROM tst_udise WHERE code = ?', [code]);
  return rows[0] || null;
}

export async function directorySize(): Promise<number> {
  if (backend() === 'file') return Object.keys(await fileData()).length;
  await table();
  const rows = await sql<{ n: number }[]>('SELECT COUNT(*) AS n FROM tst_udise');
  return Number(rows[0]?.n || 0);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADERS: Record<keyof UdiseRecord, string[]> = {
  code: ['udisecode', 'udiseschoolcode', 'udise', 'schoolcode', 'udisepluscode', 'code'],
  name: ['schoolname', 'nameoftheschool', 'nameofschool', 'name'],
  state: ['state', 'statename'],
  district: ['district', 'districtname'],
  block: ['block', 'blockname', 'mandal', 'taluk', 'taluka'],
  management: ['management', 'schoolmanagement', 'managementtype'],
  category: ['category', 'schoolcategory'],
};

/** Imports a CSV export. Returns counts and the first problems found (bad rows are skipped, not fatal). */
export async function importUdiseCsv(csv: string): Promise<{ added: number; updated: number; skipped: number; problems: string[] }> {
  const rows = parseCsv(csv);
  const header = (rows[0] || []).map(norm);
  const col = Object.fromEntries(Object.entries(HEADERS).map(([k, names]) => [k, header.findIndex(h => names.includes(h))])) as Record<keyof UdiseRecord, number>;
  if (col.code < 0 || col.name < 0) return { added: 0, updated: 0, skipped: 0, problems: ['The file needs a UDISE code column and a school name column.'] };
  const recs: UdiseRecord[] = [];
  const problems: string[] = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (k: keyof UdiseRecord) => (col[k] >= 0 ? String(r[col[k]] ?? '').trim().slice(0, 300) : '') || null;
    const code = cleanUdise(get('code'));
    const name = get('name');
    if (!isUdiseCode(code) || !name) { skipped++; if (problems.length < 10 && r.some(c => c.trim())) problems.push(`Row ${i + 1}: missing or invalid UDISE code / name.`); continue; }
    recs.push({ code, name, state: get('state'), district: get('district'), block: get('block'), management: get('management'), category: get('category') });
  }
  let added = 0, updated = 0;
  if (backend() === 'file') {
    const d = await fileData();
    for (const r of recs) { if (d[r.code]) updated++; else added++; d[r.code] = r; }
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(`${FILE()}.tmp`, JSON.stringify(d));
    await fs.rename(`${FILE()}.tmp`, FILE());
  } else {
    await table();
    for (let i = 0; i < recs.length; i += 500) {
      const chunk = recs.slice(i, i + 500);
      const existing = await sql<{ code: string }[]>(`SELECT code FROM tst_udise WHERE code IN (${chunk.map(() => '?').join(',')})`, chunk.map(r => r.code));
      updated += existing.length; added += chunk.length - existing.length;
      await sql(`INSERT INTO tst_udise (code, name, state, district, block, management, category) VALUES ${chunk.map(() => '(?,?,?,?,?,?,?)').join(',')}
        ON DUPLICATE KEY UPDATE name=VALUES(name), state=VALUES(state), district=VALUES(district), block=VALUES(block), management=VALUES(management), category=VALUES(category)`,
        chunk.flatMap(r => [r.code, r.name, r.state, r.district, r.block, r.management, r.category]));
    }
  }
  return { added, updated, skipped, problems };
}

/** Same name, ignoring case, spaces and punctuation (a hint for the reviewer, not proof). */
export function sameSchoolName(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/\b(the|school|govt|government|vidyalaya|high|public)\b/g, '').replace(/[^a-z0-9]/g, '');
  return !!n(a) && n(a) === n(b);
}

export function resetUdiseCache(): void { g.__tstUdise = undefined; }
