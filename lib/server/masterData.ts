import type { MasterItem, MasterKind, MetaValue } from '@/types';
import { KIND_MAP, type KindDef } from '@/lib/masterData/kinds';
import { masterId } from '@/lib/masterData/seed';
import { audit, nowIso, type Store } from './db';
import { parseCsv } from '@/lib/csv';

/*
 * Server-side rules for master data: validation, create/update, activate/deactivate and CSV import.
 * Items are never deleted (vacancies and profiles keep pointing at them); they are deactivated.
 */

export interface MasterInput {
  id?: string;
  code?: unknown;
  name?: unknown;
  nameHi?: unknown;
  parentId?: unknown;
  active?: unknown;
  verify?: unknown;
  sortOrder?: unknown;
  meta?: unknown;
}

const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
export const normCode = (v: unknown) => clean(v, 40).toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

export function listMaster(db: Store, kind: MasterKind, opts: { includeInactive?: boolean } = {}): MasterItem[] {
  const list = db.master[kind] || [];
  return list.filter(i => opts.includeInactive || i.active).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function cleanMeta(def: KindDef, raw: unknown): { meta: Record<string, MetaValue>; error?: string } {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const meta: Record<string, MetaValue> = {};
  for (const f of def.meta) {
    const v = src[f.key];
    if (v === undefined || v === null || v === '') { meta[f.key] = f.type === 'boolean' ? false : null; continue; }
    if (f.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) return { meta, error: `${f.label} must be a number.` };
      if (f.min !== undefined && n < f.min) return { meta, error: `${f.label} must be at least ${f.min}.` };
      if (f.max !== undefined && n > f.max) return { meta, error: `${f.label} must be at most ${f.max}.` };
      meta[f.key] = n;
    } else if (f.type === 'boolean') {
      meta[f.key] = v === true || v === 'true' || v === '1' || v === 'yes';
    } else if (f.type === 'select') {
      const s = clean(v, 60);
      if (!f.options?.some(o => o.value === s)) return { meta, error: `${f.label}: choose one of ${f.options?.map(o => o.label).join(', ')}.` };
      meta[f.key] = s;
    } else {
      meta[f.key] = clean(v, 500);
    }
  }
  return { meta };
}

/** Creates or updates one item. Returns the saved item or an error message. */
export function saveMasterItem(db: Store, kind: MasterKind, input: MasterInput, actorId: string | null): { item?: MasterItem; error?: string } {
  const def = KIND_MAP[kind];
  const list = (db.master[kind] ||= []);
  const existing = input.id ? list.find(i => i.id === input.id) : undefined;
  if (input.id && !existing) return { error: 'This item no longer exists.' };

  const code = existing ? existing.code : normCode(input.code);
  const name = clean(input.name, 200);
  if (!code) return { error: 'Code is required (letters, digits and _).' };
  if (!name) return { error: 'Name is required.' };
  if (!existing && list.some(i => i.code === code)) return { error: `The code ${code} is already used in this list.` };

  let parentId: string | null = null;
  if (def.parent) {
    const p = clean(input.parentId, 120);
    if (p) {
      if (!(db.master[def.parent.kind] || []).some(i => i.id === p)) return { error: `${def.parent.label} not found.` };
      parentId = p;
    } else if (def.parent.required) return { error: `${def.parent.label} is required.` };
  }
  const { meta, error } = cleanMeta(def, input.meta);
  if (error) return { error };

  const sortOrder = Number.isFinite(Number(input.sortOrder)) && input.sortOrder !== '' && input.sortOrder !== undefined
    ? Math.round(Number(input.sortOrder))
    : existing?.sortOrder ?? (list.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 10);

  const item: MasterItem = {
    id: existing?.id || masterId(kind, code),
    kind, code, name,
    ...(clean(input.nameHi, 200) ? { nameHi: clean(input.nameHi, 200) } : {}),
    parentId,
    active: input.active === undefined ? existing?.active ?? true : input.active === true || input.active === 'true',
    verify: input.verify === undefined ? existing?.verify ?? false : input.verify === true || input.verify === 'true',
    sortOrder, meta, updatedAt: nowIso(), updatedBy: actorId,
  };
  if (existing) list[list.indexOf(existing)] = item; else list.push(item);
  audit(db, { actorId, action: existing ? 'master.update' : 'master.create', target: item.id, detail: item.name });
  return { item };
}

