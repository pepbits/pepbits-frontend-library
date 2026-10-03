import { Router, type Request } from "express";
import { db, nowIso, parseJson } from "../db.js";
import { audit, can, requireAuth, requirePermission, type Permission } from "../auth.js";
import { classify, computeValue, localMonthOf, monthsBetween, round } from "../domain.js";
import {
  aggregate,
  applicableFacilities,
  availablePeriods,
  getIndicator,
  monthlySeries,
  recalculateFromEvents,
  type IndicatorRow,
} from "../services/calc.js";
import { blockingIssuesFor } from "../services/validation.js";

export const indicatorsRouter = Router();
indicatorsRouter.use(requireAuth);

const INDICATOR_FIELDS = [
  "code", "name", "domain", "program", "category", "unit", "direction", "target", "warning",
  "numerator_def", "denominator_def", "exclusions", "frequency", "facility_types", "min_sample", "owner_id", "status",
] as const;

function validateIndicator(body: Record<string, unknown>, partial = false): string | null {
  const required = ["code", "name", "domain", "program", "category", "unit", "direction", "target", "warning", "numerator_def", "denominator_def", "facility_types"];
  if (!partial) for (const f of required) if (body[f] === undefined || body[f] === "") return `${f.replace("_", " ")} is required.`;
  if (body.unit && !["percent", "minutes", "per_1000", "count"].includes(String(body.unit))) return "Unit must be percent, minutes, per_1000 or count.";
  if (body.direction && !["higher", "lower"].includes(String(body.direction))) return "Direction must be higher or lower.";
  if (body.target !== undefined && Number.isNaN(Number(body.target))) return "Target must be a number.";
  if (body.warning !== undefined && Number.isNaN(Number(body.warning))) return "Warning threshold must be a number.";
  if (body.direction && body.target !== undefined && body.warning !== undefined) {
    const t = Number(body.target);
    const w = Number(body.warning);
    if (body.direction === "higher" && w > t) return "For higher-is-better indicators the warning threshold must be at or below the target.";
    if (body.direction === "lower" && w < t) return "For lower-is-better indicators the warning threshold must be at or above the target.";
  }
  return null;
}

indicatorsRouter.get("/indicators", (req, res) => {
  const periods = availablePeriods();
  const period = (req.query.period as string) || periods[periods.length - 1];
  const rows = db
    .prepare(
      `SELECT i.*, u.name AS owner_name, t.code AS tat_code FROM indicators i
       LEFT JOIN users u ON u.id = i.owner_id LEFT JOIN tat_definitions t ON t.id = i.tat_definition_id
       ORDER BY i.domain, i.code`,
    )
    .all() as (IndicatorRow & { owner_name: string; tat_code: string })[];
  res.json(
    rows.map((r) => {
      const agg = aggregate(r, [period]);
      return { ...r, facility_types: parseJson<string[]>(r.facility_types, []), latest: { period, ...agg } };
    }),
  );
});

indicatorsRouter.get("/indicators/:id", (req, res) => {
  const ind = getIndicator(Number(req.params.id));
  if (!ind) return res.status(404).json({ error: "not_found", message: "Indicator not found." });
  const periods = availablePeriods();
  const facilities = applicableFacilities(ind);
  const owner = ind.owner_id ? db.prepare("SELECT id, name, title FROM users WHERE id = ?").get(ind.owner_id) : null;
  const tat = ind.tat_definition_id ? db.prepare("SELECT * FROM tat_definitions WHERE id = ?").get(ind.tat_definition_id) : null;
  const series = monthlySeries(ind, periods);
  const byFacility = facilities.map((f) => ({
    facility: f,
    series: monthlySeries(ind, periods, [f.id]),
  }));
  const results = db
    .prepare(
      `SELECT r.*, f.code AS facility_code, f.name AS facility_name FROM indicator_results r JOIN facilities f ON f.id = r.facility_id
       WHERE r.indicator_id = ? ORDER BY r.period DESC, f.id`,
    )
    .all(ind.id);
  const history = db
    .prepare("SELECT ts, user_name, action, summary, details FROM audit_log WHERE entity_type = 'indicator' AND entity_id = ? ORDER BY ts DESC LIMIT 20")
    .all(String(ind.id));
  res.json({ indicator: { ...ind, facility_types: parseJson(ind.facility_types, []) }, owner, tat, facilities, series, byFacility, results, history });
});

