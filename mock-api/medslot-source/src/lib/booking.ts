import crypto from "node:crypto";
import { db } from "../db.js";
import { addMinutes, diffMinutes, nowLocal, todayLocal } from "./time.js";
import { badRequest, conflict, notFound } from "./http.js";
import { candidatesFor, getRequirements, getResource, getService, OCCUPYING, resourceConflict } from "./availability.js";
import type { AuthUser } from "../middleware/auth.js";

export type Status =
  | "requested" | "scheduled" | "confirmed" | "checked_in" | "in_progress"
  | "completed" | "cancelled" | "no_show" | "rescheduled";

/** Allowed status moves. Rescheduling has its own endpoint. */
export const TRANSITIONS: Record<Status, Status[]> = {
  requested: ["scheduled", "confirmed", "cancelled"],
  scheduled: ["confirmed", "checked_in", "cancelled", "no_show"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
  rescheduled: [],
};
export const RESCHEDULABLE: Status[] = ["requested", "scheduled", "confirmed"];

const OCC_SQL = OCCUPYING.map((s) => `'${s}'`).join(",");

function refCode() {
  for (let i = 0; i < 10; i++) {
    const code = "AP-" + crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    if (!db.prepare("SELECT 1 FROM appointments WHERE ref_code = ?").get(code)) return code;
  }
  throw new Error("Could not generate a reference code");
}

export interface ResourcePick { resource_id: number; role: string }

/**
 * Validates that every resource is free and that the patient has no overlapping visit.
 * Must run inside a db.transaction so the check and the insert are atomic.
 */
function assertFree(picks: ResourcePick[], start: string, occupiedUntil: string, patientId: number, excludeId?: number) {
  const problems: { resource_id?: number; message: string }[] = [];
  for (const p of picks) {
    const r = getResource(p.resource_id);
    const msg = resourceConflict(r, start, occupiedUntil, excludeId);
    if (msg) problems.push({ resource_id: r.id, message: msg });
  }
  const patientClash = db.prepare(`
    SELECT a.ref_code, a.start_at FROM appointments a
    WHERE a.patient_id = ? AND a.status IN (${OCC_SQL}) AND a.id <> ?
      AND a.start_at < ? AND a.end_at > ? LIMIT 1`).get(patientId, excludeId ?? -1, occupiedUntil, start) as { ref_code: string; start_at: string } | undefined;
  if (patientClash) problems.push({ message: `Patient already has appointment ${patientClash.ref_code} at this time` });
  if (problems.length) throw conflict("This time is no longer available", { problems });
}

/** Fills in any required resource the caller didn't choose with a free candidate. */
function resolvePicks(serviceId: number, given: ResourcePick[], start: string, occ: string, excludeId?: number): ResourcePick[] {
  const reqs = getRequirements(serviceId);
  if (!reqs.length) throw badRequest("This service has no linked resources");
  const picks: ResourcePick[] = [];
  for (const req of reqs) {
    const cands = candidatesFor(serviceId, req.resource_type_id);
    const chosen = given.find((g) => cands.some((c) => c.id === g.resource_id) && !picks.some((p) => p.resource_id === g.resource_id));
    if (chosen) { picks.push({ resource_id: chosen.resource_id, role: req.role }); continue; }
    const free = cands.find((c) => !picks.some((p) => p.resource_id === c.id) && !resourceConflict(c, start, occ, excludeId));
    if (!free) throw conflict(`No ${req.type_name.toLowerCase()} is free at this time`);
    picks.push({ resource_id: free.id, role: req.role });
  }
  return picks;
}

export interface CreateInput {
  patient_id: number; patient_kind: "new" | "existing"; service_id: number;
  start_at: string; duration_minutes?: number; resources: ResourcePick[];
  reason: string; visit_type: string; priority: string; source: string;
  notes?: string | null; referral_source?: string | null; order_ref?: string | null;
  preferred_at?: string | null; notify_channels: string[]; status?: "requested" | "scheduled" | "confirmed";
}

export const createAppointment = (input: CreateInput, user: AuthUser) =>
  db.transaction(() => {
    const service = getService(input.service_id);
    if (!service.active) throw badRequest("This service is not active");
    if (service.requires_order && !input.order_ref?.trim()) throw badRequest("This service needs a doctor's order reference");
    if (service.requires_referral && !input.referral_source?.trim()) throw badRequest("This service needs a referral");
    const patient = db.prepare("SELECT id FROM patients WHERE id = ?").get(input.patient_id);
    if (!patient) throw notFound("Patient");

    const now = nowLocal();
    if (input.start_at < now && input.priority !== "emergency") throw badRequest("Choose a time in the future");
    const duration = input.duration_minutes ?? service.duration_minutes;
    const end = addMinutes(input.start_at, duration);
    const occ = addMinutes(end, service.buffer_minutes);

    const picks = resolvePicks(input.service_id, input.resources, input.start_at, occ);
    assertFree(picks, input.start_at, occ, input.patient_id);

    const status = input.status ?? "scheduled";
    const info = db.prepare(`
      INSERT INTO appointments (ref_code, patient_id, service_id, department_id, start_at, end_at, status, patient_kind,
        visit_type, priority, source, reason, notes, referral_source, order_ref, requested_at, preferred_at, booked_by,
        confirmed_at, notify_channels)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      refCode(), input.patient_id, input.service_id, service.department_id, input.start_at, end, status,
      input.patient_kind, input.visit_type, input.priority, input.source, input.reason.trim(), input.notes ?? null,
      input.referral_source ?? null, input.order_ref ?? null, now, input.preferred_at ?? null, user.id,
      status === "confirmed" ? now : null, input.notify_channels.join(","));
    const id = Number(info.lastInsertRowid);
    const insRes = db.prepare("INSERT INTO appointment_resources (appointment_id, resource_id, role, start_at, end_at) VALUES (?,?,?,?,?)");
    for (const p of picks) insRes.run(id, p.resource_id, p.role, input.start_at, occ);
    db.prepare("INSERT INTO appointment_events (appointment_id, from_status, to_status, note, user_id) VALUES (?,?,?,?,?)")
      .run(id, null, status, "Booked", user.id);
    return id;
  }).immediate();

const STAMP: Partial<Record<Status, string>> = {
  confirmed: "confirmed_at", checked_in: "checked_in_at", in_progress: "started_at",
  completed: "completed_at", cancelled: "cancelled_at", no_show: "no_show_at",
};

export function changeStatus(id: number, to: Status, user: AuthUser, note?: string) {
  return db.transaction(() => {
    const a = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as Record<string, any> | undefined;
    if (!a) throw notFound("Appointment");
    const from = a.status as Status;
    if (!TRANSITIONS[from].includes(to)) throw badRequest(`Can't move an appointment from ${from.replace("_", " ")} to ${to.replace("_", " ")}`);
    const now = nowLocal();
    if (to === "no_show" && now < a.start_at) throw badRequest("You can mark a no-show only after the appointment start time");
    if (to === "checked_in" && a.start_at.slice(0, 10) !== todayLocal()) throw badRequest("Patients can check in only on the day of the appointment");
    if (to === "cancelled" && !note?.trim()) throw badRequest("Add a cancellation reason");
    const stamp = STAMP[to];
    db.prepare(`UPDATE appointments SET status = ?, ${stamp ? `${stamp} = ?,` : ""} ${to === "cancelled" ? "cancel_reason = ?," : ""} updated_at = datetime('now') WHERE id = ?`)
      .run(...[to, ...(stamp ? [now] : []), ...(to === "cancelled" ? [note] : []), id]);
    db.prepare("INSERT INTO appointment_events (appointment_id, from_status, to_status, note, user_id) VALUES (?,?,?,?,?)")
      .run(id, from, to, note ?? null, user.id);
    return { from, to };
  }).immediate();
}

export function reschedule(id: number, startAt: string, resources: ResourcePick[], durationMinutes: number | undefined, reason: string, user: AuthUser) {
  return db.transaction(() => {
    const a = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as Record<string, any> | undefined;
    if (!a) throw notFound("Appointment");
    if (!RESCHEDULABLE.includes(a.status)) throw badRequest(`A ${a.status.replace("_", " ")} appointment can't be rescheduled`);
    if (startAt < nowLocal()) throw badRequest("Choose a time in the future");
    const service = getService(a.service_id);
    const duration = durationMinutes ?? diffMinutes(a.start_at, a.end_at);
    const end = addMinutes(startAt, duration);
    const occ = addMinutes(end, service.buffer_minutes);
    const current = db.prepare("SELECT resource_id, role FROM appointment_resources WHERE appointment_id = ?").all(id) as ResourcePick[];
    const picks = resolvePicks(a.service_id, resources.length ? resources : current, startAt, occ, id);
    assertFree(picks, startAt, occ, a.patient_id, id);

    const now = nowLocal();
    const info = db.prepare(`
      INSERT INTO appointments (ref_code, patient_id, service_id, department_id, start_at, end_at, status, patient_kind, visit_type,
        priority, source, reason, notes, referral_source, order_ref, requested_at, preferred_at, booked_by, notify_channels, rescheduled_from_id)
      VALUES (?,?,?,?,?,?,'scheduled',?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      refCode(), a.patient_id, a.service_id, a.department_id, startAt, end, a.patient_kind, a.visit_type, a.priority, a.source,
      a.reason, a.notes, a.referral_source, a.order_ref, now, a.preferred_at, user.id, a.notify_channels, id);
    const newId = Number(info.lastInsertRowid);
    const insRes = db.prepare("INSERT INTO appointment_resources (appointment_id, resource_id, role, start_at, end_at) VALUES (?,?,?,?,?)");
    for (const p of picks) insRes.run(newId, p.resource_id, p.role, startAt, occ);
    db.prepare("UPDATE appointments SET status = 'rescheduled', rescheduled_to_id = ?, updated_at = datetime('now') WHERE id = ?").run(newId, id);
    const ev = db.prepare("INSERT INTO appointment_events (appointment_id, from_status, to_status, note, user_id) VALUES (?,?,?,?,?)");
    ev.run(id, a.status, "rescheduled", reason, user.id);
    ev.run(newId, null, "scheduled", `Rescheduled from ${a.ref_code}`, user.id);
    return newId;
  }).immediate();
}

/** Lengthen or shorten an appointment. Extensions are re-checked for overlaps on every resource. */
export function changeDuration(id: number, durationMinutes: number, user: AuthUser) {
  return db.transaction(() => {
    const a = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id) as Record<string, any> | undefined;
    if (!a) throw notFound("Appointment");
    if (!["requested", "scheduled", "confirmed", "checked_in", "in_progress"].includes(a.status)) throw badRequest("This appointment can no longer be changed");
    const service = getService(a.service_id);
    const end = addMinutes(a.start_at, durationMinutes);
    const occ = addMinutes(end, service.buffer_minutes);
    const picks = db.prepare("SELECT resource_id, role FROM appointment_resources WHERE appointment_id = ?").all(id) as ResourcePick[];
    // For in-progress visits we allow running past scheduled hours, but never into another booking.
    if (["checked_in", "in_progress"].includes(a.status)) {
      for (const p of picks) {
        const clash = db.prepare(`SELECT a.ref_code FROM appointment_resources ar JOIN appointments a ON a.id = ar.appointment_id
          WHERE ar.resource_id = ? AND a.id <> ? AND a.status IN (${OCC_SQL}) AND ar.start_at < ? AND ar.end_at > ? LIMIT 1`)
          .get(p.resource_id, id, occ, a.start_at) as { ref_code: string } | undefined;
        if (clash) throw conflict(`Extending would overlap ${clash.ref_code}`);
      }
    } else {
      assertFree(picks, a.start_at, occ, a.patient_id, id);
    }
    db.prepare("UPDATE appointments SET end_at = ?, updated_at = datetime('now') WHERE id = ?").run(end, id);
    db.prepare("UPDATE appointment_resources SET end_at = ? WHERE appointment_id = ?").run(occ, id);
    db.prepare("INSERT INTO appointment_events (appointment_id, from_status, to_status, note, user_id) VALUES (?,?,?,?,?)")
      .run(id, a.status, a.status, `Duration changed to ${durationMinutes} min`, user.id);
  }).immediate();
}
