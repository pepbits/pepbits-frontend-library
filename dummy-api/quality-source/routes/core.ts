import { Router } from "express";
import { db, nowIso } from "../db.js";
import {
  ROLES,
  audit,
  createSession,
  destroySession,
  permissionsFor,
  requireAuth,
  verifyPassword,
  type Role,
} from "../auth.js";
import { EVENT_DOMAINS, addMonths, monthEndExclusiveIso, monthStartIso } from "../domain.js";
import { aggregate, allFacilities, availablePeriods, type IndicatorRow } from "../services/calc.js";
import { tatSummary, type TatDefinition } from "../services/tat.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "invalid_request", message: "Enter your email and password." });
  }
  const user = db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email.trim()) as
    | { id: number; name: string; email: string; role: Role; title: string; facility_id: number | null; status: string; password_hash: string }
    | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    audit(null, "auth.login_failed", "user", null, `Failed sign-in for ${email}`);
    return res.status(401).json({ error: "invalid_credentials", message: "The email or password is incorrect." });
  }
  if (user.status !== "active") {
    return res.status(403).json({ error: "inactive", message: "This account is inactive. Contact your administrator." });
  }
  const session = createSession(user.id);
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(nowIso(), user.id);
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, title: user.title, facility_id: user.facility_id };
  audit(req, "auth.login", "user", user.id, `${user.name} signed in`);
  res.json({ token: session.token, expiresAt: session.expires_at, user: req.user, permissions: permissionsFor(user.role) });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (token) destroySession(token);
  audit(req, "auth.logout", "user", req.user!.id, `${req.user!.name} signed out`);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user, permissions: permissionsFor(req.user!.role) });
});

export const metaRouter = Router();
metaRouter.use(requireAuth);

metaRouter.get("/meta", (_req, res) => {
  const periods = availablePeriods();
  res.json({
    facilities: allFacilities(),
    periods,
    latestPeriod: periods[periods.length - 1] ?? null,
    roles: ROLES,
    domains: (db.prepare("SELECT DISTINCT domain FROM indicators ORDER BY domain").all() as { domain: string }[]).map((r) => r.domain),
    programs: (db.prepare("SELECT DISTINCT program FROM indicators ORDER BY program").all() as { program: string }[]).map((r) => r.program),
    eventDomains: Object.entries(EVENT_DOMAINS).map(([id, d]) => ({ id, label: d.label, stages: d.stages, cancel: d.cancel, source: d.source })),
    tatDefinitions: db.prepare("SELECT * FROM tat_definitions ORDER BY domain, id").all(),
    authorities: db.prepare("SELECT id, code, name, channel, active FROM authorities ORDER BY id").all(),
    users: db.prepare("SELECT id, name, role, status FROM users ORDER BY name").all(),
  });
});

