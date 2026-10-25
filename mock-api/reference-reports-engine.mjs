/*
 * Reference Reports demo engine. Fictional, in-memory and dependency-free.
 *
 * Sections marked "source copy" are type-stripped from the read-only Lumen source
 * (src/lib/engine/expression.ts, src/lib/engine/query.ts). Sections marked "port" re-implement
 * source behaviour without its server libraries: luxon (dates, schedule), zod (builder/schemas),
 * exceljs + fs (exports). Nothing here touches the filesystem, sends email or runs timers.
 */
import { BRANCHES, datasetFreshness, getDataset, getRows, ROWS_PER_DAY } from './reference-reports-data.mjs';

export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Dates (port of src/lib/dates.ts without luxon). Calendar dates are plain YYYY-MM-DD strings.

export const PRESET_LABELS = {
  today: 'Today', yesterday: 'Yesterday', last_7_days: 'Last 7 days', last_30_days: 'Last 30 days', this_month: 'This month',
  last_month: 'Last month', this_quarter: 'This quarter', last_quarter: 'Last quarter', this_year: 'This year', last_year: 'Last year',
  last_12_months: 'Last 12 months', last_3_years: 'Last 3 years', last_5_years: 'Last 5 years', last_10_years: 'Last 10 years', custom: 'Custom range',
};
export const PRESETS = Object.keys(PRESET_LABELS);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
const toUtc = (iso) => { const { y, m, d } = parts(iso); return Date.UTC(y, m - 1, d); };
const fromUtc = (t) => { const x = new Date(t); return ymd(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); };
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const addDays = (iso, n) => fromUtc(toUtc(iso) + n * 86400000);
export function addMonths(iso, n) {
  const { y, m, d } = parts(iso);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  return ymd(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}
export function isIsoDate(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const { y, m, d } = parts(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
export function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}
function zoneParts(t, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}
export const todayIn = (tz, now = new Date()) => zoneParts(now.getTime(), validTimeZone(tz) ? tz : 'UTC').date;

/** Resolves a preset or custom range to inclusive ISO dates in the given time zone. */
export function resolveRange(v, tz, now = new Date()) {
  const today = todayIn(tz, now);
  const { y, m } = parts(today);
  const monthEnd = (yy, mm) => ymd(yy, mm, daysInMonth(yy, mm));
  const quarter = (iso) => { const p = parts(iso); const qs = Math.floor((p.m - 1) / 3) * 3 + 1; return { from: ymd(p.y, qs, 1), to: monthEnd(p.y, qs + 2) }; };
  const years = (n) => ({ from: addDays(addMonths(today, -12 * n), 1), to: today });
  switch (v?.preset ?? 'last_30_days') {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const d = addDays(today, -1); return { from: d, to: d }; }
    case 'last_7_days': return { from: addDays(today, -6), to: today };
    case 'last_30_days': return { from: addDays(today, -29), to: today };
    case 'this_month': return { from: ymd(y, m, 1), to: monthEnd(y, m) };
    case 'last_month': { const p = parts(addMonths(ymd(y, m, 1), -1)); return { from: ymd(p.y, p.m, 1), to: monthEnd(p.y, p.m) }; }
    case 'this_quarter': return quarter(today);
    case 'last_quarter': return quarter(addMonths(today, -3));
    case 'this_year': return { from: ymd(y, 1, 1), to: ymd(y, 12, 31) };
    case 'last_year': return { from: ymd(y - 1, 1, 1), to: ymd(y - 1, 12, 31) };
    case 'last_12_months': return { from: addDays(addMonths(today, -12), 1), to: today };
    case 'last_3_years': return years(3);
    case 'last_5_years': return years(5);
    case 'last_10_years': return years(10);
    case 'custom': {
      const from = isIsoDate(v?.from) ? v.from : addDays(today, -29);
      const to = isIsoDate(v?.to) ? v.to : today;
      return from <= to ? { from, to } : { from: to, to: from };
    }
    default: return { from: addDays(today, -29), to: today };
  }
}
export const rangeDays = (from, to) => Math.round((toUtc(to) - toUtc(from)) / 86400000) + 1;
/** Splits an inclusive range into calendar-month chunks for background processing. */
export function monthChunks(from, to) {
  const chunks = [];
  let cur = from;
  while (cur <= to) {
    const p = parts(cur);
    const end = ymd(p.y, p.m, daysInMonth(p.y, p.m));
    const chunkEnd = end < to ? end : to;
    chunks.push({ from: cur, to: chunkEnd });
    cur = addDays(chunkEnd, 1);
  }
  return chunks;
}
export function describeRange(v) {
  if (!v) return PRESET_LABELS.last_30_days;
  if (v.preset === 'custom') return `${v.from ?? '?'} to ${v.to ?? '?'}`;
  return PRESET_LABELS[v.preset];
}

// ---------------------------------------------------------------------------
// Schedules (port of src/lib/schedule.ts without luxon)

function offsetMs(t, tz) {
  const z = zoneParts(t, tz);
  return toUtc(z.date) + z.hour * 3600000 + z.minute * 60000 - Math.floor(t / 60000) * 60000;
}
function wallToUtc(date, hour, minute, tz) {
  const guess = toUtc(date) + hour * 3600000 + minute * 60000;
  const first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}
/** Next run strictly after `after`, in the schedule's own time zone. Returns undefined once past endDate. */
export function computeNextRun(s, after) {
  const tz = validTimeZone(s.timezone) ? s.timezone : 'UTC';
  const baseT = Math.floor(after.getTime() / 60000) * 60000;
  const base = zoneParts(baseT, tz).date;
  const at = (d) => wallToUtc(d, s.hour, s.minute, tz);
  let date;
  if (s.frequency === 'daily') {
    date = base;
    if (at(date) <= baseT) date = addDays(date, 1);
  } else if (s.frequency === 'weekly') {
    const dow = new Date(toUtc(base)).getUTCDay() || 7;
    date = addDays(base, s.dayOfWeek - dow);
    if (at(date) <= baseT) date = addDays(date, 7);
  } else {
    const inMonth = (yy, mm) => ymd(yy, mm, Math.min(s.dayOfMonth, daysInMonth(yy, mm)));
    const p = parts(base);
    date = inMonth(p.y, p.m);
    if (at(date) <= baseT) { const n = parts(addMonths(ymd(p.y, p.m, 1), 1)); date = inMonth(n.y, n.m); }
  }
  if (s.endDate && date > s.endDate) return undefined;
  return new Date(at(date)).toISOString();
}
const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function describeTiming(s) {
  const time = `${pad(s.hour)}:${pad(s.minute)}`;
  const when = s.frequency === 'daily' ? 'Every day' : s.frequency === 'weekly' ? `Every ${DAYS[s.dayOfWeek]}` : `Monthly on day ${s.dayOfMonth}`;
  return `${when} at ${time} (${s.timezone})`;
}
export const COMMON_TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];

