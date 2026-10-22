import { db } from '../db';
import { audit, broadcast, notify } from '../lib/events';
import { DAY, addDays, dateOf, dayStart, fromMin, hhmm, nowMin, nowStr, toMin, weekday } from '../lib/time';
import { Calendar, Slot, loadType, search } from './availability';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: unknown) { super(message); }
}

export interface BookInput {
  patientId: number;
  typeId: number;
  start: string;
  assignments?: { requirement_id: number; resource_id: number }[];
  priority?: 'routine' | 'urgent';
  source?: string;
  notes?: string;
  seriesId?: string;
  status?: string;
  allowPast?: boolean;
  quiet?: boolean;          // seeding: no notifications / reminders
  createdAt?: string;
}

const ACTIVE = `('booked','confirmed','checked_in','in_progress')`;

function makeRef(id: number, start: string) {
  return `CG${start.slice(2, 4)}${start.slice(5, 7)}${start.slice(8, 10)}-${String(id).padStart(5, '0')}`;
}

function insertHolds(apptId: number, slot: Slot, cal?: Calendar) {
  const ins = db.prepare(`INSERT INTO appointment_resources (appointment_id, requirement_id, resource_id, start_at, end_at, hold_start, hold_end)
    VALUES (?,?,?,?,?,?,?)`);
  for (const a of slot.assignments) {
    ins.run(apptId, a.requirement_id, a.resource_id, a.start, a.end, a.hold_start, a.hold_end);
    cal?.addHold(a.resource_id, toMin(a.hold_start), toMin(a.hold_end), apptId);
  }
}

function scheduleReminders(apptId: number) {
  const a = db.prepare(`SELECT a.*, p.full_name, p.preferred_channel, t.name type_name, t.prep_instructions FROM appointments a
    JOIN patients p ON p.id = a.patient_id JOIN appointment_types t ON t.id = a.type_id WHERE a.id = ?`).get(apptId) as any;
  db.prepare(`UPDATE reminders SET status = 'cancelled' WHERE appointment_id = ? AND status = 'scheduled'`).run(apptId);
  const start = toMin(a.start_at), now = nowMin();
  const channel = a.preferred_channel || 'SMS';
  const when = `${a.start_at.slice(0, 10)} at ${a.start_at.slice(11)}`;
  const ins = db.prepare('INSERT INTO reminders (appointment_id, channel, send_at, message) VALUES (?,?,?,?)');
  if (start - DAY > now) ins.run(apptId, channel, fromMin(start - DAY),
    `Reminder: ${a.type_name} on ${when}. Ref ${a.ref}.${a.prep_instructions ? ' ' + a.prep_instructions : ''} Reply C to confirm.`);
  if (start - 120 > now) ins.run(apptId, channel, fromMin(start - 120), `See you at ${a.start_at.slice(11)} for ${a.type_name}. Please arrive 10 minutes early.`);
}

