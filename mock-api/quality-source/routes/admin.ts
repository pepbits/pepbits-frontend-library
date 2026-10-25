import { Router } from "express";
import { db, nowIso, parseJson, verifyAuditChain } from "../db.js";
import { PERMISSIONS, ROLES, audit, hashPassword, requireAuth, requirePermission } from "../auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongEnough = (p: string) => p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);

// ---------- users ----------
adminRouter.get("/users", requirePermission("users.manage"), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.title, u.role, u.facility_id, u.status, u.last_login_at, u.created_at, f.name AS facility_name,
              (SELECT COUNT(*) FROM audit_log a WHERE a.user_id = u.id AND a.ts >= datetime('now', '-30 days')) AS actions_30d
       FROM users u LEFT JOIN facilities f ON f.id = u.facility_id ORDER BY u.status, u.name`,
    )
    .all();
  const roles = ROLES.map((r) => ({ ...r, permissions: Object.entries(PERMISSIONS).filter(([, roles]) => (roles as readonly string[]).includes(r.id)).map(([p]) => p) }));
  res.json({ rows, roles });
});

adminRouter.post("/users", requirePermission("users.manage"), (req, res) => {
  const b = req.body ?? {};
  if (!b.name?.trim()) return res.status(400).json({ error: "validation", message: "Enter the person's name." });
  if (!EMAIL.test(b.email ?? "")) return res.status(400).json({ error: "validation", message: "Enter a valid email address." });
  if (!ROLES.some((r) => r.id === b.role)) return res.status(400).json({ error: "validation", message: "Choose a role." });
  if (!strongEnough(b.password ?? "")) return res.status(400).json({ error: "validation", message: "Password needs 10+ characters with upper case, lower case and a number." });
  if (db.prepare("SELECT 1 FROM users WHERE lower(email) = lower(?)").get(b.email)) return res.status(409).json({ error: "duplicate", message: "A user with this email already exists." });
  const r = db
    .prepare("INSERT INTO users (name, email, title, role, facility_id, status, password_hash, created_at) VALUES (?,?,?,?,?,'active',?,?)")
    .run(b.name.trim(), b.email.trim().toLowerCase(), b.title ?? null, b.role, b.facility_id || null, hashPassword(b.password), nowIso());
  audit(req, "user.created", "user", Number(r.lastInsertRowid), `Created user ${b.name} (${b.role})`, { after: { name: b.name, email: b.email, role: b.role, facility_id: b.facility_id || null } });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

adminRouter.put("/users/:id", requirePermission("users.manage"), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(req.params.id)) as any;
  if (!u) return res.status(404).json({ error: "not_found", message: "User not found." });
  const b = req.body ?? {};
  if (u.id === req.user!.id && (b.status === "inactive" || (b.role && b.role !== "admin"))) {
    return res.status(409).json({ error: "self_lockout", message: "You cannot deactivate yourself or remove your own administrator role." });
  }
  if (b.email && !EMAIL.test(b.email)) return res.status(400).json({ error: "validation", message: "Enter a valid email address." });
  if (b.role && !ROLES.some((r) => r.id === b.role)) return res.status(400).json({ error: "validation", message: "Choose a valid role." });
  if (b.password && !strongEnough(b.password)) return res.status(400).json({ error: "validation", message: "Password needs 10+ characters with upper case, lower case and a number." });
  const next = { name: b.name ?? u.name, email: (b.email ?? u.email).toLowerCase(), title: b.title ?? u.title, role: b.role ?? u.role, facility_id: b.facility_id === undefined ? u.facility_id : b.facility_id || null, status: b.status ?? u.status };
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] !== u[k]) { before[k] = u[k]; after[k] = next[k]; }
  db.prepare("UPDATE users SET name=?, email=?, title=?, role=?, facility_id=?, status=? WHERE id=?").run(next.name, next.email, next.title, next.role, next.facility_id, next.status, u.id);
  if (b.password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(b.password), u.id);
    after.password = "reset";
  }
  if (next.status !== "active" || next.role !== u.role || b.password) db.prepare("DELETE FROM sessions WHERE user_id = ? AND user_id != ?").run(u.id, req.user!.id);
  const verb = after.status === "inactive" ? "Deactivated" : after.status === "active" ? "Reactivated" : "Updated";
  audit(req, "user.updated", "user", u.id, `${verb} ${next.name}${Object.keys(after).length ? `: ${Object.keys(after).join(", ")}` : ""}`, { before, after });
  res.json({ ok: true });
});

// ---------- authorities ----------
adminRouter.get("/authorities", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, (SELECT COUNT(*) FROM schedules s WHERE s.authority_id = a.id AND s.active = 1) AS active_schedules,
              (SELECT COUNT(*) FROM submissions sb WHERE sb.authority_id = a.id) AS submissions,
              (SELECT MAX(updated_at) FROM submissions sb WHERE sb.authority_id = a.id) AS last_submission
       FROM authorities a ORDER BY a.active DESC, a.name`,
    )
    .all()
    .map((a: any) => ({ ...a, programs: parseJson(a.programs, []) }));
  res.json(rows);
});