// ---------------------------------------------------------------------------
// Context helpers (port of src/lib/context.ts and src/lib/filterOptions.ts)

/** Replaces relative date presets with fixed dates so queued work reports exactly the period that was requested. */
export function freezeFilters(def, filters, tz) {
  const out = { ...filters };
  for (const f of def.filters) {
    if (f.type !== 'daterange') continue;
    const { from, to } = resolveRange(filters[f.key] ?? f.default, tz);
    out[f.key] = { preset: 'custom', from, to };
  }
  return out;
}
/** Option lists for select filters, limited to the branches the user may see. */
export function filterOptions(def, scope, now = new Date()) {
  const ds = getDataset(def.datasetId);
  const out = {};
  const thisYear = now.getUTCFullYear();
  for (const f of def.filters) {
    if (f.type === 'daterange' || f.type === 'text') continue;
    const field = ds?.fields.find((x) => x.key === f.field);
    if (f.field === ds?.branchField) out[f.key] = scope ?? [...BRANCHES];
    else if (f.field === 'year') out[f.key] = Array.from({ length: thisYear - 2015 }, (_, i) => String(thisYear - i));
    else if (f.field === 'month') {
      const months = [];
      for (let yy = thisYear; yy >= 2016; yy--) for (let mm = 12; mm >= 1; mm--) months.push(`${yy}-${pad(mm)}`);
      out[f.key] = months;
    } else out[f.key] = field?.options ?? [];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Safe expressions: source copy of src/lib/engine/expression.ts (types stripped)

/*
 * Safe arithmetic expressions for computed columns, e.g. "(actual - target) / target * 100".
 * Supports numbers, column identifiers, + - * /, parentheses and round(x[, digits]), abs, min, max, coalesce.
 * Never uses eval. Division by zero and missing values produce null.
 */

export class ExpressionError extends Error {}

const FUNCS = {
  round: { min: 1, max: 2 },
  abs: { min: 1, max: 1 },
  min: { min: 2, max: 8 },
  max: { min: 2, max: 8 },
  coalesce: { min: 2, max: 8 },
};

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const v = Number(src.slice(i, j));
      if (Number.isNaN(v)) throw new ExpressionError(`"${src.slice(i, j)}" is not a number.`);
      out.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')' }); i++; continue; }
    if (c === ',') { out.push({ t: ',' }); i++; continue; }
    throw new ExpressionError(`"${c}" is not allowed. Use column names, numbers, + - * / and parentheses.`);
  }
  if (out.length > 200) throw new ExpressionError('Expression is too long.');
  return out;
}

