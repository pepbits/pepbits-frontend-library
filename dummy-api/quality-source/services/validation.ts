import { db, nowIso, parseJson } from "../db.js";
import { EVENT_DOMAINS, addMonths, type EventDomain } from "../domain.js";
import { applicableFacilities, type IndicatorRow } from "./calc.js";
import { loadTransactions } from "./tat.js";

interface Rule {
  id: number;
  code: string;
  name: string;
  scope: string;
  severity: "blocking" | "warning";
  params: string;
  active: number;
}

interface Finding {
  fingerprint: string;
  indicator_id?: number | null;
  facility_id?: number | null;
  result_id?: number | null;
  period?: string | null;
  message: string;
}

interface ResultRow {
  id: number;
  indicator_id: number;
  facility_id: number;
  period: string;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  status: string;
}

const fmt = (n: number | null) => (n === null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(2));

function resultsIn(periods: string[]): ResultRow[] {
  return db
    .prepare(`SELECT id, indicator_id, facility_id, period, numerator, denominator, value, status
              FROM indicator_results WHERE period IN (${periods.map(() => "?").join(",")})`)
    .all(...periods) as ResultRow[];
}

function evaluate(rule: Rule, periods: string[], indicators: Map<number, IndicatorRow>, facilityNames: Map<number, string>): Finding[] {
  const params = parseJson<Record<string, number>>(rule.params, {});
  const label = (r: ResultRow) => `${indicators.get(r.indicator_id)?.code} · ${facilityNames.get(r.facility_id)} · ${r.period}`;
  const results = rule.scope === "result" ? resultsIn(periods) : [];
  const findings: Finding[] = [];
  const base = (r: ResultRow, message: string): Finding => ({
    fingerprint: `${rule.code}:${r.id}`,
    indicator_id: r.indicator_id,
    facility_id: r.facility_id,
    result_id: r.id,
    period: r.period,
    message,
  });

  switch (rule.code) {
    case "VR-001":
      for (const r of results) {
        const ind = indicators.get(r.indicator_id);
        if (r.numerator === null || (ind?.unit !== "count" && r.denominator === null))
          findings.push(base(r, `${label(r)}: numerator or denominator has not been provided.`));
      }
      break;
    case "VR-002":
      for (const r of results) {
        if (indicators.get(r.indicator_id)?.unit === "percent" && r.numerator !== null && r.denominator !== null && r.numerator > r.denominator)
          findings.push(base(r, `${label(r)}: numerator (${fmt(r.numerator)}) exceeds denominator (${fmt(r.denominator)}).`));
      }
      break;
    case "VR-003":
      for (const r of results) {
        if (r.denominator === 0)
          findings.push(base(r, `${label(r)}: denominator is zero, so the result cannot be calculated. Confirm whether the service ran this period.`));
      }
      break;
    case "VR-004":
      for (const r of results) {
        const ind = indicators.get(r.indicator_id);
        if (r.value === null || !ind) continue;
        const max = ind.unit === "percent" ? 100 : ind.unit === "minutes" ? params.maxMinutes ?? 600 : ind.unit === "per_1000" ? params.maxRate ?? 50 : Infinity;
        if (r.value < 0 || r.value > max)
          findings.push(base(r, `${label(r)}: value ${fmt(r.value)} is outside the plausible range 0–${max}.`));
      }
      break;
    case "VR-005": {
      const threshold = params.threshold ?? 0.35;
      const prevPeriods = periods.map((p) => addMonths(p, -1));
      const prev = new Map(resultsIn(prevPeriods).map((r) => [`${r.indicator_id}:${r.facility_id}:${r.period}`, r]));
      for (const r of results) {
        const ind = indicators.get(r.indicator_id);
        const p = prev.get(`${r.indicator_id}:${r.facility_id}:${addMonths(r.period, -1)}`);
        if (!ind || !p || r.value === null || p.value === null || p.value === 0) continue;
        if ((r.denominator ?? 0) < ind.min_sample) continue;
        // Rare-event rates swing widely on small counts; only compare when counts are meaningful.
        if (ind.unit === "per_1000" && ((r.numerator ?? 0) < (params.minEvents ?? 10) || (p.numerator ?? 0) < (params.minEvents ?? 10))) continue;
        const change = Math.abs(r.value - p.value) / Math.abs(p.value);
        if (change > threshold)
          findings.push(base(r, `${label(r)}: changed ${(change * 100).toFixed(0)}% from the previous month (${fmt(p.value)} → ${fmt(r.value)}). Confirm the change is real.`));
      }
      break;
    }
    case "VR-006":
      for (const r of results) {
        const ind = indicators.get(r.indicator_id);
        if (ind && ind.unit !== "count" && r.denominator !== null && r.denominator > 0 && r.denominator < ind.min_sample)
          findings.push(base(r, `${label(r)}: denominator ${fmt(r.denominator)} is below the minimum sample of ${ind.min_sample}; interpret with caution.`));
      }
      break;
    case "VR-007": {
      const present = new Set(
        (db.prepare(`SELECT indicator_id, facility_id, period FROM indicator_results WHERE period IN (${periods.map(() => "?").join(",")})`).all(...periods) as ResultRow[]).map(
          (r) => `${r.indicator_id}:${r.facility_id}:${r.period}`,
        ),
      );
      for (const ind of indicators.values()) {
        if (ind.status !== "active") continue;
        for (const f of applicableFacilities(ind)) {
          for (const p of periods) {
            if (!present.has(`${ind.id}:${f.id}:${p}`))
              findings.push({
                fingerprint: `${rule.code}:${ind.id}:${f.id}:${p}`,
                indicator_id: ind.id,
                facility_id: f.id,
                period: p,
                message: `${ind.code} · ${f.name} · ${p}: no result has been recorded for an applicable facility.`,
              });
          }
        }
      }
      break;
    }
    case "VR-008":
    case "VR-009": {
      const lookbackDays = params.lookbackDays ?? 90;
      const staleHours = params.staleHours ?? 48;
      const from = new Date(Date.now() - lookbackDays * 86400000).toISOString();
      const to = new Date().toISOString();
      for (const domain of Object.keys(EVENT_DOMAINS) as EventDomain[]) {
        const cfg = EVENT_DOMAINS[domain];
        const txs = loadTransactions(domain, { from, to });
        const byFacility = new Map<number, string[]>();
        for (const t of txs) {
          let flagged = false;
          if (rule.code === "VR-008") {
            for (let i = 0; i < cfg.stages.length - 1 && !flagged; i++) {
              const a = t.stamps[cfg.stages[i]];
              const b = t.stamps[cfg.stages[i + 1]];
              if (a && b && b < a) flagged = true;
            }
          } else {
            const done = cfg.terminal.some((s) => t.stamps[s]) || t.stamps[cfg.cancel];
            const ageHours = (Date.now() - Date.parse(t.started_at)) / 3600000;
            flagged = !done && ageHours > staleHours;
          }
          if (flagged) {
            if (!byFacility.has(t.facility_id)) byFacility.set(t.facility_id, []);
            byFacility.get(t.facility_id)!.push(t.id);
          }
        }
        for (const [facilityId, ids] of byFacility) {
          findings.push({
            fingerprint: `${rule.code}:${domain}:${facilityId}`,
            facility_id: facilityId,
            message:
              rule.code === "VR-008"
                ? `${cfg.label} · ${facilityNames.get(facilityId)}: ${ids.length} workflow(s) have a stage recorded before the preceding stage (possible clock skew). Examples: ${ids.slice(0, 3).join(", ")}.`
                : `${cfg.label} · ${facilityNames.get(facilityId)}: ${ids.length} workflow(s) are older than ${staleHours} hours with no completion event. Examples: ${ids.slice(0, 3).join(", ")}.`,
          });
        }
      }
      break;
    }
  }
  return findings;
}

