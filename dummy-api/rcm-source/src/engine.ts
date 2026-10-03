import { audit, db, nextRef, nowIso, todayUtc } from './db';
import { BRANCHES, FieldDef, RESOURCE_MAP, ResourceDef, humanize, scopeSql, tableName } from './registry';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors?: Record<string, string>) { super(message); }
}

export interface Row {
  id: number; ref: string; status: string; title: string; patient_id: number | null; branch: string | null; currency: string;
  amount_minor: number; balance_minor: number; due_date: string | null; assignee_id: number | null; priority: string | null;
  data: string; row_version: number; created_by: number; created_at: string; updated_by: number; updated_at: string;
  status_by: number; status_at: string; reason: string | null;
}

/** Field keys stored in dedicated columns (everything else lives in the JSON data column). */
const COLUMN_KEYS = ['patient', 'branch', 'amount', 'balance', 'dueDate', 'assignee', 'priority'] as const;

export const toMinor = (v: unknown) => Math.round(Number(v ?? 0) * 100);
export const toMajor = (m: number) => Math.round(m) / 100;

export function getRes(key: string): ResourceDef {
  const r = RESOURCE_MAP.get(key);
  if (!r) throw new HttpError(404, 'UNKNOWN_PAGE', `There is no workspace page called “${key}”.`);
  return r;
}

export function loadRow(res: ResourceDef, id: number): Row {
  const row = db.prepare(`SELECT * FROM ${tableName(res.key)} WHERE id = ?`).get(id) as Row | undefined;
  if (!row) throw new HttpError(404, 'NOT_FOUND', `That ${res.singular} was not found.`);
  return row;
}

/** Row → flat values object keyed by field key. */
export function valuesOf(row: Row): Record<string, any> {
  return {
    ...JSON.parse(row.data),
    patient: row.patient_id, branch: row.branch, amount: toMajor(row.amount_minor), balance: toMajor(row.balance_minor),
    dueDate: row.due_date, assignee: row.assignee_id, priority: row.priority,
  };
}

/** Flat values → column values and JSON data. */
function split(values: Record<string, any>) {
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(values)) if (!(COLUMN_KEYS as readonly string[]).includes(k) && v !== undefined) data[k] = v;
  const branch = values.branch ?? null;
  return {
    patient_id: values.patient ?? null, branch, amount_minor: toMinor(values.amount), balance_minor: toMinor(values.balance),
    due_date: values.dueDate || null, assignee_id: values.assignee ?? null, priority: values.priority ?? null,
    currency: BRANCHES.find((b) => b.value === branch)?.currency ?? 'SAR', data: JSON.stringify(data),
  };
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

const LOOKUP_SQL: Record<string, string> = {
  patients: `SELECT id, name AS label, mrn AS hint FROM ref_patient`,
  payers: `SELECT id, name AS label, code AS hint FROM ref_payer`,
  plans: `SELECT id, name AS label, code AS hint FROM ref_plan`,
  items: `SELECT id, name AS label, code AS hint FROM ref_item`,
  accounts: `SELECT id, number || ' ' || name AS label, '' AS hint FROM ref_account`,
  contracts: `SELECT id, name AS label, code AS hint FROM ref_contract`,
  users: `SELECT id, name AS label, title AS hint FROM app_user`,
};

export function labelFor(source: string | undefined, id: unknown): string | null {
  if (id === null || id === undefined || id === '' || !source) return null;
  if (source.startsWith('res:')) {
    const r = db.prepare(`SELECT ref, title FROM ${tableName(source.slice(4))} WHERE id = ?`).get(id) as { ref: string; title: string } | undefined;
    return r ? r.ref : `#${id}`;
  }
  const sql = LOOKUP_SQL[source];
  const r = sql ? (db.prepare(`${sql} WHERE id = ?`).get(id) as { label: string } | undefined) : undefined;
  return r?.label ?? `#${id}`;
}

