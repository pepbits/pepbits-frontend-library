"use client";
import { useMemo } from "react";
import { createFormatters, LANGUAGE_LOCALES } from "@pepbits/erp-config";
import { useReferenceFormat, useReferenceHost } from "@pepbits/reference-host";
import { useShell } from "../components/shell/ShellContext";

export type Tone = "neutral" | "info" | "ok" | "warn" | "danger" | "violet" | "muted";

/** One vocabulary for every record's status, shared by pills, chain and history. Labels are English catalog messages; render them through t(). */
export const STATUS: Record<string, { label: string; tone: Tone }> = {
  // prescription
  received: { label: "Received", tone: "info" }, in_review: { label: "In review", tone: "info" }, on_hold: { label: "On hold", tone: "warn" },
  verified: { label: "Verified", tone: "ok" }, partially_dispensed: { label: "Part supplied", tone: "warn" }, dispensed: { label: "Supplied", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "muted" },
  // authorization
  requested: { label: "Requested", tone: "info" }, approved: { label: "Approved", tone: "ok" }, partially_approved: { label: "Part approved", tone: "warn" },
  denied: { label: "Denied", tone: "danger" }, expired: { label: "Expired", tone: "danger" }, needed: { label: "Needed", tone: "warn" }, not_required: { label: "Not required", tone: "muted" },
  // dispensing
  prepared: { label: "Prepared", tone: "info" }, checked: { label: "Checked", tone: "violet" }, handed_over: { label: "Handed over", tone: "ok" }, returned: { label: "Returned", tone: "warn" },
  // bill
  open: { label: "Open", tone: "info" }, finalized: { label: "Finalized", tone: "ok" }, reversed: { label: "Reversed", tone: "muted" },
  // claim
  draft: { label: "Draft", tone: "neutral" }, submitted: { label: "Submitted", tone: "info" }, rejected: { label: "Rejected", tone: "danger" },
  paid: { label: "Paid", tone: "ok" }, partially_paid: { label: "Part paid", tone: "warn" },
  // RA / payment
  partial: { label: "Partial", tone: "warn" }, posted: { label: "Posted", tone: "ok" }, allocated: { label: "Allocated", tone: "ok" }, unallocated: { label: "Unallocated", tone: "warn" },
  partially_allocated: { label: "Part allocated", tone: "warn" }, awaiting: { label: "Awaiting", tone: "info" }, patient_only: { label: "Patient paid", tone: "info" },
  // batches / PO
  available: { label: "Available", tone: "ok" }, quarantined: { label: "Quarantined", tone: "warn" }, recalled: { label: "Recalled", tone: "danger" },
  sent: { label: "Sent", tone: "info" }, partially_received: { label: "Part received", tone: "warn" },
  none: { label: "None", tone: "muted" }, complete: { label: "Complete", tone: "ok" },
  // customer orders / returns
  new: { label: "New", tone: "info" }, confirmed: { label: "Confirmed", tone: "violet" }, ready: { label: "Packed", tone: "warn" },
  out_for_delivery: { label: "Out for delivery", tone: "violet" }, completed: { label: "Completed", tone: "ok" }, refunded: { label: "Refunded", tone: "warn" },
};
/** Unknown statuses fall back to the code with underscores removed (record data: not translated). */
export const statusOf = (s?: string | null) => (s ? STATUS[s] ?? { label: s.replace(/_/g, " "), tone: "neutral" as Tone } : { label: "—", tone: "muted" as Tone });

export const ENTITY_LABEL: Record<string, string> = {
  prescription: "Prescription", authorization: "Authorization", dispensing: "Dispensing", bill: "Bill", claim: "Claim",
  remittance: "Remittance", payment: "Payment", purchase_order: "Purchase order", batch: "Batch", order: "Order", sales_return: "Credit note",
};

/** Singular and plural forms of the counted nouns, one catalog message each ("1 line", "3 lines"). Add a noun here before using it with plural(). */
const PLURAL_ONE: Record<string, string> = {
  batch: "{value0} batch", claim: "{value0} claim", day: "{value0} day", item: "{value0} item", line: "{value0} line", member: "{value0} member", product: "{value0} product", return: "{value0} return",
};
const PLURAL_MANY: Record<string, string> = {
  batch: "{value0} batches", claim: "{value0} claims", day: "{value0} days", item: "{value0} items", line: "{value0} lines", member: "{value0} members", product: "{value0} products", return: "{value0} returns",
};

