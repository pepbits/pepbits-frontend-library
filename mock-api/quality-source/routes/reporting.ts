import { Router } from "express";
import { db, nowIso, parseJson } from "../db.js";
import { audit, can, requireAuth, requirePermission } from "../auth.js";
import { availablePeriods } from "../services/calc.js";
import { renderReport, reportToCsv, templateConfig, type ReportConfig } from "../services/reports.js";
import {
  SCHEDULE_TZ,
  addSubmissionEvent,
  channelNote,
  computeNextRun,
  executeSchedule,
  nextSubmissionReference,
  type ScheduleRow,
} from "../services/scheduler.js";

export const reportingRouter = Router();
reportingRouter.use(requireAuth);

const SECTION_TYPES = ["scorecard", "kpi_table", "kpi_trend", "facility_comparison", "tat_summary", "validation_summary", "verification_status", "text"];

function validateConfig(config: unknown): string | null {
  const c = config as ReportConfig;
  if (!c || !Array.isArray(c.sections)) return "The report needs at least one section.";
  if (!c.sections.length) return "Add at least one section to the report.";
  if (c.sections.length > 40) return "A report can have at most 40 sections.";
  for (const s of c.sections) {
    if (!SECTION_TYPES.includes(s.type)) return `Unknown section type ${s.type}.`;
    if (!s.title?.trim()) return "Every section needs a title.";
    if ((s.type === "kpi_trend" || s.type === "facility_comparison") && !s.indicatorId) return `Choose an indicator for “${s.title}”.`;
  }
  return null;
}

function parsePeriod(q: Record<string, unknown>) {
  const periods = availablePeriods();
  const latest = periods[periods.length - 1];
  const from = (q.from as string) || latest;
  const to = (q.to as string) || from;
  return from <= to ? { from, to } : { from: to, to: from };
}

const facilitiesFromQuery = (v: unknown) => (v ? String(v).split(",").map(Number).filter(Boolean) : []);

