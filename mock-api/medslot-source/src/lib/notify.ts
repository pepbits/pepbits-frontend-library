import {randomUUID} from "node:crypto";
import { db, getSetting } from "../db.js";
import { config } from "../config.js";
import { prettyDateTime } from "./time.js";

export const EVENTS = ["booked", "confirmed", "reminder", "rescheduled", "cancelled", "no_show", "checked_in", "completed"] as const;
export const CHANNELS = ["email", "sms", "whatsapp"] as const;
export type NotifEvent = (typeof EVENTS)[number];
export type Channel = (typeof CHANNELS)[number];

export const TEMPLATE_VARIABLES = [
  "patient_first_name", "patient_name", "facility_name", "ref_code", "appointment_date", "appointment_time",
  "appointment_datetime", "service_name", "department_name", "resource_name", "location", "prep_instructions",
  "cancel_reason", "reminder_hours",
] as const;

interface Ctx {
  appt: Record<string, any>;
  patient: Record<string, any>;
  resources: { id: number; name: string; resource_type_id: number; location: string | null }[];
  vars: Record<string, string>;
}

function loadContext(appointmentId: number, extra: Record<string, string> = {}): Ctx | null {
  const appt = db.prepare(`
    SELECT a.*, s.name AS service_name, s.specialty_id, s.prep_instructions, d.name AS department_name, d.location AS department_location
    FROM appointments a JOIN services s ON s.id = a.service_id JOIN departments d ON d.id = a.department_id
    WHERE a.id = ?`).get(appointmentId) as Record<string, any> | undefined;
  if (!appt) return null;
  const patient = db.prepare("SELECT * FROM patients WHERE id = ?").get(appt.patient_id) as Record<string, any>;
  const resources = db.prepare(`
    SELECT r.id, r.name, r.resource_type_id, r.location FROM appointment_resources ar JOIN resources r ON r.id = ar.resource_id
    WHERE ar.appointment_id = ? ORDER BY ar.rowid`).all(appointmentId) as Ctx["resources"];
  const dt = prettyDateTime(appt.start_at);
  const vars: Record<string, string> = {
    patient_first_name: patient.first_name,
    patient_name: `${patient.first_name} ${patient.last_name}`,
    facility_name: getSetting("facility_name", "Our hospital"),
    ref_code: appt.ref_code,
    appointment_date: dt.split(",").slice(0, 2).join(",").trim(),
    appointment_time: dt.split(",").slice(-1)[0].trim(),
    appointment_datetime: dt,
    service_name: appt.service_name,
    department_name: appt.department_name,
    resource_name: resources[0]?.name ?? "",
    location: resources.find((r) => r.location)?.location ?? appt.department_location ?? "",
    prep_instructions: appt.prep_instructions ?? "",
    cancel_reason: appt.cancel_reason ?? "",
    ...extra,
  };
  return { appt, patient, resources, vars };
}

/** Most specific active template wins: resource > resource type > specialty > department > global. */
export function resolveTemplate(event: NotifEvent, channel: Channel, ctx: Pick<Ctx, "appt" | "resources">) {
  const resIds = ctx.resources.map((r) => r.id);
  const typeIds = ctx.resources.map((r) => r.resource_type_id);
  const ph = (n: number) => (n ? Array(n).fill("?").join(",") : "NULL");
  const rows = db.prepare(`
    SELECT * FROM notification_templates WHERE event = ? AND channel = ? AND active = 1 AND (
      (scope_type = 'resource' AND scope_id IN (${ph(resIds.length)})) OR
      (scope_type = 'resource_type' AND scope_id IN (${ph(typeIds.length)})) OR
      (scope_type = 'specialty' AND scope_id = ?) OR
      (scope_type = 'department' AND scope_id = ?) OR
      (scope_type = 'global'))`).all(event, channel, ...resIds, ...typeIds, ctx.appt.specialty_id ?? -1, ctx.appt.department_id) as Record<string, any>[];
  const rank: Record<string, number> = { resource: 0, resource_type: 1, specialty: 2, department: 3, global: 4 };
  rows.sort((a, b) => {
    const r = rank[a.scope_type] - rank[b.scope_type];
    if (r) return r;
    // Within resource scope prefer the primary (first) resource.
    if (a.scope_type === "resource") return resIds.indexOf(a.scope_id) - resIds.indexOf(b.scope_id);
    return 0;
  });
  return rows[0] ?? null;
}