export function setMasterActive(db: Store, kind: MasterKind, id: string, active: boolean, actorId: string | null): boolean {
  const item = (db.master[kind] || []).find(i => i.id === id);
  if (!item) return false;
  item.active = active;
  item.updatedAt = nowIso();
  item.updatedBy = actorId;
  audit(db, { actorId, action: active ? 'master.activate' : 'master.deactivate', target: id });
  return true;
}

/**
 * Imports CSV rows. Columns: code, name, nameHi, parentCode, sortOrder, active, plus any meta key of
 * the kind (e.g. lgdCode). Existing codes are updated, new codes are added. All-or-nothing.
 */
export function importMasterCsv(db: Store, kind: MasterKind, csv: string, actorId: string | null): { added: number; updated: number; errors: string[] } {
  const def = KIND_MAP[kind];
  const rows = parseCsv(csv);
  if (rows.length < 2) return { added: 0, updated: 0, errors: ['The file needs a header row and at least one data row.'] };
  const header = rows[0].map(h => h.trim());
  const col = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  if (col('code') < 0 || col('name') < 0) return { added: 0, updated: 0, errors: ['The header must include "code" and "name".'] };
  if (rows.length > 20001) return { added: 0, updated: 0, errors: ['At most 20,000 rows per import.'] };

  const parents = def.parent ? db.master[def.parent.kind] || [] : [];
  const byParentCode = new Map(parents.map(p => [p.code, p.id]));
  const snapshot = JSON.stringify(db.master[kind] || []);
  const auditLen = db.audit.length;
  const errors: string[] = [];
  let added = 0, updated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every(c => !c.trim())) continue;
    const get = (name: string) => (col(name) >= 0 ? row[col(name)] ?? '' : undefined);
    const code = normCode(get('code'));
    const existing = (db.master[kind] || []).find(i => i.code === code);
    const parentCode = get('parentCode');
    let parentId: string | undefined;
    if (def.parent && parentCode !== undefined && parentCode.trim()) {
      parentId = byParentCode.get(normCode(parentCode));
      if (!parentId) { errors.push(`Row ${r + 1}: ${def.parent.label} "${parentCode}" not found.`); continue; }
    }
    const meta: Record<string, unknown> = { ...(existing?.meta || {}) };
    for (const f of def.meta) { const v = get(f.key); if (v !== undefined) meta[f.key] = v; }
    const res = saveMasterItem(db, kind, {
      id: existing?.id, code, name: get('name'), nameHi: get('nameHi') ?? existing?.nameHi,
      parentId: parentId ?? existing?.parentId ?? '', sortOrder: get('sortOrder') || undefined,
      active: get('active') !== undefined && get('active') !== '' ? !/^(false|0|no)$/i.test(get('active')!) : undefined, meta,
    }, actorId);
    if (res.error) errors.push(`Row ${r + 1}: ${res.error}`);
    else if (existing) updated++; else added++;
    if (errors.length >= 50) { errors.push('Stopped after 50 errors.'); break; }
  }

  // All-or-nothing: on any error, put the list back as it was.
  db.audit.splice(0, db.audit.length - auditLen);
  if (errors.length) {
    db.master[kind] = JSON.parse(snapshot);
    return { added: 0, updated: 0, errors };
  }
  audit(db, { actorId, action: 'master.import', target: kind, detail: `${added} added, ${updated} updated` });
  return { added, updated, errors };
}

/** Admin-set numeric weights by code (match score, panel dimensions). */
export function weightsOf(db: Store, kind: 'matchWeights' | 'panelDimensions'): Record<string, number> {
  return Object.fromEntries(listMaster(db, kind).map(i => [i.code, Number(i.meta.weight) || 0]));
}
