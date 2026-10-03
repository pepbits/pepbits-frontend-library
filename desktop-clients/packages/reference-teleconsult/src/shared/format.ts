"use client";
import { useMemo } from "react";
import { LANGUAGE_LOCALES } from "@pepbits/erp-config";
import { useReferenceFormat, useReferenceHost } from "@pepbits/reference-host";

/**
 * Display formatting through the host's effective preferences (date/time format, language). Timestamps
 * are formatted from a local Date so the viewer's zone is honoured; the pure helpers in each variant's
 * lib/format.ts hold only identity/arithmetic.
 */
export function useTeleconsultFormat() {
  const {date, time, dateTime, number, t} = useReferenceFormat();
  const language = useReferenceHost().preferences.language;
  return useMemo(() => {
    const locale = LANGUAGE_LOCALES[language ?? "en"];
    // A bare calendar date (date of birth, a date field value) has no zone: read it as local year-month-day, never as UTC midnight.
    const asDate = (value: string | Date) => {
      if (value instanceof Date) return value;
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
    };
    const weekday = (value: string | Date, style: "short" | "long") => new Intl.DateTimeFormat(locale, { weekday: style }).format(asDate(value));
    const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fmtDate = (value: string | Date) => date(asDate(value));
    const fmtTime = (value: string | Date) => time(asDate(value));
    const fmtDay = (value: string | Date, style: "short" | "long" = "short") => `${weekday(value, style)}, ${fmtDate(value)}`;
    const relDay = (value: string | Date) => {
      const d = asDate(value);
      const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
      if (diff === 0) return t("Today");
      if (diff === 1) return t("Tomorrow");
      if (diff === -1) return t("Yesterday");
      return fmtDay(d);
    };
    return { fmtDate, fmtTime, fmtDay, relDay, fmtWeekday: weekday, fmtDateTime: (value: string | Date) => dateTime(asDate(value)), fmtHour: (hour: number) => time(new Date(2000, 0, 1, hour)), number, isoDay };
  }, [date, time, dateTime, number, t, language]);
}