reportingRouter.get("/report-templates", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, a.name AS authority_name, a.code AS authority_code, u.name AS created_by_name,
              (SELECT COUNT(*) FROM schedules s WHERE s.template_id = t.id AND s.active = 1) AS active_schedules,
              (SELECT MAX(generated_at) FROM report_runs r WHERE r.template_id = t.id) AS last_generated
       FROM report_templates t LEFT JOIN authorities a ON a.id = t.authority_id LEFT JOIN users u ON u.id = t.created_by
       WHERE t.archived = 0 ORDER BY t.kind DESC, t.name`,
    )
    .all()
    .map((t: any) => ({ ...t, config: parseJson(t.config, { sections: [] }) }));
  res.json(rows);
});

reportingRouter.get("/report-templates/:id", (req, res) => {
  const t = db
    .prepare("SELECT t.*, a.name AS authority_name FROM report_templates t LEFT JOIN authorities a ON a.id = t.authority_id WHERE t.id = ?")
    .get(Number(req.params.id)) as any;
  if (!t) return res.status(404).json({ error: "not_found", message: "Report not found." });
  const runs = db
    .prepare("SELECT r.*, u.name AS generated_by_name FROM report_runs r LEFT JOIN users u ON u.id = r.generated_by WHERE r.template_id = ? ORDER BY r.generated_at DESC LIMIT 15")
    .all(t.id)
    .map((r: any) => ({ ...r, summary: parseJson(r.summary, {}) }));
  res.json({ ...t, config: parseJson(t.config, { sections: [] }), runs });
});

reportingRouter.post("/report-templates", requirePermission("reports.design"), (req, res) => {
  const { name, description, program, authority_id, config } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "validation", message: "Give the report a name." });
  const err = validateConfig(config);
  if (err) return res.status(400).json({ error: "validation", message: err });
  const now = nowIso();
  const r = db
    .prepare("INSERT INTO report_templates (name, description, kind, program, authority_id, config, created_by, created_at, updated_at) VALUES (?,?,'custom',?,?,?,?,?,?)")
    .run(name.trim(), description ?? null, program || null, authority_id || null, JSON.stringify(config), req.user!.id, now, now);
  audit(req, "report_template.created", "report_template", Number(r.lastInsertRowid), `Created report ${name}`, { sections: config.sections.length });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

reportingRouter.put("/report-templates/:id", requirePermission("reports.design"), (req, res) => {
  const t = db.prepare("SELECT * FROM report_templates WHERE id = ?").get(Number(req.params.id)) as any;
  if (!t) return res.status(404).json({ error: "not_found", message: "Report not found." });
  const { name, description, program, authority_id, config } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "validation", message: "Give the report a name." });
  const err = validateConfig(config);
  if (err) return res.status(400).json({ error: "validation", message: err });
  db.prepare("UPDATE report_templates SET name = ?, description = ?, program = ?, authority_id = ?, config = ?, updated_at = ? WHERE id = ?").run(
    name.trim(), description ?? null, program || null, authority_id || null, JSON.stringify(config), nowIso(), t.id,
  );
  const before = parseJson<ReportConfig>(t.config, { sections: [] });
  audit(req, "report_template.updated", "report_template", t.id, `Updated report ${name}`, {
    before: { name: t.name, sections: before.sections.map((s) => s.title) },
    after: { name, sections: (config as ReportConfig).sections.map((s) => s.title) },
  });
  res.json({ id: t.id });
});

reportingRouter.post("/report-templates/:id/duplicate", requirePermission("reports.design"), (req, res) => {
  const t = db.prepare("SELECT * FROM report_templates WHERE id = ?").get(Number(req.params.id)) as any;
  if (!t) return res.status(404).json({ error: "not_found", message: "Report not found." });
  const now = nowIso();
  const r = db
    .prepare("INSERT INTO report_templates (name, description, kind, program, authority_id, config, created_by, created_at, updated_at) VALUES (?,?,'custom',?,?,?,?,?,?)")
    .run(`${t.name} (copy)`, t.description, t.program, t.authority_id, t.config, req.user!.id, now, now);
  audit(req, "report_template.duplicated", "report_template", Number(r.lastInsertRowid), `Duplicated ${t.name}`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

reportingRouter.delete("/report-templates/:id", requirePermission("reports.design"), (req, res) => {
  const t = db.prepare("SELECT * FROM report_templates WHERE id = ?").get(Number(req.params.id)) as any;
  if (!t) return res.status(404).json({ error: "not_found", message: "Report not found." });
  if (t.kind === "system") return res.status(409).json({ error: "protected", message: "System reports cannot be archived. Duplicate it to make your own version." });
  const active = (db.prepare("SELECT COUNT(*) AS n FROM schedules WHERE template_id = ? AND active = 1").get(t.id) as { n: number }).n;
  if (active) return res.status(409).json({ error: "in_use", message: `Pause or delete the ${active} active schedule(s) that use this report first.` });
  db.prepare("UPDATE report_templates SET archived = 1, updated_at = ? WHERE id = ?").run(nowIso(), t.id);
  audit(req, "report_template.archived", "report_template", t.id, `Archived report ${t.name}`);
  res.json({ ok: true });
});

/** Live preview for the designer: renders an unsaved config. */
reportingRouter.post("/reports/preview", (req, res) => {
  const err = validateConfig(req.body?.config);
  if (err) return res.status(400).json({ error: "validation", message: err });
  const { from, to } = parsePeriod(req.body ?? {});
  res.json(renderReport({ config: req.body.config, periodFrom: from, periodTo: to, facilityIds: req.body.facilityIds ?? [] }));
});

reportingRouter.get("/report-templates/:id/render", (req, res) => {
  const tpl = templateConfig(Number(req.params.id));
  if (!tpl) return res.status(404).json({ error: "not_found", message: "Report not found." });
  const { from, to } = parsePeriod(req.query as Record<string, unknown>);
  const facilityIds = facilitiesFromQuery(req.query.facility);
  const rendered = renderReport({ config: tpl.config, periodFrom: from, periodTo: to, facilityIds });
  if (req.query.record === "1") {
    db.prepare(
      "INSERT INTO report_runs (template_id, period_from, period_to, facility_ids, trigger, schedule_id, generated_by, generated_at, checksum, summary) VALUES (?,?,?,?,'manual',NULL,?,?,?,?)",
    ).run(Number(req.params.id), from, to, JSON.stringify(facilityIds), req.user!.id, rendered.generatedAt, rendered.checksum, JSON.stringify(rendered.summary));
    audit(req, "report.generated", "report_template", req.params.id, `Generated ${tpl.name} for ${from}${to !== from ? ` to ${to}` : ""}`, { checksum: rendered.checksum });
  }
  res.json({ template: { id: Number(req.params.id), name: tpl.name }, ...rendered });
});

reportingRouter.get("/report-templates/:id/export.csv", (req, res) => {
  const tpl = templateConfig(Number(req.params.id));
  if (!tpl) return res.status(404).json({ error: "not_found", message: "Report not found." });
  const { from, to } = parsePeriod(req.query as Record<string, unknown>);
  const rendered = renderReport({ config: tpl.config, periodFrom: from, periodTo: to, facilityIds: facilitiesFromQuery(req.query.facility) });
  audit(req, "report.exported", "report_template", req.params.id, `Exported ${tpl.name} (${from}–${to}) as CSV`, { checksum: rendered.checksum });
  const filename = `${tpl.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${from}${to !== from ? `-to-${to}` : ""}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + reportToCsv(tpl.name, rendered));
});