function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const expect = (t) => {
    const tok = toks[p];
    if (!tok || tok.t !== t) throw new ExpressionError(`Expected "${t}" at position ${p + 1}.`);
    p++;
    return tok;
  };
  function expr() {
    let l = term();
    while (peek()?.t === 'op' && ((peek()).v === '+' || (peek()).v === '-')) {
      const op = (toks[p++]).v;
      l = { k: 'bin', op, l, r: term() };
    }
    return l;
  }
  function term() {
    let l = unary();
    while (peek()?.t === 'op' && ((peek()).v === '*' || (peek()).v === '/')) {
      const op = (toks[p++]).v;
      l = { k: 'bin', op, l, r: unary() };
    }
    return l;
  }
  function unary() {
    const t = peek();
    if (t?.t === 'op' && t.v === '-') { p++; return { k: 'neg', a: unary() }; }
    if (t?.t === 'op' && t.v === '+') { p++; return unary(); }
    return primary();
  }
  function primary() {
    const t = peek();
    if (!t) throw new ExpressionError('Expression ends unexpectedly.');
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === '(') { p++; const e = expr(); expect(')'); return e; }
    if (t.t === 'id') {
      p++;
      if (peek()?.t === '(') {
        const fn = t.v.toLowerCase();
        const spec = FUNCS[fn];
        if (!spec) throw new ExpressionError(`Unknown function "${t.v}". Available: ${Object.keys(FUNCS).join(', ')}.`);
        p++;
        const args = [];
        if (peek()?.t !== ')') {
          args.push(expr());
          while (peek()?.t === ',') { p++; args.push(expr()); }
        }
        expect(')');
        if (args.length < spec.min || args.length > spec.max) throw new ExpressionError(`${fn}() takes ${spec.min === spec.max ? spec.min : `${spec.min} to ${spec.max}`} arguments.`);
        return { k: 'call', fn, args };
      }
      return { k: 'id', v: t.v };
    }
    throw new ExpressionError(`Unexpected "${t.t === 'op' ? t.v : t.t}".`);
  }
  if (toks.length === 0) throw new ExpressionError('Expression is empty.');
  const node = expr();
  if (p < toks.length) throw new ExpressionError('Unexpected text after the end of the expression.');
  return node;
}

const compiled = new Map ();

export function compile(src) {
  let n = compiled.get(src);
  if (!n) {
    n = parse(src);
    if (compiled.size > 500) compiled.clear();
    compiled.set(src, n);
  }
  return n;
}

export function identifiers(src) {
  const out = new Set ();
  const walk = (n) => {
    if (n.k === 'id') out.add(n.v);
    else if (n.k === 'neg') walk(n.a);
    else if (n.k === 'bin') { walk(n.l); walk(n.r); }
    else if (n.k === 'call') n.args.forEach(walk);
  };
  walk(compile(src));
  return [...out];
}

