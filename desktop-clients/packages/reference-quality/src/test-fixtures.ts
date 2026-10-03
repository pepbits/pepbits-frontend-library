import type { Indicator, Meta, TatDefinition } from "./lib/types";
import { chain, json, meta, sessionHandler, type Handler } from "./test-utils";

/**
 * Fictional AllyVora Quality API fixtures: one answer per endpoint the pages call, all with fixed timestamps.
 * Nothing here is real data. `qualityHandler()` composes them with the shared /auth/me and /meta session handler.
 */

export const QUALITY_PERMISSIONS = [
  "authorities.manage", "events.ingest", "indicators.manage", "reports.design", "results.edit", "results.verify", "results.approve",
  "results.submit", "schedules.manage", "submissions.approve", "submissions.manage", "users.manage", "validation.resolve",
  "validation.rules", "validation.run", "validation.waive", "audit.view",
];

const T0 = "2026-06-15T08:30:00Z";
const T1 = "2026-06-14T16:05:00Z";
const T2 = "2026-06-12T09:00:00Z";
const NEXT = "2026-07-01T05:00:00Z";

export const facilities = [
  { id: 1, code: "ALP", name: "Alpine Hospital", type: "hospital", city: "Abu Dhabi", jurisdiction: "Abu Dhabi" },
  { id: 2, code: "BAY", name: "Bayside Clinic", type: "clinic", city: "Dubai", jurisdiction: "Dubai" },
];

export const tatDefinitions: TatDefinition[] = [
  { id: 1, code: "LAB-STAT", name: "STAT lab order to result", domain: "lab", start_event: "ordered", end_event: "resulted", target_minutes: 60, filter: { priority: "STAT" }, description: "Order placed to result released for STAT tests" },
  { id: 2, code: "RAD-RPT", name: "Scan to final report", domain: "radiology", start_event: "scanned", end_event: "reported", target_minutes: 120, filter: {}, description: "Scan completed to report signed" },
];

export const qualityMeta: Partial<Meta> = {
  facilities,
  periods: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"],
  latestPeriod: "2026-06",
  domains: ["Patient safety", "Laboratory"],
  programs: ["JAWDA", "Internal"],
  eventDomains: [
    { id: "lab", label: "Laboratory", stages: ["ordered", "collected", "received", "resulted"], cancel: "cancelled", source: "LIS" },
    { id: "radiology", label: "Radiology", stages: ["ordered", "scanned", "reported"], cancel: "cancelled", source: "RIS" },
  ],
  tatDefinitions,
  authorities: [
    { id: 1, code: "DOH", name: "Department of Health", channel: "portal_upload", active: 1 },
    { id: 2, code: "BOARD", name: "Board of Directors", channel: "email", active: 1 },
  ],
  users: [
    { id: 3, name: "Dr. Mariam Haddad", role: "quality_manager", status: "active" },
    { id: 4, name: "Omar Nasser", role: "verifier", status: "active" },
  ],
};

const indicator = (over: Partial<Indicator> & Pick<Indicator, "id" | "code" | "name">): Indicator => ({
  unit: "percent", direction: "higher", target: 90, warning: 80, domain: "Patient safety", program: "Internal", category: "process",
  numerator_def: "Compliant observations in the period", denominator_def: "All observations in the period", exclusions: "Observations flagged as training",
  frequency: "monthly", facility_types: ["hospital", "clinic"], source: "manual", tat_definition_id: null, tat_code: null, min_sample: 30,
  owner_id: 3, owner_name: "Dr. Mariam Haddad", version: 2, status: "active", ...over,
});

export const indicators: Indicator[] = [
  indicator({ id: 1, code: "PS-01", name: "Hand hygiene compliance" }),
  indicator({ id: 2, code: "PS-02", name: "Medication error rate", unit: "per_1000", direction: "lower", target: 1.5, warning: 2.5, category: "outcome", numerator_def: "Reported medication errors", denominator_def: "Patient days, in thousands" }),
  indicator({ id: 7, code: "LAB-07", name: "STAT lab results within 60 minutes", domain: "Laboratory", program: "JAWDA", source: "events", tat_definition_id: 1, tat_code: "LAB-STAT", category: "timeliness" }),
];

