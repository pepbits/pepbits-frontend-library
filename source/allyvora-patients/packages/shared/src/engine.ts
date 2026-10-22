import { FIELDS, FIELD_MAP, ID_PATTERNS, NAME_PARTS, SECTIONS } from './definition';
import type {
  Condition,
  FieldChange,
  FieldDef,
  FieldErrors,
  FieldValue,
  FormValues,
  LayoutSettings,
  Lookups,
  LookupOption,
  SectionId,
  SectionProgress,
} from './types';
import { DENSITIES, LAYOUT_KINDS, VALIDATE_MODES } from './types';

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/** Local calendar date as yyyy-mm-dd. */
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

export function isEmptyValue(v: FieldValue): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'number') return Number.isNaN(v);
  return false;
}

export function evalCondition(c: Condition, values: FormValues): boolean {
  const x = values[c.field];
  switch (c.op) {
    case 'eq':
      return x === c.value;
    case 'neq':
      return x !== c.value;
    case 'in':
      return Array.isArray(c.value) && c.value.includes(x as never);
    case 'notIn':
      return Array.isArray(c.value) && !c.value.includes(x as never);
    case 'filled':
      return !isEmptyValue(x);
    case 'empty':
      return isEmptyValue(x);
    case 'true':
      return x === true;
    case 'false':
      return x !== true;
    default:
      return true;
  }
}

export function isVisible(f: FieldDef, values: FormValues): boolean {
  return !f.visibleWhen || f.visibleWhen.every((c) => evalCondition(c, values));
}

