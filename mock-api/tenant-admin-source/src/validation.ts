import { db } from './db';
import { FieldDef, RESOURCE_MAP, ResourceDef, tableName } from './registry';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

const CODE_RE = /^[A-Z0-9][A-Z0-9_.-]{0,39}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_RE = /^-?\d{1,14}(\.\d{1,6})?$/;

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

function refExists(resourceKey: string, id: number) {
  const row = db.prepare(`SELECT id FROM ${tableName(resourceKey)} WHERE id = ?`).get(id);
  return Boolean(row);
}

/** Coerces one value to its declared type. Returns [value, error]. */
function coerce(f: FieldDef, raw: unknown): [unknown, string | null] {
  if (isEmpty(raw)) return [f.type === 'lines' || f.type === 'tags' || f.type === 'refs' || f.type === 'multiselect' ? [] : null, null];

  switch (f.type) {
    case 'text':
    case 'textarea': {
      const s = String(raw).trim();
      if (s.length > (f.type === 'text' ? 200 : 4000)) return [s, 'This is too long.'];
      if (f.upper && !CODE_RE.test(s)) return [s, 'Use upper-case letters, digits, dot, dash or underscore.'];
      return [s, null];
    }
    case 'number': {
      const n = Number(raw);
      if (!Number.isInteger(n)) return [raw, 'Enter a whole number.'];
      if (f.min !== undefined && n < f.min) return [n, `Must be at least ${f.min}.`];
      if (f.max !== undefined && n > f.max) return [n, `Must be at most ${f.max}.`];
      return [n, null];
    }
    case 'decimal':
    case 'money':
    case 'percent': {
      const s = String(raw).trim();
      if (!DECIMAL_RE.test(s)) return [s, 'Enter a decimal with up to six fractional digits.'];
      const n = Number(s);
      if ((f.type === 'money') && n < 0) return [s, 'Amounts cannot be negative.'];
      if (f.type === 'percent' && (n < 0 || n > 100)) return [s, 'Enter a percentage between 0 and 100.'];
      return [s, null];
    }
    case 'date':
      return DATE_RE.test(String(raw)) ? [String(raw), null] : [raw, 'Use the YYYY-MM-DD format.'];
    case 'boolean':
      return [raw === true || raw === 'true', null];
    case 'select': {
      const s = String(raw);
      return f.options?.some((x) => x.value === s) ? [s, null] : [s, 'Choose one of the listed options.'];
    }
    case 'multiselect': {
      if (!Array.isArray(raw)) return [raw, 'Expected a list.'];
      const vals = [...new Set(raw.map(String))];
      const bad = vals.filter((v) => !f.options?.some((x) => x.value === v));
      return bad.length ? [vals, `Unknown option: ${bad.join(', ')}.`] : [vals, null];
    }
    case 'tags': {
      const arr = Array.isArray(raw) ? raw : String(raw).split(',');
      const vals = [...new Set(arr.map((x) => String(x).trim()).filter(Boolean).map((x) => (f.upper ? x.toUpperCase() : x)))];
      if (f.maxItems && vals.length > f.maxItems) return [vals, `Use at most ${f.maxItems} entries.`];
      if (f.upper) {
        const bad = vals.filter((v) => !/^[A-Z][A-Z0-9_]{0,39}$/.test(v));
        if (bad.length) return [vals, `Codes must start with a letter and use A–Z, 0–9 or underscore: ${bad.join(', ')}.`];
      }
      return [vals, null];
    }
    case 'ref': {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) return [raw, 'Choose a record.'];
      return refExists(f.ref!, id) ? [id, null] : [id, 'The selected record no longer exists.'];
    }
    case 'refs': {
      if (!Array.isArray(raw)) return [raw, 'Expected a list.'];
      const ids = [...new Set(raw.map(Number))];
      if (ids.some((x) => !Number.isInteger(x) || x <= 0)) return [ids, 'Choose valid records.'];
      if (f.maxItems && ids.length > f.maxItems) return [ids, `Use at most ${f.maxItems} records.`];
      const missing = ids.filter((id) => !refExists(f.ref!, id));
      return missing.length ? [ids, 'Some selected records no longer exist.'] : [ids, null];
    }
    case 'lines': {
      if (!Array.isArray(raw)) return [raw, 'Expected rows.'];
      if (f.maxItems && raw.length > f.maxItems) return [raw, `Use at most ${f.maxItems} rows.`];
      const out: Record<string, unknown>[] = [];
      for (let i = 0; i < raw.length; i++) {
        const row: Record<string, unknown> = {};
        for (const c of f.columns ?? []) {
          const [v, err] = coerce(c, (raw[i] as any)?.[c.key]);
          if (err) return [raw, `Row ${i + 1}, ${c.label}: ${err}`];
          if (c.required && isEmpty(v)) return [raw, `Row ${i + 1}: ${c.label} is required.`];
          if (!isEmpty(v)) row[c.key] = v;
        }
        out.push(row);
      }
      return [out, null];
    }
  }
}

export interface CleanResult { data: Record<string, unknown>; errors: Record<string, string> }

/**
 * Validates a payload. `strict` enforces required fields and cross-field rules —
 * used when submitting for approval or saving a simple (non-versioned) record.
 */
export function clean(res: ResourceDef, input: Record<string, unknown>, strict: boolean): CleanResult {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const relaxed = res.relaxRequired?.(input ?? {}) ?? false;
  for (const f of res.fields) {
    const [v, err] = coerce(f, input?.[f.key]);
    const mustHave = f.required && (!relaxed || f.alwaysRequired);
    if (err) errors[f.key] = err;
    else if (strict && mustHave && isEmpty(v)) errors[f.key] = `${f.label} is required.`;
    if (!isEmpty(v)) data[f.key] = v;
  }
  if (strict && res.check)
    for (const [k, msg] of Object.entries(res.check(data))) if (msg && !errors[k]) errors[k] = msg;
  return { data, errors };
}

export function getResource(key: string): ResourceDef {
  const r = RESOURCE_MAP.get(key);
  if (!r) throw new HttpError(404, 'UNKNOWN_RESOURCE', `There is no configuration page called “${key}”.`);
  return r;
}

export function normalizeCode(raw: unknown): string | null {
  if (isEmpty(raw)) return null;
  const s = String(raw).trim().toUpperCase();
  if (!CODE_RE.test(s)) throw new HttpError(422, 'VALIDATION', 'Check the highlighted fields.', { code: 'Use 1–40 upper-case letters, digits, dot, dash or underscore.' });
  return s;
}