const latest = { 1: { value: 93.4, status: "on_target" }, 2: { value: 2.1, status: "warning" }, 7: { value: 72.5, status: "breach" } } as const;
const SERIES = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
const point = (period: string, i: number, value: number, status: string) => ({ period, value: value + i, numerator: 60 + i, denominator: 80, status });

const indicatorRows = indicators.map((i) => ({ ...i, latest: { period: "2026-06", value: latest[i.id as 1 | 2 | 7].value, status: latest[i.id as 1 | 2 | 7].status, completeness: 100, approvalCoverage: 50 } }));

const indicatorDetail = (id: number) => {
  const ind = indicators.find((i) => i.id === id) ?? indicators[2];
  const series = SERIES.map((p, i) => point(p, i, 70, i > 3 ? "breach" : "warning"));
  return {
    indicator: ind,
    owner: { id: 3, name: "Dr. Mariam Haddad", title: "Head of Quality" },
    tat: ind.tat_definition_id ? { id: 1, code: "LAB-STAT", name: "STAT lab order to result", target_minutes: 60 } : null,
    facilities,
    series,
    byFacility: facilities.map((f) => ({ facility: f, series: series.map((s, i) => ({ ...s, value: s.value + (f.id === 2 ? 3 : 0), numerator: 40 + i })) })),
    results: facilities.map((f, i) => ({ id: 100 + i, period: "2026-06", facility_code: f.code, facility_name: f.name, numerator: 58 + i, denominator: 80, value: 72.5 + i, status: "draft", source: ind.source, version: 1 })),
    history: [{ ts: T1, user_name: "Dr. Mariam Haddad", action: "indicator.update", summary: "Raised the target from 85 to 90" }],
  };
};

const kpi = (i: Indicator) => ({ id: i.id, code: i.code, name: i.name, domain: i.domain, program: i.program, unit: i.unit, direction: i.direction, target: i.target, warning: i.warning, value: latest[i.id as 1 | 2 | 7].value, previous: 70, status: latest[i.id as 1 | 2 | 7].status, completeness: 100, spark: [68, 70, 72, 71, 73, 72.5] });

const dashboard = {
  period: "2026-06",
  previousPeriod: "2026-05",
  kpis: indicators.map(kpi),
  statusCounts: { on_target: 1, warning: 1, breach: 1, no_data: 0 },
  byDomain: [
    { domain: "Patient safety", total: 2, on_target: 1, warning: 1, breach: 0, no_data: 0 },
    { domain: "Laboratory", total: 1, on_target: 0, warning: 0, breach: 1, no_data: 0 },
  ],
  workflow: [{ status: "draft", n: 2 }, { status: "submitted", n: 1 }, { status: "verified", n: 1 }, { status: "approved", n: 2 }],
  issues: [{ severity: "blocking", n: 2 }, { severity: "warning", n: 3 }],
  tat: [
    { id: 1, code: "LAB-STAT", name: "STAT lab order to result", domain: "lab", median: 48, p90: 95, pctWithin: 72.5, measured: 240, incomplete: 6, target: 60 },
    { id: 2, code: "RAD-RPT", name: "Scan to final report", domain: "radiology", median: 85, p90: 150, pctWithin: 91, measured: 180, incomplete: 2, target: 120 },
  ],
  upcoming: [{ id: 1, name: "Monthly board pack", next_run_at: NEXT, frequency: "monthly", authority: null, require_approval: 0 }, { id: 2, name: "Quarterly DOH submission", next_run_at: "2026-07-05T05:00:00Z", frequency: "quarterly", authority: "Department of Health", require_approval: 1 }],
  submissions: [{ id: 11, reference: "SUB-2026-0011", status: "pending_approval", period_from: "2026-04", period_to: "2026-06", updated_at: T1, authority: "Department of Health", template: "Quarterly scorecard" }],
  activity: [{ id: 1, ts: T1, user_name: "Omar Nasser", action: "result.verify", summary: "Verified 4 results for Alpine Hospital" }],
  pendingMine: { status: "submitted", count: 3 },
};

