'use client';
/*
 * Source `lib/format.ts` adapted: display formatting reads the host's effective
 * preferences (currency, number locale, date format, decimals, negative style) through
 * useFormat() instead of fixed APP locale/currency module constants. Pure helpers
 * (cx, statusTone, ISO date math) stay module functions. Native date inputs keep ISO.
 */
import { useMemo } from 'react';
import { createFormatters, LANGUAGE_LOCALES, type UserPreferences } from '@pepbits/erp-config';
import { useReferenceHost } from '@pepbits/reference-host';
import type { Field } from './types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');


export interface ReferenceFormat {
  fmtCurrency: (v: unknown) => string;
  fmtCompact: (v: unknown) => string;
  fmtNumber: (v: unknown) => string;
  fmtDate: (v: unknown, withYear?: boolean) => string;
  fmtTime: (v: unknown, seconds?: boolean) => string;
  fmtValue: (f: Field, v: unknown) => string;
  amountInWords: (v: number) => string;
  /** Display locale for calendar labels (weekday / month names) in the host language. */
  fmtLocale: string;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function words(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + words(n % 100) : ''}`;
  if (n < 1e6) return `${words(Math.floor(n / 1000))} Thousand${n % 1000 ? ' ' + words(n % 1000) : ''}`;
  return `${words(Math.floor(n / 1e6))} Million${n % 1e6 ? ' ' + words(n % 1e6) : ''}`;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && !isNaN(v);

/** Formatting bound to one preference set. Exported for tests and non-React callers. */
export function createReferenceFormat(prefs: UserPreferences): ReferenceFormat {
  const f = createFormatters(prefs);
  const fmtLocale = LANGUAGE_LOCALES[prefs.language] ?? prefs.numberLocale;
  const accounting = prefs.negativeStyle === 'parentheses';
  // Compact amounts follow the same currency display and negative style as full amounts.
  const compactMoney = prefs.currencyDisplay === 'none' ? null : new Intl.NumberFormat(prefs.numberLocale, {
    style: 'currency', currency: prefs.currencyCode, currencyDisplay: prefs.currencyDisplay === 'code' ? 'code' : 'symbol',
    notation: 'compact', maximumFractionDigits: 1, signDisplay: accounting ? 'never' : 'auto',
  });
  const compactPlain = new Intl.NumberFormat(prefs.numberLocale, { notation: 'compact', maximumFractionDigits: 1, signDisplay: accounting ? 'never' : 'auto' });
  const fmtCurrency = (v: unknown) => (isNum(v) ? f.money(v) : '—');
  const fmtCompact = (v: unknown) => {
    if (!isNum(v)) return '—';
    // Intl ignores the accounting sign with compact notation, so parentheses are applied here.
    const text = (compactMoney ?? compactPlain).format(v);
    return accounting && v < 0 ? `(${text})` : text;
  };
  const fmtNumber = (v: unknown) => (isNum(v) ? f.number(v) : '—');
  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtDate = (v: unknown, withYear = true): string => {
    if (!v) return '—';
    const s = String(v);
    const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
    if (isNaN(+d)) return s;
    const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : toIso(d);
    const full = f.date(iso);
    if (withYear) return full;
    // Same effective format with the year part (and its separator) removed.
    const year = iso.slice(0, 4);
    return full.replace(new RegExp(`^${year}[-/.\\s]|[-/.\\s]${year}$`), '').trim();
  };
  const fmtTime = (v: unknown, seconds = false): string => {
    if (v === null || v === undefined || v === '') return '—';
    return f.time(v instanceof Date ? v : String(v), { seconds });
  };
  const fmtValue = (field: Field, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    switch (field.type) {
      case 'currency': return fmtCurrency(Number(v));
      case 'number': return fmtNumber(Number(v));
      case 'percent': return `${fmtNumber(Number(v))}%`;
      case 'date': return fmtDate(v);
      case 'time': return fmtTime(v);
      case 'boolean': return v ? 'Yes' : 'No';
      default: return String(v);
    }
  };
  const amountInWords = (v: number): string => {
    const whole = Math.floor(Math.abs(v));
    const cents = Math.round((Math.abs(v) - whole) * 100);
    const unit = prefs.currencyCode === 'USD' ? 'Dollars' : prefs.currencyCode;
    return `${whole ? words(whole) : 'Zero'} ${unit}${cents ? ` and ${words(cents)} Cents` : ''} only`;
  };
  return { fmtCurrency, fmtCompact, fmtNumber, fmtDate, fmtTime, fmtValue, amountInWords, fmtLocale };
}

/** Per-component formatter derived from the host's effective preferences. */
export function useFormat(): ReferenceFormat {
  const { preferences: p } = useReferenceHost();
  return useMemo(() => createReferenceFormat(p), [p.currencyCode, p.numberLocale, p.dateFormat, p.decimalPlaces, p.timeFormat, p.currencyDisplay, p.negativeStyle, p.language]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const isNumeric = (f: Field) => f.type === 'number' || f.type === 'currency' || f.type === 'percent';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'brand' | 'violet';

const TONES: [RegExp, Tone][] = [
  [/^(active|approved|paid|completed|pass(ed)?|posted|delivered|confirmed|resolved|present|received|done|enabled|balanced|available|admitted)$/i, 'ok'],
  [/^(pending|draft|submitted|partially|partially paid|in progress|upcoming|scheduled|waiting|on hold|probation|booked|running|unpaid|on leave|half day|normal)$/i, 'warn'],
  [/^(rejected|cancelled|overdue|fail(ed)?|inactive|expired|blocked|critical|urgent|absent|no show|obsolete|exited|reversed|disabled|lost)$/i, 'danger'],
  [/^(open|new|high|sent|issued|discharged|checked in|in service)$/i, 'info'],
  [/^(withdrawn|closed|archived)$/i, 'neutral'],
];

export function statusTone(s: unknown): Tone {
  const str = String(s ?? '');
  for (const [re, tone] of TONES) if (re.test(str)) return tone;
  return 'neutral';
}

export function initials(name: unknown): string {
  const parts = String(name ?? '').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toISO(d);
}
export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
export function daysBetween(a: string, b: string): number {
  return Math.round((+new Date(`${b}T00:00:00`) - +new Date(`${a}T00:00:00`)) / 86400000);
}
export function relativeDays(iso: string): string {
  const d = daysBetween(iso, todayISO());
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d > 1) return `${d}d ago`;
  if (d === -1) return 'tomorrow';
  return `in ${-d}d`;
}