export function runValidation(periods: string[], userId: number | null) {
  const rules = db.prepare("SELECT * FROM validation_rules WHERE active = 1").all() as Rule[];
  const indicators = new Map((db.prepare("SELECT * FROM indicators").all() as IndicatorRow[]).map((i) => [i.id, i]));
  const facilityNames = new Map((db.prepare("SELECT id, name FROM facilities").all() as { id: number; name: string }[]).map((f) => [f.id, f.name]));
  const now = nowIso();
  let opened = 0;
  let autoResolved = 0;
  let checked = 0;

  const run = db.transaction(() => {
    for (const rule of rules) {
      const findings = evaluate(rule, periods, indicators, facilityNames);
      checked++;
      const seen = new Set<string>();
      for (const f of findings) {
        seen.add(f.fingerprint);
        const existing = db.prepare("SELECT id, status FROM validation_issues WHERE fingerprint = ?").get(f.fingerprint) as { id: number; status: string } | undefined;
        if (!existing) {
          db.prepare(
            `INSERT INTO validation_issues (rule_id, fingerprint, indicator_id, facility_id, result_id, period, severity, message, status, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,'open',?,?)`,
          ).run(rule.id, f.fingerprint, f.indicator_id ?? null, f.facility_id ?? null, f.result_id ?? null, f.period ?? null, rule.severity, f.message, now, now);
          opened++;
        } else if (existing.status === "resolved") {
          // Resolved previously but the condition is present again: reopen.
          db.prepare("UPDATE validation_issues SET status = 'open', message = ?, severity = ?, updated_at = ?, resolved_at = NULL WHERE id = ?").run(
            f.message,
            rule.severity,
            now,
            existing.id,
          );
          opened++;
        } else {
          db.prepare("UPDATE validation_issues SET message = ?, severity = ?, updated_at = ? WHERE id = ?").run(f.message, rule.severity, now, existing.id);
        }
      }
      // Auto-resolve open issues in scope that no longer reproduce.
      const scoped =
        rule.scope === "events"
          ? (db.prepare("SELECT id, fingerprint FROM validation_issues WHERE rule_id = ? AND status = 'open'").all(rule.id) as { id: number; fingerprint: string }[])
          : (db
              .prepare(`SELECT id, fingerprint FROM validation_issues WHERE rule_id = ? AND status = 'open' AND period IN (${periods.map(() => "?").join(",")})`)
              .all(rule.id, ...periods) as { id: number; fingerprint: string }[]);
      for (const issue of scoped) {
        if (!seen.has(issue.fingerprint)) {
          db.prepare(
            "UPDATE validation_issues SET status = 'resolved', resolution_note = 'Condition no longer present at re-validation', resolved_at = ?, updated_at = ? WHERE id = ?",
          ).run(now, now, issue.id);
          autoResolved++;
        }
      }
    }
    db.prepare("INSERT INTO validation_runs (started_at, user_id, scope, checked, opened, auto_resolved) VALUES (?,?,?,?,?,?)").run(
      now,
      userId,
      periods.join(","),
      checked,
      opened,
      autoResolved,
    );
  });
  run();
  return { rules: checked, opened, autoResolved, periods };
}

/** Open blocking issues attached to a result (directly or by indicator/facility/period). */
export function blockingIssuesFor(result: { id: number; indicator_id: number; facility_id: number; period: string }) {
  return db
    .prepare(
      `SELECT vi.id, vi.message, vr.code FROM validation_issues vi JOIN validation_rules vr ON vr.id = vi.rule_id
       WHERE vi.status = 'open' AND vi.severity = 'blocking'
         AND (vi.result_id = ? OR (vi.indicator_id = ? AND vi.facility_id = ? AND vi.period = ?))`,
    )
    .all(result.id, result.indicator_id, result.facility_id, result.period) as { id: number; message: string; code: string }[];
}