const resultRows = [
  { id: 100, code: "LAB-07", name: "STAT lab results within 60 minutes", facility_code: "ALP", facility_name: "Alpine Hospital", domain: "Laboratory", period: "2026-06", numerator: 58, denominator: 80, value: 72.5, unit: "percent", direction: "higher", target: 90, warning: 80, status: "draft", blocking: 0, warnings: 1, last_actor: "Omar Nasser", kpi_status: "breach" },
  { id: 101, code: "PS-01", name: "Hand hygiene compliance", facility_code: "BAY", facility_name: "Bayside Clinic", domain: "Patient safety", period: "2026-06", numerator: 93, denominator: 100, value: 93, unit: "percent", direction: "higher", target: 90, warning: 80, status: "rejected", blocking: 0, warnings: 0, last_actor: null, kpi_status: "on_target" },
];

const tatAnalysis = {
  definition: { id: 1, name: "STAT lab order to result", domain: "lab", start_event: "ordered", end_event: "resulted", target_minutes: 60, description: "Order placed to result released for STAT tests" },
  summary: { population: 260, measured: 240, within: 174, over: 66, incomplete: 6, negative: 1, cancelled: 13, pctWithin: 72.5, median: 48, p90: 95, mean: 55, target: 60 },
  histogram: [{ label: "0-30", count: 60, withinTarget: true, from: 0 }, { label: "30-60", count: 114, withinTarget: true, from: 30 }, { label: "60-90", count: 46, withinTarget: false, from: 60 }, { label: "90+", count: 20, withinTarget: false, from: 90 }],
  trend: [{ bucket: "2026-06-01", median: 45, p90: 90, pctWithin: 75, volume: 40 }, { bucket: "2026-06-08", median: 50, p90: 97, pctWithin: 70, volume: 44 }],
  byFacility: [
    { facility: { id: 1, name: "Alpine Hospital", code: "ALP" }, population: 160, measured: 150, within: 105, over: 45, incomplete: 4, negative: 1, cancelled: 5, pctWithin: 70, median: 50, p90: 100, mean: 58, target: 60 },
    { facility: { id: 2, name: "Bayside Clinic", code: "BAY" }, population: 100, measured: 90, within: 69, over: 21, incomplete: 2, negative: 0, cancelled: 8, pctWithin: 76.7, median: 44, p90: 88, mean: 50, target: 60 },
  ],
  stages: [{ from: "ordered", to: "collected", median: 12, p90: 25, n: 240 }, { from: "collected", to: "received", median: 15, p90: 30, n: 238 }, { from: "received", to: "resulted", median: 21, p90: 45, n: 236 }],
  exceptions: [
    { transactionId: "TX-LAB-0001", facility: "ALP", priority: "STAT", attributes: { test: "Troponin" }, startedAt: T2, endedAt: "2026-06-12T10:40:00Z", minutes: 100, outcome: "over", currentState: "resulted" },
    { transactionId: "TX-LAB-0002", facility: "BAY", priority: "STAT", attributes: { test: "Lactate" }, startedAt: T2, endedAt: null, minutes: null, outcome: "incomplete", currentState: "collected" },
  ],
};

const eventStats = {
  byDomain: [{ domain: "lab", transactions: 300, complete: 280, last24h: 24 }, { domain: "radiology", transactions: 120, complete: 110, last24h: 9 }],
  ingestion: [{ outcome: "accepted", n: 1500 }, { outcome: "duplicate", n: 12 }, { outcome: "rejected", n: 3 }],
  lastIngested: [{ source_system: "LIS", last: T0 }, { source_system: "RIS", last: T1 }],
  corrections: [{ event_kind: "correction", n: 7 }],
  hourly: [{ hour: "2026-06-15T06:00:00Z", n: 20 }, { hour: "2026-06-15T07:00:00Z", n: 31 }],
};

