import crypto from "node:crypto";
import { db, nowIso, parseJson } from "../db.js";
import { addMonths, classify, monthEndExclusiveIso, monthStartIso, monthsBetween } from "../domain.js";
import { aggregate, allFacilities, applicableFacilities, monthlySeries, type IndicatorRow } from "./calc.js";
import { getDefinition, tatSummary } from "./tat.js";

export type SectionType =
  | "scorecard"
  | "kpi_table"
  | "kpi_trend"
  | "facility_comparison"
  | "tat_summary"
  | "validation_summary"
  | "verification_status"
  | "text";

export interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  indicatorIds?: number[];
  program?: string;
  domain?: string;
  indicatorId?: number;
  tatDefinitionIds?: number[];
  breakdown?: "none" | "facility";
  months?: number;
  body?: string;
}

export interface ReportConfig {
  sections: ReportSection[];
  approvedOnlyWarning?: boolean;
}

export interface RenderInput {
  config: ReportConfig;
  periodFrom: string;
  periodTo: string;
  facilityIds: number[];
}

function resolveIndicators(section: ReportSection): IndicatorRow[] {
  let rows = db.prepare("SELECT * FROM indicators WHERE status = 'active' ORDER BY domain, code").all() as IndicatorRow[];
  if (section.indicatorIds?.length) {
    const order = new Map(section.indicatorIds.map((id, i) => [id, i]));
    rows = rows.filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  } else {
    if (section.program) rows = rows.filter((r) => r.program === section.program);
    if (section.domain) rows = rows.filter((r) => r.domain === section.domain);
  }
  return rows;
}

const indicatorMeta = (i: IndicatorRow) => ({
  id: i.id,
  code: i.code,
  name: i.name,
  unit: i.unit,
  direction: i.direction,
  target: i.target,
  warning: i.warning,
  domain: i.domain,
  program: i.program,
});

export function renderReport(input: RenderInput) {
  const periods = monthsBetween(input.periodFrom, input.periodTo);
  const facilityIds = input.facilityIds.length ? input.facilityIds : allFacilities().map((f) => f.id);
  const facilities = allFacilities().filter((f) => facilityIds.includes(f.id));
  const statusCounts = { on_target: 0, warning: 0, breach: 0, no_data: 0 };
  const seenIndicators = new Set<number>();
  let approvedResults = 0;
  let totalResults = 0;

  const sections = input.config.sections.map((s) => {
    switch (s.type) {
      case "scorecard":
      case "kpi_table": {
        const inds = resolveIndicators(s);
        const rows = inds.flatMap((ind) => {
          const agg = aggregate(ind, periods, facilityIds);
          if (!seenIndicators.has(ind.id)) {
            seenIndicators.add(ind.id);
            statusCounts[agg.status]++;
            approvedResults += agg.approved;
            totalResults += agg.present;
          }
          const main = { indicator: indicatorMeta(ind), facility: null as null | { id: number; name: string; code: string }, ...agg };
          if (s.breakdown !== "facility") return [main];
          const perFacility = applicableFacilities(ind, facilityIds).map((f) => ({
            indicator: indicatorMeta(ind),
            facility: { id: f.id, name: f.name, code: f.code },
            ...aggregate(ind, periods, [f.id]),
          }));
          return [main, ...perFacility];
        });
        if (s.type === "scorecard") {
          const counts = { on_target: 0, warning: 0, breach: 0, no_data: 0 };
          for (const r of rows) if (!r.facility) counts[r.status]++;
          return { ...s, data: { counts, total: inds.length, rows: rows.filter((r) => !r.facility && r.status !== "on_target") } };
        }
        return { ...s, data: { rows } };
      }
      case "kpi_trend": {
        const ind = s.indicatorId ? (db.prepare("SELECT * FROM indicators WHERE id = ?").get(s.indicatorId) as IndicatorRow | undefined) : undefined;
        if (!ind) return { ...s, data: { error: "Select an indicator for this trend." } };
        const months = Math.max(3, Math.min(24, s.months ?? 12));
        const trendPeriods = monthsBetween(addMonths(input.periodTo, -(months - 1)), input.periodTo);
        return { ...s, data: { indicator: indicatorMeta(ind), series: monthlySeries(ind, trendPeriods, facilityIds) } };
      }
      case "facility_comparison": {
        const ind = s.indicatorId ? (db.prepare("SELECT * FROM indicators WHERE id = ?").get(s.indicatorId) as IndicatorRow | undefined) : undefined;
        if (!ind) return { ...s, data: { error: "Select an indicator to compare facilities." } };
        const rows = applicableFacilities(ind, facilityIds).map((f) => ({ facility: { id: f.id, name: f.name, code: f.code }, ...aggregate(ind, periods, [f.id]) }));
        return { ...s, data: { indicator: indicatorMeta(ind), rows } };
      }
      case "tat_summary": {
        const ids = s.tatDefinitionIds?.length ? s.tatDefinitionIds : (db.prepare("SELECT id FROM tat_definitions").all() as { id: number }[]).map((r) => r.id);
        const rows = ids
          .map((id) => getDefinition(id))
          .filter((d): d is NonNullable<typeof d> => !!d)
          .map((d) => {
            const sum = tatSummary(d, { from: monthStartIso(input.periodFrom), to: monthEndExclusiveIso(input.periodTo), facilityIds });
            return {
              definition: { id: d.id, code: d.code, name: d.name, domain: d.domain, target: d.target_minutes },
              ...sum,
              status: classify(sum.pctWithin, "higher", 90, 80),
            };
          });
        return { ...s, data: { rows } };
      }
      case "validation_summary": {
        const ph = periods.map(() => "?").join(",");
        const fh = facilityIds.map(() => "?").join(",");
        const byRule = db
          .prepare(
            `SELECT vr.code, vr.name, vi.severity, vi.status, COUNT(*) AS n FROM validation_issues vi JOIN validation_rules vr ON vr.id = vi.rule_id
             WHERE (vi.period IN (${ph}) OR vi.period IS NULL) AND (vi.facility_id IN (${fh}) OR vi.facility_id IS NULL)
             GROUP BY vr.code, vi.severity, vi.status ORDER BY vr.code`,
          )
          .all(...periods, ...facilityIds);
        const open = db
          .prepare(
            `SELECT vi.id, vr.code, vi.severity, vi.message FROM validation_issues vi JOIN validation_rules vr ON vr.id = vi.rule_id
             WHERE vi.status = 'open' AND (vi.period IN (${ph}) OR vi.period IS NULL) AND (vi.facility_id IN (${fh}) OR vi.facility_id IS NULL)
             ORDER BY CASE vi.severity WHEN 'blocking' THEN 0 ELSE 1 END, vi.id LIMIT 15`,
          )
          .all(...periods, ...facilityIds);
        return { ...s, data: { byRule, open } };
      }
      case "verification_status": {
        const ph = periods.map(() => "?").join(",");
        const fh = facilityIds.map(() => "?").join(",");
        const rows = db
          .prepare(`SELECT status, COUNT(*) AS n FROM indicator_results WHERE period IN (${ph}) AND facility_id IN (${fh}) GROUP BY status`)
          .all(...periods, ...facilityIds) as { status: string; n: number }[];
        const counts: Record<string, number> = { draft: 0, submitted: 0, verified: 0, approved: 0, rejected: 0 };
        for (const r of rows) counts[r.status] = r.n;
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return { ...s, data: { counts, total } };
      }
      case "text":
      default:
        return { ...s, data: { body: s.body ?? "" } };
    }
  });

  const summary = {
    indicators: seenIndicators.size,
    ...statusCounts,
    approvalCoverage: totalResults ? Math.round((approvedResults / totalResults) * 1000) / 10 : null,
  };
  const generatedAt = nowIso();
  const checksum = crypto
    .createHash("sha256")
    .update(JSON.stringify({ sections, periods, facilityIds }))
    .digest("hex");

  return {
    period: { from: input.periodFrom, to: input.periodTo, months: periods },
    facilities: facilities.map((f) => ({ id: f.id, code: f.code, name: f.name })),
    generatedAt,
    sections,
    summary,
    checksum,
  };
}