indicatorsRouter.post("/indicators", requirePermission("indicators.manage"), (req, res) => {
  const body = req.body ?? {};
  const err = validateIndicator(body);
  if (err) return res.status(400).json({ error: "validation", message: err });
  if (db.prepare("SELECT 1 FROM indicators WHERE code = ?").get(body.code)) return res.status(409).json({ error: "duplicate", message: `Indicator code ${body.code} already exists.` });
  const now = nowIso();
  const r = db
    .prepare(
      `INSERT INTO indicators (code, name, domain, program, category, unit, direction, target, warning, numerator_def, denominator_def, exclusions, frequency, facility_types, source, min_sample, owner_id, version, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'manual',?,?,1,'active',?,?)`,
    )
    .run(body.code, body.name, body.domain, body.program, body.category, body.unit, body.direction, Number(body.target), Number(body.warning), body.numerator_def, body.denominator_def, body.exclusions ?? null, body.frequency ?? "monthly", JSON.stringify(body.facility_types), Number(body.min_sample ?? 30), body.owner_id ?? req.user!.id, now, now);
  audit(req, "indicator.created", "indicator", Number(r.lastInsertRowid), `Created indicator ${body.code} ${body.name}`, { after: body });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

indicatorsRouter.put("/indicators/:id", requirePermission("indicators.manage"), (req, res) => {
  const ind = getIndicator(Number(req.params.id));
  if (!ind) return res.status(404).json({ error: "not_found", message: "Indicator not found." });
  const body = { ...ind, ...req.body, facility_types: req.body.facility_types ?? parseJson(ind.facility_types, []) };
  const err = validateIndicator(body);
  if (err) return res.status(400).json({ error: "validation", message: err });
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const f of INDICATOR_FIELDS) {
    const prev = f === "facility_types" ? parseJson(ind.facility_types, []) : (ind as unknown as Record<string, unknown>)[f];
    const next = body[f];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      before[f] = prev;
      after[f] = next;
    }
  }
  if (!Object.keys(after).length) return res.json({ id: ind.id, changed: false });
  const definitionChanged = ["numerator_def", "denominator_def", "exclusions", "unit", "facility_types"].some((f) => f in after);
  db.prepare(
    `UPDATE indicators SET code=?, name=?, domain=?, program=?, category=?, unit=?, direction=?, target=?, warning=?, numerator_def=?, denominator_def=?, exclusions=?, frequency=?, facility_types=?, min_sample=?, owner_id=?, status=?, version = version + ?, updated_at=? WHERE id=?`,
  ).run(body.code, body.name, body.domain, body.program, body.category, body.unit, body.direction, Number(body.target), Number(body.warning), body.numerator_def, body.denominator_def, body.exclusions ?? null, body.frequency, JSON.stringify(body.facility_types), Number(body.min_sample), body.owner_id, body.status, definitionChanged ? 1 : 0, nowIso(), ind.id);
  audit(req, "indicator.updated", "indicator", ind.id, `Updated ${ind.code}: ${Object.keys(after).join(", ")}${definitionChanged ? " (new definition version)" : ""}`, { before, after });
  res.json({ id: ind.id, changed: true, newVersion: definitionChanged });
});

indicatorsRouter.post("/indicators/:id/recalculate", requirePermission("results.edit"), (req, res) => {
  const ind = getIndicator(Number(req.params.id));
  if (!ind) return res.status(404).json({ error: "not_found", message: "Indicator not found." });
  if (ind.source !== "events") return res.status(400).json({ error: "not_event_sourced", message: "Only indicators calculated from Event Pulse can be recalculated." });
  const periods = availablePeriods();
  const eventRange = db.prepare("SELECT MIN(started_at) AS a, MAX(started_at) AS b FROM transactions").get() as { a: string; b: string };
  const scope = monthsBetween(localMonthOf(eventRange.a), localMonthOf(eventRange.b)).filter((p) => periods.includes(p));
  const result = recalculateFromEvents(ind, scope, req.user!.id);
  audit(req, "indicator.recalculated", "indicator", ind.id, `Recalculated ${ind.code} from Event Pulse for ${scope.join(", ")}`, result);
  res.json({ periods: scope, ...result });
});

