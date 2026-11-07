import { promises as fs, statSync } from 'fs';
import path from 'path';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

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
 *  - the main store: collections such as users, sessions, master data (key → JSON value);
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

const g = globalThis as unknown as { __tstPool?: Pool; __tstSchema?: Promise<void> };

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
  })().catch(e => { g.__tstSchema = undefined; throw e; });
  return g.__tstSchema;
}

export interface StoreSession {
  data: Db;
  save(): Promise<void>;
  close(): Promise<void>;
}

const MAIN_PREFIX = 'main:';
const cache = globalThis as unknown as { __tstMain?: { data: Db; version: number; json: Map<string, string> } };

/** Opens the main store with an exclusive lock (MySQL GET_LOCK, so it also holds across server processes). */
export async function openStore(): Promise<StoreSession> {
  if (backend() === 'file') return openFileStore();
  await ensureSchema();
  const conn: PoolConnection = await (await pool()).getConnection();
  try {
    const [lk] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK('tst_store', 20) AS ok");
    if (!lk[0]?.ok) throw new Error('The database is busy. Please try again.');
    const [vr] = await conn.query<RowDataPacket[]>('SELECT version FROM tst_meta WHERE id = 1');
    const version = Number(vr[0]?.version || 0);
    let data: Db;
    let json: Map<string, string>;
    if (cache.__tstMain && cache.__tstMain.version === version) {
      ({ data, json } = cache.__tstMain);
    } else {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT k, v FROM tst_kv WHERE k LIKE ?', [`${MAIN_PREFIX}%`]);
      data = {};
      json = new Map();
      for (const r of rows) {
        const key = String(r.k).slice(MAIN_PREFIX.length);
        try { data[key] = JSON.parse(String(r.v)); json.set(key, String(r.v)); } catch { /* skip a damaged row */ }
      }
      cache.__tstMain = { data, version, json };
    }
    let released = false;
    return {
      data,
      async save() {
        // Only collections whose JSON changed are written.
        const writes: [string, string][] = [];
        const deletes: string[] = [];
        for (const key of Object.keys(data)) {
          if (data[key] === undefined) continue;
          const v = JSON.stringify(data[key]);
          if (json.get(key) !== v) writes.push([key, v]);
        }
        for (const key of json.keys()) if (data[key] === undefined) deletes.push(key);
        if (!writes.length && !deletes.length) return;
        await conn.beginTransaction();
        try {
          for (const [key, v] of writes) await conn.query('INSERT INTO tst_kv (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [MAIN_PREFIX + key, v]);
          for (const key of deletes) await conn.query('DELETE FROM tst_kv WHERE k = ?', [MAIN_PREFIX + key]);
          await conn.query('UPDATE tst_meta SET version = version + 1 WHERE id = 1');
          const [nv] = await conn.query<RowDataPacket[]>('SELECT version FROM tst_meta WHERE id = 1');
          await conn.commit();
          for (const [key, v] of writes) json.set(key, v);
          for (const key of deletes) json.delete(key);
          cache.__tstMain = { data, version: Number(nv[0]?.version || 0), json };
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
export async function storageStatus(): Promise<{ backend: Backend; ok: boolean; error?: string; rows?: number; blobs?: number }> {
  if (backend() === 'file') return { backend: 'file', ok: true };
  try {
    await ensureSchema();
    const p = await pool();
    const [a] = await p.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM tst_kv');
    const [b] = await p.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM tst_blobs');
    return { backend: 'mysql', ok: true, rows: Number(a[0].n), blobs: Number(b[0].n) };
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

/** Test helper: forget cached data (e.g. after pointing TST_DATA_DIR somewhere else). */
export function resetCaches(): void {
  cache.__tstMain = undefined;
  fileCache.__tstFileDb = undefined;
}
