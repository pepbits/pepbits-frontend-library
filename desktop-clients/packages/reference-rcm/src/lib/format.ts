"use client";
import { useMemo } from "react";
import { useReferenceFormat, useReferenceHost } from "@pepbits/reference-host";
import type { Branch, Tone } from "./types";

/** Acronyms the source keeps upper case when it turns a code like `DEAD_LETTER` into words. */
const KEEP = new Set(["DRG", "CDI", "GL", "EFT", "ERP", "SAP", "IDOC", "JSON", "CSV", "TPA", "EM", "P4P", "AI", "SMS", "SAR", "AED", "X12", "REST", "L2", "L3", "L4", "L5"]);

/** Server codes (statuses, reasons, methods) as words. A code is a value: this only changes how it is shown. */
export function humanize(code: string | null | undefined): string {
  if (!code) return "";
  return String(code).split("_").map((w, i) => (KEEP.has(w) ? w : i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase())).join(" ");
}

export const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");
/** Today as the source computes it: a UTC calendar day (the server's `todayUtc`). */
export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Days from today to an ISO date (negative = past). */
export function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso + "T00:00:00Z").getTime() - new Date(todayIso() + "T00:00:00Z").getTime()) / 86400000);
}

/**
 * The source's tone classes, kept verbatim: the Tailwind scanner reads these literals so the palette utilities exist in the
 * generated stylesheet. `ring-*` stays inside the source palette; the dark-theme neutrals are remapped by styles.mjs.
 */
export const TONE: Record<Tone, { pill: string; dot: string; text: string; bar: string; soft: string }> = {
  info: { pill: "bg-cobalt-50 text-cobalt-700 ring-cobalt-100", dot: "bg-cobalt-500", text: "text-cobalt-700", bar: "bg-cobalt-500", soft: "bg-cobalt-50" },
  progress: { pill: "bg-signal-50 text-signal-700 ring-signal-100", dot: "bg-signal-500", text: "text-signal-700", bar: "bg-signal-500", soft: "bg-signal-50" },
  attention: { pill: "bg-saffron-50 text-saffron-700 ring-saffron-100", dot: "bg-saffron-500", text: "text-saffron-700", bar: "bg-saffron-500", soft: "bg-saffron-50" },
  success: { pill: "bg-jade-50 text-jade-700 ring-jade-100", dot: "bg-jade-500", text: "text-jade-700", bar: "bg-jade-500", soft: "bg-jade-50" },
  danger: { pill: "bg-madder-50 text-madder-700 ring-madder-100", dot: "bg-madder-500", text: "text-madder-700", bar: "bg-madder-500", soft: "bg-madder-50" },
  muted: { pill: "bg-mist text-muted ring-line", dot: "bg-slate-soft", text: "text-muted", bar: "bg-slate-soft", soft: "bg-mist" },
};

/** Scope is a branch code or ALL:<currency>. Every total on screen is in exactly one currency. */
export function scopeInfo(branches: readonly Branch[], scope: string, t: (message: string, values?: Record<string, string | number>) => string) {
  const b = branches.find((x) => x.value === scope);
  if (b) return { label: b.short, long: b.label, currency: b.currency, branches: [b.value] };
  const cur = scope.startsWith("ALL:") ? scope.slice(4) : branches[0]?.currency ?? "SAR";
  const list = branches.filter((x) => x.currency === cur);
  return {
    label: t("All {value0} branches", { value0: cur }),
    long: t("All {value0} branches ({value1})", { value0: cur, value1: list.map((x) => x.short).join(", ") }),
    currency: cur, branches: list.map((x) => x.value),
  };
}

/** The scope the source opens with (`ALL:SAR`), chosen from the branches the server lists. */
export const defaultScope = (branches: readonly Branch[]) => `ALL:${branches.find((b) => b.currency === "SAR")?.currency ?? branches[0]?.currency ?? "SAR"}`;
export const validScope = (branches: readonly Branch[], scope: string | null | undefined): scope is string =>
  !!scope && (branches.some((b) => b.value === scope) || branches.some((b) => `ALL:${b.currency}` === scope));

/** Used only to read the hour and minute out of Intl parts as Latin digits; nothing formatted with it is displayed. */
const PARSE_LOCALE = "en-u-nu-latn";

const asDate = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
/** Drops the year from a host-formatted date ("01 Oct 2026" -> "01 Oct", "2026-10-01" -> "10-01"). */
const withoutYear = (formatted: string) => formatted.replace(/^\d{4}[-/\s]|[-/\s]\d{4}$/, "");