export function options(source: string, q?: string, branch?: string) {
  if (source.startsWith('res:')) {
    const res = getRes(source.slice(4));
    const where: string[] = [];
    const p: unknown[] = [];
    if (q) { where.push('(ref LIKE ? OR title LIKE ? OR patient_id IN (SELECT id FROM ref_patient WHERE name LIKE ?))'); p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    where.push(scopeSql(branch));
    const rows = db.prepare(`SELECT id, ref, title, status, patient_id, balance_minor, currency FROM ${tableName(res.key)} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 60`).all(...p) as any[];
    return rows.map((r) => {
      const pat = r.patient_id ? (db.prepare('SELECT name FROM ref_patient WHERE id = ?').get(r.patient_id) as { name: string } | undefined)?.name : null;
      const st = res.statuses.find((s) => s.key === r.status)?.label ?? r.status;
      return { value: String(r.id), label: `${r.ref}${pat ? `  ${pat}` : r.title ? `  ${r.title}` : ''}`, hint: `${st}${r.balance_minor ? `, ${r.currency} ${(r.balance_minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} due` : ''}` };
    });
  }
  const sql = LOOKUP_SQL[source];
  if (!sql) throw new HttpError(404, 'UNKNOWN_SOURCE', `Unknown lookup ${source}.`);
  const rows = (q
    ? db.prepare(`SELECT * FROM (${sql}) WHERE label LIKE ? OR hint LIKE ? ORDER BY label LIMIT 60`).all(`%${q}%`, `%${q}%`)
    : db.prepare(`SELECT * FROM (${sql}) ORDER BY label LIMIT 200`).all()) as { id: number; label: string; hint: string }[];
  return rows.map((r) => ({ value: String(r.id), label: r.label, hint: r.hint }));
}

function titleOf(res: ResourceDef, v: Record<string, any>): string {
  const f = res.fields.find((x) => x.key === res.titleField);
  if (!f) return '';
  const raw = v[f.key];
  if (raw === undefined || raw === null || raw === '') return '';
  if (f.type === 'ref') return labelFor(f.source, raw) ?? '';
  if (f.type === 'select') return f.options?.find((o) => o.value === raw)?.label ?? humanize(String(raw));
  return String(raw);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

function refExists(source: string, id: number) {
  if (source.startsWith('res:')) return Boolean(db.prepare(`SELECT 1 FROM ${tableName(source.slice(4))} WHERE id = ?`).get(id));
  const table = { patients: 'ref_patient', payers: 'ref_payer', plans: 'ref_plan', items: 'ref_item', accounts: 'ref_account', contracts: 'ref_contract', users: 'app_user' }[source];
  return table ? Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)) : false;
}

export function coerce(f: FieldDef, raw: unknown): [unknown, string | null] {
  if (empty(raw)) return [f.type === 'tags' || f.type === 'multiselect' || f.type === 'lines' ? [] : null, null];
  switch (f.type) {
    case 'text': case 'textarea': {
      const s = String(raw).trim();
      return s.length > (f.type === 'text' ? 200 : 4000) ? [s, 'This is too long.'] : [s, null];
    }
    case 'number': {
      const n = Number(raw);
      if (!Number.isInteger(n)) return [raw, 'Enter a whole number.'];
      if (f.min !== undefined && n < f.min) return [n, `Must be at least ${f.min}.`];
      if (f.max !== undefined && n > f.max) return [n, `Must be at most ${f.max}.`];
      return [n, null];
    }
    case 'decimal': case 'money': case 'percent': {
      const n = Number(String(raw).replace(/,/g, ''));
      if (!Number.isFinite(n)) return [raw, 'Enter a number.'];
      if (f.type === 'money' && n < 0) return [n, 'Amounts cannot be negative.'];
      if (f.type === 'percent' && (n < 0 || n > 100)) return [n, 'Enter 0 to 100.'];
      return [f.type === 'money' ? Math.round(n * 100) / 100 : n, null];
    }
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(String(raw)) ? [String(raw), null] : [raw, 'Use the YYYY-MM-DD format.'];
    case 'boolean': return [raw === true || raw === 'true', null];
    case 'select': return f.options?.some((o) => o.value === raw) ? [raw, null] : [raw, 'Choose one of the listed options.'];
    case 'multiselect': return Array.isArray(raw) ? [raw, null] : [raw, 'Expected a list.'];
    case 'tags': {
      const arr = (Array.isArray(raw) ? raw : String(raw).split(',')).map((x) => String(x).trim()).filter(Boolean);
      return [[...new Set(arr)], null];
    }
    case 'ref': {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) return [raw, 'Choose a record.'];
      return refExists(f.source!, id) ? [id, null] : [id, 'That record no longer exists.'];
    }
    case 'lines': return Array.isArray(raw) ? [raw, null] : [raw, 'Expected rows.'];
  }
}

function validate(res: ResourceDef, input: Record<string, any>, fields: FieldDef[]) {
  const out: Record<string, any> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const [v, err] = coerce(f, input[f.key]);
    if (err) errors[f.key] = err;
    else if (f.required && empty(v)) errors[f.key] = `${f.label} is required.`;
    if (!empty(v) || f.type === 'boolean') out[f.key] = v;
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'VALIDATION', 'Check the highlighted fields.', errors);
  return out;
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