export function render(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

// Simulated delivery stays inside the serialized command transaction; no external credentials or network.
async function deliver(channel: Channel, to: string, subject: string | null, body: string) {
 return {status:"sent" as const,ref:"MOCK-"+channel+"-"+randomUUID(),error:undefined as string|undefined};
}
const pending: [number, NotifEvent][] = [];
export async function flushNotifications(success:boolean) {
 const jobs=pending.splice(0);if(success)for(const [id,event] of jobs)await notify(id,event);
}
const insertLog = db.prepare(`
  INSERT OR IGNORE INTO notifications (appointment_id, patient_id, event, channel, recipient, subject, body, template_id, status, error, dedupe_key)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const finishLog = db.prepare(`UPDATE notifications SET status = ?, error = ?, provider_ref = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE NULL END WHERE id = ?`);

/**
 * Sends an event on every channel the appointment asked for, honouring channel switches and patient opt-ins.
 * Runs after the booking transaction commits; failures are logged, never thrown to the caller.
 */
export async function notify(appointmentId: number, event: NotifEvent, opts: { dedupePrefix?: string; extra?: Record<string, string> } = {}) {
  const ctx = loadContext(appointmentId, opts.extra);
  if (!ctx) return;
  const wanted = String(ctx.appt.notify_channels || "").split(",").filter(Boolean) as Channel[];
  const jobs: Promise<void>[] = [];
  for (const channel of wanted) {
    if (getSetting(`channel_${channel}_enabled`, "1") !== "1") continue;
    const tpl = resolveTemplate(event, channel, ctx);
    if (!tpl) continue;
    const to = channel === "email" ? ctx.patient.email : ctx.patient.phone;
    if (!to) continue;
    const optIn = { email: ctx.patient.email_opt_in, sms: ctx.patient.sms_opt_in, whatsapp: ctx.patient.whatsapp_opt_in }[channel];
    const subject = tpl.subject ? render(tpl.subject, ctx.vars) : null;
    const body = render(tpl.body, ctx.vars);
    const key = opts.dedupePrefix ? `${opts.dedupePrefix}:${channel}` : null;
    if (!optIn) {
      insertLog.run(appointmentId, ctx.patient.id, event, channel, to, subject, body, tpl.id, "opted_out", "Patient has not opted in", key);
      continue;
    }
    const info = insertLog.run(appointmentId, ctx.patient.id, event, channel, to, subject, body, tpl.id, "queued", null, key);
    if (!info.changes) continue; // already sent (dedupe)
    const logId = Number(info.lastInsertRowid);
    jobs.push(deliver(channel, to, subject, body).then((r) => { finishLog.run(r.status, r.error ?? null, r.ref ?? null, r.status, logId); }));
  }
  await Promise.all(jobs);
}

export function notifyLater(appointmentId: number, event: NotifEvent) {
  pending.push([appointmentId,event]);
}

export async function retry(notificationId: number) {
  const n = db.prepare("SELECT * FROM notifications WHERE id = ?").get(notificationId) as Record<string, any> | undefined;
  if (!n) return null;
  const r = await deliver(n.channel, n.recipient, n.subject, n.body);
  finishLog.run(r.status, r.error ?? null, r.ref ?? null, r.status, notificationId);
  return r;
}

export function previewTemplate(body: string, subject: string | null, appointmentId?: number) {
  const sample: Record<string, string> = {
    patient_first_name: "Asha", patient_name: "Asha Verma", facility_name: getSetting("facility_name", "Our hospital"),
    ref_code: "AP-7K2M9Q", appointment_date: "Mon, 12 Oct 2026", appointment_time: "10:30 am",
    appointment_datetime: "Mon, 12 Oct 2026, 10:30 am", service_name: "Cardiology consultation",
    department_name: "Cardiology", resource_name: "Dr. Meera Iyer", location: "Block B, 2nd floor",
    prep_instructions: "Bring previous reports.", cancel_reason: "Doctor unavailable", reminder_hours: "24",
  };
  const vars = appointmentId ? loadContext(appointmentId)?.vars ?? sample : sample;
  return { subject: subject ? render(subject, vars) : null, body: render(body, vars) };
}
