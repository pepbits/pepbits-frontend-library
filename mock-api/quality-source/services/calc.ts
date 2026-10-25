import { db, nowIso, parseJson } from "../db.js";
import {
  classify,
  computeValue,
  monthEndExclusiveIso,
  monthStartIso,
  monthsBetween,
  round,
  type KpiStatus,
} from "../domain.js";
import { getDefinition, loadTransactions, measure } from "./tat.js";

export interface IndicatorRow {
  id: number;
  code: string;
  name: string;
  domain: string;
  program: string;
  category: string;
  unit: string;
  direction: string;
  target: number;
  warning: number;
  numerator_def: string;
  denominator_def: string;
  exclusions: string | null;
  frequency: string;
  facility_types: string;
  source: string;
  tat_definition_id: number | null;
  min_sample: number;
  owner_id: number | null;
  version: number;
  status: string;
}

export interface Facility {
  id: number;
  code: string;
  name: string;
  type: string;
  city: string;
  jurisdiction: string;
}

export const allFacilities = () => db.prepare("SELECT * FROM facilities WHERE active = 1 ORDER BY id").all() as Facility[];

export function applicableFacilities(ind: IndicatorRow, facilityIds?: number[]): Facility[] {
  const types = parseJson<string[]>(ind.facility_types, []);
  return allFacilities().filter(
    (f) => types.includes(f.type) && (!facilityIds?.length || facilityIds.includes(f.id)),
  );
}

export interface Aggregate {
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  status: KpiStatus;
  expected: number;
  present: number;
  approved: number;
  completeness: number | null;
  approvalCoverage: number | null;
}

/** Pools numerators and denominators before dividing (never averages percentages). */
export function aggregate(ind: IndicatorRow, periods: string[], facilityIds?: number[]): Aggregate {
  const facilities = applicableFacilities(ind, facilityIds);
  const expected = facilities.length * periods.length;
  if (!facilities.length || !periods.length) {
    return { numerator: null, denominator: null, value: null, status: "no_data", expected: 0, present: 0, approved: 0, completeness: null, approvalCoverage: null };
  }
  const rows = db
    .prepare(
      `SELECT numerator, denominator, status FROM indicator_results
       WHERE indicator_id = ? AND period IN (${periods.map(() => "?").join(",")})
         AND facility_id IN (${facilities.map(() => "?").join(",")})`,
    )
    .all(ind.id, ...periods, ...facilities.map((f) => f.id)) as { numerator: number | null; denominator: number | null; status: string }[];

  const usable = rows.filter((r) => r.numerator !== null && (ind.unit === "count" || r.denominator !== null));
  const numerator = usable.length ? round(usable.reduce((s, r) => s + (r.numerator ?? 0), 0), 2) : null;
  const denominator = usable.length ? round(usable.reduce((s, r) => s + (r.denominator ?? 0), 0), 2) : null;
  const value = computeValue(ind.unit, numerator, denominator);
  return {
    numerator,
    denominator,
    value: round(value, 2),
    status: classify(value, ind.direction, ind.target, ind.warning),
    expected,
    present: usable.length,
    approved: rows.filter((r) => r.status === "approved").length,
    completeness: expected ? round((usable.length / expected) * 100, 1) : null,
    approvalCoverage: rows.length ? round((rows.filter((r) => r.status === "approved").length / rows.length) * 100, 1) : null,
  };
}

export function monthlySeries(ind: IndicatorRow, periods: string[], facilityIds?: number[]) {
  return periods.map((p) => {
    const a = aggregate(ind, [p], facilityIds);
    return { period: p, value: a.value, numerator: a.numerator, denominator: a.denominator, status: a.status };
  });
}

export const getIndicator = (id: number) =>
  db.prepare("SELECT * FROM indicators WHERE id = ?").get(id) as IndicatorRow | undefined;

/**
 * Recalculates an event-sourced indicator for the given months from Event Pulse history.
 * Approved results are immutable and are reported as locked rather than changed.
 */
export function recalculateFromEvents(ind: IndicatorRow, periods: string[], userId: number | null) {
  if (ind.source !== "events" || !ind.tat_definition_id) {
    return { updated: 0, unchanged: 0, locked: 0, created: 0, skipped: periods.length };
  }
  const def = getDefinition(ind.tat_definition_id);
  if (!def) return { updated: 0, unchanged: 0, locked: 0, created: 0, skipped: periods.length };

  const counters = { updated: 0, unchanged: 0, locked: 0, created: 0, skipped: 0 };
  const facilities = applicableFacilities(ind);
  const now = nowIso();

  const tx = db.transaction(() => {
    for (const period of periods) {
      for (const f of facilities) {
        const m = measure(def, loadTransactions(def.domain, { from: monthStartIso(period), to: monthEndExclusiveIso(period), facilityIds: [f.id] }));
        const valid = m.filter((x) => x.outcome === "within" || x.outcome === "over");
        if (!valid.length) {
          counters.skipped++;
          continue;
        }
        let numerator: number;
        const denominator = valid.length;
        if (ind.unit === "minutes") numerator = round(valid.reduce((s, x) => s + (x.minutes ?? 0), 0), 2) as number;
        else numerator = valid.filter((x) => x.outcome === "within").length;
        const value = round(computeValue(ind.unit, numerator, denominator), 2);

        const existing = db
          .prepare("SELECT * FROM indicator_results WHERE indicator_id = ? AND facility_id = ? AND period = ?")
          .get(ind.id, f.id, period) as { id: number; numerator: number; denominator: number; status: string; version: number } | undefined;

        if (!existing) {
          const r = db
            .prepare(
              `INSERT INTO indicator_results (indicator_id, facility_id, period, numerator, denominator, value, status, source, version, calculated_at, updated_at)
               VALUES (?,?,?,?,?,?,'draft','events',1,?,?)`,
            )
            .run(ind.id, f.id, period, numerator, denominator, value, now, now);
          db.prepare(
            "INSERT INTO result_reviews (result_id, action, from_status, to_status, user_id, comment, created_at) VALUES (?,?,?,?,?,?,?)",
          ).run(r.lastInsertRowid, "recalculated", null, "draft", userId, "Calculated from Event Pulse history", now);
          counters.created++;
          continue;
        }
        if (existing.numerator === numerator && existing.denominator === denominator) {
          counters.unchanged++;
          continue;
        }
        if (existing.status === "approved") {
          counters.locked++;
          continue;
        }
        db.prepare(
          `UPDATE indicator_results SET numerator = ?, denominator = ?, value = ?, status = 'draft', version = version + 1,
             calculated_at = ?, updated_at = ? WHERE id = ?`,
        ).run(numerator, denominator, value, now, now, existing.id);
        db.prepare(
          "INSERT INTO result_reviews (result_id, action, from_status, to_status, user_id, comment, created_at) VALUES (?,?,?,?,?,?,?)",
        ).run(
          existing.id,
          "recalculated",
          existing.status,
          "draft",
          userId,
          `Recalculated from Event Pulse: ${existing.numerator}/${existing.denominator} → ${numerator}/${denominator}`,
          now,
        );
        counters.updated++;
      }
    }
  });
  tx();
  return counters;
}

export function availablePeriods(): string[] {
  const row = db.prepare("SELECT MIN(period) AS min, MAX(period) AS max FROM indicator_results").get() as { min: string | null; max: string | null };
  if (!row.min || !row.max) return [];
  return monthsBetween(row.min, row.max);
}
