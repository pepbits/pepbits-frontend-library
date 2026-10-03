import { Router } from "express";
import { db, nowIso, parseJson } from "../db.js";
import { audit, requireAuth, requirePermission } from "../auth.js";
import { availablePeriods } from "../services/calc.js";
import { runValidation } from "../services/validation.js";

export const validationRouter = Router();
validationRouter.use(requireAuth);

validationRouter.get("/validation/rules", (_req, res) => {
  const rules = db
    .prepare(
      `SELECT r.*, (SELECT COUNT(*) FROM validation_issues vi WHERE vi.rule_id = r.id AND vi.status = 'open') AS open_issues
       FROM validation_rules r ORDER BY r.code`,
    )
    .all()
    .map((r: any) => ({ ...r, params: parseJson(r.params, {}) }));
  res.json(rules);
});

validationRouter.put("/validation/rules/:id", requirePermission("validation.rules"), (req, res) => {
  const rule = db.prepare("SELECT * FROM validation_rules WHERE id = ?").get(Number(req.params.id)) as any;
  if (!rule) return res.status(404).json({ error: "not_found", message: "Rule not found." });
  const severity = req.body.severity ?? rule.severity;
  if (!["blocking", "warning"].includes(severity)) return res.status(400).json({ error: "validation", message: "Severity must be blocking or warning." });
  const active = req.body.active === undefined ? rule.active : req.body.active ? 1 : 0;
  const params = req.body.params ? JSON.stringify(req.body.params) : rule.params;
  db.prepare("UPDATE validation_rules SET severity = ?, active = ?, params = ? WHERE id = ?").run(severity, active, params, rule.id);
  audit(req, "validation_rule.updated", "validation_rule", rule.id, `Updated rule ${rule.code}`, {
    before: { severity: rule.severity, active: !!rule.active, params: parseJson(rule.params, {}) },
    after: { severity, active: !!active, params: parseJson(params, {}) },
  });
  res.json({ ok: true });
});

validationRouter.get("/validation/issues", (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const q = req.query;
  if (q.status) { where.push("vi.status = ?"); params.push(q.status); }
  if (q.severity) { where.push("vi.severity = ?"); params.push(q.severity); }
  if (q.rule) { where.push("vr.code = ?"); params.push(q.rule); }
  if (q.facility) { where.push("vi.facility_id = ?"); params.push(Number(q.facility)); }
  if (q.period) { where.push("vi.period = ?"); params.push(q.period); }
  if (q.assigned === "me") { where.push("vi.assigned_to = ?"); params.push(req.user!.id); }
  const rows = db
    .prepare(
      `SELECT vi.*, vr.code AS rule_code, vr.name AS rule_name, vr.scope, i.code AS indicator_code, f.code AS facility_code,
              ua.name AS assignee, ur.name AS resolver
       FROM validation_issues vi JOIN validation_rules vr ON vr.id = vi.rule_id
       LEFT JOIN indicators i ON i.id = vi.indicator_id LEFT JOIN facilities f ON f.id = vi.facility_id
       LEFT JOIN users ua ON ua.id = vi.assigned_to LEFT JOIN users ur ON ur.id = vi.resolved_by
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY CASE vi.status WHEN 'open' THEN 0 ELSE 1 END, CASE vi.severity WHEN 'blocking' THEN 0 ELSE 1 END, vi.updated_at DESC LIMIT 500`,
    )
    .all(...params);
  const summary = db.prepare("SELECT status, severity, COUNT(*) AS n FROM validation_issues GROUP BY status, severity").all();
  const lastRun = db.prepare("SELECT vr.*, u.name AS user_name FROM validation_runs vr LEFT JOIN users u ON u.id = vr.user_id ORDER BY vr.id DESC LIMIT 1").get();
  res.json({ rows, summary, lastRun });
});

validationRouter.post("/validation/run", requirePermission("validation.run"), (req, res) => {
  const periods = availablePeriods();
  const requested: string[] = Array.isArray(req.body?.periods) && req.body.periods.length ? req.body.periods : periods.slice(-3);
  const valid = requested.filter((p) => periods.includes(p));
  if (!valid.length) return res.status(400).json({ error: "validation", message: "Choose at least one reporting period." });
  const result = runValidation(valid, req.user!.id);
  audit(req, "validation.run", "validation", null, `Validation run for ${valid.join(", ")}: ${result.opened} opened, ${result.autoResolved} auto-resolved`, result);
  res.json(result);
});

validationRouter.post("/validation/issues/:id/:action(resolve|waive|reopen|assign)", (req, res) => {
  const issue = db.prepare("SELECT vi.*, vr.code FROM validation_issues vi JOIN validation_rules vr ON vr.id = vi.rule_id WHERE vi.id = ?").get(Number(req.params.id)) as any;
  if (!issue) return res.status(404).json({ error: "not_found", message: "Issue not found." });
  const action = req.params.action;
  const note = String(req.body?.note ?? "").trim();
  const role = req.user!.role;
  const allowed = {
    resolve: ["admin", "quality_manager", "data_steward"],
    reopen: ["admin", "quality_manager", "data_steward", "approver"],
    assign: ["admin", "quality_manager", "data_steward"],
    waive: ["admin", "approver"],
  }[action]!;
  if (!allowed.includes(role)) return res.status(403).json({ error: "forbidden", message: `Your role cannot ${action} validation issues.` });
  const now = nowIso();
  if (action === "assign") {
    const userId = req.body?.userId ? Number(req.body.userId) : null;
    db.prepare("UPDATE validation_issues SET assigned_to = ?, updated_at = ? WHERE id = ?").run(userId, now, issue.id);
    audit(req, "validation_issue.assigned", "validation_issue", issue.id, `Assigned ${issue.code} issue #${issue.id}`, { assigned_to: userId });
    return res.json({ ok: true });
  }
  if (action === "reopen") {
    if (issue.status === "open") return res.status(409).json({ error: "invalid_state", message: "The issue is already open." });
    db.prepare("UPDATE validation_issues SET status = 'open', resolved_at = NULL, resolved_by = NULL, resolution_note = NULL, updated_at = ? WHERE id = ?").run(now, issue.id);
    audit(req, "validation_issue.reopened", "validation_issue", issue.id, `Reopened ${issue.code} issue #${issue.id}`, { note });
    return res.json({ ok: true });
  }
  if (issue.status !== "open") return res.status(409).json({ error: "invalid_state", message: `The issue is already ${issue.status}.` });
  if (!note) return res.status(400).json({ error: "validation", message: action === "waive" ? "Explain why this issue can be accepted." : "Describe how the issue was resolved." });
  if (action === "waive" && issue.severity === "blocking" && role !== "admin") {
    return res.status(403).json({ error: "forbidden", message: "Blocking issues can only be waived by an administrator. Resolve the underlying data instead." });
  }
  const status = action === "resolve" ? "resolved" : "waived";
  db.prepare("UPDATE validation_issues SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?").run(status, note, req.user!.id, now, now, issue.id);
  audit(req, `validation_issue.${status}`, "validation_issue", issue.id, `${status === "resolved" ? "Resolved" : "Waived"} ${issue.code} issue #${issue.id}`, { note, message: issue.message });
  res.json({ ok: true });
});