const transactions = {
  total: 2,
  rows: [
    { id: "TX-LAB-0001", domain: "lab", facility_code: "ALP", priority: "STAT", attributes: { test: "Troponin" }, started_at: T2, current_state: "resulted", current_state_at: T0, is_complete: 1, last_sequence: 4 },
    { id: "TX-RAD-0002", domain: "radiology", facility_code: "BAY", priority: "ROUTINE", attributes: { modality: "Chest X-ray" }, started_at: T2, current_state: "scanned", current_state_at: T0, is_complete: 0, last_sequence: 2 },
  ],
};
const transactionDetail = (id: string) => ({
  transaction: { id, domain: "lab", facility_name: "Alpine Hospital", priority: "STAT", attributes: { test: "Troponin" }, patient_ref: "PT-0001", started_at: T2, current_state: "resulted", current_state_at: T0, is_complete: 1 },
  stages: ["ordered", "collected", "received", "resulted"],
  events: [
    { event_id: "EV-1", event_type: "ordered", occurred_at: T2, ingested_at: T2, source_system: "LIS", source_event_key: "LIS-KEY-1", actor: "Lab clerk", event_kind: "normal", supersedes_event_id: null, superseded: false, payload: {} },
    { event_id: "EV-2", event_type: "resulted", occurred_at: "2026-06-12T09:50:00Z", ingested_at: "2026-06-12T09:51:00Z", source_system: "LIS", source_event_key: "LIS-KEY-2", actor: null, event_kind: "normal", supersedes_event_id: null, superseded: false, payload: {} },
  ],
});
const events = {
  total: 1,
  rows: [{ event_id: "EV-1", transaction_id: "TX-LAB-0001", domain: "lab", event_type: "ordered", facility_code: "ALP", occurred_at: T2, ingested_at: T2, source_system: "LIS", source_event_key: "LIS-KEY-1", actor: "Lab clerk", event_kind: "normal" }],
};

const issues = {
  rows: [
    { id: 1, rule_code: "VR-001", rule_name: "Denominator below minimum sample", scope: "result", severity: "blocking", status: "open", message: "Denominator 12 is below the minimum sample of 30 for LAB-07 at Bayside Clinic", period: "2026-06", indicator_code: "LAB-07", facility_code: "BAY", result_id: 100, assignee: "Omar Nasser", assigned_to: 4, resolver: null, resolution_note: null, created_at: T2, updated_at: T1, resolved_at: null },
    { id: 2, rule_code: "VR-014", rule_name: "Late events", scope: "events", severity: "warning", status: "open", message: "6 transactions have no end event after 48 hours", period: null, indicator_code: null, facility_code: "ALP", result_id: null, assignee: null, assigned_to: null, resolver: null, resolution_note: null, created_at: T2, updated_at: T1, resolved_at: null },
  ],
  summary: [{ status: "open", severity: "blocking", n: 1 }, { status: "open", severity: "warning", n: 1 }, { status: "resolved", severity: "warning", n: 4 }, { status: "waived", severity: "blocking", n: 1 }],
  lastRun: { started_at: T1, user_name: "Dr. Mariam Haddad", opened: 2, auto_resolved: 1, scope: "2026-05,2026-06" },
};
const rules = [
  { id: 1, code: "VR-001", name: "Denominator below minimum sample", description: "The denominator is smaller than the indicator minimum sample", scope: "result", severity: "blocking", params: { threshold: 30 }, active: 1, open_issues: 1 },
  { id: 2, code: "VR-014", name: "Late events", description: "A transaction has no end event after the allowed wait", scope: "events", severity: "warning", params: { hours: 48 }, active: 1, open_issues: 1 },
];

