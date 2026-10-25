'use client';
import {useMemo} from 'react';
import {LANGUAGE_LOCALES} from '@pepbits/i18n';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {usePreferences} from '@pepbits/preferences/react';

/** Amounts, dates and times use the host's effective formatter (PREF-06): currency, locale,
 * decimals, negative style, date and time formats all come from accepted preferences. */
export function useFormat() {
  const f = useFormatters();
  const {preferences} = usePreferences();
  return useMemo(() => {
    const locale = LANGUAGE_LOCALES[preferences.language] ?? 'en';
    const money = (n: number | null | undefined, opts: {sign?: boolean; whole?: boolean} = {}) => {
      const v = Number(n || 0), shown = opts.whole ? Math.round(v) : v;
      return (opts.sign && v > 0.004 ? '+' : '') + f.money(shown);
    };
    const dateTime = (s?: string | null) => (s ? f.dateTime(s) : '—');
    const date = (s?: string | null) => (s ? f.date(s) : '—');
    const time = (s?: string | null) => (s ? f.time(s) : '—');
    const relative = (s?: string | null) => {
      if (!s) return '—';
      const diff = (Date.now() - new Date(s).getTime()) / 1000;
      const rtf = new Intl.RelativeTimeFormat(locale, {numeric: 'auto', style: 'short'});
      if (diff < 60) return rtf.format(0, 'second');
      if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
      if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
      if (diff < 86400 * 7) return rtf.format(-Math.floor(diff / 86400), 'day');
      return date(s);
    };
    const weekdayDate = (s: string) => new Intl.DateTimeFormat(locale, {weekday: 'short'}).format(new Date(s)) + ', ' + f.date(s);
    const longDay = (s: Date) => new Intl.DateTimeFormat(locale, {weekday: 'long'}).format(s) + ', ' + f.date(s);
    return {money, num: (n: number) => f.number(n), dateTime, date, time, relative, weekdayDate, longDay, currencyCode: preferences.currencyCode};
  }, [f, preferences.language, preferences.currencyCode]);
}
export type SettleFormat = ReturnType<typeof useFormat>;

export const isZero = (n: number) => Math.abs(n) < 0.005;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Machine dates for native inputs and API filters (ISO, local calendar day). */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const daysAgoISO = (n: number) => {
  const d = new Date(Date.now() - n * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const age = (dob?: string | null) => {
  if (!dob) return null;
  const d = new Date(dob);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a;
};

export const STATUS = {
  A: {label: 'Open', tone: 'sky'},
  F: {label: 'Finalized', tone: 'indigo'},
  C: {label: 'Closed', tone: 'pine'},
  X: {label: 'Cancelled', tone: 'rose'},
} as const;

export const billTypeLabel = (t: 'P' | 'C') => (t === 'P' ? 'Bill Now' : 'Bill Later');
export const restrictionLabel = (r: string) => ({N: 'Hospital', P: 'Pharmacy', T: 'Test'}[r] || r);
export const availabilityLabel = (a: string) => ({H: 'Hospital', P: 'Pharmacy', B: 'Hospital & pharmacy'}[a] || a);
export const claimStatusLabel = (s: string) => ({O: 'Not sent', S: 'Sent', R: 'Received'}[s] || s);
export const roleLabel = (r: string) => ({admin: 'Administrator', billing: 'Billing executive', cashier: 'Cashier', finance: 'Finance manager'}[r] || r);
export const kindLabel = (k: string) => ({discount: 'Discount', writeoff: 'Write-off', cancellation: 'Bill cancellation'}[k] || k);

export const GROUP_LABEL: Record<string, string> = {
  REG: 'Registration', DOC: 'Consultation', DIA: 'Diagnostics', BED: 'Room', ICU: 'ICU', OPE: 'Surgery', MED: 'Medicines', ITE: 'Consumables',
  OTC: 'Other', SNP: 'Nursing', DIE: 'Diet', ROF: 'Round-off', PKG: 'Package',
};