/**
 * Display formatting through the host's effective preferences (date, time, number and amount formats, language). The source's
 * fixed en-GB / en-US formatting is gone. Amounts keep the source's `CUR 1,234.50` shape with the record's own currency code,
 * because a record is in exactly one currency regardless of the user's preferred display currency. Record values are never transformed.
 */
export function useRcmFormat() {
  const { preferences } = useReferenceHost();
  const { t, date: hostDate, time: hostTime, dateTime: hostDateTime } = useReferenceFormat();
  const { numberLocale, language, dateFormat, timeFormat, decimalPlaces, negativeStyle } = preferences;
  return useMemo(() => {
    // Receivable amounts keep the source's two decimals: the host default of 0 places would hide cents that the ledger reconciles to.
    const places = Math.max(2, decimalPlaces);
    const full = new Intl.NumberFormat(numberLocale, { minimumFractionDigits: places, maximumFractionDigits: places });
    const whole = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 });
    const none = (n: unknown): n is null | undefined => n === null || n === undefined || (typeof n === "number" && Number.isNaN(n));
    const parentheses = negativeStyle === "parentheses";

    /** `CUR 1,234.50`; compact amounts drop to whole numbers below 10,000 and to K/M above, as the source does. */
    const money = (n: number | null | undefined, currency?: string | null, opts: { compact?: boolean; sign?: boolean } = {}): string => {
      if (none(n)) return "—";
      const f = opts.compact ? (Math.abs(n) >= 10000 ? compact : whole) : full;
      const s = f.format(Math.abs(n));
      const body = `${currency ? currency + " " : ""}${s}`;
      if (n < 0) return parentheses ? `(${body})` : `−${body}`;
      return opts.sign && n > 0 ? `+${body}` : body;
    };
    const num = (n: number) => whole.format(n);
    const pct = (n: number | string) => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(Number(n));
    /** A decimal as stored on a record (two places, no currency). */
    const dec = (n: number | string) => full.format(Number(n));

    const date = (iso: string | null | undefined, withYear = true): string => {
      if (!iso) return "—";
      const full = iso.length === 10 ? hostDate(iso) : hostDate(new Date(iso));
      return withYear ? full : withoutYear(full);
    };
    const dateTime = (iso: string | null | undefined) => (iso ? hostDateTime(asDate(iso)) : "—");
    const time = (value: Date | string) => hostTime(value);
    /** "5 min ago", "2 h ago", "just now"; older than 45 days falls back to the host date. */
    const relative = (iso: string) => {
      const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      if (m < 1) return t("just now");
      if (m < 60) return t("{value0} min ago", { value0: whole.format(m) });
      const h = Math.round(m / 60);
      if (h < 24) return t("{value0} h ago", { value0: whole.format(h) });
      const d = Math.round(h / 24);
      return d < 45 ? t("{value0} d ago", { value0: whole.format(d) }) : date(iso);
    };
    const dueText = (iso: string | null | undefined): { text: string; tone: "danger" | "attention" | "muted" } | null => {
      const d = daysFromToday(iso);
      if (d === null) return null;
      if (d < 0) return { text: t("{value0} d overdue", { value0: whole.format(-d) }), tone: "danger" };
      if (d === 0) return { text: t("Due today"), tone: "attention" };
      if (d <= 3) return { text: t("Due in {value0} d", { value0: whole.format(d) }), tone: "attention" };
      return { text: date(iso, false), tone: "muted" };
    };
    /** Wall-clock time in the tenant's zone, in the host's time format ("Mon 14:05"-style weekday is dropped: the host owns date shapes). */
    const clock = (timeZone: string) => {
      try {
        const parts = new Intl.DateTimeFormat(PARSE_LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(new Date());
        const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
        return hostTime(new Date(2000, 0, 1, get("hour"), get("minute")));
      } catch { return ""; }
    };
    /** Short month name for a `YYYY-MM` bucket, in the interface language. */
    const month = (ym: string) => new Intl.DateTimeFormat(language === "ar" ? "ar" : language ?? "en", { month: "short", timeZone: "UTC" }).format(new Date(ym + "-01T00:00:00Z"));
    return { t, money, num, dec, pct, date, dateTime, time, relative, dueText, clock, month };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, numberLocale, language, dateFormat, timeFormat, decimalPlaces, negativeStyle, hostDate, hostTime, hostDateTime]);
}
