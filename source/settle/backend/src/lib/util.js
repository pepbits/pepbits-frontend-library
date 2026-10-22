import { db } from '../db.js';

export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'error';
    this.details = details;
  }
}
export const bad = (msg, code = 'invalid', details) => new HttpError(400, msg, code, details);
export const forbidden = (msg) => new HttpError(403, msg, 'forbidden');
export const notFound = (msg) => new HttpError(404, msg, 'not_found');
export const conflict = (msg, code = 'conflict', details) => new HttpError(409, msg, code, details);

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const isZero = (n) => Math.abs(n) < 0.005;
/** Current time. The seed script swaps the clock so demo history lands on realistic dates. */
export const clock = { now: null };
export const nowIso = () => (clock.now ? clock.now() : new Date().toISOString());
export const todayIso = () => new Date().toISOString().slice(0, 10);

export const parseJson = (s, fallback) => {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};

export const asyncRoute = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.then === 'function') out.catch(next);
  } catch (e) { next(e); }
};

/* ---------- Number series ---------- */
const getSeries = db.prepare('SELECT * FROM number_series WHERE key = ?');
const bumpSeries = db.prepare('UPDATE number_series SET next_value = next_value + 1 WHERE key = ?');
/** Consumes the next number in a series. Only call inside the transaction that inserts the row. */
export function nextNumber(key) {
  const s = getSeries.get(key);
  if (!s) throw new Error(`Number series ${key} missing`);
  bumpSeries.run(key);
  return `${s.prefix}${String(s.next_value).padStart(s.pad, '0')}`;
}

/* ---------- Preferences ---------- */
export function pref(key, fallback) {
  const row = db.prepare('SELECT value, kind FROM preferences WHERE key = ?').get(key);
  if (!row) return fallback;
  if (row.kind === 'boolean') return row.value === 'Y';
  if (row.kind === 'number') return Number(row.value);
  return row.value;
}

/* ---------- Audit ---------- */
const insAudit = db.prepare(`INSERT INTO audit_log (entity, entity_id, bill_no, mr_no, action, summary, detail, username, at)
  VALUES (@entity, @entity_id, @bill_no, @mr_no, @action, @summary, @detail, @username, @at)`);
export function audit(user, { entity, id, billNo = null, mrNo = null, action, summary, detail = {} }) {
  insAudit.run({
    entity, entity_id: String(id), bill_no: billNo, mr_no: mrNo, action, summary,
    detail: JSON.stringify(detail), username: user?.username || 'system', at: nowIso(),
  });
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw bad(`Missing ${missing.join(', ')}`, 'missing_fields', { missing });
}
