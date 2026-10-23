import { LANGUAGE_LOCALES } from "./core";
import type { FormatColumn, FormatOptions } from "./types";

/* Value formatting takes explicit host options so numeric preferences remain
   independent of the interface language and UI primitives stay reusable. */

export interface Formatters {
  money(value: number): string;
  /** A clock time. Accepts "HH:MM[:SS]" or the time half of an ISO string.
      `seconds` appends them in whichever of 12h/24h is configured. */
  time(value: string | Date, options?: { seconds?: boolean }): string;
  /** Date and time together, each in its own configured format. */
  dateTime(value: string | Date): string;
  compact(value: number): string;
  number(value: number): string;
  percent(value: number | string): string;
  date(value: string | Date): string;
  /** Format by the column's declared type. The single entry point for a cell. */
  cell(column: FormatColumn | undefined, value: unknown): string;
}




/* Parsed by hand rather than with `new Date(value)`: the mock data is plain
   YYYY-MM-DD, and Date would read that as UTC midnight and then render it in
   the viewer's local zone -- which shifts every date back a day for anyone west
   of Greenwich. A calendar date has no timezone; treat it as three numbers. */
function parseDate(value: string): { y: string; m: string; d: string; month: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { y: match[1]!, m: match[2]!, d: match[3]!, month };
}