export type RenderedReport = ReturnType<typeof renderReport>;

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  // Protect spreadsheet consumers from formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function reportToCsv(templateName: string, r: RenderedReport): string {
  const lines: string[] = [];
  lines.push([csvCell(templateName), csvCell(`${r.period.from} to ${r.period.to}`), csvCell(`Checksum ${r.checksum}`)].join(","));
  lines.push("");
  for (const s of r.sections as Array<{ type: string; title: string; data: any }>) {
    if (s.type === "kpi_table" || s.type === "scorecard") {
      lines.push(csvCell(s.title));
      lines.push(["Code", "Indicator", "Facility", "Numerator", "Denominator", "Value", "Unit", "Target", "Status", "Completeness %", "Approved %"].join(","));
      for (const row of s.data.rows ?? []) {
        lines.push(
          [row.indicator.code, row.indicator.name, row.facility?.name ?? "All selected", row.numerator, row.denominator, row.value, row.indicator.unit, row.indicator.target, row.status, row.completeness, row.approvalCoverage]
            .map(csvCell)
            .join(","),
        );
      }
      lines.push("");
    } else if (s.type === "tat_summary") {
      lines.push(csvCell(s.title));
      lines.push(["Code", "Measure", "Target (min)", "Measured", "Median", "P90", "% within target", "Incomplete", "Clock errors"].join(","));
      for (const row of s.data.rows ?? []) {
        lines.push([row.definition.code, row.definition.name, row.target, row.measured, row.median, row.p90, row.pctWithin, row.incomplete, row.negative].map(csvCell).join(","));
      }
      lines.push("");
    } else if (s.type === "facility_comparison" && s.data.rows) {
      lines.push(csvCell(s.title));
      lines.push(["Facility", "Numerator", "Denominator", "Value", "Status"].join(","));
      for (const row of s.data.rows) lines.push([row.facility.name, row.numerator, row.denominator, row.value, row.status].map(csvCell).join(","));
      lines.push("");
    } else if (s.type === "kpi_trend" && s.data.series) {
      lines.push(csvCell(s.title));
      lines.push(["Period", "Numerator", "Denominator", "Value", "Status"].join(","));
      for (const row of s.data.series) lines.push([row.period, row.numerator, row.denominator, row.value, row.status].map(csvCell).join(","));
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function templateConfig(templateId: number): { name: string; config: ReportConfig } | null {
  const t = db.prepare("SELECT name, config FROM report_templates WHERE id = ?").get(templateId) as { name: string; config: string } | undefined;
  if (!t) return null;
  return { name: t.name, config: parseJson<ReportConfig>(t.config, { sections: [] }) };
}
