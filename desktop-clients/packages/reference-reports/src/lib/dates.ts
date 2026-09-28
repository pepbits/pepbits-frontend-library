/*
 * Port of lumen-reports src/lib/dates.ts without luxon. Calendar dates stay plain YYYY-MM-DD strings;
 * "today" is read in the organisation's reporting time zone with Intl, exactly as the server does
 * (dummy-api/reference-reports-engine.mjs), so the range meter shows the period the server will run.
 */
import type { DatePreset, DateRangeValue, Frequency } from '../types';

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  this_month: 'This month',
  last_month: 'Last month',
  this_quarter: 'This quarter',
  last_quarter: 'Last quarter',
  this_year: 'This year',
  last_year: 'Last year',
  last_12_months: 'Last 12 months',
  last_3_years: 'Last 3 years',
  last_5_years: 'Last 5 years',
  last_10_years: 'Last 10 years',
  custom: 'Custom range',
};

export const PRESETS = Object.keys(PRESET_LABELS) as DatePreset[];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
const toUtc = (iso: string) => { const { y, m, d } = parts(iso); return Date.UTC(y, m - 1, d); };
const fromUtc = (t: number) => { const x = new Date(t); return ymd(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); };
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * 86400000);
function addMonths(iso: string, n: number) {
  const { y, m, d } = parts(iso);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  return ymd(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const { y, m, d } = parts(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function validTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

/** Wall-clock parts of an instant in a time zone. */
export function zoneParts(instant: Date | string | number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: validTimeZone(tz) ? tz : 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${pad(Number(p.hour) % 24)}:${p.minute}:${p.second}` };
}

/** Resolves a preset or custom range to inclusive ISO dates in the given time zone. */
export function resolveRange(v: DateRangeValue | undefined, tz: string, now: Date = new Date()): { from: string; to: string } {
  const today = zoneParts(now, tz).date;
  const { y, m } = parts(today);
  const monthEnd = (yy: number, mm: number) => ymd(yy, mm, daysInMonth(yy, mm));
  const quarter = (iso: string) => { const p = parts(iso); const qs = Math.floor((p.m - 1) / 3) * 3 + 1; return { from: ymd(p.y, qs, 1), to: monthEnd(p.y, qs + 2) }; };
  const years = (n: number) => ({ from: addDays(addMonths(today, -12 * n), 1), to: today });
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
      const from = isIsoDate(v?.from) ? v!.from! : addDays(today, -29);
      const to = isIsoDate(v?.to) ? v!.to! : today;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

export function rangeDays(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86400000) + 1;
}

export function describeRange(v: DateRangeValue | undefined): string {
  if (!v) return PRESET_LABELS.last_30_days;
  if (v.preset === 'custom') return `${v.from ?? '?'} to ${v.to ?? '?'}`;
  return PRESET_LABELS[v.preset];
}

// Port of lumen-reports src/lib/schedule.ts (display helpers only; next-run maths stays on the server).
const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function describeTiming(s: { frequency: Frequency; dayOfWeek: number; dayOfMonth: number; hour: number; minute: number; timezone: string }): string {
  const time = `${pad(s.hour)}:${pad(s.minute)}`;
  const when = s.frequency === 'daily' ? 'Every day' : s.frequency === 'weekly' ? `Every ${DAYS[s.dayOfWeek]}` : `Monthly on day ${s.dayOfMonth}`;
  return `${when} at ${time} (${s.timezone})`;
}
export const COMMON_TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