function num(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function ev(n, vars) {
  switch (n.k) {
    case 'num': return n.v;
    case 'id': return num(vars[n.v]);
    case 'neg': { const a = ev(n.a, vars); return a === null ? null : -a; }
    case 'bin': {
      const l = ev(n.l, vars);
      const r = ev(n.r, vars);
      if (l === null || r === null) return null;
      if (n.op === '+') return l + r;
      if (n.op === '-') return l - r;
      if (n.op === '*') return l * r;
      return r === 0 ? null : l / r;
    }
    case 'call': {
      const args = n.args.map((a) => ev(a, vars));
      if (n.fn === 'coalesce') return args.find((a) => a !== null) ?? null;
      if (args.some((a) => a === null)) return null;
      const a = args;
      if (n.fn === 'round') { const f = Math.pow(10, a[1] ?? 0); return Math.round(a[0] * f) / f; }
      if (n.fn === 'abs') return Math.abs(a[0]);
      if (n.fn === 'min') return Math.min(...a);
      if (n.fn === 'max') return Math.max(...a);
      return null;
    }
  }
}

export function evaluate(src, vars) {
  const v = ev(compile(src), vars);
  return v === null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000;
}

/** Returns an error message, or null when the expression is valid and only uses allowed identifiers. */
export function validateExpression(src, allowed) {
  try {
    const ids = identifiers(src);
    const unknown = ids.filter((i) => !allowed.includes(i));
    if (unknown.length) return `Unknown column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Use: ${allowed.join(', ')}.`;
    return null;
  } catch (e) {
    return e instanceof ExpressionError ? e.message : 'Invalid expression.';
  }
}

// ---------------------------------------------------------------------------
// Query engine: source copy of src/lib/engine/query.ts (types stripped; cache made per partition)



export const MASK = '••••••';

// ---------------------------------------------------------------------------
// Policy and guard

export function effectivePolicy(def, s) {
  return {
    maxOnlineRangeDays: def.policy?.maxOnlineRangeDays ?? s.maxOnlineRangeDays,
    maxOnlineRows: def.policy?.maxOnlineRows ?? s.maxOnlineRows,
    cacheTtlSec: def.policy?.cacheTtlSec ?? 60,
  };
}

/** Decides whether a request is small enough to load on screen. Large requests must run as background jobs. */
export function guard(def, filters, ctx, s) {
  const policy = effectivePolicy(def, s);
  const { from, to, branches } = resolveFilters(def, filters, ctx);
  const days = rangeDays(from, to);
  const branchShare = (branches?.length ?? BRANCHES.length) / BRANCHES.length;
  const detail = def.groupBy.length === 0;
  const estimatedRows = Math.round(days * (ROWS_PER_DAY[def.datasetId] ?? 20) * branchShare);
  if (days > policy.maxOnlineRangeDays) {
    return { online: false, rangeDays: days, estimatedRows, policy, reason: `The period covers ${days.toLocaleString()} days. This report loads up to ${policy.maxOnlineRangeDays.toLocaleString()} days on screen.` };
  }
  if (detail && estimatedRows > policy.maxOnlineRows) {
    return { online: false, rangeDays: days, estimatedRows, policy, reason: `About ${estimatedRows.toLocaleString()} rows expected. This report loads up to ${policy.maxOnlineRows.toLocaleString()} rows on screen.` };
  }
  return { online: true, rangeDays: days, estimatedRows, policy };
}

// ---------------------------------------------------------------------------
// Filters

export function resolveFilters(def, filters, ctx) {
  const ds = getDataset(def.datasetId);
  if (!ds) throw new Error(`Dataset ${def.datasetId} not found`);
  const predicates = [];
  let range = resolveRange(undefined, ctx.timezone);
  let requestedBranches = null;

  for (const f of def.filters) {
    const v = filters[f.key] ?? f.default;
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (f.type === 'daterange') {
      range = resolveRange(typeof v === 'object' && !Array.isArray(v) ? (v) : undefined, ctx.timezone);
      continue;
    }
    if (f.field === ds.branchField) {
      requestedBranches = Array.isArray(v) ? v : typeof v === 'string' ? [v] : null;
      continue;
    }
    const field = f.field;
    if (f.type === 'multiselect' && Array.isArray(v)) {
      const set = new Set(v);
      predicates.push((r) => set.has(String(r[field])));
    } else if (f.type === 'select' && typeof v === 'string') {
      predicates.push((r) => String(r[field]) === v);
    } else if (f.type === 'text' && typeof v === 'string') {
      const needle = v.toLowerCase().slice(0, 100);
      predicates.push((r) => String(r[field] ?? '').toLowerCase().includes(needle));
    }
  }

  // Row-level security: intersect requested branches with the caller's scope.
  let branches = requestedBranches;
  if (ctx.branches) branches = requestedBranches ? requestedBranches.filter((b) => ctx.branches .includes(b)) : [...ctx.branches];
  if (branches && ds.branchField) {
    const set = new Set(branches);
    const bf = ds.branchField;
    predicates.push((r) => set.has(String(r[bf])));
  }
  return { ...range, predicates, branches };
}

/** Scans the dataset and returns raw rows matching filters within [from, to] (optionally narrowed by bounds). */
export function collectRows(def, rf, bounds) {
  const ds = getDataset(def.datasetId);
  const df = ds.dateField;
  const from = bounds && bounds.from > rf.from ? bounds.from : rf.from;
  const to = bounds && bounds.to < rf.to ? bounds.to : rf.to;
  const out = [];
  const all = getRows(def.datasetId);
  const preds = rf.predicates;
  outer: for (let i = 0; i < all.length; i++) {
    const r = all[i];
    const d = r[df];
    if (d < from || d > to) continue;
    for (let p = 0; p < preds.length; p++) if (!preds[p](r)) continue outer;
    out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shaping

export function isSensitive(def, col) {
  if (col.sensitive) return true;
  const ds = getDataset(def.datasetId);
  return !!ds?.fields.find((f) => f.key === (col.field ?? col.key))?.sensitive;
}

export function selectColumns(def, requested) {
  const byKey = new Map(def.columns.map((c) => [c.key, c]));
  let keys = (requested?.length ? requested : def.defaultColumns).filter((k) => byKey.has(k));
  if (keys.length === 0) keys = def.defaultColumns.filter((k) => byKey.has(k));
  // Grouped reports always keep their grouping columns so rows stay labelled.
  const missingDims = def.groupBy.filter((g) => !keys.includes(g) && byKey.has(g));
  return [...missingDims, ...keys].map((k) => byKey.get(k));
}

/** Produces rows with every column of the definition computed (before projection and masking). */
export function shapeAll(def, raw) {
  const exprCols = def.columns.filter((c) => c.expression);
  if (def.groupBy.length === 0) {
    const plain = def.columns.filter((c) => !c.expression);
    return raw.map((r) => {
      const o = {};
      for (const c of plain) o[c.key] = r[c.field ?? c.key] ?? null;
      for (const c of exprCols) o[c.key] = evaluate(c.expression, o);
      return o;
    });
  }
  const aggCols = def.columns.filter((c) => c.aggregate);

  const groups = new Map ();
  for (const r of raw) {
    const key = def.groupBy.map((g) => r[g]).join('\u0001');
    let grp = groups.get(key);
    if (!grp) {
      const dims = {};
      for (const g of def.groupBy) dims[g] = r[g] ?? null;
      grp = { dims, acc: aggCols.map(() => ({ sum: 0, count: 0, min: Infinity, max: -Infinity, n: 0 })) };
      groups.set(key, grp);
    }
    for (let i = 0; i < aggCols.length; i++) {
      const v = r[aggCols[i].field ?? aggCols[i].key];
      const a = grp.acc[i];
      a.count++;
      if (typeof v === 'number') {
        a.sum += v;
        a.n++;
        if (v < a.min) a.min = v;
        if (v > a.max) a.max = v;
      }
    }
  }
  const out = [];
  for (const { dims, acc } of groups.values()) {
    const o = { ...dims };
    aggCols.forEach((c, i) => {
      const a = acc[i];
      const v = c.aggregate === 'sum' ? a.sum : c.aggregate === 'count' ? a.count : c.aggregate === 'avg' ? (a.n ? a.sum / a.n : null) : c.aggregate === 'min' ? (a.n ? a.min : null) : a.n ? a.max : null;
      o[c.key] = typeof v === 'number' ? Math.round(v * 100) / 100 : v;
    });
    for (const c of exprCols) o[c.key] = evaluate(c.expression, o);
    out.push(o);
  }
  return out;
}

export function computeTotals(def, rows) {
  const t = {};
  const grouped = def.groupBy.length > 0;
  for (const c of def.columns) {
    if (c.expression) continue;
    const numeric = c.type === 'integer' || c.type === 'currency' || c.type === 'number';
    if (!numeric) continue;
    if (grouped && c.aggregate === 'sum') t[c.key] = Math.round(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0) * 100) / 100;
    else if (grouped && c.aggregate === 'avg') t[c.key] = rows.length ? Math.round((rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0) / rows.length) * 100) / 100 : null;
    else if (!grouped && (c.type === 'integer' || c.type === 'currency')) t[c.key] = Math.round(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0) * 100) / 100;
  }
  for (const c of def.columns.filter((x) => x.expression)) t[c.key] = evaluate(c.expression, t);
  return t;
}

