import { promises as fs, statSync } from 'fs';
import path from 'path';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { TABLES, TABLE_BY_COLL, colValue, createSql, rowsOf, sqlType, valueOf, type TableDef } from './tables';

/*
 * Where TheSchoolTeacher keeps its data. Adapted from AcadeXMatch lib/server/persist.ts
 * (same key → JSON collection model, same MySQL locking and version cache), without the
 * AcadeXMatch-specific job reporting table and legacy-file migration.
 *
 *  - MySQL (production): used whenever DB_HOST is set. GoDaddy Node.js Hosting injects DB_HOST,
 *    DB_PORT, DB_NAME, DB_USER and DB_PASSWORD for the app's database. Data lives outside the
 *    app's code, so deploying a new version never touches it.
 *  - Files in ./data (local development and tests): used when no database is configured, or when
 *    TST_STORAGE=file. TST_DATA_DIR moves the folder (the tests use a temporary one).
 *
 * Two kinds of data:
 *  - the main store: users, schools, jobs, applications … In MySQL each kind has its own table with one row
 *    per record (layout in tables.ts). The whole store is read into memory once and kept there while no other
 *    process has written (tst_meta.version); saving writes only the rows that changed, in one transaction.
 *    The first start after upgrading moves the older key → JSON layout (tst_kv) into the tables automatically.
 *  - blobs: uploaded files (documents, photos), stored as bytes.
 */

export type Db = Record<string, unknown>;
export type Backend = 'mysql' | 'file';

export function dataDir(): string {
  return process.env.TST_DATA_DIR || path.join(process.cwd(), 'data');
}
const dbFile = () => path.join(dataDir(), 'db.json');

export function backend(): Backend {
  if (process.env.TST_STORAGE === 'file') return 'file';
  return process.env.DB_HOST ? 'mysql' : 'file';
}

const g = globalThis as unknown as { __tstPool?: Pool; __tstSchema?: Promise<void>; __tstMigrated?: boolean };

async function pool(): Promise<Pool> {
  if (!g.__tstPool) {
    const mysql = await import('mysql2/promise');
    g.__tstPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectionLimit: 5,
      waitForConnections: true,
      charset: 'utf8mb4',
      enableKeepAlive: true,
      ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
    });
  }
  return g.__tstPool;
}

