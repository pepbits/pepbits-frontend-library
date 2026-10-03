import { db, parseJson } from "../db.js";
import { EVENT_DOMAINS, REPORTING_UTC_OFFSET_HOURS, type EventDomain, percentile, round } from "../domain.js";

export interface TatDefinition {
  id: number;
  code: string;
  name: string;
  domain: EventDomain;
  start_event: string;
  end_event: string;
  target_minutes: number;
  filter: string;
  description: string | null;
}

export interface LoadedTx {
  id: string;
  facility_id: number;
  priority: string;
  attributes: Record<string, unknown>;
  started_at: string;
  current_state: string;
  stamps: Record<string, string>;
}

export interface TatScope {
  from: string; // ISO inclusive
  to: string; // ISO exclusive
  facilityIds?: number[];
}

/**
 * Loads transactions for a domain together with the first effective timestamp of each stage.
 * Effective events exclude retractions and any event superseded by a correction.
 */
export function loadTransactions(domain: EventDomain, scope: TatScope): LoadedTx[] {
  const params: unknown[] = [domain, domain, scope.from, scope.to];
  let facilityClause = "";
  if (scope.facilityIds?.length) {
    facilityClause = ` AND t.facility_id IN (${scope.facilityIds.map(() => "?").join(",")})`;
    params.push(...scope.facilityIds);
  }
  const rows = db
    .prepare(
      `WITH superseded AS (
         SELECT supersedes_event_id AS id FROM clinical_events
         WHERE domain = ? AND supersedes_event_id IS NOT NULL
       )
       SELECT t.id, t.facility_id, t.priority, t.attributes, t.started_at, t.current_state,
              e.event_type, MIN(e.occurred_at) AS occurred_at
       FROM transactions t
       JOIN clinical_events e ON e.transaction_id = t.id
       WHERE t.domain = ? AND t.started_at >= ? AND t.started_at < ? ${facilityClause}
         AND e.event_kind != 'retraction'
         AND e.event_id NOT IN (SELECT id FROM superseded)
       GROUP BY t.id, e.event_type`,
    )
    .all(...params) as {
    id: string;
    facility_id: number;
    priority: string;
    attributes: string;
    started_at: string;
    current_state: string;
    event_type: string;
    occurred_at: string;
  }[];

  const map = new Map<string, LoadedTx>();
  for (const r of rows) {
    let tx = map.get(r.id);
    if (!tx) {
      tx = {
        id: r.id,
        facility_id: r.facility_id,
        priority: r.priority,
        attributes: parseJson(r.attributes, {}),
        started_at: r.started_at,
        current_state: r.current_state,
        stamps: {},
      };
      map.set(r.id, tx);
    }
    tx.stamps[r.event_type] = r.occurred_at;
  }
  return [...map.values()];
}

export function matchesFilter(tx: LoadedTx, filterJson: string): boolean {
  const filter = parseJson<Record<string, unknown>>(filterJson, {});
  for (const [key, expected] of Object.entries(filter)) {
    const actual = key === "priority" ? tx.priority : tx.attributes[key];
    if (actual !== expected) return false;
  }
  return true;
}

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60000;

export type TatOutcome = "within" | "over" | "incomplete" | "negative" | "cancelled";

export interface TatMeasurement {
  tx: LoadedTx;
  minutes: number | null;
  outcome: TatOutcome;
}

export function measure(def: TatDefinition, txs: LoadedTx[]): TatMeasurement[] {
  const cancelEvent = EVENT_DOMAINS[def.domain].cancel;
  const out: TatMeasurement[] = [];
  for (const tx of txs) {
    if (!matchesFilter(tx, def.filter)) continue;
    const start = tx.stamps[def.start_event];
    if (!start) continue; // not in the initial population
    if (tx.stamps[cancelEvent]) {
      out.push({ tx, minutes: null, outcome: "cancelled" });
      continue;
    }
    const end = tx.stamps[def.end_event];
    if (!end) {
      out.push({ tx, minutes: null, outcome: "incomplete" });
      continue;
    }
    const minutes = minutesBetween(start, end);
    if (minutes < 0) {
      out.push({ tx, minutes, outcome: "negative" });
      continue;
    }
    out.push({ tx, minutes, outcome: minutes <= def.target_minutes ? "within" : "over" });
  }
  return out;
}

export function summarize(def: TatDefinition, m: TatMeasurement[]) {
  const valid = m.filter((x) => x.outcome === "within" || x.outcome === "over");
  const sorted = valid.map((x) => x.minutes as number).sort((a, b) => a - b);
  const within = valid.filter((x) => x.outcome === "within").length;
  return {
    population: m.length,
    measured: valid.length,
    within,
    over: valid.length - within,
    incomplete: m.filter((x) => x.outcome === "incomplete").length,
    negative: m.filter((x) => x.outcome === "negative").length,
    cancelled: m.filter((x) => x.outcome === "cancelled").length,
    pctWithin: valid.length ? round((within / valid.length) * 100, 1) : null,
    median: round(percentile(sorted, 0.5), 1),
    p90: round(percentile(sorted, 0.9), 1),
    mean: valid.length ? round(sorted.reduce((a, b) => a + b, 0) / valid.length, 1) : null,
    min: sorted.length ? round(sorted[0], 1) : null,
    max: sorted.length ? round(sorted[sorted.length - 1], 1) : null,
    target: def.target_minutes,
  };
}