const reportConfig = { sections: [{ id: "s1", type: "scorecard", title: "Performance against target" }, { id: "s2", type: "kpi_table", title: "Indicators", program: "JAWDA", breakdown: "none" }] };
const templates = [
  { id: 3, name: "Quarterly JAWDA scorecard", description: "Quarterly indicator package for the regulator", kind: "system", program: "JAWDA", authority_name: "Department of Health", authority_code: "DOH", config: reportConfig, created_by_name: null, active_schedules: 1, last_generated: T1, updated_at: T2 },
  { id: 4, name: "Executive weekly digest", description: null, kind: "custom", program: null, authority_name: null, authority_code: null, config: reportConfig, created_by_name: "Dr. Mariam Haddad", active_schedules: 0, last_generated: null, updated_at: T2 },
];
const templateDetail = (id: number) => {
  const t = templates.find((x) => x.id === id) ?? templates[0];
  return { ...t, authority_id: t.authority_code ? 1 : null, runs: [{ id: 21, period_from: "2026-04", period_to: "2026-06", trigger: "manual", generated_by_name: "Dr. Mariam Haddad", generated_at: T1, checksum: "a1b2c3d4e5f60718293a4b5c6d7e8f90" }, { id: 22, period_from: "2026-05", period_to: "2026-05", trigger: "schedule", generated_by_name: null, generated_at: T2, checksum: "0f9e8d7c6b5a49382716f5e4d3c2b1a0" }] };
};
const metaOf = (i: Indicator) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, direction: i.direction, target: i.target, warning: i.warning });
const rendered = {
  template: { id: 3, name: "Quarterly JAWDA scorecard" },
  period: { from: "2026-04", to: "2026-06", months: ["2026-04", "2026-05", "2026-06"] },
  facilities: facilities.map(({ id, code, name }) => ({ id, code, name })),
  generatedAt: T0,
  checksum: "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0",
  summary: { indicators: 3, on_target: 1, warning: 1, breach: 1, no_data: 0, approvalCoverage: 50 },
  sections: [
    { id: "s1", type: "scorecard", title: "Performance against target", data: { counts: { on_target: 1, warning: 1, breach: 1, no_data: 0 }, rows: indicators.map((i) => ({ indicator: metaOf(i), facility: null, numerator: 58, denominator: 80, value: latest[i.id as 1 | 2 | 7].value, status: latest[i.id as 1 | 2 | 7].status, completeness: 100, approvalCoverage: 50 })) } },
    { id: "s2", type: "kpi_table", title: "Indicators", data: { rows: [{ indicator: metaOf(indicators[2]), facility: null, numerator: 58, denominator: 80, value: 72.5, status: "breach", completeness: 100, approvalCoverage: 50 }, { indicator: metaOf(indicators[2]), facility: facilities[0], numerator: 30, denominator: 40, value: 75, status: "breach", completeness: 90, approvalCoverage: null }] } },
    { id: "s3", type: "kpi_trend", title: "Lab timeliness trend", data: { indicator: metaOf(indicators[2]), series: SERIES.map((period, i) => ({ period, value: 70 + i })) } },
    { id: "s4", type: "facility_comparison", title: "Lab timeliness by facility", data: { indicator: metaOf(indicators[2]), rows: [{ facility: { code: "ALP" }, value: 70, status: "breach" }, { facility: { code: "BAY" }, value: 76.7, status: "breach" }] } },
    { id: "s5", type: "tat_summary", title: "Turnaround summary", data: { rows: [{ definition: { id: 1, name: "STAT lab order to result" }, target: 60, measured: 240, median: 48, p90: 95, pctWithin: 72.5, incomplete: 6 }] } },
    { id: "s6", type: "verification_status", title: "Review progress", data: { total: 6, counts: { approved: 2, verified: 1, submitted: 1, draft: 2, rejected: 0 } } },
    { id: "s7", type: "validation_summary", title: "Data quality", data: { open: [{ id: 1, code: "VR-001", severity: "blocking", message: "Denominator 12 is below the minimum sample" }], byRule: [{ status: "open", severity: "blocking", n: 1 }, { status: "resolved", severity: "warning", n: 4 }] } },
    { id: "s8", type: "text", title: "Methodology", body: "Figures pool numerators and denominators across the selected facilities.", data: { body: "Figures pool numerators and denominators across the selected facilities." } },
  ],
};