export function toDto(res: ResourceDef, row: Row) {
  const values = valuesOf(row);
  const labels: Record<string, string> = {};
  for (const f of res.fields) if (f.type === 'ref' && values[f.key]) labels[f.key] = labelFor(f.source, values[f.key]) ?? '';
  const pat = row.patient_id ? (db.prepare('SELECT name, mrn FROM ref_patient WHERE id = ?').get(row.patient_id) as { name: string; mrn: string } | undefined) : undefined;
  return {
    id: row.id, ref: row.ref, status: row.status, title: row.title, currency: row.currency,
    patient: pat ? { id: row.patient_id, name: pat.name, mrn: pat.mrn } : null,
    branch: row.branch, amount: toMajor(row.amount_minor), balance: toMajor(row.balance_minor), dueDate: row.due_date,
    assignee: row.assignee_id, priority: row.priority, values, labels, rowVersion: row.row_version,
    createdBy: row.created_by, createdAt: row.created_at, updatedBy: row.updated_by, updatedAt: row.updated_at,
    statusBy: row.status_by, statusAt: row.status_at, reason: row.reason,
  };
}

const SORTS: Record<string, string> = { ref: 'id', status: 'status', amount: 'amount_minor', balance: 'balance_minor', due: 'due_date', updated: 'updated_at', created: 'created_at' };

function scope(branch?: string) {
  return { sql: scopeSql(branch), p: {} };
}

export function kpis(res: ResourceDef, branch?: string) {
  const t = tableName(res.key);
  const sc = scope(branch);
  return res.kpis.map((k) => {
    const where = [sc.sql];
    const p: Record<string, unknown> = { ...sc.p, today: todayUtc() };
    if (k.statuses) where.push(`status IN (${k.statuses.map((s) => `'${s}'`).join(',')})`);
    if (k.overdue) where.push(`due_date IS NOT NULL AND due_date < @today`);
    if (k.today) where.push(`substr(created_at, 1, 10) = @today`);
    const agg = k.metric === 'count' ? 'COUNT(*)' : k.metric === 'amount' ? 'COALESCE(SUM(amount_minor),0)' : 'COALESCE(SUM(balance_minor),0)';
    const r = db.prepare(`SELECT ${agg} v, COUNT(*) n FROM ${t} WHERE ${where.join(' AND ')}`).get(p) as { v: number; n: number };
    return { label: k.label, metric: k.metric, tone: k.tone ?? null, value: k.metric === 'count' ? r.v : toMajor(r.v), count: r.n, statuses: k.statuses ?? null, overdue: !!k.overdue };
  });
}