async function ensureSchema(): Promise<void> {
  g.__tstSchema ||= (async () => {
    const p = await pool();
    // Older layout (kept: other keys still live here, and it holds the backup made by the migration).
    await p.query(`CREATE TABLE IF NOT EXISTS tst_kv (
      k VARCHAR(191) NOT NULL PRIMARY KEY,
      v LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await p.query(`CREATE TABLE IF NOT EXISTS tst_blobs (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      mime VARCHAR(100) NOT NULL,
      data LONGBLOB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await p.query(`CREATE TABLE IF NOT EXISTS tst_meta (
      id TINYINT NOT NULL PRIMARY KEY,
      version BIGINT NOT NULL
    ) ENGINE=InnoDB`);
    await p.query('INSERT IGNORE INTO tst_meta (id, version) VALUES (1, 0)');
    for (const t of uniqueTables()) {
      await p.query(createSql(t));
      // Columns added to the registry later are added to existing tables.
      const [have] = await p.query<RowDataPacket[]>('SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [t.table]);
      const names = new Set(have.map(r => String(r.c)));
      for (const col of t.cols) if (!names.has(col.name)) await p.query(`ALTER TABLE \`${t.table}\` ADD COLUMN \`${col.name}\` ${sqlType(col.type)} NULL`);
    }
  })().catch(e => { g.__tstSchema = undefined; throw e; });
  return g.__tstSchema;
}

/** One CREATE per table name (several scalar settings share tst_settings). */
const uniqueTables = () => [...new Map(TABLES.map(t => [t.table, t])).values()];

export interface StoreSession {
  data: Db;
  save(): Promise<void>;
  close(): Promise<void>;
}

const KV_PREFIX = 'main:';
const KV_BACKUP = 'backup-main:';
const LAYOUT_KEY = 'storage_layout';
/** Per collection: row key → the JSON last read from / written to the database. */
type Snapshot = Map<string, Map<string, string>>;
const cache = globalThis as unknown as { __tstMain?: { data: Db; version: number; snap: Snapshot; kv: Map<string, string> } };

/** Reads every table into memory (the application works on plain objects; see db.ts). */
async function loadAll(conn: PoolConnection): Promise<{ data: Db; snap: Snapshot; kv: Map<string, string> }> {
  const data: Db = {};
  const snap: Snapshot = new Map();
  for (const t of TABLES) {
    const [rows] = await conn.query<RowDataPacket[]>(
      t.shape === 'scalar' ? `SELECT id, data FROM \`${t.table}\` WHERE id = ?` : `SELECT id, data FROM \`${t.table}\` ORDER BY seq ${t.order === 'desc' ? 'DESC' : 'ASC'}`,
      t.shape === 'scalar' ? [t.coll] : []);
    const list: [string, unknown][] = [];
    const m = new Map<string, string>();
    for (const r of rows) {
      try { list.push([String(r.id), JSON.parse(String(r.data))]); m.set(String(r.id), String(r.data)); } catch { /* skip a damaged row */ }
    }
    const v = valueOf(t, list);
    if (v !== undefined) data[t.coll] = v;
    snap.set(t.coll, m);
  }
  // Anything not in the table registry stays in the key-value table.
  const kv = new Map<string, string>();
  const [kvRows] = await conn.query<RowDataPacket[]>('SELECT k, v FROM tst_kv WHERE k LIKE ?', [`${KV_PREFIX}%`]);
  for (const r of kvRows) {
    const key = String(r.k).slice(KV_PREFIX.length);
    if (TABLE_BY_COLL.has(key)) continue;
    try { data[key] = JSON.parse(String(r.v)); kv.set(key, String(r.v)); } catch { /* skip */ }
  }
  return { data, snap, kv };
}

const CHUNK = 200;

interface Diff { t: TableDef; next: Map<string, string>; upserts: unknown[][]; deletes: string[] }

/** The rows of one collection that changed since the snapshot. */
function diffTable(t: TableDef, value: unknown, prev: Map<string, string>): Diff {
  const next = new Map<string, string>();
  const upserts: unknown[][] = [];
  for (const [key, rec] of rowsOf(t, value)) {
    const json = JSON.stringify(rec);
    if (json === undefined) continue;
    next.set(key, json);
    if (prev.get(key) !== json) upserts.push([key, ...t.cols.map(col => colValue(col, rec, key)), json]);
  }
  return { t, next, upserts, deletes: [...prev.keys()].filter(k => !next.has(k)) };
}

async function applyDiff(conn: PoolConnection, { t, upserts, deletes }: Diff): Promise<void> {
  const colNames = ['id', ...t.cols.map(col => col.name), 'data'].map(n => `\`${n}\``);
  const update = colNames.slice(1).map(n => `${n} = VALUES(${n})`).join(', ');
  const ph = `(${colNames.map(() => '?').join(', ')})`;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const part = upserts.slice(i, i + CHUNK);
    await conn.query(`INSERT INTO \`${t.table}\` (${colNames.join(', ')}) VALUES ${part.map(() => ph).join(', ')} ON DUPLICATE KEY UPDATE ${update}`, part.flat());
  }
  for (let i = 0; i < deletes.length; i += CHUNK) {
    const part = deletes.slice(i, i + CHUNK);
    await conn.query(`DELETE FROM \`${t.table}\` WHERE id IN (${part.map(() => '?').join(', ')})`, part);
  }
}

/**
 * One-time move from the old layout (every collection as one JSON value in tst_kv) to the tables.
 * Runs inside the store lock; the old values are kept in tst_kv under "backup-main:<name>".
 */
async function migrateFromKv(conn: PoolConnection): Promise<boolean> {
  const [done] = await conn.query<RowDataPacket[]>('SELECT data FROM tst_settings WHERE id = ?', [LAYOUT_KEY]);
  if (done.length) return false;
  const [rows] = await conn.query<RowDataPacket[]>('SELECT k, v FROM tst_kv WHERE k LIKE ?', [`${KV_PREFIX}%`]);
  const old: Db = {};
  for (const r of rows) { const key = String(r.k).slice(KV_PREFIX.length); if (TABLE_BY_COLL.has(key)) try { old[key] = JSON.parse(String(r.v)); } catch { /* skip */ } }
  await conn.beginTransaction();
  try {
    let moved = 0;
    for (const t of TABLES) {
      if (old[t.coll] === undefined) continue;
      // Old newest-first lists: insert oldest first so the newest gets the highest seq.
      const value = t.order === 'desc' && Array.isArray(old[t.coll]) ? [...(old[t.coll] as unknown[])].reverse() : old[t.coll];
      const d = diffTable(t, value, new Map());
      await applyDiff(conn, d);
      moved += d.next.size;
    }
    for (const r of rows) {
      const key = String(r.k).slice(KV_PREFIX.length);
      if (!TABLE_BY_COLL.has(key)) continue;
      await conn.query('INSERT INTO tst_kv (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [KV_BACKUP + key, String(r.v)]);
      await conn.query('DELETE FROM tst_kv WHERE k = ?', [String(r.k)]);
    }
    await conn.query('INSERT INTO tst_settings (id, data) VALUES (?, ?)', [LAYOUT_KEY, JSON.stringify({ layout: 'tables', migratedAt: new Date().toISOString(), fromKvRows: rows.length, rows: moved })]);
    await conn.query('UPDATE tst_meta SET version = version + 1 WHERE id = 1');
    await conn.commit();
    if (rows.length) console.log(`[TheSchoolTeacher] Moved ${moved} records from tst_kv into ${TABLES.length} tables (old values kept as ${KV_BACKUP}*).`);
    return true;
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  }
}

/** Opens the main store with an exclusive lock (MySQL GET_LOCK, so it also holds across server processes). */
export async function openStore(): Promise<StoreSession> {
  if (backend() === 'file') return openFileStore();
  await ensureSchema();
  const conn: PoolConnection = await (await pool()).getConnection();
  try {
    const [lk] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK('tst_store', 20) AS ok");
    if (!lk[0]?.ok) throw new Error('The database is busy. Please try again.');
    if (!g.__tstMigrated) { if (await migrateFromKv(conn)) cache.__tstMain = undefined; g.__tstMigrated = true; }
    const [vr] = await conn.query<RowDataPacket[]>('SELECT version FROM tst_meta WHERE id = 1');
    const version = Number(vr[0]?.version || 0);
    if (!cache.__tstMain || cache.__tstMain.version !== version) cache.__tstMain = { ...(await loadAll(conn)), version };
    const { data, snap, kv } = cache.__tstMain;
    let released = false;
    return {
      data,
      async save() {
        const diffs = TABLES.map(t => diffTable(t, data[t.coll], snap.get(t.coll)!)).filter(d => d.upserts.length || d.deletes.length);
        const kvWrites: [string, string][] = [];
        const kvDeletes: string[] = [];
        for (const key of Object.keys(data)) {
          if (TABLE_BY_COLL.has(key) || data[key] === undefined) continue;
          const v = JSON.stringify(data[key]);
          if (kv.get(key) !== v) kvWrites.push([key, v]);
        }
        for (const key of kv.keys()) if (data[key] === undefined) kvDeletes.push(key);
        if (!diffs.length && !kvWrites.length && !kvDeletes.length) return;
        await conn.beginTransaction();
        try {
          for (const d of diffs) await applyDiff(conn, d);
          for (const [key, v] of kvWrites) await conn.query('INSERT INTO tst_kv (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [KV_PREFIX + key, v]);
          for (const key of kvDeletes) await conn.query('DELETE FROM tst_kv WHERE k = ?', [KV_PREFIX + key]);
          await conn.query('UPDATE tst_meta SET version = version + 1 WHERE id = 1');
          const [nv] = await conn.query<RowDataPacket[]>('SELECT version FROM tst_meta WHERE id = 1');
          await conn.commit();
          for (const d of diffs) snap.set(d.t.coll, d.next);
          for (const [key, v] of kvWrites) kv.set(key, v);
          for (const key of kvDeletes) kv.delete(key);
          cache.__tstMain = { data, version: Number(nv[0]?.version || 0), snap, kv };
        } catch (e) {
          await conn.rollback().catch(() => undefined);
          cache.__tstMain = undefined; // reload from the database next time
          throw e;
        }
      },
      async close() {
        if (released) return;
        released = true;
        await conn.query("SELECT RELEASE_LOCK('tst_store')").catch(() => undefined);
        conn.release();
      },
    };
  } catch (e) {
    await conn.query("SELECT RELEASE_LOCK('tst_store')").catch(() => undefined);
    conn.release();
    throw e;
  }
}

const fileCache = globalThis as unknown as { __tstFileDb?: { file: string; data: Db; mtimeMs: number; json: string } };

async function openFileStore(): Promise<StoreSession> {
  const file = dbFile();
  let mtimeMs = 0;
  try { mtimeMs = statSync(file).mtimeMs; } catch { /* no file yet */ }
  const hit = fileCache.__tstFileDb;
  let data: Db;
  let json: string;
  if (hit && hit.file === file && hit.mtimeMs === mtimeMs && mtimeMs !== 0) ({ data, json } = hit);
  else {
    try { json = await fs.readFile(file, 'utf8'); data = JSON.parse(json); } catch { data = {}; json = ''; }
    fileCache.__tstFileDb = { file, data, mtimeMs, json };
  }
  return {
    data,
    async save() {
      const next = JSON.stringify(data);
      if (next === fileCache.__tstFileDb?.json && mtimeMs !== 0) return;
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, next, 'utf8');
      await fs.rename(tmp, file);
      mtimeMs = statSync(file).mtimeMs;
      fileCache.__tstFileDb = { file, data, mtimeMs, json: next };
    },
    async close() { /* nothing to release */ },
  };
}

// ------------------------------------------------------------------ blobs (documents, photos)

/** Blob ids look like "documents/<userId>/<file>" (also their path under ./data). */
function blobPath(id: string): string {
  const parts = id.split('/').map(p => path.basename(p)).filter(p => p && p !== '..' && p !== '.');
  return path.join(dataDir(), 'blobs', ...parts);
}

export async function putBlob(id: string, mime: string, bytes: Buffer): Promise<void> {
  if (backend() === 'file') {
    const file = blobPath(id);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    return;
  }
  await ensureSchema();
  await (await pool()).query('INSERT INTO tst_blobs (id, mime, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE mime = VALUES(mime), data = VALUES(data)', [id, mime, bytes]);
}

export async function getBlob(id: string): Promise<Buffer | null> {
  if (backend() === 'file') {
    try { return await fs.readFile(blobPath(id)); } catch { return null; }
  }
  await ensureSchema();
  const [rows] = await (await pool()).query<RowDataPacket[]>('SELECT data FROM tst_blobs WHERE id = ?', [id]);
  return rows.length ? (rows[0].data as Buffer) : null;
}

export async function deleteBlobPrefix(prefix: string): Promise<void> {
  if (backend() === 'file') { await fs.rm(blobPath(prefix), { recursive: true, force: true }).catch(() => undefined); return; }
  await ensureSchema();
  await (await pool()).query('DELETE FROM tst_blobs WHERE id LIKE ?', [`${prefix.replace(/[%_\\]/g, '\\$&')}%`]);
}

/** Health information for the admin console. */
export async function storageStatus(): Promise<{ backend: Backend; ok: boolean; error?: string; rows?: number; blobs?: number; tables?: { table: string; rows: number }[] }> {
  if (backend() === 'file') return { backend: 'file', ok: true };
  try {
    await ensureSchema();
    const p = await pool();
    let rows = 0;
    const tables: { table: string; rows: number }[] = [];
    for (const t of uniqueTables()) {
      const [a] = await p.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${t.table}\``);
      tables.push({ table: t.table, rows: Number(a[0].n) });
      rows += Number(a[0].n);
    }
    const [b] = await p.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM tst_blobs');
    return { backend: 'mysql', ok: true, rows, blobs: Number(b[0].n), tables };
  } catch (e) {
    return { backend: 'mysql', ok: false, error: (e as Error).message };
  }
}

/** Runs a query on the MySQL pool (after the schema exists). Only for backend() === 'mysql'. */
export async function sql<T = RowDataPacket[]>(query: string, params: unknown[] = []): Promise<T> {
  await ensureSchema();
  const [rows] = await (await pool()).query(query, params);
  return rows as T;
}

/** Test helper: create the tables again on next use (after the test runner dropped them). */
export function resetSchema(): void {
  g.__tstSchema = undefined;
  cache.__tstMain = undefined;
  g.__tstMigrated = false;
}

/** Test helper: forget cached data (e.g. after pointing TST_DATA_DIR somewhere else). */
export function resetCaches(): void {
  cache.__tstMain = undefined;
  fileCache.__tstFileDb = undefined;
  g.__tstMigrated = false;
}
