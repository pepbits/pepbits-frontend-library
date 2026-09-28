"use client";

import { useCallback, useMemo } from "react";
import { createFormatters, LANGUAGE_LOCALES, type ExportFormat, type PreferencePolicy, type UserPreferences } from "@pepbits/erp-config";
import { useReferenceHost } from "@pepbits/reference-host";
import { downloadCsv, toDate, type CsvCell } from "./utils";

/** The source's fmt* helpers, now driven by the host's effective preferences (date format, 12/24h clock,
    number locale, currency and language) instead of hardcoded en-GB/USD. */
export function useFormat() {
  const { preferences } = useReferenceHost();
  return useMemo(() => {
    const f = createFormatters(preferences);
    const locale = LANGUAGE_LOCALES[preferences.language] ?? "en";
    const intl = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, opts);
    const dayMonth = intl({ day: "2-digit", month: "short" });
    const order = preferences.dateFormat;
    /** Day + month without the year, ordered like the chosen date format. */
    const fmtShort = (d: string | Date) => {
      const date = toDate(d);
      if (order === "iso") return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (order === "mdy") return `${intl({ month: "short" }).format(date)} ${String(date.getDate()).padStart(2, "0")}`;
      return dayMonth.format(date);
    };
    /** No options: the preferred date format. With options (weekday, long month…): the preferred language. */
    const fmtDate = (d: string | Date, opts?: Intl.DateTimeFormatOptions) => {
      if (!opts) return f.date(typeof d === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(d) ? toDate(d) : d);
      if (!opts.year && !opts.weekday && opts.day && opts.month === "short") return fmtShort(d);
      return intl(opts).format(toDate(d));
    };
    return {
      fmtDate,
      fmtShort,
      /** Clock strings ("08:50") keep their wall time; instants are shown in local time. Both use the preferred 12/24-hour clock. */
      fmtTime: (d: string | Date) => (typeof d === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(d) ? f.time(d) : f.time(toDate(d))),
      fmtMoney: (n: number) => f.money(n),
      fmtNum: (n: number) => f.number(n),
      /** A percentage shown as the source did ("94.5%"), with the number in the host number locale. */
      fmtPct: (n: number) => `${f.number(n)}%`,
      fmtCompact: (n: number) => f.compact(n),
      /** A fixed number of decimals (GPA 3.42, rating 4.5) in the preferred number locale. */
      fmtFixed: (n: number, digits: number) => new Intl.NumberFormat(preferences.numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
      fmtMonth: (d: string | Date, style: "short" | "long" = "short") => intl({ month: style }).format(toDate(d)),
      fmtMonthYear: (d: string | Date) => intl({ month: "long", year: "numeric" }).format(toDate(d)),
      locale,
      /** ISO code of the preferred currency, for labels such as "Amount (USD)". */
      currency: preferences.currencyCode,
    };
  }, [preferences]);
}

export type Formatters = ReturnType<typeof useFormat>;

/** Formats this module can write. XLSX needs the workbook writer that lives in erp-screens, which this package does
    not depend on, so a user whose effective format is XLSX gets a disabled action with the reason, never a CSV. */
export const SCHOOL_EXPORT_FORMATS: readonly ExportFormat[] = ["csv"];

export interface ExportCapability { format: ExportFormat; disabled: boolean; reason?: string }

/** Pure decision, exported for tests: the effective format must be one this module writes and one policy allows. */
export function schoolExportCapability(preferences: Pick<UserPreferences, "exportFormat">, policy?: PreferencePolicy): ExportCapability {
  const format = preferences.exportFormat;
  const rule = policy?.rules.exportFormat;
  if (rule?.allowedValues && !rule.allowedValues.includes(format)) return { format, disabled: true, reason: "Your administrator does not allow this export format." };
  if (!SCHOOL_EXPORT_FORMATS.includes(format)) {
    return { format, disabled: true, reason: rule?.locked
      ? `Your administrator requires ${format.toUpperCase()} exports, which this page cannot produce.`
      : `Your export format is ${format.toUpperCase()}; this page exports CSV only. Choose CSV in preferences to export.` };
  }
  return { format, disabled: false };
}

/** Exports rows in the effective format, or refuses (see schoolExportCapability). */
export function useSchoolExport() {
  const host = useReferenceHost();
  const capability = schoolExportCapability(host.preferences, host.preferenceHost?.preferencePolicy);
  const exportCsv = useCallback((name: string, rows: CsvCell[][]) => {
    if (capability.disabled) return false;
    downloadCsv(name.endsWith(".csv") ? name : `${name}.csv`, rows);
    return true;
  }, [capability.disabled]);
  return { exportCsv, disabled: capability.disabled, reason: capability.reason, format: capability.format };
}

/** Custom key handlers attach only while the shortcut preference is on (PREF-07). */
export function useShortcutsEnabled() {
  return useReferenceHost().preferences.keyboardShortcuts !== false;
}