/** Whole days from now to a calendar date (negative when past). Arithmetic only: nothing here is displayed. */
export const daysUntil = (d: string) => Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000);
export const age = (dob: string) => Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
/** Today as a YYYY-MM-DD calendar day in the viewer's zone (record dates are plain calendar days). */
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const asDate = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso);

/**
 * Display formatting through the host's effective preferences (date, time and number formats, language, negative style,
 * decimals). The currency comes from the pharmacy's server settings; the source's fixed en-US/en-GB/AED are gone.
 */
export function usePharmacyFormat() {
  const { preferences } = useReferenceHost();
  const { meta } = useShell();
  const { t, date: hostDate, time: hostTime, dateTime: hostDateTime } = useReferenceFormat();
  const currency = meta?.settings.currency;
  const { numberLocale, language, currencyCode, decimalPlaces, currencyDisplay, negativeStyle, dateFormat, timeFormat } = preferences;
  return useMemo(() => {
    const code = (currency || currencyCode) as typeof currencyCode;
    const make = (display: typeof currencyDisplay) => {
      try { return createFormatters({ ...preferences, currencyCode: code, currencyDisplay: display }); }
      catch { return createFormatters({ ...preferences, currencyDisplay: display }); }
    };
    const withCode = make(currencyDisplay), bare = make("none");
    const locale = LANGUAGE_LOCALES[language ?? "en"];
    const nf0 = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 });
    const nf2 = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 });
    const compactF = new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 });
    const none = (n: unknown): n is null | undefined => n === null || n === undefined || (typeof n === "number" && Number.isNaN(n));
    const int = (n: number | null | undefined) => (none(n) ? "—" : nf0.format(n));
    /** A quantity, rate or percentage as the server reports it: whole numbers stay whole, fractions keep up to two digits (7.5%, 2.5 units). */
    const num = (n: number | null | undefined) => (none(n) ? "—" : nf2.format(n));
    /** A plain amount in the preferred decimals, no currency (columns whose header already names it). */
    const money = (n: number | null | undefined) => (none(n) ? "—" : bare.money(n));
    /** An amount with the pharmacy currency, in the preferred symbol/code/negative style. */
    const moneyC = (n: number | null | undefined) => (none(n) ? "—" : withCode.money(n));
    const compact = (n: number) => (Math.abs(n) >= 10000 ? compactF.format(n) : nf0.format(n));
    const ago = (iso?: string | null) => {
      if (!iso) return "—";
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 60) return t("just now");
      if (s < 3600) return t("{value0}m", { value0: nf0.format(Math.floor(s / 60)) });
      if (s < 86400) return t("{value0}h {value1}m", { value0: nf0.format(Math.floor(s / 3600)), value1: nf0.format(Math.floor((s % 3600) / 60)) });
      const d = Math.floor(s / 86400);
      return d === 1 ? t("1 day") : t("{value0} days", { value0: nf0.format(d) });
    };
    /** "5m ago", "2 days ago", "just now": the whole phrase, so "just now" never reads "just now ago". */
    const agoLong = (iso?: string | null) => {
      if (!iso) return "—";
      return (Date.now() - new Date(iso).getTime()) / 1000 < 60 ? t("just now") : t("{value0} ago", { value0: ago(iso) });
    };
    const time = (iso?: string | null) => (iso ? hostTime(asDate(iso)) : "—");
    const date = (iso?: string | null) => (iso ? (iso.length === 10 ? hostDate(iso) : hostDate(new Date(iso))) : "—");
    /** The source's day-and-month form follows the same host date format (the year is part of the chosen format). */
    const dateShort = date;
    const dateTime = (iso?: string | null) => (iso ? hostDateTime(asDate(iso)) : "—");
    const plural = (n: number, word: string) => {
      const table = n === 1 ? PLURAL_ONE : PLURAL_MANY;
      return table[word] ? t(table[word], { value0: nf0.format(n) }) : `${nf0.format(n)} ${word}`;
    };
    const statusLabel = (s?: string | null) => t(statusOf(s).label);
    const entityLabel = (e: string) => t(ENTITY_LABEL[e] ?? e);
    return { t, currency: code as string, int, num, money, moneyC, compact, ago, agoLong, time, date, dateShort, dateTime, plural, statusLabel, entityLabel, locale, formatters: withCode };
  }, [t, currency, currencyCode, numberLocale, language, decimalPlaces, currencyDisplay, negativeStyle, dateFormat, timeFormat, hostDate, hostTime, hostDateTime, preferences]);
}