// ---------- schedules ----------

function validateSchedule(b: any): string | null {
  if (!b.name?.trim()) return "Give the schedule a name.";
  if (!b.template_id) return "Choose a report.";
  if (!["daily", "weekly", "monthly", "quarterly"].includes(b.frequency)) return "Choose how often it runs.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time_of_day ?? "")) return "Time must be in HH:MM format.";
  if (b.frequency === "weekly" && !(b.day_of_week >= 0 && b.day_of_week <= 6)) return "Choose a day of the week.";
  if ((b.frequency === "monthly" || b.frequency === "quarterly") && !(b.day_of_month >= 1 && b.day_of_month <= 28)) return "Choose a day of the month between 1 and 28.";
  if (!Array.isArray(b.recipients)) return "Recipients must be a list.";
  const bad = b.recipients.find((r: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r));
  if (bad) return `${bad} is not a valid email address.`;
  if (!b.authority_id && !b.recipients.length) return "Choose an authority or add at least one recipient.";
  if (!["pdf", "csv", "xlsx"].includes(b.format)) return "Format must be PDF, CSV or XLSX.";
  return null;
}

reportingRouter.get("/schedules", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, t.name AS template_name, a.name AS authority_name, a.code AS authority_code, a.channel, u.name AS created_by_name
       FROM schedules s JOIN report_templates t ON t.id = s.template_id LEFT JOIN authorities a ON a.id = s.authority_id LEFT JOIN users u ON u.id = s.created_by
       ORDER BY s.active DESC, s.next_run_at`,
    )
    .all()
    .map((s: any) => ({ ...s, facility_ids: parseJson(s.facility_ids, []), recipients: parseJson(s.recipients, []) }));
  res.json({ timezone: SCHEDULE_TZ, rows });
});

reportingRouter.post("/schedules", requirePermission("schedules.manage"), (req, res) => {
  const b = req.body ?? {};
  const err = validateSchedule(b);
  if (err) return res.status(400).json({ error: "validation", message: err });
  const now = nowIso();
  const next = b.active === false ? null : computeNextRun(b);
  const r = db
    .prepare(
      `INSERT INTO schedules (name, template_id, authority_id, frequency, day_of_week, day_of_month, time_of_day, facility_ids, recipients, format, require_approval, active, next_run_at, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(b.name.trim(), b.template_id, b.authority_id || null, b.frequency, b.frequency === "weekly" ? b.day_of_week : null, ["monthly", "quarterly"].includes(b.frequency) ? b.day_of_month : null, b.time_of_day, JSON.stringify(b.facility_ids ?? []), JSON.stringify(b.recipients), b.format, b.require_approval ? 1 : 0, b.active === false ? 0 : 1, next, req.user!.id, now, now);
  audit(req, "schedule.created", "schedule", Number(r.lastInsertRowid), `Created schedule ${b.name}`, { after: b });
  res.status(201).json({ id: Number(r.lastInsertRowid), next_run_at: next });
});