metaRouter.get("/dashboard", (req, res) => {
  const periods = availablePeriods();
  const latest = (req.query.period as string) || periods[periods.length - 1];
  const facilityIds = req.query.facility ? String(req.query.facility).split(",").map(Number).filter(Boolean) : [];
  const prev = addMonths(latest, -1);
  const indicators = db.prepare("SELECT * FROM indicators WHERE status = 'active' ORDER BY domain, code").all() as IndicatorRow[];

  const kpis = indicators.map((ind) => {
    const cur = aggregate(ind, [latest], facilityIds);
    const last = aggregate(ind, [prev], facilityIds);
    const spark = periods.slice(-12).map((p) => aggregate(ind, [p], facilityIds).value);
    return {
      id: ind.id,
      code: ind.code,
      name: ind.name,
      domain: ind.domain,
      program: ind.program,
      unit: ind.unit,
      direction: ind.direction,
      target: ind.target,
      warning: ind.warning,
      value: cur.value,
      previous: last.value,
      status: cur.status,
      completeness: cur.completeness,
      spark,
    };
  });
  const statusCounts = { on_target: 0, warning: 0, breach: 0, no_data: 0 };
  for (const k of kpis) statusCounts[k.status]++;

  const byDomain = [...new Set(kpis.map((k) => k.domain))].map((domain) => {
    const items = kpis.filter((k) => k.domain === domain);
    return {
      domain,
      total: items.length,
      on_target: items.filter((k) => k.status === "on_target").length,
      warning: items.filter((k) => k.status === "warning").length,
      breach: items.filter((k) => k.status === "breach").length,
      no_data: items.filter((k) => k.status === "no_data").length,
    };
  });

  const fClause = facilityIds.length ? ` AND facility_id IN (${facilityIds.join(",")})` : "";
  const workflow = db.prepare(`SELECT status, COUNT(*) AS n FROM indicator_results WHERE period = ?${fClause} GROUP BY status`).all(latest) as { status: string; n: number }[];
  const issues = db
    .prepare(`SELECT severity, COUNT(*) AS n FROM validation_issues WHERE status = 'open'${facilityIds.length ? ` AND (facility_id IS NULL OR facility_id IN (${facilityIds.join(",")}))` : ""} GROUP BY severity`)
    .all() as { severity: string; n: number }[];

  const tatCodes = ["LAB-TAT-STAT", "ED-D2P", "OPD-WAIT", "RAD-CT-RPT"];
  const tat = (db.prepare(`SELECT * FROM tat_definitions WHERE code IN (${tatCodes.map(() => "?").join(",")})`).all(...tatCodes) as TatDefinition[]).map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    domain: d.domain,
    ...tatSummary(d, { from: monthStartIso(latest), to: monthEndExclusiveIso(latest), facilityIds }),
  }));

  const upcoming = db
    .prepare(
      `SELECT s.id, s.name, s.next_run_at, s.frequency, a.name AS authority, s.require_approval FROM schedules s
       LEFT JOIN authorities a ON a.id = s.authority_id WHERE s.active = 1 ORDER BY s.next_run_at LIMIT 5`,
    )
    .all();
  const submissions = db
    .prepare(
      `SELECT sb.id, sb.reference, sb.status, sb.period_from, sb.period_to, sb.updated_at, a.name AS authority, t.name AS template
       FROM submissions sb LEFT JOIN authorities a ON a.id = sb.authority_id JOIN report_templates t ON t.id = sb.template_id
       ORDER BY sb.updated_at DESC LIMIT 6`,
    )
    .all();
  const activity = db.prepare("SELECT id, ts, user_name, action, summary FROM audit_log WHERE action NOT LIKE 'auth.%' ORDER BY ts DESC LIMIT 8").all();
  const pendingMine = (() => {
    const role = req.user!.role;
    const status = role === "verifier" ? "submitted" : role === "approver" ? "verified" : role === "data_steward" ? "draft" : null;
    if (!status) return null;
    return { status, count: (db.prepare(`SELECT COUNT(*) AS n FROM indicator_results WHERE status = ?${fClause}`).get(status) as { n: number }).n };
  })();

  res.json({ period: latest, previousPeriod: prev, kpis, statusCounts, byDomain, workflow, issues, tat, upcoming, submissions, activity, pendingMine });
});


/** Counts of work waiting for the signed-in user, shown in the header. */
metaRouter.get("/me/tasks", (req, res) => {
  const role = req.user!.role;
  const count = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const tasks: { key: string; label: string; count: number; href: string }[] = [];
  if (["verifier", "admin"].includes(role))
    tasks.push({ key: "verify", label: "Results awaiting verification", count: count("SELECT COUNT(*) AS n FROM indicator_results WHERE status = 'submitted'"), href: "/verification?queue=verify" });
  if (["approver", "admin"].includes(role))
    tasks.push({ key: "approve", label: "Results awaiting approval", count: count("SELECT COUNT(*) AS n FROM indicator_results WHERE status = 'verified'"), href: "/verification?queue=approve" });
  if (["approver", "admin"].includes(role))
    tasks.push({ key: "submissions", label: "Submissions awaiting approval", count: count("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending_approval'"), href: "/submissions?status=pending_approval" });
  if (["data_steward", "quality_manager", "admin"].includes(role))
    tasks.push({ key: "draft", label: "Draft or rejected results to submit", count: count("SELECT COUNT(*) AS n FROM indicator_results WHERE status IN ('draft','rejected')"), href: "/verification?queue=submit" });
  tasks.push({ key: "issues", label: "Validation issues assigned to you", count: count("SELECT COUNT(*) AS n FROM validation_issues WHERE status = 'open' AND assigned_to = ?", req.user!.id), href: "/validation?assigned=me" });
  const visible = tasks.filter((t) => t.count > 0);
  res.json({ tasks: visible, total: visible.reduce((s, t) => s + t.count, 0) });
});
