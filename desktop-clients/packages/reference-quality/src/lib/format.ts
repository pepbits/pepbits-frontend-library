"use client";
import { useMemo } from "react";
import { LANGUAGE_LOCALES } from "@pepbits/erp-config";
import { useReferenceFormat, useReferenceHost } from "@pepbits/reference-host";
import type { KpiStatus, Unit } from "./types";

/** Pure helpers: identity and arithmetic only. Everything shown to a reader goes through useQualityFormat(). */
export const STATUS_LABEL: Record<KpiStatus, string> = {
  on_target: "On target",
  warning: "Watch",
  breach: "Off target",
  no_data: "No data",
};

export function unitLabel(unit: Unit | string): string {
  return ({ percent: "%", minutes: "minutes", per_1000: "per 1,000", count: "count" } as Record<string, string>)[unit] ?? unit;
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  const t = s.replace(/[._]/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function delta(current: number | null, previous: number | null, direction: "higher" | "lower") {
  if (current === null || previous === null) return null;
  const d = current - previous;
  const improving = direction === "higher" ? d > 0 : d < 0;
  return { d, improving, flat: Math.abs(d) < 1e-9 };
}

export function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const none = (v: unknown) => v === null || v === undefined || v === "" || (typeof v === "number" && Number.isNaN(v));
/** A bare calendar day (YYYY-MM-DD) has no zone: read it as a local day. Timestamps become instants. */
const asDate = (value: string | Date) => {
  if (value instanceof Date) return value;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
};

/**
 * Display formatting through the host's effective preferences (date and time format, number locale, language).
 * The source fixed en-GB and Asia/Dubai; here dates follow the user's date/time preference in the viewer's zone and
 * numbers use the preferred number locale (the source's fixed decimals per unit are kept: they are meaning, not style).
 */
export function useQualityFormat() {
  const { date, time, dateTime, t } = useReferenceFormat();
  const { numberLocale, language } = useReferenceHost().preferences;
  return useMemo(() => {
    const locale = LANGUAGE_LOCALES[language ?? "en"];
    const numbers = new Map<number, Intl.NumberFormat>();
    const fmtNumber = (n: number | null | undefined, dp = 0): string => {
      if (none(n)) return "—";
      let f = numbers.get(dp);
      if (!f) { f = new Intl.NumberFormat(numberLocale, { minimumFractionDigits: dp, maximumFractionDigits: dp }); numbers.set(dp, f); }
      return f.format(n as number);
    };
    const fmtValue = (value: number | null | undefined, unit: Unit | string): string => {
      if (none(value)) return "—";
      switch (unit) {
        case "percent": return `${fmtNumber(value, 1)}%`;
        case "minutes": return t("{value0} min", { value0: fmtNumber(value, 1) });
        case "per_1000": return fmtNumber(value, 2);
        default: return fmtNumber(value, 0);
      }
    };
    const fmtMinutes = (min: number | null | undefined): string => {
      if (none(min)) return "—";
      const neg = (min as number) < 0;
      const m = Math.abs(min as number);
      let out: string;
      if (m < 60) out = t("{value0} min", { value0: m < 10 ? fmtNumber(m, 1) : fmtNumber(Math.round(m)) });
      else if (m < 1440) out = t("{value0} h {value1} m", { value0: fmtNumber(Math.floor(m / 60)), value1: String(Math.round(m % 60)).padStart(2, "0") });
      else out = t("{value0} d {value1} h", { value0: fmtNumber(Math.floor(m / 1440)), value1: fmtNumber(Math.round((m % 1440) / 60)) });
      return neg ? `−${out}` : out;
    };
    const periodFormat = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" });
    const fmtPeriod = (p: string | null | undefined): string => {
      if (!p) return "—";
      const [y, m] = p.split("-").map(Number);
      return periodFormat.format(new Date(Date.UTC(y, m - 1, 1)));
    };
    const fmtPeriodRange = (from: string, to: string): string => (from === to ? fmtPeriod(from) : `${fmtPeriod(from)} – ${fmtPeriod(to)}`);
    const fmtDateTime = (iso: string | null | undefined): string => (iso ? dateTime(asDate(iso)) : "—");
    const fmtDate = (iso: string | null | undefined): string => (iso ? date(asDate(iso)) : "—");
    const fmtTime = (iso: string | null | undefined): string => (iso ? time(asDate(iso), { seconds: true }) : "—");
    const dayMonth = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
    const fmtDayMonth = (iso: string | null | undefined): string => (iso ? dayMonth.format(asDate(iso)) : "—");
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const fmtRelative = (iso: string | null | undefined): string => {
      if (!iso) return "—";
      const diff = (Date.parse(iso) - Date.now()) / 1000;
      const abs = Math.abs(diff);
      if (abs < 60) return relative.format(Math.round(diff), "second");
      if (abs < 3600) return relative.format(Math.round(diff / 60), "minute");
      if (abs < 86400) return relative.format(Math.round(diff / 3600), "hour");
      if (abs < 86400 * 30) return relative.format(Math.round(diff / 86400), "day");
      return fmtDate(iso);
    };
    /** humanize() then the host translation: known codes ("open", "waived") reach the catalog, others pass through unchanged. */
    const humanizeText = (s: string | null | undefined): string => (s ? t(humanize(s)) : "—");
    return { fmtNumber, fmtValue, fmtMinutes, fmtPeriod, fmtPeriodRange, fmtDateTime, fmtDate, fmtDayMonth, fmtTime, fmtRelative, humanize: humanizeText };
  }, [date, time, dateTime, t, numberLocale, language]);
}
