"use client";
import {useCallback} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";

/** Clock times in the effective time-format preference. */
export function useClock() {
  const format = useFormatters();
  return useCallback((iso?: string) => (iso ? format.time(new Date(iso)) : "—"), [format]);
}

/** "5 minutes ago" in the interface language; older than a week falls back to the date preference. */
export function useRelativeTime() {
  const format = useFormatters(), {language} = useLocalization();
  return useCallback((iso: string, now: Date = new Date()) => {
    const diff = (new Date(iso).getTime() - now.getTime()) / 1000, abs = Math.abs(diff);
    let rtf: Intl.RelativeTimeFormat;
    try { rtf = new Intl.RelativeTimeFormat(language, {numeric: "auto"}); } catch { rtf = new Intl.RelativeTimeFormat("en", {numeric: "auto"}); }
    if (abs < 45) return rtf.format(0, "second");
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
    if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
    return format.date(new Date(iso));
  }, [format, language]);
}

/** Waiting time as "45 min" or "2 h 5 min", as in the source workspace. */
export const waitLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`);
