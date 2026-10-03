"use client";
import { useMemo } from "react";
import { useReferenceFormat, useReferenceHost } from "@pepbits/reference-host";
import type { Status } from "./types";

/** Acronyms the source keeps upper case when it turns a code like `MPR_TABLE` into words. */
const KEEP = new Set(["FFS", "DRG", "MPR", "PMPM", "P4P", "TPA", "GL", "AR", "OOP", "REST", "JSON", "XML", "SOAP", "X12", "FHIR", "NPHIES", "MTLS", "HMAC", "OAUTH2", "EM", "SMS", "AI", "SAR", "AED", "USD"]);

/** Server codes (care settings, models, audit actions) as words. A code is a value: this only changes how it is shown. */
export function humanize(code: string | null | undefined): string {
  if (!code) return "";
  return code
    .split("_")
    .map((w, i) => (KEEP.has(w) ? w : i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(" ");
}

/** English catalog messages; render them through t(). */
export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft", PENDING_APPROVAL: "Awaiting approval", APPROVED: "Approved", REJECTED: "Returned",
  RETIRED: "Retired", SUPERSEDED: "Superseded", ACTIVE: "Active", INACTIVE: "Inactive",
};

/** Today as a YYYY-MM-DD calendar day in the viewer's zone (record dates are plain calendar days). */
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Used only to read the hour and minute out of Intl parts as Latin digits; nothing formatted with it is displayed. */
const PARSE_LOCALE = "en-u-nu-latn";

const asDate = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso);

/**
 * Display formatting through the host's effective preferences (date, time and number formats, language). The source's fixed
 * en-GB / en-US formatting is gone. Record values (names, codes, notes) are never transformed.
 */
export function useTenantFormat() {
  const { preferences } = useReferenceHost();
  const { t, date: hostDate, time: hostTime, dateTime: hostDateTime } = useReferenceFormat();
  const { numberLocale, language, dateFormat, timeFormat } = preferences;
  return useMemo(() => {
    const nf0 = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 });
    const decimal = new Intl.NumberFormat(numberLocale, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
    const money = new Intl.NumberFormat(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    const none = (n: unknown): n is null | undefined => n === null || n === undefined || (typeof n === "number" && Number.isNaN(n));
    /** A whole count. */
    const int = (n: number | null | undefined) => (none(n) ? "—" : nf0.format(n));
    /** A decimal or percentage as stored on a record (no currency: the page names it). */
    const dec = (n: number | string | null | undefined) => (none(n) || n === "" ? "—" : decimal.format(Number(n)));
    /** A monetary amount as stored on a record (two to six decimals, no currency symbol). */
    const amount = (n: number | string | null | undefined) => (none(n) || n === "" ? "—" : money.format(Number(n)));
    const date = (iso?: string | null) => (iso ? (iso.length === 10 ? hostDate(iso) : hostDate(new Date(iso))) : "—");
    const dateTime = (iso?: string | null) => (iso ? hostDateTime(asDate(iso)) : "—");
    const time = (iso?: string | null) => (iso ? hostTime(asDate(iso)) : "—");
    /** "5 min ago", "2 h ago", "just now"; older than a month falls back to the host date. */
    const relative = (iso: string) => {
      const diff = Date.now() - new Date(iso).getTime();
      const m = Math.round(diff / 60000);
      if (m < 1) return t("just now");
      if (m < 60) return t("{value0} min ago", { value0: nf0.format(m) });
      const h = Math.round(m / 60);
      if (h < 24) return t("{value0} h ago", { value0: nf0.format(h) });
      const d = Math.round(h / 24);
      if (d < 30) return t("{value0} d ago", { value0: nf0.format(d) });
      return date(iso);
    };
    /** The wall-clock time in the tenant's time zone, in the host's time format. Empty when the zone is unknown. */
    const clock = (timeZone: string) => {
      try {
        const parts = new Intl.DateTimeFormat(PARSE_LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(new Date());
        const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
        return hostTime(new Date(2000, 0, 1, get("hour"), get("minute")));
      } catch { return ""; }
    };
    const statusLabel = (s: Status) => t(STATUS_LABEL[s]);
    return { t, int, dec, amount, date, dateTime, time, relative, clock, statusLabel };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, numberLocale, language, dateFormat, timeFormat, hostDate, hostTime, hostDateTime]);
}
