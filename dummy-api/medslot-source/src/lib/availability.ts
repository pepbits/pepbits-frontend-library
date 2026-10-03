import { db, getSetting } from "../db.js";
import { addDays, addMinutes, minutesToTime, nowLocal, timeToMinutes, weekday } from "./time.js";
import { badRequest, notFound } from "./http.js";

/** Statuses that hold time on a resource. */
export const OCCUPYING = ["requested", "scheduled", "confirmed", "checked_in", "in_progress", "completed"] as const;
const OCC_SQL = OCCUPYING.map((s) => `'${s}'`).join(",");

export interface ResourceRow {
  id: number; name: string; resource_type_id: number; department_id: number;
  specialty_id: number | null; slot_minutes: number; capacity: number; active: number;
  type_name?: string; location?: string | null;
}
interface Window { start: string; end: string; slot: number }
interface Busy { start: string; end: string; appointment_id?: number }

export interface Requirement { resource_type_id: number; role: string; is_primary: number; type_name: string }

export function getService(serviceId: number) {
  const s = db.prepare(`
    SELECT s.*, d.name AS department_name FROM services s JOIN departments d ON d.id = s.department_id
    WHERE s.id = ?`).get(serviceId) as Record<string, any> | undefined;
  if (!s) throw notFound("Service");
  return s;
}

/** Resource types a service needs. If none configured, the service needs one resource of any linked type. */
export function getRequirements(serviceId: number): Requirement[] {
  const reqs = db.prepare(`
    SELECT sr.resource_type_id, sr.role, sr.is_primary, rt.name AS type_name
    FROM service_requirements sr JOIN resource_types rt ON rt.id = sr.resource_type_id
    WHERE sr.service_id = ? ORDER BY sr.is_primary DESC, sr.sort, sr.id`).all(serviceId) as Requirement[];
  if (reqs.length) return reqs;
  const first = db.prepare(`
    SELECT r.resource_type_id, rt.name AS type_name FROM service_resources x
    JOIN resources r ON r.id = x.resource_id JOIN resource_types rt ON rt.id = r.resource_type_id
    WHERE x.service_id = ? LIMIT 1`).get(serviceId) as { resource_type_id: number; type_name: string } | undefined;
  if (!first) return [];
  return [{ resource_type_id: first.resource_type_id, role: first.type_name, is_primary: 1, type_name: first.type_name }];
}

export function candidatesFor(serviceId: number, resourceTypeId: number): ResourceRow[] {
  return db.prepare(`
    SELECT r.*, rt.name AS type_name FROM service_resources x
    JOIN resources r ON r.id = x.resource_id JOIN resource_types rt ON rt.id = r.resource_type_id
    WHERE x.service_id = ? AND r.resource_type_id = ? AND r.active = 1 ORDER BY r.name`).all(serviceId, resourceTypeId) as ResourceRow[];
}

export function getResource(id: number): ResourceRow {
  const r = db.prepare(`SELECT r.*, rt.name AS type_name FROM resources r JOIN resource_types rt ON rt.id = r.resource_type_id WHERE r.id = ?`).get(id) as ResourceRow | undefined;
  if (!r) throw notFound("Resource");
  return r;
}

export function holidayOn(date: string, departmentId: number): string | null {
  const h = db.prepare(`SELECT name FROM holidays WHERE date = ? AND (department_id IS NULL OR department_id = ?) LIMIT 1`)
    .get(date, departmentId) as { name: string } | undefined;
  return h?.name ?? null;
}

export function windowsFor(resource: ResourceRow, date: string): Window[] {
  const rows = db.prepare(`
    SELECT start_time, end_time, slot_minutes FROM schedules
    WHERE resource_id = ? AND weekday = ?
      AND (effective_from IS NULL OR effective_from <= ?) AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY start_time`).all(resource.id, weekday(date), date, date) as { start_time: string; end_time: string; slot_minutes: number | null }[];
  return rows.map((r) => ({
    start: `${date}T${r.start_time}`,
    end: r.end_time === "24:00" ? `${addDays(date, 1)}T00:00` : `${date}T${r.end_time}`,
    slot: r.slot_minutes ?? resource.slot_minutes,
  }));
}

function blocksBetween(resourceId: number, from: string, to: string): Busy[] {
  return db.prepare(`SELECT start_at AS start, end_at AS end FROM resource_blocks WHERE resource_id = ? AND start_at < ? AND end_at > ?`)
    .all(resourceId, to, from) as Busy[];
}

function bookingsBetween(resourceId: number, from: string, to: string, excludeAppointmentId?: number): Busy[] {
  return db.prepare(`
    SELECT ar.start_at AS start, ar.end_at AS end, ar.appointment_id FROM appointment_resources ar
    JOIN appointments a ON a.id = ar.appointment_id
    WHERE ar.resource_id = ? AND ar.start_at < ? AND ar.end_at > ? AND a.status IN (${OCC_SQL})
      AND a.id <> ?`).all(resourceId, to, from, excludeAppointmentId ?? -1) as Busy[];
}

const overlaps = (a: { start: string; end: string }, s: string, e: string) => a.start < e && a.end > s;