reportingRouter.put("/schedules/:id", requirePermission("schedules.manage"), (req, res) => {
  const s = db.prepare("SELECT * FROM schedules WHERE id = ?").get(Number(req.params.id)) as any;
  if (!s) return res.status(404).json({ error: "not_found", message: "Schedule not found." });
  const b = { ...s, facility_ids: parseJson(s.facility_ids, []), recipients: parseJson(s.recipients, []), require_approval: !!s.require_approval, active: !!s.active, ...req.body };
  const err = validateSchedule(b);
  if (err) return res.status(400).json({ error: "validation", message: err });
  const next = b.active ? computeNextRun(b) : null;
  db.prepare(
    `UPDATE schedules SET name=?, template_id=?, authority_id=?, frequency=?, day_of_week=?, day_of_month=?, time_of_day=?, facility_ids=?, recipients=?, format=?, require_approval=?, active=?, next_run_at=?, updated_at=? WHERE id=?`,
  ).run(b.name.trim(), b.template_id, b.authority_id || null, b.frequency, b.frequency === "weekly" ? b.day_of_week : null, ["monthly", "quarterly"].includes(b.frequency) ? b.day_of_month : null, b.time_of_day, JSON.stringify(b.facility_ids), JSON.stringify(b.recipients), b.format, b.require_approval ? 1 : 0, b.active ? 1 : 0, next, nowIso(), s.id);
  const changed = Object.keys(req.body).filter((k) => JSON.stringify(req.body[k]) !== JSON.stringify((s as any)[k]));
  audit(req, req.body.active === false && s.active ? "schedule.paused" : req.body.active === true && !s.active ? "schedule.resumed" : "schedule.updated", "schedule", s.id, `${req.body.active === false && s.active ? "Paused" : req.body.active === true && !s.active ? "Resumed" : "Updated"} schedule ${b.name}`, { changed });
  res.json({ id: s.id, next_run_at: next });
});