export function sortRows(rows, sort, def) {
  if (!sort || !def.columns.some((c) => c.key === sort.key)) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[sort.key];
    const y = b[sort.key];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
  });
}

export function project(def, rows, cols, unmask) {
  const masked = cols.filter((c) => !unmask && isSensitive(def, c)).map((c) => c.key);
  const maskedSet = new Set(masked);
  return {
    columns: cols.map((c) => ({ key: c.key, label: c.label, type: c.type, ...(maskedSet.has(c.key) ? { masked: true } : {}) })),
    rows: rows.map((r) => {
      const o = {};
      for (const c of cols) o[c.key] = maskedSet.has(c.key) ? (r[c.key] === null ? null : MASK) : (r[c.key] ?? null);
      return o;
    }),
    masked,
  };
}

function buildChart(def, rows) {
  const ch = def.chart;
  if (!ch || ch.type === 'none' || !ch.x || !ch.y?.length) return null;
  const cols = new Map(def.columns.map((c) => [c.key, c]));
  const ys = ch.y.filter((k) => cols.has(k));
  if (!ys.length) return null;
  let data = rows;
  if (ch.type === 'line') {
    data = [...rows].sort((a, b) => String(a[ch.x ]).localeCompare(String(b[ch.x ])));
  } else if (rows.length > 12) {
    data = [...rows].sort((a, b) => (Number(b[ys[0]]) || 0) - (Number(a[ys[0]]) || 0)).slice(0, 12);
  }
  if (data.length > 400) data = data.slice(-400);
  return {
    type: ch.type,
    labels: data.map((r) => String(r[ch.x ] ?? '')),
    series: ys.map((k) => ({ key: k, label: cols.get(k) .label, values: data.map((r) => Number(r[k]) || 0) })),
  };
}

// ---------------------------------------------------------------------------
// Cache

// Cache: one Map per tenant partition, supplied by the caller in ctx.cache (the source used a process global).
export function clearResultCache(cache) {
  cache?.clear();
}

// ---------------------------------------------------------------------------
// Entry point for on-screen runs

