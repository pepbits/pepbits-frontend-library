import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { idParam, parse, notFound } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";
import { CHANNELS, EVENTS, TEMPLATE_VARIABLES, previewTemplate, retry } from "../lib/notify.js";
import { runReminders } from "../jobs/reminders.js";

export const notificationsRouter = Router();
const admin = requireRole("admin");

// Same deduplicated source job; explicit admin invocation is useful for demo verification.
notificationsRouter.post("/reminders/run", admin, async (req, res, next) => {
 try {
  const before = db.prepare("SELECT count(*) AS n FROM notifications").get() as {n:number};
  await runReminders();
  const after = db.prepare("SELECT count(*) AS n FROM notifications").get() as {n:number};
  audit(req, "run", "notification_reminders", null, {created:after.n-before.n});
  res.json({ok:true,created:after.n-before.n});
 } catch(error) { next(error); }
});

const tpl = z.object({
  event: z.enum(EVENTS),
  channel: z.enum(CHANNELS),
  scope_type: z.enum(["global", "department", "specialty", "resource_type", "resource"]),
  scope_id: z.number().int().min(0).default(0),
  subject: z.string().trim().nullish(),
  body: z.string().trim().min(5, "Message text is required").max(4000),
  active: z.boolean().default(true),
}).refine((t) => t.scope_type === "global" || t.scope_id > 0, { message: "Choose what this template applies to", path: ["scope_id"] })
  .refine((t) => t.channel !== "email" || !!t.subject, { message: "Email templates need a subject", path: ["subject"] })
  .refine((t) => t.channel === "email" || t.body.length <= 1000, { message: "SMS and WhatsApp messages must be 1000 characters or less", path: ["body"] });

const scopeName = `CASE t.scope_type
  WHEN 'global' THEN 'All appointments'
  WHEN 'department' THEN (SELECT name FROM departments WHERE id = t.scope_id)
  WHEN 'specialty' THEN (SELECT name FROM specialties WHERE id = t.scope_id)
  WHEN 'resource_type' THEN (SELECT name FROM resource_types WHERE id = t.scope_id)
  WHEN 'resource' THEN (SELECT name FROM resources WHERE id = t.scope_id) END`;

notificationsRouter.get("/meta", (_req, res) => {
  res.json({
    events: EVENTS, channels: CHANNELS, variables: TEMPLATE_VARIABLES,
    providers: {
      email: true,
      sms: true,
      whatsapp: true,
    },
  });
});

notificationsRouter.get("/templates", (req, res) => {
  const where = ["1=1"]; const args: unknown[] = [];
  for (const k of ["event", "channel", "scope_type"] as const) if (req.query[k]) { where.push(`t.${k} = ?`); args.push(String(req.query[k])); }
  const rows = db.prepare(`SELECT t.*, ${scopeName} AS scope_name FROM notification_templates t WHERE ${where.join(" AND ")}
    ORDER BY CASE t.scope_type WHEN 'global' THEN 0 WHEN 'department' THEN 1 WHEN 'specialty' THEN 2 WHEN 'resource_type' THEN 3 ELSE 4 END, t.event, t.channel`).all(...args) as Record<string, any>[];
  res.json(rows.map((r) => ({ ...r, active: !!r.active })));
});

notificationsRouter.post("/templates", admin, (req, res) => {
  const b = parse(tpl, req.body);
  const info = db.prepare(`INSERT INTO notification_templates (event, channel, scope_type, scope_id, subject, body, active) VALUES (?,?,?,?,?,?,?)`)
    .run(b.event, b.channel, b.scope_type, b.scope_type === "global" ? 0 : b.scope_id, b.subject ?? null, b.body, b.active ? 1 : 0);
  audit(req, "create", "notification_template", Number(info.lastInsertRowid));
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

notificationsRouter.put("/templates/:id", admin, (req, res) => {
  const id = idParam(req);
  const b = parse(tpl, req.body);
  const info = db.prepare(`UPDATE notification_templates SET event=?, channel=?, scope_type=?, scope_id=?, subject=?, body=?, active=?, updated_at=datetime('now') WHERE id=?`)
    .run(b.event, b.channel, b.scope_type, b.scope_type === "global" ? 0 : b.scope_id, b.subject ?? null, b.body, b.active ? 1 : 0, id);
  if (!info.changes) throw notFound("Template");
  audit(req, "update", "notification_template", id);
  res.json({ ok: true });
});

notificationsRouter.delete("/templates/:id", admin, (req, res) => {
  const id = idParam(req);
  const t = db.prepare("SELECT scope_type FROM notification_templates WHERE id = ?").get(id) as { scope_type: string } | undefined;
  if (!t) throw notFound("Template");
  db.prepare("DELETE FROM notification_templates WHERE id = ?").run(id);
  audit(req, "delete", "notification_template", id);
  res.json({ ok: true });
});

notificationsRouter.post("/preview", (req, res) => {
  const b = parse(z.object({ subject: z.string().nullish(), body: z.string(), appointment_id: z.number().int().positive().optional() }), req.body);
  res.json(previewTemplate(b.body, b.subject ?? null, b.appointment_id));
});

const mask = (s: string) => s.includes("@") ? s.replace(/^(.).*(@.*)$/, "$1•••$2") : s.slice(0, 3) + "•••" + s.slice(-2);

notificationsRouter.get("/log", (req, res) => {
  const where = ["1=1"]; const args: unknown[] = [];
  for (const k of ["status", "channel", "event"] as const) if (req.query[k]) { where.push(`n.${k} = ?`); args.push(String(req.query[k])); }
  const rows = db.prepare(`SELECT n.id, n.appointment_id, n.event, n.channel, n.recipient, n.subject, n.status, n.error, n.created_at, n.sent_at,
      a.ref_code, p.first_name || ' ' || p.last_name AS patient_name
    FROM notifications n LEFT JOIN appointments a ON a.id = n.appointment_id LEFT JOIN patients p ON p.id = n.patient_id
    WHERE ${where.join(" AND ")} ORDER BY n.id DESC LIMIT 300`).all(...args) as Record<string, any>[];
  res.json(rows.map((r) => ({ ...r, recipient: mask(r.recipient) })));
});

notificationsRouter.post("/:id/retry", requireRole("admin", "scheduler"), async (req, res) => {
  const id = idParam(req);
  const r = await retry(id);
  if (!r) throw notFound("Notification");
  audit(req, "retry", "notification", id, { status: r.status });
  res.json(r);
});