// ---------- results & verification ----------

const STATUS_FLOW: Record<string, { from: string[]; to: string; permission: Permission }> = {
  submit: { from: ["draft", "rejected"], to: "submitted", permission: "results.submit" },
  verify: { from: ["submitted"], to: "verified", permission: "results.verify" },
  approve: { from: ["verified"], to: "approved", permission: "results.approve" },
  reject: { from: ["submitted", "verified"], to: "rejected", permission: "results.verify" },
  return: { from: ["submitted", "verified", "approved"], to: "draft", permission: "results.approve" },
};

indicatorsRouter.get("/results", (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const q = req.query;
  if (q.period) { where.push("r.period = ?"); params.push(q.period); }
  if (q.status) {
    const statuses = String(q.status).split(",");
    where.push(`r.status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }
  if (q.facility) { where.push("r.facility_id = ?"); params.push(Number(q.facility)); }
  if (q.domain) { where.push("i.domain = ?"); params.push(q.domain); }
  if (q.program) { where.push("i.program = ?"); params.push(q.program); }
  if (q.indicator) { where.push("r.indicator_id = ?"); params.push(Number(q.indicator)); }
  if (q.search) { where.push("(i.code LIKE ? OR i.name LIKE ?)"); params.push(`%${q.search}%`, `%${q.search}%`); }
  const rows = db
    .prepare(
      `SELECT r.*, i.code, i.name, i.unit, i.direction, i.target, i.warning, i.domain, i.program, i.min_sample,
              f.code AS facility_code, f.name AS facility_name,
              (SELECT COUNT(*) FROM validation_issues vi WHERE vi.status = 'open' AND vi.severity = 'blocking'
                 AND (vi.result_id = r.id OR (vi.indicator_id = r.indicator_id AND vi.facility_id = r.facility_id AND vi.period = r.period))) AS blocking,
              (SELECT COUNT(*) FROM validation_issues vi WHERE vi.status = 'open' AND vi.severity = 'warning' AND vi.result_id = r.id) AS warnings,
              (SELECT u.name FROM result_reviews rr JOIN users u ON u.id = rr.user_id WHERE rr.result_id = r.id ORDER BY rr.id DESC LIMIT 1) AS last_actor
       FROM indicator_results r JOIN indicators i ON i.id = r.indicator_id JOIN facilities f ON f.id = r.facility_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY r.period DESC, i.domain, i.code, f.id LIMIT 1000`,
    )
    .all(...params) as (Record<string, unknown> & { value: number | null; direction: string; target: number; warning: number })[];
  res.json(rows.map((r) => ({ ...r, kpi_status: classify(r.value, r.direction, r.target, r.warning) })));
});

indicatorsRouter.get("/results/:id", (req, res) => {
  const r = db
    .prepare(
      `SELECT r.*, i.code, i.name, i.unit, i.direction, i.target, i.warning, i.numerator_def, i.denominator_def, i.exclusions, i.source AS indicator_source, i.min_sample,
              f.code AS facility_code, f.name AS facility_name
       FROM indicator_results r JOIN indicators i ON i.id = r.indicator_id JOIN facilities f ON f.id = r.facility_id WHERE r.id = ?`,
    )
    .get(Number(req.params.id)) as Record<string, any> | undefined;
  if (!r) return res.status(404).json({ error: "not_found", message: "Result not found." });
  const reviews = db
    .prepare("SELECT rr.*, u.name AS user_name, u.role FROM result_reviews rr LEFT JOIN users u ON u.id = rr.user_id WHERE rr.result_id = ? ORDER BY rr.created_at, rr.id")
    .all(r.id);
  const issues = db
    .prepare(
      `SELECT vi.*, vr.code AS rule_code, vr.name AS rule_name FROM validation_issues vi JOIN validation_rules vr ON vr.id = vi.rule_id
       WHERE vi.result_id = ? OR (vi.indicator_id = ? AND vi.facility_id = ? AND vi.period = ?) ORDER BY vi.status, vi.severity`,
    )
    .all(r.id, r.indicator_id, r.facility_id, r.period);
  const previous = db.prepare("SELECT period, value, numerator, denominator FROM indicator_results WHERE indicator_id = ? AND facility_id = ? AND period < ? ORDER BY period DESC LIMIT 6").all(r.indicator_id, r.facility_id, r.period);
  res.json({ result: { ...r, kpi_status: classify(r.value, r.direction, r.target, r.warning) }, reviews, issues, previous });
});

indicatorsRouter.put("/results/:id", requirePermission("results.edit"), (req, res) => {
  const r = db.prepare("SELECT r.*, i.unit, i.code FROM indicator_results r JOIN indicators i ON i.id = r.indicator_id WHERE r.id = ?").get(Number(req.params.id)) as
    | { id: number; numerator: number | null; denominator: number | null; status: string; unit: string; code: string; comment: string | null; period: string }
    | undefined;
  if (!r) return res.status(404).json({ error: "not_found", message: "Result not found." });
  if (!["draft", "rejected"].includes(r.status)) {
    return res.status(409).json({ error: "locked", message: `Results in ${r.status} status cannot be edited. Return it to draft first.` });
  }
  const numerator = req.body.numerator === null || req.body.numerator === "" ? null : Number(req.body.numerator);
  const denominator = req.body.denominator === null || req.body.denominator === "" ? null : Number(req.body.denominator);
  if ((numerator !== null && Number.isNaN(numerator)) || (denominator !== null && Number.isNaN(denominator))) {
    return res.status(400).json({ error: "validation", message: "Numerator and denominator must be numbers." });
  }
  if ((numerator ?? 0) < 0 || (denominator ?? 0) < 0) return res.status(400).json({ error: "validation", message: "Values cannot be negative." });
  const reason = String(req.body.reason ?? "").trim();
  if (!reason) return res.status(400).json({ error: "validation", message: "Give a reason for the change so reviewers can follow it." });
  const value = round(computeValue(r.unit, numerator, denominator), 2);
  const now = nowIso();
  db.prepare("UPDATE indicator_results SET numerator = ?, denominator = ?, value = ?, comment = ?, version = version + 1, updated_at = ? WHERE id = ?").run(numerator, denominator, value, req.body.comment ?? r.comment, now, r.id);
  db.prepare("INSERT INTO result_reviews (result_id, action, from_status, to_status, user_id, comment, created_at) VALUES (?,?,?,?,?,?,?)").run(r.id, "edited", r.status, r.status, req.user!.id, reason, now);
  audit(req, "result.edited", "indicator_result", r.id, `${r.code} · ${r.period}: ${r.numerator}/${r.denominator} → ${numerator}/${denominator}`, {
    before: { numerator: r.numerator, denominator: r.denominator },
    after: { numerator, denominator },
    reason,
  });
  res.json({ id: r.id, value });
});

function transition(req: Request, resultId: number, action: string, comment: string | null) {
  const flow = STATUS_FLOW[action];
  if (!flow) return { ok: false, status: 400, message: `Unknown action ${action}.` };
  if (!can(req.user, flow.permission)) return { ok: false, status: 403, message: `Your role cannot ${action} results.` };
  const r = db
    .prepare("SELECT r.*, i.code, f.code AS facility_code FROM indicator_results r JOIN indicators i ON i.id = r.indicator_id JOIN facilities f ON f.id = r.facility_id WHERE r.id = ?")
    .get(resultId) as { id: number; indicator_id: number; facility_id: number; period: string; status: string; code: string; facility_code: string; numerator: number | null } | undefined;
  if (!r) return { ok: false, status: 404, message: "Result not found." };
  if (!flow.from.includes(r.status)) return { ok: false, status: 409, message: `${r.code} · ${r.facility_code} is ${r.status}; it cannot be ${action === "return" ? "returned" : action + "d"} from that status.` };
  if (["reject", "return"].includes(action) && !comment) return { ok: false, status: 400, message: "Add a comment explaining what needs to change." };
  if (["submit", "verify", "approve"].includes(action)) {
    const blocking = blockingIssuesFor(r);
    if (blocking.length) return { ok: false, status: 409, message: `${r.code} · ${r.facility_code} has ${blocking.length} open blocking validation issue(s): ${blocking[0].code}. Resolve them first.` };
  }
  if (action === "approve") {
    const verifier = db.prepare("SELECT user_id FROM result_reviews WHERE result_id = ? AND action = 'verified' ORDER BY id DESC LIMIT 1").get(r.id) as { user_id: number } | undefined;
    if (verifier?.user_id === req.user!.id) return { ok: false, status: 409, message: `${r.code} · ${r.facility_code}: the person who verified a result cannot also approve it.` };
  }
  if (action === "verify") {
    const submitter = db.prepare("SELECT user_id FROM result_reviews WHERE result_id = ? AND action = 'submitted' ORDER BY id DESC LIMIT 1").get(r.id) as { user_id: number } | undefined;
    if (submitter?.user_id === req.user!.id) return { ok: false, status: 409, message: `${r.code} · ${r.facility_code}: the person who submitted a result cannot also verify it.` };
  }
  const now = nowIso();
  const past = { submit: "submitted", verify: "verified", approve: "approved", reject: "rejected", return: "returned" }[action as "submit"];
  db.prepare("UPDATE indicator_results SET status = ?, updated_at = ? WHERE id = ?").run(flow.to, now, r.id);
  db.prepare("INSERT INTO result_reviews (result_id, action, from_status, to_status, user_id, comment, created_at) VALUES (?,?,?,?,?,?,?)").run(r.id, past, r.status, flow.to, req.user!.id, comment, now);
  audit(req, `result.${past}`, "indicator_result", r.id, `${r.code} · ${r.facility_code} · ${r.period}: ${r.status} → ${flow.to}`, comment ? { comment } : {});
  return { ok: true, status: 200, message: `${r.code} · ${r.facility_code} ${past}.` };
}

indicatorsRouter.post("/results/:id/:action(submit|verify|approve|reject|return)", (req, res) => {
  const out = transition(req, Number(req.params.id), req.params.action, req.body?.comment?.trim() || null);
  res.status(out.status).json(out.ok ? { ok: true, message: out.message } : { error: "transition_failed", message: out.message });
});

indicatorsRouter.post("/results/bulk", (req, res) => {
  const { ids, action, comment } = req.body ?? {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: "validation", message: "Select at least one result." });
  const outcomes = ids.map((id: number) => ({ id, ...transition(req, Number(id), String(action), comment?.trim() || null) }));
  res.json({
    succeeded: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).map((o) => ({ id: o.id, message: o.message })),
  });
});

indicatorsRouter.get("/verification/summary", (req, res) => {
  const periods = availablePeriods();
  const period = (req.query.period as string) || periods[periods.length - 1];
  const counts = db.prepare("SELECT status, COUNT(*) AS n FROM indicator_results WHERE period = ? GROUP BY status").all(period) as { status: string; n: number }[];
  const byFacility = db
    .prepare(
      `SELECT f.id, f.code, f.name, r.status, COUNT(*) AS n FROM indicator_results r JOIN facilities f ON f.id = r.facility_id
       WHERE r.period = ? GROUP BY f.id, r.status ORDER BY f.id`,
    )
    .all(period);
  const ageing = db
    .prepare(
      `SELECT r.status, AVG(julianday('now') - julianday(r.updated_at)) AS avg_days, MAX(julianday('now') - julianday(r.updated_at)) AS max_days
       FROM indicator_results r WHERE r.status IN ('submitted','verified','rejected') GROUP BY r.status`,
    )
    .all();
  res.json({ period, counts, byFacility, ageing });
});

void aggregate;