export function runReport(def, params, ctx, s) {
  const resultCache = ctx.cache ?? new Map();
  const started = Date.now();
  const pageSize = Math.min(params.maxPageSize ?? 500, Math.max(1, params.pageSize ?? s.defaultPageSize));
  const page = Math.max(1, params.page ?? 1);
  const cols = selectColumns(def, params.columns);
  const sort = params.sort ?? def.sort;
  const rf = resolveFilters(def, params.filters, ctx);
  const policy = effectivePolicy(def, s);

  const cacheKey = JSON.stringify([def.id, def.version, def.updatedAt, rf.from, rf.to, params.filters, cols.map((c) => c.key), sort, page, pageSize, rf.branches, ctx.unmask]);
  const hit = resultCache.get(cacheKey);
  if (hit && policy.cacheTtlSec > 0 && Date.now() - hit.at < policy.cacheTtlSec * 1000) {
    return { ...hit.value, meta: { ...hit.value.meta, cached: true } };
  }

  const raw = collectRows(def, rf);
  const full = sortRows(shapeAll(def, raw), sort, def);
  const totals = computeTotals(def, full);
  const start = (page - 1) * pageSize;
  const { rows, columns, masked } = project(def, full.slice(start, start + pageSize), cols, ctx.unmask);
  const totalsProjected = project(def, [totals], cols, ctx.unmask).rows[0];
  if (cols[0] && (cols[0].type === 'string' || cols[0].type === 'date')) totalsProjected[cols[0].key] = 'Total';

  const result = {
    columns,
    rows,
    total: full.length,
    page,
    pageSize,
    totals: totalsProjected,
    chart: buildChart(def, full),
    meta: {
      from: rf.from,
      to: rf.to,
      rangeDays: rangeDays(rf.from, rf.to),
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      cached: false,
      maskedColumns: masked,
      scopedBranches: rf.branches,
      freshness: datasetFreshness(def.datasetId),
    },
  };
  if (policy.cacheTtlSec > 0) {
    if (resultCache.size > 300) resultCache.clear();
    resultCache.set(cacheKey, { at: Date.now(), value: result });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Request validation (port of src/lib/schemas.ts and the route-level zod objects, without zod).
// Failures use the source response shape: 400 { error: 'Some fields are invalid.', code: 'VALIDATION', details }.

export const ACTIONS = ['view', 'print', 'export_csv', 'export_xlsx', 'export_json', 'email', 'schedule', 'api'];
export const PERMISSIONS = ['admin.users', 'admin.access', 'admin.settings', 'admin.sources', 'audit.view', 'reports.build', 'reports.share', 'dashboards.edit', 'data.unmask', 'schedules.manage_all', 'api.keys'];

export class Validator {
  constructor(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'Request body must be JSON.');
    this.raw = raw;
    this.errors = {};
  }
  fail(key, message) { (this.errors[key] ??= []).push(message); return undefined; }
  done() { if (Object.keys(this.errors).length) throw new HttpError(400, 'Some fields are invalid.', 'VALIDATION', { fieldErrors: this.errors }); }
  str(key, { min = 0, max = 10000, trim = false, optional = false, def, pattern, patternMessage, lower = false } = {}) {
    let v = this.raw[key];
    if (v === undefined || v === null) return optional || def !== undefined ? def : this.fail(key, 'Required');
    if (typeof v !== 'string') return this.fail(key, 'Expected string');
    if (trim) v = v.trim();
    if (lower) v = v.toLowerCase();
    if (v.length < min) return this.fail(key, `Must contain at least ${min} character(s)`);
    if (v.length > max) return this.fail(key, `Must contain at most ${max} character(s)`);
    if (pattern && !pattern.test(v)) return this.fail(key, patternMessage ?? 'Invalid');
    return v;
  }
  int(key, { min = -Infinity, max = Infinity, optional = false, def, number = false } = {}) {
    const v = this.raw[key];
    if (v === undefined || v === null) return optional || def !== undefined ? def : this.fail(key, 'Required');
    if (typeof v !== 'number' || !Number.isFinite(v) || (!number && !Number.isInteger(v))) return this.fail(key, number ? 'Expected number' : 'Expected integer');
    if (v < min || v > max) return this.fail(key, `Must be between ${min} and ${max}`);
    return v;
  }
  bool(key, { optional = false, def } = {}) {
    const v = this.raw[key];
    if (v === undefined || v === null) return optional || def !== undefined ? def : this.fail(key, 'Required');
    return typeof v === 'boolean' ? v : this.fail(key, 'Expected boolean');
  }
  oneOf(key, values, { optional = false, def } = {}) {
    const v = this.raw[key];
    if (v === undefined || v === null) return optional || def !== undefined ? def : this.fail(key, 'Required');
    return values.includes(v) ? v : this.fail(key, `Expected one of ${values.join(', ')}`);
  }
  strings(key, { min = 0, max = 100, itemMax = 200, optional = false, def, of } = {}) {
    const v = this.raw[key];
    if (v === undefined || v === null) return optional || def !== undefined ? def : this.fail(key, 'Required');
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x.length > itemMax)) return this.fail(key, 'Expected a list of text values');
    if (v.length < min || v.length > max) return this.fail(key, `Expected ${min} to ${max} values`);
    if (of && v.some((x) => !of.includes(x))) return this.fail(key, 'Contains an unknown value');
    return v;
  }
  custom(key, fn, { optional = false, def } = {}) {
    const v = this.raw[key];
    if (v === undefined || v === null) return optional || def !== undefined ? def : this.fail(key, 'Required');
    try { return fn(v); } catch (e) { return this.fail(key, e.message); }
  }
}
export function parseDateRange(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || !PRESETS.includes(v.preset)) throw new Error('Invalid period');
  for (const k of ['from', 'to']) if (v[k] !== undefined && (typeof v[k] !== 'string' || !ISO.test(v[k]))) throw new Error('Dates must look like 2025-01-31');
  return { preset: v.preset, ...(v.from ? { from: v.from } : {}), ...(v.to ? { to: v.to } : {}) };
}
export function parseFilters(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid filters');
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (k.length > 64) throw new Error('Filter key too long');
    if (x === undefined || x === null) continue;
    if (typeof x === 'string') { if (x.length > 200) throw new Error('Filter value too long'); out[k] = x; }
    else if (Array.isArray(x)) { if (x.length > 100 || x.some((i) => typeof i !== 'string' || i.length > 200)) throw new Error('Invalid filter list'); out[k] = x; }
    else out[k] = parseDateRange(x);
  }
  return out;
}
export function parseSort(v) {
  if (!v || typeof v !== 'object' || typeof v.key !== 'string' || v.key.length > 64 || !['asc', 'desc'].includes(v.dir)) throw new Error('Invalid sort');
  return { key: v.key, dir: v.dir };
}
const columnsOpt = { max: 80, itemMax: 64 };

// ---------------------------------------------------------------------------
// Report builder (port of src/lib/builder.ts; zod replaced by Validator)