export function book(input: BookInput, cal?: Calendar) {
  const { type } = loadType(input.typeId);
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(input.patientId) as any;
  if (!patient) throw new HttpError(404, 'Patient not found');
  const date = input.start.slice(0, 10);
  const pref = input.assignments?.map(a => a.resource_id) ?? [];
  const run = () => {
    const res = search({ typeId: input.typeId, fromDate: date, days: 1, exactStart: input.start, priority: input.priority,
      source: input.source, patientId: input.patientId, preferredResourceIds: pref, allowPast: input.allowPast, ignoreNotice: input.allowPast }, cal);
    const slot = res.firstAvailable;
    if (!slot) {
      const alt = input.allowPast ? null : search({ typeId: input.typeId, fromDate: date, days: 3, priority: input.priority, patientId: input.patientId, limitPerDay: 3, maxSlots: 6 });
      throw new HttpError(409, 'That time is no longer available', {
        blockers: res.blockers, alternatives: alt ? alt.days.flatMap(d => d.slots).slice(0, 4) : [],
      });
    }
    const at = input.createdAt ?? nowStr();
    const info = db.prepare(`INSERT INTO appointments (ref, patient_id, type_id, start_at, end_at, status, priority, source, mode, series_id, notes, created_at, updated_at)
      VALUES ('pending',?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.patientId, input.typeId, slot.start, slot.end, input.status ?? 'booked',
      input.priority ?? 'routine', input.source ?? 'desk', type.mode, input.seriesId ?? null, input.notes ?? null, at, at);
    const id = Number(info.lastInsertRowid);
    db.prepare('UPDATE appointments SET ref = ? WHERE id = ?').run(makeRef(id, slot.start), id);
    insertHolds(id, slot, cal);
    return { id, slot };
  };
  const { id, slot } = db.transaction(run)();
  if (!input.quiet) {
    scheduleReminders(id);
    audit('book', 'appointment', id, { start: slot.start, type: type.name });
    notify(input.priority === 'urgent' ? 'warning' : 'success', 'booking', `${type.name} booked`,
      `${patient.full_name} on ${slot.start.slice(0, 10)} at ${slot.start.slice(11)}. ${slot.assignments.length} resources reserved.`, `/schedule?date=${slot.start.slice(0, 10)}&appt=${id}`);
    broadcast('schedule-changed', { date: slot.start.slice(0, 10) });
  }
  return getAppointment(id);
}

export function getAppointment(id: number) {
  const a = db.prepare(`SELECT a.*, p.full_name patient_name, p.mrn, p.phone, p.language, p.interpreter_needed, p.mobility, p.allergies,
      t.name type_name, t.duration_min, t.prep_instructions, t.requires_consent, c.name category_name, c.icon category_icon, d.color dept_color
    FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN appointment_types t ON t.id = a.type_id
    JOIN categories c ON c.id = t.category_id JOIN departments d ON d.id = c.department_id WHERE a.id = ?`).get(id) as any;
  if (!a) throw new HttpError(404, 'Appointment not found');
  a.resources = db.prepare(`SELECT ar.*, r.name resource_name, r.kind, r.role_code, ro.label role_label FROM appointment_resources ar
    JOIN resources r ON r.id = ar.resource_id JOIN roles ro ON ro.code = r.role_code WHERE ar.appointment_id = ? ORDER BY ar.start_at, ar.id`).all(id);
  a.reminders = db.prepare('SELECT * FROM reminders WHERE appointment_id = ? ORDER BY send_at').all(id);
  a.queue = db.prepare(`SELECT * FROM reschedule_queue WHERE appointment_id = ? AND status = 'pending'`).all(id);
  return a;
}

export function reschedule(id: number, start: string, assignments?: { requirement_id: number; resource_id: number }[], reason = 'Rescheduled') {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
  if (!a) throw new HttpError(404, 'Appointment not found');
  if (!['booked', 'confirmed'].includes(a.status)) throw new HttpError(400, `A ${a.status.replace('_', ' ')} appointment cannot be moved`);
  const res = search({ typeId: a.type_id, fromDate: start.slice(0, 10), days: 1, exactStart: start, priority: a.priority,
    patientId: a.patient_id, excludeApptId: id, preferredResourceIds: assignments?.map(x => x.resource_id) });
  const slot = res.firstAvailable;
  if (!slot) throw new HttpError(409, 'That time is no longer available', { blockers: res.blockers });
  db.transaction(() => {
    db.prepare('DELETE FROM appointment_resources WHERE appointment_id = ?').run(id);
    insertHolds(id, slot);
    db.prepare(`UPDATE appointments SET start_at = ?, end_at = ?, at_risk = 0, status = 'booked', updated_at = ? WHERE id = ?`).run(slot.start, slot.end, nowStr(), id);
    db.prepare(`UPDATE reschedule_queue SET status = 'resolved', resolved_at = ? WHERE appointment_id = ? AND status = 'pending'`).run(nowStr(), id);
  })();
  scheduleReminders(id);
  audit('reschedule', 'appointment', id, { from: a.start_at, to: slot.start, reason });
  const full = getAppointment(id);
  notify('info', 'reschedule', 'Appointment moved', `${full.patient_name}: ${full.type_name} moved from ${a.start_at.replace('T', ' ')} to ${slot.start.replace('T', ' ')}.`, `/schedule?date=${slot.start.slice(0, 10)}&appt=${id}`);
  broadcast('schedule-changed', { date: slot.start.slice(0, 10) });
  return full;
}

export function cancel(id: number, reason: string) {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
  if (!a) throw new HttpError(404, 'Appointment not found');
  if (!['booked', 'confirmed', 'checked_in'].includes(a.status)) throw new HttpError(400, 'Only upcoming appointments can be cancelled');
  db.transaction(() => {
    db.prepare(`UPDATE appointments SET status = 'cancelled', cancel_reason = ?, at_risk = 0, updated_at = ? WHERE id = ?`).run(reason, nowStr(), id);
    db.prepare('UPDATE appointment_resources SET released = 1 WHERE appointment_id = ?').run(id);
    db.prepare(`UPDATE reminders SET status = 'cancelled' WHERE appointment_id = ? AND status = 'scheduled'`).run(id);
    db.prepare(`UPDATE reschedule_queue SET status = 'dismissed', resolved_at = ? WHERE appointment_id = ? AND status = 'pending'`).run(nowStr(), id);
  })();
  audit('cancel', 'appointment', id, { reason });
  const full = getAppointment(id);
  notify('info', 'booking', 'Appointment cancelled', `${full.patient_name}: ${full.type_name} on ${a.start_at.replace('T', ' ')}. ${reason}`, `/schedule?date=${a.start_at.slice(0, 10)}`);
  offerToWaitlist(a.type_id, a.start_at);
  broadcast('schedule-changed', { date: a.start_at.slice(0, 10) });
  return full;
}

/** When a slot frees up, offer it to the first matching waitlisted patient. */
export function offerToWaitlist(typeId: number, start: string) {
  if (toMin(start) < nowMin()) return;
  const w = db.prepare(`SELECT w.*, p.full_name, t.name type_name FROM waitlist w JOIN patients p ON p.id = w.patient_id JOIN appointment_types t ON t.id = w.type_id
    WHERE w.type_id = ? AND w.status = 'waiting' AND w.earliest <= ? AND w.latest >= ? ORDER BY CASE w.priority WHEN 'urgent' THEN 0 ELSE 1 END, w.created_at LIMIT 1`)
    .get(typeId, start.slice(0, 10), start.slice(0, 10)) as any;
  if (!w) return;
  db.prepare(`UPDATE waitlist SET status = 'offered' WHERE id = ?`).run(w.id);
  notify('success', 'waitlist', 'Freed slot matches the waitlist', `${w.full_name} is waiting for ${w.type_name}. Offer ${start.replace('T', ' ')}.`, `/book?patient=${w.patient_id}&type=${typeId}&date=${start.slice(0, 10)}&waitlist=${w.id}`);
}

const TRANSITIONS: Record<string, { from: string[]; to: string; stamp?: string }> = {
  confirm: { from: ['booked'], to: 'confirmed' },
  check_in: { from: ['booked', 'confirmed'], to: 'checked_in', stamp: 'checked_in_at' },
  start: { from: ['checked_in', 'booked', 'confirmed'], to: 'in_progress', stamp: 'actual_start' },
  complete: { from: ['in_progress'], to: 'completed', stamp: 'actual_end' },
  no_show: { from: ['booked', 'confirmed'], to: 'no_show' },
  undo: { from: ['checked_in', 'no_show'], to: 'booked' },
};

export function transition(id: number, action: string) {
  const t = TRANSITIONS[action];
  if (!t) throw new HttpError(400, 'Unknown action');
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as any;
  if (!a) throw new HttpError(404, 'Appointment not found');
  if (!t.from.includes(a.status)) throw new HttpError(400, `Cannot ${action.replace('_', ' ')} an appointment that is ${a.status.replace('_', ' ')}`);
  const now = nowStr();
  const sets = [`status = '${t.to}'`, `updated_at = '${now}'`];
  if (t.stamp) sets.push(`${t.stamp} = '${now}'`);
  if (action === 'start' && !a.checked_in_at) sets.push(`checked_in_at = '${now}'`);
  if (action === 'undo') sets.push('checked_in_at = NULL');
  db.prepare(`UPDATE appointments SET ${sets.join(', ')} WHERE id = ?`).run(id);
  if (action === 'no_show') {
    db.prepare('UPDATE appointment_resources SET released = 1 WHERE appointment_id = ? AND hold_start >= ?').run(id, now);
  }
  if (action === 'undo') db.prepare('UPDATE appointment_resources SET released = 0 WHERE appointment_id = ?').run(id);
  if (action === 'complete') {
    // free the remainder of resource holds if the visit finished early
    db.prepare('UPDATE appointment_resources SET hold_end = ? WHERE appointment_id = ? AND hold_end > ? AND hold_start <= ?').run(now, id, now, now);
  }
  audit(action, 'appointment', id);
  broadcast('schedule-changed', { date: a.start_at.slice(0, 10) });
  return getAppointment(id);
}

export interface SeriesInput {
  patientId: number; typeId: number; startDate: string; weekdays: number[]; time: string; occurrences: number;
  priority?: 'routine' | 'urgent'; notes?: string;
}

/** Books a recurring course (dialysis 3x/week, physio 10 sessions...). Finds the nearest time on each date when the preferred time is taken. */
export function bookSeries(input: SeriesInput) {
  if (!input.weekdays.length) throw new HttpError(400, 'Choose at least one weekday');
  const seriesId = `S${Date.now().toString(36).toUpperCase()}`;
  const booked: any[] = []; const skipped: { date: string; reason: string }[] = [];
  let date = input.startDate; let guard = 0;
  const prefMin = toMin(`2000-01-01T${input.time}`) - toMin('2000-01-01T00:00');
  let lastResources: number[] = [];
  while (booked.length < input.occurrences && guard++ < 400) {
    if (input.weekdays.includes(weekday(dayStart(date)))) {
      const res = search({ typeId: input.typeId, fromDate: date, days: 1, patientId: input.patientId, priority: input.priority, preferredResourceIds: lastResources, limitPerDay: 500 });
      const slots = res.days[0]?.slots ?? [];
      if (!slots.length) skipped.push({ date, reason: res.blockers[0]?.label ? `No capacity: ${res.blockers[0].label}` : 'Closed or fully booked' });
      else {
        const target = dayStart(date) + prefMin;
        const best = slots.slice().sort((a, b) => (Math.abs(toMin(a.start) - target) - Math.abs(toMin(b.start) - target)) || (b.score - a.score))[0];
        const appt = book({ patientId: input.patientId, typeId: input.typeId, start: best.start, assignments: best.assignments, priority: input.priority,
          source: 'series', seriesId, notes: input.notes, quiet: true });
        scheduleReminders(appt.id);
        lastResources = appt.resources.map((r: any) => r.resource_id);
        booked.push({ id: appt.id, ref: appt.ref, start: appt.start_at, shifted: toMin(best.start) !== target });
      }
    }
    date = addDays(date, 1);
  }
  const t = loadType(input.typeId).type;
  notify(skipped.length ? 'warning' : 'success', 'booking', `${booked.length}-session course booked`,
    `${t.name}${skipped.length ? `; ${skipped.length} date(s) skipped` : ''}. Series ${seriesId}.`, `/patients?id=${input.patientId}`);
  broadcast('schedule-changed', {});
  return { seriesId, booked, skipped };
}

export function dayList(date: string, filters: { category?: number; department?: number; status?: string; q?: string }) {
  const where = ['a.start_at >= ?', 'a.start_at < ?'];
  const args: any[] = [`${date}T00:00`, `${addDays(date, 1)}T00:00`];
  if (filters.category) { where.push('t.category_id = ?'); args.push(filters.category); }
  if (filters.department) { where.push('c.department_id = ?'); args.push(filters.department); }
  if (filters.status) { where.push('a.status = ?'); args.push(filters.status); }
  if (filters.q) { where.push('(p.full_name LIKE ? OR p.mrn LIKE ? OR a.ref LIKE ?)'); args.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`); }
  return db.prepare(`SELECT a.id, a.ref, a.start_at, a.end_at, a.status, a.priority, a.at_risk, a.source, a.checked_in_at, a.actual_start, a.actual_end,
      p.id patient_id, p.full_name patient_name, p.mrn, p.interpreter_needed, p.mobility, p.allergies,
      t.id type_id, t.name type_name, t.duration_min, c.id category_id, c.name category_name, c.icon category_icon, d.color dept_color, d.name department_name,
      (SELECT r.name FROM appointment_resources ar JOIN resources r ON r.id = ar.resource_id WHERE ar.appointment_id = a.id ORDER BY ar.id LIMIT 1) primary_resource
    FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN appointment_types t ON t.id = a.type_id
    JOIN categories c ON c.id = t.category_id JOIN departments d ON d.id = c.department_id
    WHERE ${where.join(' AND ')} ORDER BY a.start_at`).all(...args);
}

export { ACTIVE, hhmm, dateOf };