const schedules = {
  timezone: "Asia/Dubai",
  rows: [
    { id: 1, name: "Monthly board pack", template_id: 4, template_name: "Executive weekly digest", authority_id: null, authority_name: null, authority_code: null, channel: null, frequency: "monthly", day_of_week: null, day_of_month: 1, time_of_day: "09:00", facility_ids: [], recipients: ["board@example.test"], format: "pdf", require_approval: 0, active: 1, next_run_at: NEXT, last_run_at: T2, last_status: "accepted" },
    { id: 2, name: "Quarterly DOH submission", template_id: 3, template_name: "Quarterly JAWDA scorecard", authority_id: 1, authority_name: "Department of Health", authority_code: "DOH", channel: "portal_upload", frequency: "quarterly", day_of_week: null, day_of_month: 5, time_of_day: "09:00", facility_ids: [1, 2], recipients: [], format: "xlsx", require_approval: 1, active: 0, next_run_at: null, last_run_at: null, last_status: null },
  ],
};

const submissions = {
  rows: [
    { id: 11, reference: "SUB-2026-0011", template_id: 3, template_name: "Quarterly JAWDA scorecard", authority_name: "Department of Health", authority_code: "DOH", channel: "portal_upload", schedule_name: "Quarterly DOH submission", period_from: "2026-04", period_to: "2026-06", format: "xlsx", status: "pending_approval", checksum: "c0ffee00c0ffee00c0ffee00c0ffee00", receipt_ref: null, rejection_reason: null, created_by_name: "Dr. Mariam Haddad", approved_by_name: null, supersedes_reference: null, superseded_by_reference: null, created_at: T2, updated_at: T1 },
    { id: 12, reference: "SUB-2026-0012", template_id: 3, template_name: "Quarterly JAWDA scorecard", authority_name: "Department of Health", authority_code: "DOH", channel: "portal_upload", schedule_name: null, period_from: "2026-01", period_to: "2026-03", format: "xlsx", status: "accepted", checksum: "decaf000decaf000decaf000decaf000", receipt_ref: "RCPT-7781", rejection_reason: null, created_by_name: "Dr. Mariam Haddad", approved_by_name: "Omar Nasser", supersedes_reference: null, superseded_by_reference: null, created_at: T2, updated_at: T2 },
  ],
  counts: [{ status: "pending_approval", n: 1 }, { status: "accepted", n: 1 }],
};

const authorities = [
  { id: 1, code: "DOH", name: "Department of Health", jurisdiction: "Abu Dhabi", channel: "portal_upload", endpoint: null, contact_email: "quality@doh.example.test", programs: ["JAWDA"], active: 1, active_schedules: 1, submissions: 2, last_submission: T1 },
  { id: 2, code: "BOARD", name: "Board of Directors", jurisdiction: "Group", channel: "email", endpoint: null, contact_email: null, programs: [], active: 1, active_schedules: 1, submissions: 0, last_submission: null },
];

const users = {
  rows: [
    { id: 3, name: "Dr. Mariam Haddad", email: "mariam@example.test", title: "Head of Quality", role: "quality_manager", facility_id: null, facility_name: null, status: "active", last_login_at: T1, actions_30d: 42 },
    { id: 4, name: "Omar Nasser", email: "omar@example.test", title: null, role: "verifier", facility_id: 1, facility_name: "Alpine Hospital", status: "active", last_login_at: null, actions_30d: 7 },
    { id: 5, name: "Lina Farouk", email: "host-lina@quality.invalid", title: null, role: "viewer", facility_id: null, facility_name: null, status: "inactive", last_login_at: T2, actions_30d: 0 },
  ],
  roles: [
    { id: "quality_manager", label: "Quality manager", description: "Owns indicators and reports", permissions: ["indicators.manage", "reports.design"] },
    { id: "viewer", label: "Viewer", description: "Read only", permissions: [] },
  ],
};

const audit = {
  total: 2,
  rows: [
    { id: 2, ts: T1, user_id: 3, user_name: "Dr. Mariam Haddad", action: "indicator.update", entity_type: "indicator", entity_id: "7", summary: "Raised the target for LAB-07 from 85 to 90", details: { before: 85, after: 90 }, ip: "203.0.113.7", prev_hash: "1".repeat(64), hash: "2".repeat(64) },
    { id: 1, ts: T2, user_id: 4, user_name: "Omar Nasser", action: "result.verify", entity_type: "result", entity_id: "100", summary: "Verified LAB-07 for Alpine Hospital, June 2026", details: {}, ip: null, prev_hash: "0".repeat(64), hash: "1".repeat(64) },
  ],
  entities: ["indicator", "result"],
  actions: ["indicator.update", "result.verify"],
};