function histogram(def: TatDefinition, m: TatMeasurement[]) {
  const values = m.filter((x) => x.minutes !== null && x.minutes >= 0).map((x) => x.minutes as number);
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const ceiling = Math.max(percentile(sorted, 0.97) ?? 0, def.target_minutes * 1.6);
  const rawWidth = ceiling / 14;
  const nice = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720];
  const width = nice.find((n) => n >= rawWidth) ?? Math.ceil(rawWidth);
  const buckets = Math.ceil(ceiling / width);
  const out = Array.from({ length: buckets + 1 }, (_, i) => ({
    from: i * width,
    to: i === buckets ? null : (i + 1) * width,
    label: i === buckets ? `${i * width}+` : `${i * width}–${(i + 1) * width}`,
    count: 0,
    withinTarget: (i + 1) * width <= def.target_minutes,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor(v / width), buckets);
    out[idx].count++;
  }
  return out;
}

const toLocal = (iso: string) => new Date(Date.parse(iso) + REPORTING_UTC_OFFSET_HOURS * 3600000).toISOString();

function weekStart(iso: string): string {
  const d = new Date(toLocal(iso));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function trend(def: TatDefinition, m: TatMeasurement[], scope: TatScope) {
  const days = (Date.parse(scope.to) - Date.parse(scope.from)) / 86400000;
  const keyOf = days <= 35 ? (iso: string) => toLocal(iso).slice(0, 10) : weekStart;
  const groups = new Map<string, TatMeasurement[]>();
  for (const x of m) {
    const start = x.tx.stamps[def.start_event];
    const k = keyOf(start);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(x);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, items]) => {
      const s = summarize(def, items);
      return { bucket, median: s.median, p90: s.p90, pctWithin: s.pctWithin, volume: s.population, incomplete: s.incomplete };
    });
}

function byFacility(def: TatDefinition, m: TatMeasurement[]) {
  const facilities = db.prepare("SELECT id, code, name FROM facilities").all() as { id: number; code: string; name: string }[];
  return facilities
    .map((f) => ({ facility: f, ...summarize(def, m.filter((x) => x.tx.facility_id === f.id)) }))
    .filter((r) => r.population > 0);
}

function stageBreakdown(domain: EventDomain, txs: LoadedTx[]) {
  const stages = EVENT_DOMAINS[domain].stages;
  const out: { from: string; to: string; median: number | null; p90: number | null; n: number }[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const a = stages[i];
    const b = stages[i + 1];
    const vals = txs
      .filter((t) => t.stamps[a] && t.stamps[b])
      .map((t) => minutesBetween(t.stamps[a], t.stamps[b]))
      .filter((v) => v >= 0)
      .sort((x, y) => x - y);
    out.push({ from: a, to: b, median: round(percentile(vals, 0.5), 1), p90: round(percentile(vals, 0.9), 1), n: vals.length });
  }
  return out;
}

export function getDefinition(id: number): TatDefinition | undefined {
  return db.prepare("SELECT * FROM tat_definitions WHERE id = ?").get(id) as TatDefinition | undefined;
}

export function tatAnalysis(def: TatDefinition, scope: TatScope) {
  const txs = loadTransactions(def.domain, scope);
  const m = measure(def, txs);
  const facilityNames = new Map(
    (db.prepare("SELECT id, name FROM facilities").all() as { id: number; name: string }[]).map((f) => [f.id, f.name]),
  );
  const exceptions = m
    .filter((x) => x.outcome !== "within" && x.outcome !== "cancelled")
    .sort((a, b) => {
      const rank = (o: TatOutcome) => (o === "negative" ? 0 : o === "incomplete" ? 1 : 2);
      return rank(a.outcome) - rank(b.outcome) || (b.minutes ?? 0) - (a.minutes ?? 0);
    })
    .slice(0, 60)
    .map((x) => ({
      transactionId: x.tx.id,
      facility: facilityNames.get(x.tx.facility_id),
      priority: x.tx.priority,
      attributes: x.tx.attributes,
      startedAt: x.tx.stamps[def.start_event],
      endedAt: x.tx.stamps[def.end_event] ?? null,
      minutes: round(x.minutes, 1),
      outcome: x.outcome,
      currentState: x.tx.current_state,
    }));
  return {
    definition: def,
    summary: summarize(def, m),
    histogram: histogram(def, m),
    trend: trend(def, m, scope),
    byFacility: byFacility(def, m),
    stages: stageBreakdown(def.domain, txs.filter((t) => matchesFilter(t, def.filter))),
    exceptions,
  };
}

/** Lightweight summary used by dashboards and reports. */
export function tatSummary(def: TatDefinition, scope: TatScope) {
  return summarize(def, measure(def, loadTransactions(def.domain, scope)));
}