export function createFormatters(preferences: FormatOptions): Formatters {
  const { currencyCode, numberLocale, dateFormat, decimalPlaces,
          timeFormat, currencyDisplay, negativeStyle } = preferences;

  /* currencySign:"accounting" is what produces (1,200) rather than -1,200 --
     done by Intl rather than by hand so the parenthesis lands where each locale
     puts it relative to the symbol, which is not the same everywhere. */
  const languageLocale = LANGUAGE_LOCALES[preferences.language ?? "en"];
  const months = Array.from({length: 12}, (_, month) => new Intl.DateTimeFormat(languageLocale, {month: "short", timeZone: "UTC"}).format(new Date(Date.UTC(2020, month, 1))));
  const periods = [0, 12].map(hour => new Intl.DateTimeFormat(languageLocale, {hour: "numeric", hour12: true, timeZone: "UTC"}).formatToParts(new Date(Date.UTC(2020, 0, 1, hour))).find(part => part.type === "dayPeriod")?.value ?? (hour ? "PM" : "AM"));
  const accounting = negativeStyle === "parentheses";
  const money = currencyDisplay === "none"
    ? new Intl.NumberFormat(numberLocale, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
        signDisplay: accounting ? "never" : "auto",
      })
    : new Intl.NumberFormat(numberLocale, {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: currencyDisplay === "code" ? "code" : "symbol",
        currencySign: accounting ? "accounting" : "standard",
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

  /* Only for the paths Intl does NOT parenthesise itself. currencySign:
     "accounting" already yields (AED 1,200); wrapping that too produced
     ((AED 1,200)). signDisplay:"never" strips the minus first, or this would
     read (-1,200). */
  const wrapNegative = (formatted: string, value: number) =>
    accounting && value < 0 ? `(${formatted})` : formatted;

  /* currencyDisplay:"none" drops to the plain decimal formatter, which has no
     currencySign option -- so that path, and only that path, needs the wrapper. */
  const currencyless = currencyDisplay === "none";
  const formatMoney = (value: number) =>
    currencyless ? wrapNegative(money.format(value), value) : money.format(value);
  const plain = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: decimalPlaces, signDisplay: accounting ? "never" : "auto" });
  const compact = new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 });

  /* A Date is reduced to its LOCAL calendar parts, never via toISOString():
     that converts to UTC first, so any local time before the offset rolls the
     date back a day for anyone east of Greenwich -- Dubai included. */
  const isoOf = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

  const date = (value: string | Date): string => {
    if (value instanceof Date) value = isoOf(value);
    const parts = parseDate(value);
    if (!parts) return value;                       // not a date; leave it alone
    switch (dateFormat) {
      case "dmy":    return `${parts.d}/${parts.m}/${parts.y}`;
      case "mdy":    return `${parts.m}/${parts.d}/${parts.y}`;
      case "medium": return `${parts.d} ${months[parts.month - 1]} ${parts.y}`;
      default:       return `${parts.y}-${parts.m}-${parts.d}`;
    }
  };

  /* Read off the string rather than through Date, for the same reason dates are:
     "14:30" has no timezone, and routing it through Date would anchor it to
     today in UTC and then shift it by the viewer's offset. */
  const time = (value: string | Date, options?: { seconds?: boolean }): string => {
    let h: number;
    let m: string;
    let sec: string | null = null;
    if (value instanceof Date) {
      h = value.getHours();
      m = String(value.getMinutes()).padStart(2, "0");
      sec = String(value.getSeconds()).padStart(2, "0");
    } else {
      const match = /(?:^|[T\s])(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value);
      if (!match) return String(value);
      h = Number(match[1]);
      m = match[2]!;
      sec = match[3] ?? null;
      if (h > 23) return String(value);
    }
    /* Seconds appear only when the caller asks AND the source had them -- a
       "14:30" string must not gain a fabricated ":00". */
    const tail = options?.seconds && sec !== null ? `:${sec}` : "";
    if (timeFormat === "24h") return `${String(h).padStart(2, "0")}:${m}${tail}`;
    // 00:xx is 12 AM and 12:xx is 12 PM -- the two cases a plain h % 12 gets wrong.
    const suffix = periods[h < 12 ? 0 : 1];
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m}${tail} ${suffix}`;
  };

  const percent = (value: number | string) => wrapNegative(`${plain.format(Number(value))}%`, Number(value));

  const dateTime = (value: string | Date): string => {
    if (value instanceof Date) return `${date(value)} ${time(value)}`;
    const stamp = time(value);
    const day = date(value);
    return stamp === value ? day : `${day} ${stamp}`;
  };

  return {
    money: (value) => formatMoney(Number(value) || 0),
    compact: (value) => compact.format(Number(value) || 0),
    number: (value) => wrapNegative(plain.format(Number(value) || 0), Number(value) || 0),
    percent,
    date,
    time,
    dateTime,
    cell(column, value) {
      if (value === null || value === undefined || value === "") return "—";
      switch (column?.type) {
        case "money":   return formatMoney(Number(value) || 0);
        case "percent": return percent(value as number);
        case "number":  return wrapNegative(plain.format(Number(value) || 0), Number(value) || 0);
        case "date":    return /[T\s]\d{1,2}:\d{2}/.test(String(value)) ? dateTime(String(value)) : date(String(value));
        default:
          /* An untyped column can still hold a date, so a bare YYYY-MM-DD
             is formatted even when a host has not tagged the column.
             parseDate returns null for anything else, which passes through. */
          if (typeof value === "string" && parseDate(value)) return date(value);
          return String(value);
      }
    },
  };
}

/** Compact currency values retain the host's currency visibility and negative style. */
export function formatCompactMoney(preferences:FormatOptions,value:unknown):string {
 if(typeof value!=='number'||!Number.isFinite(value))return '—';
 const accounting=preferences.negativeStyle==='parentheses';
 const formatter=new Intl.NumberFormat(preferences.numberLocale,{notation:'compact',maximumFractionDigits:1,signDisplay:accounting?'never':'auto',...(preferences.currencyDisplay==='none'?{}:{style:'currency',currency:preferences.currencyCode,currencyDisplay:preferences.currencyDisplay==='code'?'code':'symbol'})});
 const text=formatter.format(value);return accounting&&value<0?`(${text})`:text;
}
/** Calendar display without a year; native input values remain unchanged. */
export function formatShortDate(preferences:FormatOptions,value:string):string {
 const full=createFormatters(preferences).date(value),parts=parseDate(value);return parts?full.replace(new RegExp(`^${parts.y}[-/.\\s]|[-/.\\s]${parts.y}$`),'').trim():full;
}