/** Reason a resource can't take [start, end), or null when it can. Reads fresh from the DB. */
export function resourceConflict(resource: ResourceRow, start: string, end: string, excludeAppointmentId?: number): string | null {
  if (!resource.active) return `${resource.name} is inactive`;
  const date = start.slice(0, 10);
  const holiday = holidayOn(date, resource.department_id);
  if (holiday) return `${date} is a holiday (${holiday})`;
  const windows = windowsFor(resource, date);
  if (!windows.some((w) => w.start <= start && w.end >= end)) return `${resource.name} is not working at this time`;
  if (blocksBetween(resource.id, start, end).length) return `${resource.name} is blocked (leave or maintenance)`;
  const busy = bookingsBetween(resource.id, start, end, excludeAppointmentId);
  if (busy.length >= resource.capacity) return `${resource.name} is already booked at this time`;
  return null;
}

/** Context loaded once per resource per range, so slot generation stays in memory. */
class ResourceDay {
  windows: Window[]; blocks: Busy[]; busy: Busy[]; holiday: string | null;
  constructor(public r: ResourceRow, date: string, excludeAppointmentId?: number) {
    const from = `${date}T00:00`, to = `${addDays(date, 1)}T23:59`;
    this.holiday = holidayOn(date, r.department_id);
    this.windows = windowsFor(r, date);
    this.blocks = blocksBetween(r.id, from, to);
    this.busy = bookingsBetween(r.id, from, to, excludeAppointmentId);
  }
  free(s: string, e: string) {
    if (this.holiday || !this.r.active) return false;
    if (!this.windows.some((w) => w.start <= s && w.end >= e)) return false;
    if (this.blocks.some((b) => overlaps(b, s, e))) return false;
    return this.busy.filter((b) => overlaps(b, s, e)).length < this.r.capacity;
  }
  load() { return this.busy.length; }
}

export interface Slot {
  start: string; end: string; occupied_until: string;
  resources: { id: number; name: string; role: string; type_name: string }[];
}
export interface AvailabilityDay { date: string; closed: string | null; slots: Slot[] }

export interface AvailabilityQuery {
  serviceId: number; from: string; days: number;
  resourceId?: number; durationMinutes?: number; excludeAppointmentId?: number;
}

export function getAvailability(q: AvailabilityQuery) {
  const service = getService(q.serviceId);
  if (!service.active) throw badRequest("This service is not active");
  const reqs = getRequirements(q.serviceId);
  if (!reqs.length) throw badRequest("No resources are linked to this service yet. Link resources on the service page");

  const duration = Math.max(5, q.durationMinutes ?? service.duration_minutes);
  const buffer = service.buffer_minutes as number;
  const now = nowLocal();
  const minNotice = Number(getSetting("min_notice_minutes", "0"));
  const earliest = addMinutes(now, minNotice);
  const horizon = Number(getSetting("booking_horizon_days", "90"));
  const days = Math.min(Math.max(q.days, 1), 31);

  const candidates = reqs.map((r) => candidatesFor(q.serviceId, r.resource_type_id));
  const primaryIdx = 0;
  let primaries = candidates[primaryIdx];
  if (q.resourceId) primaries = primaries.filter((r) => r.id === q.resourceId);

  const out: AvailabilityDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(q.from, i);
    if (date > addDays(now.slice(0, 10), horizon)) break;
    const closed = holidayOn(date, service.department_id);
    if (closed) { out.push({ date, closed, slots: [] }); continue; }

    const ctx = new Map<number, ResourceDay>();
    const dayOf = (r: ResourceRow) => {
      if (!ctx.has(r.id)) ctx.set(r.id, new ResourceDay(r, date, q.excludeAppointmentId));
      return ctx.get(r.id)!;
    };

    const slots: Slot[] = [];
    for (const p of primaries) {
      const pd = dayOf(p);
      for (const w of pd.windows) {
        for (let t = w.start; addMinutes(t, duration) <= w.end; t = addMinutes(t, w.slot)) {
          if (t < earliest) continue;
          const end = addMinutes(t, duration);
          const occ = addMinutes(end, buffer);
          if (!pd.free(t, occ > w.end ? end : occ)) continue;
          const assigned = [{ id: p.id, name: p.name, role: reqs[primaryIdx].role, type_name: reqs[primaryIdx].type_name }];
          let ok = true;
          for (let k = 0; k < reqs.length; k++) {
            if (k === primaryIdx) continue;
            // Least-loaded free candidate keeps work balanced across rooms/staff.
            const free = candidates[k].map(dayOf).filter((d) => d.free(t, occ)).sort((a, b) => a.load() - b.load())[0];
            if (!free) { ok = false; break; }
            assigned.push({ id: free.r.id, name: free.r.name, role: reqs[k].role, type_name: reqs[k].type_name });
          }
          if (ok) slots.push({ start: t, end, occupied_until: occ, resources: assigned });
        }
      }
    }
    slots.sort((a, b) => a.start.localeCompare(b.start) || a.resources[0].name.localeCompare(b.resources[0].name));
    out.push({ date, closed: null, slots });
  }

  return {
    service: { id: service.id, name: service.name, duration_minutes: service.duration_minutes, buffer_minutes: buffer, department_name: service.department_name },
    duration_minutes: duration,
    requirements: reqs.map((r, i) => ({ ...r, candidates: candidates[i].map((c) => ({ id: c.id, name: c.name, slot_minutes: c.slot_minutes })) })),
    days: out,
  };
}

/** Free/busy picture of one resource for calendar rendering. */
export function resourceDayGrid(resourceId: number, date: string) {
  const r = getResource(resourceId);
  const d = new ResourceDay(r, date);
  return {
    resource_id: r.id,
    holiday: d.holiday,
    windows: d.windows.map((w) => ({ start: w.start, end: w.end, slot_minutes: w.slot })),
    blocks: d.blocks,
  };
}

export { minutesToTime, timeToMinutes };