reportingRouter.delete("/schedules/:id", requirePermission("schedules.manage"), (req, res) => {
  const s = db.prepare("SELECT * FROM schedules WHERE id = ?").get(Number(req.params.id)) as any;
  if (!s) return res.status(404).json({ error: "not_found", message: "Schedule not found." });
  const subs = (db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE schedule_id = ?").get(s.id) as { n: number }).n;
  if (subs) {
    db.prepare("UPDATE schedules SET active = 0, next_run_at = NULL, updated_at = ? WHERE id = ?").run(nowIso(), s.id);
    audit(req, "schedule.paused", "schedule", s.id, `Paused schedule ${s.name} (kept because it has ${subs} submission(s) on record)`);
    return res.json({ ok: true, paused: true, message: "This schedule has submission history, so it was paused instead of deleted." });
  }
  db.prepare("DELETE FROM schedules WHERE id = ?").run(s.id);
  audit(req, "schedule.deleted", "schedule", s.id, `Deleted schedule ${s.name}`);
  res.json({ ok: true });
});

reportingRouter.post("/schedules/:id/run", requirePermission("schedules.manage"), (req, res) => {
  const s = db.prepare("SELECT * FROM schedules WHERE id = ?").get(Number(req.params.id)) as ScheduleRow | undefined;
  if (!s) return res.status(404).json({ error: "not_found", message: "Schedule not found." });
  try {
    res.json(executeSchedule(s, req, "manual"));
  } catch (err) {
    res.status(500).json({ error: "run_failed", message: err instanceof Error ? err.message : "The run failed." });
  }
});

reportingRouter.get("/schedules/preview-next", (req, res) => {
  try {
    const q = req.query as Record<string, string>;
    const base = { frequency: q.frequency as ScheduleRow["frequency"], day_of_week: q.day_of_week ? Number(q.day_of_week) : null, day_of_month: q.day_of_month ? Number(q.day_of_month) : null, time_of_day: q.time_of_day || "08:00" };
    const runs: string[] = [];
    let after = new Date();
    for (let i = 0; i < 3; i++) {
      const next = computeNextRun(base, after);
      runs.push(next);
      after = new Date(next);
    }
    res.json({ runs, timezone: SCHEDULE_TZ });
  } catch {
    res.json({ runs: [], timezone: SCHEDULE_TZ });
  }
});

// ---------- submissions ----------

reportingRouter.get("/submissions", (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (req.query.status) { where.push("sb.status = ?"); params.push(req.query.status); }
  if (req.query.authority) { where.push("sb.authority_id = ?"); params.push(Number(req.query.authority)); }
  const rows = db
    .prepare(
      `SELECT sb.*, t.name AS template_name, a.name AS authority_name, a.code AS authority_code, a.channel,
              s.name AS schedule_name, uc.name AS created_by_name, ua.name AS approved_by_name,
              (SELECT reference FROM submissions x WHERE x.id = sb.supersedes_id) AS supersedes_reference,
              (SELECT reference FROM submissions x WHERE x.supersedes_id = sb.id) AS superseded_by_reference
       FROM submissions sb JOIN report_templates t ON t.id = sb.template_id LEFT JOIN authorities a ON a.id = sb.authority_id
       LEFT JOIN schedules s ON s.id = sb.schedule_id LEFT JOIN users uc ON uc.id = sb.created_by LEFT JOIN users ua ON ua.id = sb.approved_by
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY sb.created_at DESC LIMIT 300`,
    )
    .all(...params);
  const counts = db.prepare("SELECT status, COUNT(*) AS n FROM submissions GROUP BY status").all();
  res.json({ rows, counts });
});

reportingRouter.get("/submissions/:id", (req, res) => {
  const sb = db
    .prepare(
      `SELECT sb.*, t.name AS template_name, a.name AS authority_name, a.code AS authority_code, a.channel, a.endpoint, s.name AS schedule_name, s.recipients,
              uc.name AS created_by_name, ua.name AS approved_by_name,
              (SELECT reference FROM submissions x WHERE x.id = sb.supersedes_id) AS supersedes_reference,
              (SELECT reference FROM submissions x WHERE x.supersedes_id = sb.id) AS superseded_by_reference
       FROM submissions sb JOIN report_templates t ON t.id = sb.template_id LEFT JOIN authorities a ON a.id = sb.authority_id LEFT JOIN schedules s ON s.id = sb.schedule_id
       LEFT JOIN users uc ON uc.id = sb.created_by LEFT JOIN users ua ON ua.id = sb.approved_by WHERE sb.id = ?`,
    )
    .get(Number(req.params.id)) as any;
  if (!sb) return res.status(404).json({ error: "not_found", message: "Submission not found." });
  const events = db.prepare("SELECT se.*, u.name AS user_name FROM submission_events se LEFT JOIN users u ON u.id = se.user_id WHERE se.submission_id = ? ORDER BY se.created_at, se.id").all(sb.id);
  const run = sb.report_run_id ? db.prepare("SELECT * FROM report_runs WHERE id = ?").get(sb.report_run_id) : null;
  res.json({ ...sb, recipients: parseJson(sb.recipients, []), events, run: run ? { ...(run as any), summary: parseJson((run as any).summary, {}) } : null });
});

reportingRouter.post("/submissions", requirePermission("submissions.manage"), (req, res) => {
  const { template_id, authority_id, from, to, facilityIds, format } = req.body ?? {};
  const tpl = templateConfig(Number(template_id));
  if (!tpl) return res.status(400).json({ error: "validation", message: "Choose a report." });
  if (!authority_id) return res.status(400).json({ error: "validation", message: "Choose the authority to submit to." });
  const period = parsePeriod({ from, to });
  const rendered = renderReport({ config: tpl.config, periodFrom: period.from, periodTo: period.to, facilityIds: facilityIds ?? [] });
  const now = nowIso();
  const authority = db.prepare("SELECT code FROM authorities WHERE id = ?").get(Number(authority_id)) as { code: string } | undefined;
  if (!authority) return res.status(400).json({ error: "validation", message: "Unknown authority." });
  const out = db.transaction(() => {
    const run = db
      .prepare("INSERT INTO report_runs (template_id, period_from, period_to, facility_ids, trigger, generated_by, generated_at, checksum, summary) VALUES (?,?,?,?,'manual',?,?,?,?)")
      .run(template_id, period.from, period.to, JSON.stringify(facilityIds ?? []), req.user!.id, now, rendered.checksum, JSON.stringify(rendered.summary));
    const reference = nextSubmissionReference(authority.code);
    const sub = db
      .prepare(
        `INSERT INTO submissions (reference, template_id, authority_id, report_run_id, period_from, period_to, format, status, checksum, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,'pending_approval',?,?,?,?)`,
      )
      .run(reference, template_id, authority_id, run.lastInsertRowid, period.from, period.to, format ?? "xlsx", rendered.checksum, req.user!.id, now, now);
    addSubmissionEvent(Number(sub.lastInsertRowid), "prepared", `Prepared manually for ${period.from}${period.to !== period.from ? ` to ${period.to}` : ""}.`, req.user!.id);
    addSubmissionEvent(Number(sub.lastInsertRowid), "pending_approval", "Awaiting approval before transmission.", req.user!.id);
    return { id: Number(sub.lastInsertRowid), reference };
  })();
  audit(req, "submission.prepared", "submission", out.id, `Prepared ${out.reference} from ${tpl.name}`, { checksum: rendered.checksum, approvalCoverage: rendered.summary.approvalCoverage });
  res.status(201).json(out);
});

reportingRouter.post("/submissions/:id/:action(approve|transmit|accept|reject|cancel|resubmit)", (req, res) => {
  const sb = db.prepare("SELECT * FROM submissions WHERE id = ?").get(Number(req.params.id)) as any;
  if (!sb) return res.status(404).json({ error: "not_found", message: "Submission not found." });
  const action = req.params.action;
  const note = String(req.body?.note ?? "").trim();
  const permission = action === "approve" ? "submissions.approve" : "submissions.manage";
  if (!can(req.user, permission)) return res.status(403).json({ error: "forbidden", message: `Your role cannot ${action} submissions.` });
  const transitions: Record<string, { from: string[]; to: string }> = {
    approve: { from: ["pending_approval"], to: "approved" },
    transmit: { from: ["approved"], to: "transmitted" },
    accept: { from: ["transmitted"], to: "accepted" },
    reject: { from: ["transmitted"], to: "rejected" },
    cancel: { from: ["pending_approval", "approved"], to: "cancelled" },
    resubmit: { from: ["rejected"], to: "pending_approval" },
  };
  const t = transitions[action];
  if (!t.from.includes(sb.status)) return res.status(409).json({ error: "invalid_state", message: `${sb.reference} is ${sb.status.replace("_", " ")}; it cannot be ${action === "resubmit" ? "resubmitted" : action + "ed"}.` });
  if (action === "approve" && sb.created_by === req.user!.id) return res.status(409).json({ error: "segregation", message: "The person who prepared a submission cannot also approve it." });
  if (action === "reject" && !note) return res.status(400).json({ error: "validation", message: "Record the authority's rejection reason." });
  if (action === "cancel" && !note) return res.status(400).json({ error: "validation", message: "Give a reason for cancelling." });
  const now = nowIso();

  if (action === "resubmit") {
    // A rejected submission is never edited. A new linked submission is prepared from fresh data.
    const tpl = templateConfig(sb.template_id)!;
    const run = db.prepare("SELECT facility_ids FROM report_runs WHERE id = ?").get(sb.report_run_id) as { facility_ids: string } | undefined;
    const facilityIds = parseJson<number[]>(run?.facility_ids ?? "[]", []);
    const rendered = renderReport({ config: tpl.config, periodFrom: sb.period_from, periodTo: sb.period_to, facilityIds });
    const authority = db.prepare("SELECT code FROM authorities WHERE id = ?").get(sb.authority_id) as { code: string } | undefined;
    const out = db.transaction(() => {
      const r = db
        .prepare("INSERT INTO report_runs (template_id, period_from, period_to, facility_ids, trigger, schedule_id, generated_by, generated_at, checksum, summary) VALUES (?,?,?,?,'manual',?,?,?,?,?)")
        .run(sb.template_id, sb.period_from, sb.period_to, JSON.stringify(facilityIds), sb.schedule_id, req.user!.id, now, rendered.checksum, JSON.stringify(rendered.summary));
      const reference = nextSubmissionReference(authority?.code ?? null);
      const s = db
        .prepare(
          `INSERT INTO submissions (reference, template_id, authority_id, schedule_id, report_run_id, period_from, period_to, format, status, checksum, supersedes_id, created_by, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,'pending_approval',?,?,?,?,?)`,
        )
        .run(reference, sb.template_id, sb.authority_id, sb.schedule_id, r.lastInsertRowid, sb.period_from, sb.period_to, sb.format, rendered.checksum, sb.id, req.user!.id, now, now);
      const id = Number(s.lastInsertRowid);
      addSubmissionEvent(id, "prepared", `Resubmission of ${sb.reference} prepared from current data.${note ? ` ${note}` : ""}`, req.user!.id);
      addSubmissionEvent(id, "pending_approval", "Awaiting approval before transmission.", req.user!.id);
      addSubmissionEvent(sb.id, "superseded", `Superseded by ${reference}.`, req.user!.id);
      return { id, reference };
    })();
    audit(req, "submission.resubmitted", "submission", out.id, `Prepared ${out.reference} to replace rejected ${sb.reference}`, { supersedes: sb.reference });
    return res.json(out);
  }

  const updates: string[] = ["status = ?", "updated_at = ?"];
  const params: unknown[] = [t.to, now];
  if (action === "approve") { updates.push("approved_by = ?"); params.push(req.user!.id); }
  if (action === "accept") { updates.push("receipt_ref = ?"); params.push(note || `RCPT-${Date.now().toString(36).toUpperCase()}`); }
  if (action === "reject") { updates.push("rejection_reason = ?"); params.push(note); }
  db.prepare(`UPDATE submissions SET ${updates.join(", ")} WHERE id = ?`).run(...params, sb.id);
  const recipients = sb.schedule_id ? parseJson<string[]>((db.prepare("SELECT recipients FROM schedules WHERE id = ?").get(sb.schedule_id) as { recipients: string } | undefined)?.recipients ?? "[]", []) : [];
  const eventNote =
    action === "approve" ? note || "Approved for transmission."
    : action === "transmit" ? channelNote(sb.authority_id, recipients)
    : action === "accept" ? `Receipt ${note || "recorded"}.`
    : note;
  addSubmissionEvent(sb.id, t.to, eventNote, req.user!.id);
  audit(req, `submission.${t.to}`, "submission", sb.id, `${sb.reference}: ${sb.status.replace("_", " ")} → ${t.to.replace("_", " ")}`, note ? { note } : {});
  res.json({ ok: true, status: t.to });
});