const resultDetail = (id: number) => ({
  result: { id, code: "LAB-07", name: "STAT lab results within 60 minutes", period: "2026-06", facility_name: "Alpine Hospital", facility_code: "ALP", numerator: 58, denominator: 80, value: 72.5, status: "draft", unit: "percent", direction: "higher", target: 90, warning: 80, numerator_def: "Results within 60 minutes", denominator_def: "All STAT results", exclusions: null, source: "events", version: 1, indicator_id: 7, kpi_status: "breach", min_sample: 30, comment: null },
  reviews: [], issues: [], previous: [{ period: "2026-05", value: 71, numerator: 57, denominator: 80 }],
});

const idOf = (pathname: string, prefix: string) => Number(pathname.slice(prefix.length).split("/")[0]);

/** Every endpoint the Quality pages call, answered from the fictional fixtures above. */
export const apiHandler: Handler = (r) => {
  const p = r.url.pathname;
  const get = r.method === "GET";
  if (p === "/me/tasks") return json({ tasks: [{ key: "verify", label: "Results waiting to verify", count: 3, href: "/verification?queue=verify" }], total: 3 });
  if (p === "/dashboard") return json(dashboard);
  if (p === "/indicators" && get) return json(indicatorRows);
  if (p.startsWith("/indicators/") && get) return json(indicatorDetail(idOf(p, "/indicators/")));
  if (p === "/results" && get) return json(resultRows);
  if (p.startsWith("/results/") && get) return json(resultDetail(idOf(p, "/results/")));
  if (p === "/verification/summary") return json({ counts: [{ status: "draft", n: 1 }, { status: "rejected", n: 1 }, { status: "submitted", n: 1 }, { status: "verified", n: 1 }, { status: "approved", n: 2 }] });
  if (p === "/tat/analysis") return json(tatAnalysis);
  if (p === "/events/stats") return json(eventStats);
  if (p === "/transactions") return json(transactions);
  if (p.startsWith("/transactions/")) return json(transactionDetail(decodeURIComponent(p.slice("/transactions/".length))));
  if (p === "/events") return json(events);
  if (p === "/validation/issues") return json(issues);
  if (p === "/validation/rules") return json(rules);
  if (p === "/report-templates" && get) return json(templates);
  if (/^\/report-templates\/\d+\/render$/.test(p)) return json(rendered);
  if (/^\/report-templates\/\d+$/.test(p) && get) return json(templateDetail(idOf(p, "/report-templates/")));
  if (p === "/reports/preview") return json(rendered);
  if (p === "/schedules/preview-next") return json({ runs: ["2026-07-01T05:00:00Z", "2026-08-01T05:00:00Z"] });
  if (p === "/schedules" && get) return json(schedules);
  if (p === "/submissions" && get) return json(submissions);
  if (p === "/authorities" && get) return json(authorities);
  if (p === "/users" && get) return json(users);
  if (p === "/audit" && get) return json(audit);
  if (p === "/audit/verify") return json({ valid: true, checked: 2, brokenAt: null, verifiedAt: T0 });
};

/** The full Quality backend: session (/auth/me, /meta) plus every page endpoint. */
export const qualityHandler = (over: { permissions?: string[] } = {}): Handler =>
  chain(apiHandler, sessionHandler({ permissions: over.permissions ?? QUALITY_PERMISSIONS, meta: qualityMeta }));

/** Every string value in the fixtures: names, codes, facility and domain labels. Used to tell data from UI copy. */
export function fixtureStrings(): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  [qualityMeta, meta(), indicators, indicatorRows, indicatorDetail(7), dashboard, resultRows, tatAnalysis, eventStats, transactions, transactionDetail("TX-LAB-0001"), events, issues, rules, templates, templateDetail(3), rendered, schedules, submissions, authorities, users, audit].forEach(walk);
  return out;
}