export function isRequired(f: FieldDef, values: FormValues): boolean {
  if (f.type === 'readonly' || !isVisible(f, values)) return false;
  if (f.required) return true;
  return !!f.requiredWhen && f.requiredWhen.every((c) => evalCondition(c, values));
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function lcFirst(label: string): string {
  // Keep acronyms such as "ABHA" or "PIN" intact.
  if (label.length > 1 && label[1] === label[1].toUpperCase() && /[A-Z]/.test(label[1])) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function requiredMessage(f: FieldDef): string {
  if (f.requiredMessage) return f.requiredMessage;
  switch (f.type) {
    case 'select':
    case 'segmented':
      return `Choose ${lcFirst(f.label)}`;
    case 'multiselect':
      return `Add at least one item`;
    case 'switch':
      return 'Turn this on to continue';
    case 'signature':
      return 'Signature is needed';
    default:
      return `Enter ${lcFirst(f.label)}`;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Rule = (value: FieldValue, values: FormValues, today: string) => string | null;

const CROSS_FIELD_RULES: Record<string, Rule> = {
  idNumber: (v, all) => {
    const p = ID_PATTERNS[String(all.idDocumentType ?? '')];
    if (!p) return null;
    return p.regex.test(String(v).toUpperCase().trim()) ? null : p.message;
  },
  birthYear: (v, _all, today) => {
    const y = Number(v);
    return y > Number(today.slice(0, 4)) ? 'Birth year is in the future' : null;
  },
  birthMonth: (v, all, today) => {
    const y = Number(all.birthYear);
    if (y === Number(today.slice(0, 4)) && Number(v) > Number(today.slice(5, 7))) return 'This month is in the future';
    return null;
  },
  validTo: (v, all) => {
    if (typeof all.validFrom === 'string' && all.validFrom && String(v) <= all.validFrom) return 'Must be after the cover start date';
    return null;
  },
  emergencyPhone: (v, all) => (v && v === all.mobile ? 'Use a different number from the patient’s mobile' : null),
};

export function validateField(f: FieldDef, values: FormValues, today: string = todayISO()): string | null {
  if (f.type === 'readonly' || !isVisible(f, values)) return null;
  const v = values[f.id];
  const required = isRequired(f, values);

  if (f.type === 'switch') {
    return required && v !== true ? requiredMessage(f) : null;
  }
  if (isEmptyValue(v)) return required ? requiredMessage(f) : null;

  const s = typeof v === 'string' ? v.trim() : v;

  if (typeof s === 'string') {
    if (f.maxLength && s.length > f.maxLength && f.type !== 'signature') return `Use ${f.maxLength} characters or fewer`;
    if (f.type === 'email' && !EMAIL.test(s)) return 'Enter an email like name@example.com';
    if (f.pattern && !new RegExp(f.pattern.regex, f.pattern.flags).test(s)) return f.pattern.message;
    if (f.type === 'date') {
      if (!isValidISODate(s)) return 'Enter a valid date';
      if (f.date?.min && s < f.date.min) return `Date must be after ${f.date.min.slice(0, 4)}`;
      if (f.date?.rule === 'past' && s > today) return f.date.message ?? 'Date can’t be in the future';
      if (f.date?.rule === 'future' && s < today) return f.date.message ?? 'Date must be today or later';
    }
  }

  if (f.type === 'number') {
    const n = Number(s);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return 'Enter a whole number';
    if (f.min !== undefined && n < f.min) return `Must be ${f.min} or more`;
    if (f.max !== undefined && n > f.max) return `Must be ${f.max} or less`;
  }

  const rule = CROSS_FIELD_RULES[f.id];
  return rule ? rule(v, values, today) : null;
}

export function validateForm(values: FormValues, today: string = todayISO()): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of FIELDS) {
    const e = validateField(f, values, today);
    if (e) errors[f.id] = e;
  }
  return errors;
}

export function firstErrorField(errors: FieldErrors): string | undefined {
  return FIELDS.find((f) => errors[f.id])?.id;
}

export function visibleFields(section: SectionId, values: FormValues): FieldDef[] {
  return FIELDS.filter((f) => f.section === section && isVisible(f, values));
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export function sectionProgress(
  section: SectionId,
  values: FormValues,
  allErrors: FieldErrors,
  shownErrors: FieldErrors,
): SectionProgress {
  const fields = visibleFields(section, values).filter((f) => f.type !== 'readonly');
  let requiredTotal = 0;
  let requiredDone = 0;
  let filled = 0;
  let errorCount = 0;
  let hiddenProblems = 0;
  for (const f of fields) {
    const req = isRequired(f, values);
    const empty = f.type === 'switch' ? values[f.id] !== true : isEmptyValue(values[f.id]);
    if (!empty) filled++;
    if (shownErrors[f.id]) errorCount++;
    else if (allErrors[f.id]) hiddenProblems++;
    if (req) {
      requiredTotal++;
      if (!empty && !allErrors[f.id]) requiredDone++;
    }
  }
  const optional = requiredTotal === 0;
  let state: SectionProgress['state'];
  if (errorCount > 0) state = 'error';
  else if (optional) state = filled > 0 ? (hiddenProblems ? 'in-progress' : 'complete') : 'untouched';
  else if (requiredDone === requiredTotal && hiddenProblems === 0) state = 'complete';
  else state = filled > 0 ? 'in-progress' : 'untouched';
  return { state, requiredTotal, requiredDone, errorCount, filled, optional };
}

/** Overall record completeness: required fields weigh most, optional details add the rest. */
export function completion(values: FormValues, today: string = todayISO()): number {
  let req = 0;
  let reqDone = 0;
  let opt = 0;
  let optDone = 0;
  for (const f of FIELDS) {
    if (f.type === 'readonly' || f.type === 'switch' || !isVisible(f, values)) continue;
    const empty = isEmptyValue(values[f.id]);
    if (isRequired(f, values)) {
      req++;
      if (!empty && !validateField(f, values, today)) reqDone++;
    } else {
      opt++;
      if (!empty) optDone++;
    }
  }
  const w = 0.35;
  const total = req + opt * w;
  return total === 0 ? 0 : Math.round((100 * (reqDone + optDone * w)) / total);
}

/* ------------------------------------------------------------------ */
/* Derived values                                                      */
/* ------------------------------------------------------------------ */

export function deriveDisplayName(values: FormValues, lookups?: Lookups): string {
  const title = values.title ? lookups?.title?.find((o) => o.code === values.title)?.label ?? '' : '';
  return [title, ...NAME_PARTS.slice(1).map((k) => values[k])]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

export interface AgeInfo {
  years: number | null;
  label: string | null;
  approximate: boolean;
}

export function computeAge(values: FormValues, today: string = todayISO()): AgeInfo {
  const [ty, tm, td] = today.split('-').map(Number);
  const p = values.dobPrecision;
  if (p === 'exact' && typeof values.dateOfBirth === 'string' && isValidISODate(values.dateOfBirth) && values.dateOfBirth <= today) {
    const [y, m, d] = values.dateOfBirth.split('-').map(Number);
    let years = ty - y;
    if (tm < m || (tm === m && td < d)) years--;
    if (years >= 2) return { years, label: `${years} y`, approximate: false };
    let months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
    if (months >= 1) return { years, label: `${months} mo`, approximate: false };
    const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
    return { years: 0, label: `${days} d`, approximate: false };
  }
  if ((p === 'year' || p === 'yearMonth') && values.birthYear) {
    const by = Number(values.birthYear);
    if (!Number.isFinite(by) || by > ty) return { years: null, label: null, approximate: true };
    let years = ty - by;
    if (p === 'yearMonth' && values.birthMonth && Number(values.birthMonth) > tm) years--;
    return { years, label: `~${Math.max(years, 0)} y`, approximate: true };
  }
  if (p === 'age' && values.estimatedAge !== undefined && values.estimatedAge !== null && values.estimatedAge !== '') {
    const years = Number(values.estimatedAge);
    if (!Number.isFinite(years)) return { years: null, label: null, approximate: true };
    return { years, label: `~${years} y`, approximate: true };
  }
  return { years: null, label: null, approximate: false };
}

/** Removes unknown keys, values of hidden fields and read-only fields; trims and normalises. */
export function sanitizeValues(values: FormValues): FormValues {
  const out: FormValues = {};
  for (const f of FIELDS) {
    if (f.type === 'readonly' || !isVisible(f, values)) continue;
    let v = values[f.id];
    if (v === undefined) continue;
    if (typeof v === 'string') {
      v = v.trim();
      if (f.uppercase) v = v.toUpperCase();
      if (v === '') v = null;
    }
    if (f.type === 'number' && v !== null && v !== '' && typeof v !== 'number') {
      const n = Number(v);
      v = Number.isFinite(n) ? n : null;
    }
    if (f.type === 'switch') v = v === true;
    if (f.type === 'multiselect') v = Array.isArray(v) ? v.map(String) : [];
    if (f.id === 'branchId' && v !== null) v = Number(v);
    out[f.id] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Lookups and formatting                                              */
/* ------------------------------------------------------------------ */

export function optionsFor(f: FieldDef, values: FormValues, lookups: Lookups): LookupOption[] {
  const all = (f.lookup && lookups[f.lookup]) || [];
  if (!f.lookupParent) return all;
  const parent = values[f.lookupParent];
  if (isEmptyValue(parent)) return all;
  return all.filter((o) => !o.parent || o.parent === parent);
}

export function lookupLabel(lookups: Lookups, category: string | undefined, code: FieldValue): string {
  if (code === null || code === undefined || code === '') return '';
  const found = category ? lookups[category]?.find((o) => o.code === String(code)) : undefined;
  return found?.label ?? String(code);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string): string {
  if (!isValidISODate(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function maskSensitive(v: string): string {
  const clean = v.replace(/[\s-]/g, '');
  if (clean.length <= 4) return '••••';
  return `•••• ${clean.slice(-4)}`;
}

export function formatValue(f: FieldDef, value: FieldValue, lookups: Lookups, opts: { mask?: boolean } = {}): string {
  if (f.type === 'switch') return value === true ? 'Yes' : 'No';
  if (isEmptyValue(value)) return '';
  switch (f.type) {
    case 'select':
    case 'segmented':
      return lookupLabel(lookups, f.lookup, value);
    case 'multiselect':
      return (value as string[]).map((c) => lookupLabel(lookups, f.lookup, c)).join(', ');
    case 'date':
      return formatDate(String(value));
    case 'signature':
      return 'Signed';
    case 'tel':
      return f.prefix ? `${f.prefix} ${value}` : String(value);
    default: {
      const s = String(value);
      return opts.mask && f.sensitive ? maskSensitive(s) : s;
    }
  }
}

export function diffValues(before: FormValues, after: FormValues, lookups: Lookups): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const f of FIELDS) {
    if (f.type === 'readonly') continue;
    const a = before[f.id];
    const b = after[f.id];
    const same = JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (same) continue;
    if (isEmptyValue(a) && isEmptyValue(b) && f.type !== 'switch') continue;
    const fmt = (v: FieldValue) =>
      f.type === 'signature' ? (isEmptyValue(v) ? '' : 'Signed') : formatValue(f, v, lookups, { mask: true });
    changes.push({ field: f.id, label: f.label, from: fmt(a), to: fmt(b) });
  }
  return changes;
}

/* ------------------------------------------------------------------ */
/* Rule descriptions (for "Check form rules")                          */
/* ------------------------------------------------------------------ */

function describeCondition(c: Condition, lookups: Lookups): string {
  const f = FIELD_MAP[c.field];
  const label = f?.label ?? c.field;
  const val = (v: unknown) => (f ? lookupLabel(lookups, f.lookup, v as FieldValue) || String(v) : String(v));
  switch (c.op) {
    case 'eq':
      return f?.type === 'switch' ? `“${label}” is ${c.value ? 'on' : 'off'}` : `${label} is ${val(c.value)}`;
    case 'neq':
      return `${label} is not ${val(c.value)}`;
    case 'in':
      return `${label} is ${(c.value as unknown[]).map(val).join(' or ')}`;
    case 'notIn':
      return `${label} is not ${(c.value as unknown[]).map(val).join(' or ')}`;
    case 'filled':
      return `${label} is filled in`;
    case 'empty':
      return `${label} is empty`;
    case 'true':
      return `“${label}” is on`;
    case 'false':
      return `“${label}” is off`;
  }
}

export function describeFieldRule(f: FieldDef, lookups: Lookups): string {
  const parts: string[] = [];
  if (f.required) parts.push('Required');
  else if (f.requiredWhen) parts.push(`Required when ${f.requiredWhen.map((c) => describeCondition(c, lookups)).join(' and ')}`);
  else parts.push('Optional');
  if (f.visibleWhen) parts.push(`shown when ${f.visibleWhen.map((c) => describeCondition(c, lookups)).join(' and ')}`);
  return parts.join(', ');
}

/** Fields that carry a rule worth listing (required or conditional). */
export function ruleFields(section: SectionId): FieldDef[] {
  return FIELDS.filter((f) => f.section === section && f.type !== 'readonly' && (f.required || f.requiredWhen || f.visibleWhen));
}

export function sectionIndex(id: SectionId): number {
  return SECTIONS.findIndex((s) => s.id === id);
}

/* ------------------------------------------------------------------ */
/* Layout settings                                                     */
/* ------------------------------------------------------------------ */

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  layout: 'scroll',
  density: 'comfortable',
  columns: 4,
  showSummary: true,
  validateOn: 'blur',
  autosaveDraft: true,
};

export function normalizeLayoutSettings(input: unknown): { value: LayoutSettings; errors: string[] } {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const pick = <T>(key: string, allowed: readonly T[], fallback: T): T => {
    if (src[key] === undefined) return fallback;
    if (allowed.includes(src[key] as T)) return src[key] as T;
    errors.push(`${key} must be one of ${allowed.join(', ')}`);
    return fallback;
  };
  const bool = (key: string, fallback: boolean) => {
    if (src[key] === undefined) return fallback;
    if (typeof src[key] === 'boolean') return src[key] as boolean;
    errors.push(`${key} must be true or false`);
    return fallback;
  };
  const d = DEFAULT_LAYOUT_SETTINGS;
  return {
    value: {
      layout: pick('layout', LAYOUT_KINDS, d.layout),
      density: pick('density', DENSITIES, d.density),
      columns: pick('columns', [2, 3, 4] as const, d.columns),
      showSummary: bool('showSummary', d.showSummary),
      validateOn: pick('validateOn', VALIDATE_MODES, d.validateOn),
      autosaveDraft: bool('autosaveDraft', d.autosaveDraft),
    },
    errors,
  };
}
