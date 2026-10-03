export const EVENT_DOMAINS = {
  lab: {
    label: "Laboratory",
    source: "LIS-CORE",
    stages: [
      "order_placed",
      "sample_collected",
      "sample_received",
      "processing_started",
      "result_verified",
      "result_released",
      "critical_acknowledged",
    ],
    terminal: ["result_released", "critical_acknowledged"],
    cancel: "order_cancelled",
  },
  radiology: {
    label: "Radiology",
    source: "RIS-MAIN",
    stages: ["order_placed", "patient_arrived", "exam_started", "exam_completed", "report_drafted", "report_signed"],
    terminal: ["report_signed"],
    cancel: "order_cancelled",
  },
  ed: {
    label: "Emergency",
    source: "EHR-ED",
    stages: ["arrival", "triage", "physician_seen", "disposition_decided", "departed"],
    terminal: ["departed"],
    cancel: "left_without_being_seen",
  },
  outpatient: {
    label: "Outpatient",
    source: "EHR-OPD",
    stages: ["check_in", "vitals_recorded", "consultation_started", "consultation_ended"],
    terminal: ["consultation_ended"],
    cancel: "visit_cancelled",
  },
  pharmacy: {
    label: "Pharmacy",
    source: "PHARM-SYS",
    stages: ["order_received", "pharmacist_verified", "prepared", "dispensed"],
    terminal: ["dispensed"],
    cancel: "order_cancelled",
  },
} as const;

export type EventDomain = keyof typeof EVENT_DOMAINS;
export const isEventDomain = (d: string): d is EventDomain => d in EVENT_DOMAINS;

export const UNIT_MULTIPLIER: Record<string, number> = {
  percent: 100,
  per_1000: 1000,
  minutes: 1,
  count: 1,
};

export function computeValue(unit: string, numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || numerator === undefined) return null;
  if (unit === "count") return numerator;
  if (denominator === null || denominator === undefined || denominator === 0) return null;
  return (numerator / denominator) * (UNIT_MULTIPLIER[unit] ?? 1);
}

export type KpiStatus = "on_target" | "warning" | "breach" | "no_data";

export function classify(
  value: number | null,
  direction: string,
  target: number,
  warning: number,
): KpiStatus {
  if (value === null || Number.isNaN(value)) return "no_data";
  if (direction === "higher") {
    if (value >= target) return "on_target";
    if (value >= warning) return "warning";
    return "breach";
  }
  if (value <= target) return "on_target";
  if (value <= warning) return "warning";
  return "breach";
}

/** Month helpers. Periods are YYYY-MM strings. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthKey(d);
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let p = from;
  let guard = 0;
  while (p <= to && guard++ < 240) {
    out.push(p);
    p = addMonths(p, 1);
  }
  return out;
}

export function lastCompleteMonth(now = new Date()): string {
  return addMonths(monthKey(now), -1);
}

export function quarterOf(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

export function quarterRange(q: string): { from: string; to: string } {
  const [y, qs] = q.split("-Q");
  const startMonth = (Number(qs) - 1) * 3 + 1;
  const from = `${y}-${String(startMonth).padStart(2, "0")}`;
  return { from, to: addMonths(from, 2) };
}

/** Reporting boundaries follow facility local time (UAE, UTC+4, no daylight saving). */
export const REPORTING_UTC_OFFSET_HOURS = 4;

export function localDateStartIso(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - REPORTING_UTC_OFFSET_HOURS * 3600000).toISOString();
}

export function localMonthOf(iso: string): string {
  return monthKey(new Date(Date.parse(iso) + REPORTING_UTC_OFFSET_HOURS * 3600000));
}

export function monthStartIso(period: string): string {
  return localDateStartIso(`${period}-01`);
}

export function monthEndExclusiveIso(period: string): string {
  return localDateStartIso(`${addMonths(period, 1)}-01`);
}

export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export const round = (n: number | null, dp = 2) =>
  n === null || Number.isNaN(n) ? null : Math.round(n * 10 ** dp) / 10 ** dp;
