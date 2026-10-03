"use client";
import { useMemo } from "react";
import { LANGUAGE_LOCALES } from "@pepbits/erp-config";
import { useReferenceFormat, useReferenceHost } from "@pepbits/reference-host";
import { ageParts, daysBetween } from "./utils";

/** A bare calendar day (yyyy-mm-dd) has no zone: it is read as a local day. Timestamps become instants. */
const asDate = (iso: string) => {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(iso);
};

/**
 * Display formatting through the host's effective preferences (date and time format, number locale, currency, language).
 * The source called toLocaleDateString/toLocaleString with the browser locale and fixed en-US USD for amounts; here every
 * displayed date, time, age and amount follows the user's preferences. Machine values (inputs, API payloads) are untouched.
 */
export function useMedbandFormat() {
  const { date, time, dateTime, money, number, t } = useReferenceFormat();
  const { language } = useReferenceHost().preferences;
  return useMemo(() => {
    const locale = LANGUAGE_LOCALES[language ?? "en"];
    const valid = (iso?: string) => !!iso && !Number.isNaN(asDate(iso).getTime());
    const fmtDate = (iso?: string) => (valid(iso) ? date(asDate(iso!)) : "");
    const fmtDateTime = (iso?: string) => (valid(iso) ? dateTime(asDate(iso!)) : "");
    const fmtTime = (iso?: string) => (valid(iso) ? time(asDate(iso!)) : "");
    /** "Monday 21-09-2026": the weekday in the chosen language, then the date in the chosen format. */
    const fmtDay = (d: Date) => `${new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d)} ${date(d)}`;
    const fmtAmount = (n: number) => money(n);
    const ageOf = (dob: string, at = new Date()) => {
      const a = ageParts(dob, at);
      return a ? t(a.unit === "y" ? "{value0}y" : "{value0}m", { value0: number(a.value) }) : "";
    };
    /** today, yesterday, tomorrow, "3 days ago", "in 3 days": the whole phrase so every language can order it. */
    const relativeDay = (iso: string, now = new Date()) => {
      const diff = daysBetween(asDate(iso), now);
      if (diff === 0) return t("today");
      if (diff === 1) return t("yesterday");
      if (diff === -1) return t("tomorrow");
      if (diff > 0) return t("{value0} days ago", { value0: number(diff) });
      return t("in {value0} days", { value0: number(-diff) });
    };
    return { fmtDate, fmtDateTime, fmtTime, fmtDay, fmtAmount, ageOf, relativeDay, fmtNumber: number };
  }, [date, time, dateTime, money, number, t, language]);
}