export function list(res: ResourceDef, q: { search?: string; status?: string; branch?: string; page?: number; pageSize?: number; sort?: string; dir?: string; overdue?: boolean; assignee?: number }) {
  const t = tableName(res.key);
  const where: string[] = [];
  const p: Record<string, unknown> = { today: todayUtc() };
  where.push(scopeSql(q.branch));
  if (q.search) {
    where.push('(ref LIKE @s OR title LIKE @s OR data LIKE @s OR patient_id IN (SELECT id FROM ref_patient WHERE name LIKE @s OR mrn LIKE @s))');
    p.s = `%${q.search}%`;
  }
  if (q.assignee) { where.push('assignee_id = @assignee'); p.assignee = q.assignee; }
  const base = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const counts = Object.fromEntries((db.prepare(`SELECT status, COUNT(*) n FROM ${t} ${base} GROUP BY status`).all(p) as { status: string; n: number }[]).map((r) => [r.status, r.n]));
  if (q.status && q.status !== 'ALL') {
    const sts = q.status.split(',').filter((s) => res.statuses.some((x) => x.key === s));
    if (sts.length) where.push(`status IN (${sts.map((s) => `'${s}'`).join(',')})`);
  }
  if (q.overdue) where.push('due_date IS NOT NULL AND due_date < @today');
  const filtered = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (db.prepare(`SELECT COUNT(*) n FROM ${t} ${filtered}`).get(p) as { n: number }).n;
  const pageSize = Math.min(Math.max(Number(q.pageSize) || 30, 5), 300);
  const page = Math.max(Number(q.page) || 1, 1);
  const col = SORTS[q.sort ?? ''] ?? 'updated_at';
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const rows = db.prepare(`SELECT * FROM ${t} ${filtered} ORDER BY ${col} IS NULL, ${col} ${dir}, id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...p, limit: pageSize, offset: (page - 1) * pageSize }) as Row[];
  return { rows: rows.map((r) => toDto(res, r)), total, page, pageSize, counts, kpis: kpis(res, q.branch) };
}

export function get(res: ResourceDef, id: number) {
  const row = loadRow(res, id);
  const timeline = db.prepare(`SELECT id, at, actor_id actorId, action, from_status "from", to_status "to", summary, reason FROM audit_event WHERE resource = ? AND record_id = ? ORDER BY at DESC, id DESC`).all(res.key, id);
  return { ...toDto(res, row), timeline };
}

/* ------------------------------------------------------------------ */
/* Write                                                               */
/* ------------------------------------------------------------------ */

/** Records attached to another record inherit its branch, so scoping and currency follow the source document. */
const PARENTS: [string, string][] = [['invoice', 'invoices'], ['claim', 'claims'], ['encounter', 'encounters'], ['remittance', 'remittances']];
function inheritBranch(values: Record<string, any>) {
  if (values.branch) return;
  for (const [k, r] of PARENTS) {
    if (!values[k]) continue;
    const row = db.prepare(`SELECT branch FROM ${tableName(r)} WHERE id = ?`).get(values[k]) as { branch: string | null } | undefined;
    if (row?.branch) { values.branch = row.branch; return; }
  }
}

export function insertRecord(res: ResourceDef, values: Record<string, any>, opts: { status?: string; actorId: number; at?: string; ref?: string; reason?: string | null; statusBy?: number }) {
  const t = tableName(res.key);
  inheritBranch(values);
  const at = opts.at ?? nowIso();
  const cols = split(values);
  const status = opts.status ?? res.initial;
  const ref = opts.ref ?? nextRef(res.prefix);
  const info = db.prepare(`INSERT INTO ${t} (ref, status, title, patient_id, branch, currency, amount_minor, balance_minor, due_date, assignee_id, priority, data,
      created_by, created_at, updated_by, updated_at, status_by, status_at, reason)
    VALUES (@ref, @status, @title, @patient_id, @branch, @currency, @amount_minor, @balance_minor, @due_date, @assignee_id, @priority, @data,
      @actor, @at, @actor, @at, @statusBy, @at, @reason)`)
    .run({ ...cols, ref, status, title: titleOf(res, values), actor: opts.actorId, statusBy: opts.statusBy ?? opts.actorId, at, reason: opts.reason ?? null });
  return Number(info.lastInsertRowid);
}

export function writeValues(res: ResourceDef, id: number, values: Record<string, any>, actorId: number, status?: string, reason?: string | null) {
  const cols = split(values);
  const now = nowIso();
  db.prepare(`UPDATE ${tableName(res.key)} SET title=@title, patient_id=@patient_id, branch=@branch, currency=@currency, amount_minor=@amount_minor, balance_minor=@balance_minor,
      due_date=@due_date, assignee_id=@assignee_id, priority=@priority, data=@data, row_version=row_version+1, updated_by=@actor, updated_at=@now
      ${status ? ', status=@status, status_by=@actor, status_at=@now, reason=@reason' : ''} WHERE id=@id`)
    .run({ ...cols, title: titleOf(res, values), actor: actorId, now, id, status, reason: reason ?? null });
}

/** Derived values recomputed on every create and edit. */
export const derive: Record<string, (v: Record<string, any>, creating: boolean) => void> = {
  charges: (v) => { if (v.unitPrice !== undefined && v.quantity) v.amount = round2(v.unitPrice * v.quantity); },
  'manual-charges': (v) => { v.amount = round2((v.unitPrice ?? 0) * (v.quantity ?? 0)); },
  deposits: (v, c) => { if (c) v.balance = v.amount; },
  receipts: (v, c) => { if (c) { v.balance = v.amount; v.allocations = []; } },
  packages: (v, c) => { if (c) { v.sessionsUsed = 0; v.balance = v.amount; } },
  'payment-plans': (v, c) => { if (c) v.balance = v.amount; },
  'cash-sessions': (v) => { if (Array.isArray(v.tenders)) v.amount = round2(v.tenders.filter((x: any) => x.method === 'CASH').reduce((s: number, x: any) => s + Number(x.total || 0), 0)); },
  'payer-reconciliations': (v) => { v.variance = round2((v.receivedAmount ?? 0) - (v.amount ?? 0)); },
};
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function create(res: ResourceDef, body: any, actorId: number, defaultBranch?: string) {
  if (!res.create) throw new HttpError(405, 'NOT_CREATABLE', `${cap(res.label)} are created by the system, not by hand.`);
  const input = { ...(body.values ?? {}) };
  if (!input.branch && defaultBranch && res.fields.some((f) => f.key === 'branch')) input.branch = defaultBranch;
  const values = validate(res, input, res.fields.filter((f) => !f.readonly));
  derive[res.key]?.(values, true);
  const id = insertRecord(res, values, { actorId });
  const row = loadRow(res, id);
  audit({ actorId, resource: res.key, recordId: id, recordRef: row.ref, action: 'CREATED', to: row.status, summary: `Created ${res.singular} ${row.ref}${row.title ? ` (${row.title})` : ''}.` });
  return get(res, id);
}

export function update(res: ResourceDef, id: number, body: any, actorId: number) {
  const row = loadRow(res, id);
  assertVersion(row, body.rowVersion);
  if (!res.editable.includes(row.status)) throw new HttpError(409, 'LOCKED', `A ${res.singular} that is ${statusLabel(res, row.status).toLowerCase()} can’t be edited. Use the actions instead.`);
  const editable = res.fields.filter((f) => !f.readonly);
  const next = validate(res, { ...valuesOf(row), ...(body.values ?? {}) }, editable);
  const values = { ...valuesOf(row), ...next };
  for (const f of editable) if (!(f.key in next)) delete values[f.key];
  derive[res.key]?.(values, false);
  writeValues(res, id, values, actorId);
  audit({ actorId, resource: res.key, recordId: id, recordRef: row.ref, action: 'UPDATED', summary: `Edited ${row.ref}.` });
  return get(res, id);
}

export function assertVersion(row: Row, expected: unknown) {
  if (expected === undefined || expected === null) throw new HttpError(428, 'VERSION_REQUIRED', 'Reload the record and try again.');
  if (Number(expected) !== row.row_version) throw new HttpError(409, 'STALE_VERSION', 'Someone else changed this record a moment ago. It has been reloaded; check it and try again.');
}

export const statusLabel = (res: ResourceDef, s: string) => res.statuses.find((x) => x.key === s)?.label ?? humanize(s);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export interface EffectCtx {
  res: ResourceDef; row: Row; values: Record<string, any>; input: Record<string, any>; actorId: number; reason: string | null;
}
export type Effect = (ctx: EffectCtx) => { status?: string; summary?: string } | void;
let EFFECTS: Record<string, Effect> = {};
export const registerEffects = (e: Record<string, Effect>) => { EFFECTS = e; };

export function act(res: ResourceDef, id: number, actionKey: string, body: any, actorId: number) {
  const action = res.actions.find((a) => a.key === actionKey);
  if (!action) throw new HttpError(400, 'UNKNOWN_ACTION', `“${actionKey}” is not an action on ${res.label.toLowerCase()}.`);
  return db.transaction(() => {
    const row = loadRow(res, id);
    assertVersion(row, body.rowVersion);
    if (!action.from.includes(row.status))
      throw new HttpError(409, 'INVALID_TRANSITION', `You can’t “${action.label.toLowerCase()}” while the ${res.singular} is ${statusLabel(res, row.status).toLowerCase()}.`);
    if (action.independent && (actorId === row.created_by || actorId === row.status_by))
      throw new HttpError(403, 'INDEPENDENCE_REQUIRED', 'A different person must do this. You created this record or moved it to its current step.');
    const reason: string | null = (body.reason ?? '').trim() || null;
    if (action.reason === 'required' && !reason) throw new HttpError(422, 'REASON_REQUIRED', 'Give a reason for this action.', { reason: 'A reason is required.' });
    const input = action.inputs ? validate(res, body.input ?? {}, action.inputs) : {};

    const values = valuesOf(row);
    for (const [k, v] of Object.entries(input)) if (res.fields.some((f) => f.key === k)) values[k] = v;
    const out = EFFECTS[`${res.key}:${action.key}`]?.({ res, row, values, input, actorId, reason }) ?? {};
    const to = out.status ?? (action.to === '*' ? row.status : action.to);
    derive[res.key]?.(values, false);
    writeValues(res, id, values, actorId, to, reason);
    audit({
      actorId, resource: res.key, recordId: id, recordRef: row.ref, action: action.key.toUpperCase().replace(/-/g, '_'), from: row.status, to,
      summary: out.summary ?? `${action.label}: ${row.ref} ${row.status === to ? `stays ${statusLabel(res, to).toLowerCase()}` : `moved from ${statusLabel(res, row.status).toLowerCase()} to ${statusLabel(res, to).toLowerCase()}`}.`,
      reason,
    });
    return get(res, id);
  })();
}