function validateAuthority(b: any): string | null {
  if (!b.code?.trim() || !/^[A-Z0-9_-]{2,12}$/.test(b.code)) return "Code must be 2–12 upper-case letters, digits, dashes or underscores.";
  if (!b.name?.trim()) return "Enter the authority's name.";
  if (!b.jurisdiction?.trim()) return "Enter the jurisdiction.";
  if (!["portal_upload", "sftp", "api", "email"].includes(b.channel)) return "Choose a submission channel.";
  if (b.contact_email && !EMAIL.test(b.contact_email)) return "Contact email is not valid.";
  return null;
}

adminRouter.post("/authorities", requirePermission("authorities.manage"), (req, res) => {
  const b = req.body ?? {};
  const err = validateAuthority(b);
  if (err) return res.status(400).json({ error: "validation", message: err });
  if (db.prepare("SELECT 1 FROM authorities WHERE code = ?").get(b.code)) return res.status(409).json({ error: "duplicate", message: `Authority ${b.code} already exists.` });
  const r = db
    .prepare("INSERT INTO authorities (code, name, jurisdiction, channel, endpoint, contact_email, programs, active) VALUES (?,?,?,?,?,?,?,1)")
    .run(b.code, b.name.trim(), b.jurisdiction.trim(), b.channel, b.endpoint ?? null, b.contact_email ?? null, JSON.stringify(b.programs ?? []));
  audit(req, "authority.created", "authority", Number(r.lastInsertRowid), `Added authority ${b.name}`, { after: b });
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

adminRouter.put("/authorities/:id", requirePermission("authorities.manage"), (req, res) => {
  const a = db.prepare("SELECT * FROM authorities WHERE id = ?").get(Number(req.params.id)) as any;
  if (!a) return res.status(404).json({ error: "not_found", message: "Authority not found." });
  const b = { ...a, programs: parseJson(a.programs, []), ...req.body };
  const err = validateAuthority(b);
  if (err) return res.status(400).json({ error: "validation", message: err });
  if (b.active === false || b.active === 0) {
    const active = (db.prepare("SELECT COUNT(*) AS n FROM schedules WHERE authority_id = ? AND active = 1").get(a.id) as { n: number }).n;
    if (active) return res.status(409).json({ error: "in_use", message: `Pause the ${active} active schedule(s) for this authority first.` });
  }
  db.prepare("UPDATE authorities SET code=?, name=?, jurisdiction=?, channel=?, endpoint=?, contact_email=?, programs=?, active=? WHERE id=?").run(
    b.code, b.name, b.jurisdiction, b.channel, b.endpoint ?? null, b.contact_email ?? null, JSON.stringify(b.programs ?? []), b.active ? 1 : 0, a.id,
  );
  audit(req, "authority.updated", "authority", a.id, `Updated authority ${b.name}`, { before: { ...a, programs: parseJson(a.programs, []) }, after: b });
  res.json({ ok: true });
});

// ---------- audit ----------
adminRouter.get("/audit", requirePermission("audit.view"), (req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  const q = req.query;
  if (q.user) { where.push("user_id = ?"); params.push(Number(q.user)); }
  if (q.entity) { where.push("entity_type = ?"); params.push(q.entity); }
  if (q.action) { where.push("action LIKE ?"); params.push(`${q.action}%`); }
  if (q.from) { where.push("ts >= ?"); params.push(`${q.from}T00:00:00.000Z`); }
  if (q.to) { where.push("ts < ?"); params.push(new Date(Date.parse(`${q.to}T00:00:00Z`) + 86400000).toISOString()); }
  if (q.search) { where.push("(summary LIKE ? OR entity_id = ?)"); params.push(`%${q.search}%`, q.search); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(200, Number(q.limit) || 50);
  const offset = Math.max(0, Number(q.offset) || 0);
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_log ${whereSql}`).get(...params) as { n: number }).n;
  const rows = db
    .prepare(`SELECT * FROM audit_log ${whereSql} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map((r: any) => ({ ...r, details: parseJson(r.details, {}) }));
  const entities = (db.prepare("SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type").all() as { entity_type: string }[]).map((r) => r.entity_type);
  const actions = (db.prepare("SELECT DISTINCT action FROM audit_log ORDER BY action").all() as { action: string }[]).map((r) => r.action);
  res.json({ total, rows, entities, actions });
});

adminRouter.get("/audit/verify", requirePermission("audit.view"), (req, res) => {
  const result = verifyAuditChain();
  audit(req, "audit.verified", "audit", null, result.valid ? `Verified the audit chain: ${result.checked} entries intact` : `Audit chain verification failed at entry ${result.brokenAt}`, result);
  res.json({ ...result, verifiedAt: nowIso() });
});

adminRouter.get("/audit/export.csv", requirePermission("audit.view"), (req, res) => {
  const rows = db.prepare("SELECT id, ts, user_name, action, entity_type, entity_id, summary, ip, hash FROM audit_log ORDER BY ts DESC LIMIT 10000").all() as Record<string, unknown>[];
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  audit(req, "audit.exported", "audit", null, `Exported ${rows.length} audit entries`);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="audit-log-${nowIso().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + ["Entry,Timestamp,User,Action,Entity,Entity ID,Summary,IP,Chain hash", ...rows.map((r) => [r.id, r.ts, r.user_name, r.action, r.entity_type, r.entity_id, r.summary, r.ip, r.hash].map(cell).join(","))].join("\n"));
});