export function parseDefinitionInput(raw) {
  const v = new Validator(raw);
  const out = {
    title: v.str('title', { trim: true, min: 3, max: 120 }),
    description: v.str('description', { trim: true, max: 400, def: '' }),
    category: v.str('category', { max: 60 }),
    subcategory: v.str('subcategory', { trim: true, max: 60, def: 'Custom' }),
    datasetId: v.str('datasetId', { max: 40 }),
    columns: v.custom('columns', (cols) => {
      if (!Array.isArray(cols) || cols.length < 1 || cols.length > 60) throw new Error('Add between 1 and 60 columns');
      return cols.map((c) => {
        const cv = new Validator(c);
        const col = {
          key: cv.str('key', { pattern: /^[a-z][a-z0-9_]{0,40}$/, patternMessage: 'Column keys use lowercase letters, digits and underscores.' }),
          label: cv.str('label', { trim: true, min: 1, max: 80 }),
          type: cv.oneOf('type', ['string', 'integer', 'number', 'currency', 'percent', 'date']),
          field: cv.str('field', { max: 64, optional: true }),
          aggregate: cv.oneOf('aggregate', ['sum', 'count', 'avg', 'min', 'max'], { optional: true }),
          expression: cv.str('expression', { max: 300, optional: true }),
        };
        if (Object.keys(cv.errors).length) throw new Error(Object.values(cv.errors).flat()[0]);
        return col;
      });
    }),
    defaultColumns: v.strings('defaultColumns', { max: 60, def: [] }),
    groupBy: v.strings('groupBy', { max: 4, def: [] }),
    filterFields: v.strings('filterFields', { max: 12, def: [] }),
    defaultPreset: v.oneOf('defaultPreset', PRESETS, { def: 'last_30_days' }),
    sort: v.custom('sort', parseSort, { optional: true }),
    chart: v.custom('chart', (c) => {
      if (!c || typeof c !== 'object' || !['bar', 'line', 'donut', 'none'].includes(c.type)) throw new Error('Choose a chart type');
      if (c.x !== undefined && typeof c.x !== 'string') throw new Error('Invalid chart label column');
      if (c.y !== undefined && (!Array.isArray(c.y) || c.y.length > 4 || c.y.some((y) => typeof y !== 'string'))) throw new Error('Choose up to four chart values');
      return { type: c.type, ...(c.x ? { x: c.x } : {}), ...(c.y ? { y: c.y } : {}) };
    }),
    visibility: v.oneOf('visibility', ['private', 'roles', 'everyone']),
    sharedRoleIds: v.strings('sharedRoleIds', { max: 20, def: [] }),
    tags: v.strings('tags', { max: 10, itemMax: 30, def: [] }),
    policy: v.custom('policy', (p) => {
      if (!p || typeof p !== 'object') throw new Error('Invalid limits');
      const pv = new Validator(p);
      const out2 = { maxOnlineRangeDays: pv.int('maxOnlineRangeDays', { min: 1, max: 4000, optional: true }), maxOnlineRows: pv.int('maxOnlineRows', { min: 100, max: 500000, optional: true }) };
      if (Object.keys(pv.errors).length) throw new Error('Invalid limits');
      return out2;
    }, { optional: true }),
  };
  v.done();
  return out;
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
export { slugify };

/** Validates builder input against the dataset and returns a runnable definition. */
export function buildDefinition(input, user, existing, { categories, hasPerm, randomSuffix, now = new Date() }) {
  const ds = getDataset(input.datasetId);
  if (!ds) throw new HttpError(400, 'Choose a dataset.');
  if (!categories.some((c) => c.name === input.category) && input.category !== 'Custom') throw new HttpError(400, 'Choose a category.');
  const fieldKeys = ds.fields.map((f) => f.key);
  const grouped = input.groupBy.length > 0;
  const keys = new Set();
  const columns = [];
  for (const g of input.groupBy) if (!fieldKeys.includes(g)) throw new HttpError(400, `Group by field "${g}" is not in ${ds.name}.`);
  for (const c of input.columns) {
    if (keys.has(c.key)) throw new HttpError(400, `Column key "${c.key}" is used twice.`);
    if (c.expression) {
      const err = validateExpression(c.expression, [...keys]);
      if (err) throw new HttpError(400, `Computed column "${c.label}": ${err} Computed columns can only use columns listed before them.`);
      columns.push({ key: c.key, label: c.label, type: c.type, expression: c.expression });
    } else {
      const field = c.field ?? c.key;
      const f = ds.fields.find((x) => x.key === field);
      if (!f) throw new HttpError(400, `Field "${field}" is not in ${ds.name}.`);
      if (grouped && !c.aggregate && !input.groupBy.includes(field)) throw new HttpError(400, `"${c.label}" needs a summary (sum, average…) or must be a group-by field, because this report is summarised.`);
      if (c.aggregate && c.aggregate !== 'count' && !['integer', 'number', 'currency', 'percent'].includes(f.type)) throw new HttpError(400, `"${c.label}" is text, so it can only be counted.`);
      columns.push({ key: c.key, label: c.label, type: c.aggregate === 'count' ? 'integer' : f.type, field, ...(grouped && c.aggregate ? { aggregate: c.aggregate } : {}), ...(f.sensitive ? { sensitive: true } : {}) });
    }
    keys.add(c.key);
  }
  for (const g of input.groupBy) {
    if (!columns.some((c) => (c.field ?? c.key) === g && !c.aggregate)) {
      const f = ds.fields.find((x) => x.key === g);
      columns.unshift({ key: g, label: f.label, type: f.type, ...(f.sensitive ? { sensitive: true } : {}) });
      keys.add(g);
    }
  }
  const filters = [{ key: 'period', label: 'Period', type: 'daterange', field: ds.dateField, default: { preset: input.defaultPreset } }];
  for (const key of input.filterFields) {
    const f = ds.fields.find((x) => x.key === key);
    if (!f || !f.filter) throw new HttpError(400, `"${key}" cannot be used as a filter.`);
    filters.push({ key, label: f.label, type: f.filter === 'select' ? 'multiselect' : 'text', field: key });
  }
  if (ds.branchField && !filters.some((f) => f.field === ds.branchField)) filters.splice(1, 0, { key: 'branch', label: 'Branch', type: 'multiselect', field: ds.branchField });
  const chart = { ...input.chart };
  if (chart.type !== 'none') {
    if (!chart.x || !keys.has(chart.x)) throw new HttpError(400, 'Choose the chart label column.');
    chart.y = (chart.y ?? []).filter((y) => keys.has(y));
    if (!chart.y.length) throw new HttpError(400, 'Choose at least one chart value column.');
  }
  if (input.visibility !== 'private' && !hasPerm(user, 'reports.share')) throw new HttpError(403, 'Your role can build reports but not share them. Save it as private.');
  if (input.policy && !user.isAdmin) throw new HttpError(403, 'Only administrators can change on-screen limits.');
  const defaults = input.defaultColumns.filter((k) => keys.has(k));
  return {
    id: existing?.id ?? `custom-${slugify(input.title)}-${randomSuffix()}`,
    title: input.title,
    description: input.description,
    category: input.category,
    subcategory: input.subcategory || 'Custom',
    datasetId: ds.id,
    columns,
    defaultColumns: defaults.length ? defaults : columns.map((c) => c.key),
    groupBy: input.groupBy,
    filters,
    sort: input.sort && keys.has(input.sort.key) ? input.sort : undefined,
    chart,
    policy: input.policy ?? existing?.policy ?? (grouped ? undefined : { maxOnlineRangeDays: 92, maxOnlineRows: 20000 }),
    tags: input.tags,
    kind: 'custom',
    ownerId: existing?.ownerId ?? user.id,
    visibility: input.visibility,
    sharedRoleIds: input.visibility === 'roles' ? input.sharedRoleIds : [],
    version: (existing?.version ?? 0) + 1,
    updatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Exports (port of src/lib/export.ts). Files are built in memory; XLSX uses a minimal
// dependency-free SpreadsheetML writer instead of exceljs.

export const MIME = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json; charset=utf-8',
};
/** Neutralises spreadsheet formula injection (=, +, -, @, tab, CR at the start of a text cell). */
export function safeCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function describeFilters(filters) {
  return Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(', ')}`;
      if (typeof v === 'object' && v) return `${k}: ${v.preset === 'custom' ? `${v.from} to ${v.to}` : v.preset}`;
      return `${k}: ${String(v)}`;
    })
    .join('; ');
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** Stored (uncompressed) ZIP container: enough for a valid .xlsx without a compression dependency. */
function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x0800, 8); dir.writeUInt16LE(0, 10);
    dir.writeUInt32LE(0, 12); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(data.length, 20); dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28); dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}
const xml = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const colName = (i) => { let s = ''; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const STYLE = { currency: 2, integer: 3, number: 2, percent: 4 };
function sheetXml(rows, { widths, frozen }) {
  const body = rows.map((cells, r) => `<row r="${r + 1}">${cells.map(([v, style], c) => {
    const ref = `${colName(c)}${r + 1}`;
    const s = style ? ` s="${style}"` : '';
    if (v === null || v === undefined || v === '') return `<c r="${ref}"${s}/>`;
    if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const pane = frozen ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${body}</sheetData></worksheet>`;
}
function xlsx(columns, rows, info) {
  const header = columns.map((c) => [c.label, 1]);
  const data = rows.map((r) => columns.map((c) => {
    const v = r[c.key];
    return [typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : (v ?? null), STYLE[c.type]];
  }));
  const about = [['Report', info.title], ['Period', info.period], ['Filters', info.filters || 'None'], ['Generated by', info.generatedBy], ['Generated at (UTC)', info.generatedAt], ['Rows', String(rows.length)], ['Currency', info.currency], ['Masked columns', info.maskedColumns.length ? info.maskedColumns.join(', ') : 'None']].map((l) => l.map((v) => [v]));
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.00&quot;%&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF15343A"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="3" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/></cellXfs></styleSheet>';
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/><sheet name="About" sheetId="2" r:id="rId2"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', styles],
    ['xl/worksheets/sheet1.xml', sheetXml([header, ...data], { widths: columns.map((c) => Math.min(40, Math.max(12, c.label.length + 4))), frozen: true })],
    ['xl/worksheets/sheet2.xml', sheetXml(about, { widths: [22, 80], frozen: false })],
  ]);
}
/** Builds an export file in memory. Returns a Buffer. */
export function writeExport(format, columns, rows, info) {
  if (format === 'csv') {
    const lines = [columns.map((c) => safeCell(c.label)).join(','), ...rows.map((r) => columns.map((c) => safeCell(r[c.key])).join(','))];
    return Buffer.from('﻿' + lines.join('\n') + '\n', 'utf8');
  }
  if (format === 'json') {
    return Buffer.from(JSON.stringify({ schema: 'lumen.report.v1', report: info.title, generatedAt: info.generatedAt, generatedBy: info.generatedBy, period: info.period, filters: info.filters, maskedColumns: info.maskedColumns, columns, rows }), 'utf8');
  }
  return xlsx(columns, rows, info);
}
