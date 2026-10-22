import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { addClient, audit, broadcast, notify } from '../lib/events';
import { DAY, addDays, dayStart, fromMin, nowStr, toMin, todayStr } from '../lib/time';
import { Calendar, availableWindows, loadType, search } from '../engine/availability';
import { HttpError, book, bookSeries, cancel, dayList, getAppointment, reschedule, transition } from '../engine/booking';
import { autoResolve, createException, deleteException, previewImpact, queue, suggestions } from '../engine/exceptions';
import { durationAnalysis, summary, utilization } from '../engine/analytics';

export const api = Router();
type H = (req: Request, res: Response) => unknown;
const wrap = (fn: H) => (req: Request, res: Response, next: NextFunction) => {
  try { const out = fn(req, res); if (out !== undefined) res.json(out); } catch (e) { next(e); }
};
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));
const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, r.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
  return r.data;
};
const dt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'use YYYY-MM-DDTHH:MM');
const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');

api.get('/health', wrap(() => ({ ok: true, time: nowStr() })));

api.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ time: nowStr() })}\n\n`);
  addClient(res);
  const ping = setInterval(() => res.write(`event: ping\ndata: ${JSON.stringify({ time: nowStr() })}\n\n`), 25000);
  res.on('close', () => clearInterval(ping));
});

// ---------- reference data ----------
api.get('/meta', wrap(() => ({
  today: todayStr(), now: nowStr(),
  departments: db.prepare('SELECT * FROM departments ORDER BY id').all(),
  categories: db.prepare(`SELECT c.*, d.color, d.name department_name, (SELECT COUNT(*) FROM appointment_types t WHERE t.category_id = c.id AND t.active = 1) type_count
    FROM categories c JOIN departments d ON d.id = c.department_id ORDER BY c.sort`).all(),
  roles: db.prepare(`SELECT ro.*, (SELECT COUNT(*) FROM resources r WHERE r.role_code = ro.code AND r.active = 1) resource_count FROM roles ro ORDER BY ro.label`).all(),
  kinds: ['person', 'machine', 'room', 'chair', 'bed', 'vehicle'],
  exceptionTypes: ['leave', 'sick', 'training', 'conference', 'maintenance', 'breakdown', 'calibration', 'cleaning', 'other'],
})));

api.get('/search', wrap(req => {
  const q = `%${String(req.query.q ?? '').trim()}%`;
  if (q.length < 3) return { patients: [], types: [], resources: [] };
  return {
    patients: db.prepare('SELECT id, full_name, mrn, phone FROM patients WHERE full_name LIKE ? OR mrn LIKE ? OR phone LIKE ? LIMIT 6').all(q, q, q),
    types: db.prepare(`SELECT t.id, t.name, c.name category, c.icon FROM appointment_types t JOIN categories c ON c.id = t.category_id WHERE t.name LIKE ? OR c.name LIKE ? LIMIT 8`).all(q, q),
    resources: db.prepare(`SELECT r.id, r.name, r.kind, ro.label role_label FROM resources r JOIN roles ro ON ro.code = r.role_code WHERE r.name LIKE ? OR ro.label LIKE ? LIMIT 6`).all(q, q),
  };
}));

// ---------- appointment types ----------
function reqSummary(typeId: number) {
  const labels = new Map((db.prepare('SELECT code, label, kind FROM roles').all() as any[]).map(r => [r.code, r]));
  return (db.prepare('SELECT * FROM type_requirements WHERE type_id = ? ORDER BY seq').all(typeId) as any[]).map(r => {
    const codes = String(r.role_codes).split('|');
    return { ...r, roles: codes, label: codes.map(c => labels.get(c)?.label ?? c).join(' or '), kind: labels.get(codes[0])?.kind ?? 'person',
      resource_count: (db.prepare(`SELECT COUNT(*) c FROM resources WHERE active = 1 AND role_code IN (${codes.map(() => '?').join(',')})`).get(...codes) as any).c };
  });
}

api.get('/types', wrap(req => {
  const where: string[] = ['1=1']; const args: any[] = [];
  if (req.query.category) { where.push('t.category_id = ?'); args.push(Number(req.query.category)); }
  if (req.query.q) { where.push('(t.name LIKE ? OR c.name LIKE ? OR t.notes LIKE ?)'); const q = `%${req.query.q}%`; args.push(q, q, q); }
  const types = db.prepare(`SELECT t.*, c.name category_name, c.icon category_icon, d.color dept_color FROM appointment_types t
    JOIN categories c ON c.id = t.category_id JOIN departments d ON d.id = c.department_id WHERE ${where.join(' AND ')} ORDER BY c.sort, t.id`).all(...args) as any[];
  const reqs = db.prepare('SELECT type_id, role_codes, offset_min, duration_min, is_primary FROM type_requirements ORDER BY seq').all() as any[];
  const labels = new Map((db.prepare('SELECT code, label, kind FROM roles').all() as any[]).map(r => [r.code, r]));
  const by = new Map<number, any[]>();
  for (const r of reqs) {
    if (!by.has(r.type_id)) by.set(r.type_id, []);
    const codes = String(r.role_codes).split('|');
    by.get(r.type_id)!.push({ roles: codes, label: codes.map(c => labels.get(c)?.label ?? c).join(' or '), kind: labels.get(codes[0])?.kind, offset: r.offset_min, duration: r.duration_min, primary: r.is_primary });
  }
  return types.map(t => ({ ...t, requirements: by.get(t.id) ?? [] }));
}));

api.get('/types/:id', wrap(req => {
  const id = Number(req.params.id);
  const t = db.prepare(`SELECT t.*, c.name category_name, c.icon category_icon, d.color dept_color FROM appointment_types t
    JOIN categories c ON c.id = t.category_id JOIN departments d ON d.id = c.department_id WHERE t.id = ?`).get(id);
  if (!t) throw new HttpError(404, 'Appointment type not found');
  const stats = db.prepare(`SELECT COUNT(*) total, SUM(status = 'no_show') no_show, SUM(start_at >= ?) upcoming FROM appointments WHERE type_id = ?`).get(nowStr(), id);
  return { ...t, requirements: reqSummary(id), stats };
}));

api.patch('/types/:id', wrap(req => {
  const body = parse(z.object({
    duration_min: z.number().int().min(5).max(10080).optional(), slot_step_min: z.number().int().min(5).max(240).optional(),
    min_notice_min: z.number().int().min(0).optional(), max_advance_days: z.number().int().min(1).max(365).optional(),
    window_start: z.number().int().min(0).max(1440).nullable().optional(), window_end: z.number().int().min(0).max(1440).nullable().optional(),
    prep_instructions: z.string().nullable().optional(), active: z.number().int().min(0).max(1).optional(),
  }), req.body);
  const id = Number(req.params.id);
  const keys = Object.keys(body);
  if (!keys.length) throw new HttpError(400, 'Nothing to update');
  const before = db.prepare('SELECT duration_min FROM appointment_types WHERE id = ?').get(id) as any;
  // keep whole-appointment requirement segments in sync with a new duration
  db.prepare(`UPDATE appointment_types SET ${keys.map(k => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...body, id });
  audit('update', 'appointment_type', id, { before, after: body });
  if (body.duration_min) notify('success', 'system', 'Slot length updated', `New bookings will use ${body.duration_min} minutes. Existing appointments keep their times.`, `/catalog?type=${id}`);
  return db.prepare('SELECT * FROM appointment_types WHERE id = ?').get(id);
}));

// ---------- patients (demo data) ----------
api.get('/patients', wrap(req => {
  const q = `%${String(req.query.q ?? '')}%`;
  return db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id AND a.start_at >= ? AND a.status IN ('booked','confirmed')) upcoming,
      (SELECT MIN(start_at) FROM appointments a WHERE a.patient_id = p.id AND a.start_at >= ? AND a.status IN ('booked','confirmed')) next_at
    FROM patients p WHERE p.full_name LIKE ? OR p.mrn LIKE ? OR p.phone LIKE ? ORDER BY p.full_name LIMIT 200`).all(nowStr(), nowStr(), q, q, q);
}));

api.get('/patients/:id', wrap(req => {
  const id = Number(req.params.id);
  const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  if (!p) throw new HttpError(404, 'Patient not found');
  const appts = db.prepare(`SELECT a.*, t.name type_name, c.icon category_icon, c.name category_name, d.color dept_color FROM appointments a
    JOIN appointment_types t ON t.id = a.type_id JOIN categories c ON c.id = t.category_id JOIN departments d ON d.id = c.department_id
    WHERE a.patient_id = ? ORDER BY a.start_at DESC`).all(id);
  const waitlist = db.prepare(`SELECT w.*, t.name type_name FROM waitlist w JOIN appointment_types t ON t.id = w.type_id WHERE w.patient_id = ? AND w.status IN ('waiting','offered')`).all(id);
  return { ...p as object, appointments: appts, waitlist };
}));

api.post('/patients', wrap(req => {
  const b = parse(z.object({ full_name: z.string().min(2), gender: z.string().optional(), dob: d.optional(), phone: z.string().optional(),
    email: z.string().optional(), language: z.string().optional(), interpreter_needed: z.number().int().optional(), mobility: z.string().optional(),
    allergies: z.string().optional(), payer: z.string().optional(), preferred_channel: z.string().optional() }), req.body);
  const max = (db.prepare('SELECT MAX(id) m FROM patients').get() as any).m ?? 0;
  const info = db.prepare(`INSERT INTO patients (mrn, full_name, gender, dob, phone, email, language, interpreter_needed, mobility, allergies, payer, preferred_channel)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(`CG-${100200 + (max + 1) * 7}`, b.full_name, b.gender ?? null, b.dob ?? null, b.phone ?? null, b.email ?? null,
    b.language ?? 'English', b.interpreter_needed ?? 0, b.mobility ?? 'Independent', b.allergies ?? null, b.payer ?? 'Self pay', b.preferred_channel ?? 'SMS');
  notify('success', 'system', 'Patient registered', b.full_name, `/patients?id=${info.lastInsertRowid}`);
  return db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);
}));

// ---------- availability & booking ----------
api.get('/availability', wrap(req => {
  const typeId = num(req.query.typeId);
  if (!typeId) throw new HttpError(400, 'typeId is required');
  const r = search({
    typeId, fromDate: String(req.query.from ?? todayStr()), days: num(req.query.days) ?? 7,
    priority: req.query.priority === 'urgent' ? 'urgent' : 'routine', source: req.query.source ? String(req.query.source) : undefined,
    patientId: num(req.query.patientId), daypart: (req.query.daypart as any) ?? 'any',
    preferredResourceIds: req.query.preferred ? String(req.query.preferred).split(',').map(Number) : undefined,
    excludeApptId: num(req.query.excludeAppt), limitPerDay: num(req.query.limit) ?? 60,
  });
  return { ...r, requirements: reqSummary(typeId) };
}));

const assignmentSchema = z.array(z.object({ requirement_id: z.number(), resource_id: z.number() })).optional();

api.post('/appointments', wrap(req => {
  const b = parse(z.object({ patientId: z.number(), typeId: z.number(), start: dt, assignments: assignmentSchema,
    priority: z.enum(['routine', 'urgent']).optional(), source: z.string().optional(), notes: z.string().optional(), waitlistId: z.number().optional() }), req.body);
  const appt = book(b);
  if (b.waitlistId) db.prepare(`UPDATE waitlist SET status = 'booked' WHERE id = ?`).run(b.waitlistId);
  return appt;
}));

api.post('/appointments/series', wrap(req => {
  const b = parse(z.object({ patientId: z.number(), typeId: z.number(), startDate: d, weekdays: z.array(z.number().int().min(0).max(6)),
    time: z.string().regex(/^\d{2}:\d{2}$/), occurrences: z.number().int().min(1).max(60), priority: z.enum(['routine', 'urgent']).optional(), notes: z.string().optional() }), req.body);
  return bookSeries(b);
}));

api.get('/appointments', wrap(req => dayList(String(req.query.date ?? todayStr()), {
  category: num(req.query.category), department: num(req.query.department), status: req.query.status ? String(req.query.status) : undefined,
  q: req.query.q ? String(req.query.q) : undefined,
})));

api.get('/appointments/:id', wrap(req => getAppointment(Number(req.params.id))));

api.post('/appointments/:id/reschedule', wrap(req => {
  const b = parse(z.object({ start: dt, assignments: assignmentSchema }), req.body);
  return reschedule(Number(req.params.id), b.start, b.assignments);
}));

api.post('/appointments/:id/cancel', wrap(req => {
  const b = parse(z.object({ reason: z.string().min(2) }), req.body);
  return cancel(Number(req.params.id), b.reason);
}));

api.post('/appointments/:id/status', wrap(req => {
  const b = parse(z.object({ action: z.enum(['confirm', 'check_in', 'start', 'complete', 'no_show', 'undo']) }), req.body);
  return transition(Number(req.params.id), b.action);
}));

// ---------- schedule board ----------
api.get('/schedule', wrap(req => {
  const date = String(req.query.date ?? todayStr());
  const d0 = dayStart(date), d1 = d0 + DAY;
  const where = ['r.active = 1']; const args: any[] = [];
  if (req.query.department) { where.push('r.department_id = ?'); args.push(Number(req.query.department)); }
  if (req.query.kind) { where.push('r.kind = ?'); args.push(String(req.query.kind)); }
  if (req.query.role) { where.push('r.role_code = ?'); args.push(String(req.query.role)); }
  if (req.query.q) { where.push('(r.name LIKE ? OR ro.label LIKE ?)'); args.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  const resources = db.prepare(`SELECT r.*, ro.label role_label, d.name department, d.color FROM resources r JOIN roles ro ON ro.code = r.role_code
    JOIN departments d ON d.id = r.department_id WHERE ${where.join(' AND ')} ORDER BY d.id, ro.label, r.name LIMIT 160`).all(...args) as any[];
  if (!resources.length) return { date, resources: [] };
  const cal = new Calendar(d0, d1, [...new Set(resources.map(r => r.role_code))]);
  const ids = resources.map(r => r.id).join(',');
  const holds = db.prepare(`SELECT ar.*, a.ref, a.status, a.priority, a.at_risk, a.start_at appt_start, a.end_at appt_end, p.full_name patient_name, t.name type_name, dd.color
    FROM appointment_resources ar JOIN appointments a ON a.id = ar.appointment_id JOIN patients p ON p.id = a.patient_id
    JOIN appointment_types t ON t.id = a.type_id JOIN categories c ON c.id = t.category_id JOIN departments dd ON dd.id = c.department_id
    WHERE ar.resource_id IN (${ids}) AND ar.released = 0 AND a.status NOT IN ('cancelled') AND ar.hold_end > ? AND ar.hold_start < ?`)
    .all(fromMin(d0), fromMin(d1)) as any[];
  const exRows = db.prepare(`SELECT * FROM resource_exceptions WHERE resource_id IN (${ids})`).all() as any[];
  const exFor = (rid: number) => exRows.filter(x => x.resource_id === rid).flatMap(x => {
    const out: any[] = []; const step = x.recur_weeks ? x.recur_weeks * 7 * DAY : 0;
    for (let k = 0; k < (step ? 400 : 1); k++) {
      const s = toMin(x.start_at) + k * step, e = toMin(x.end_at) + k * step;
      if (s >= d1) break;
      if (x.recur_until && k > 0 && s > toMin(x.recur_until) + DAY) break;
      if (e > d0) out.push({ id: x.id, type: x.type, reason: x.reason, planned: x.planned, start: fromMin(Math.max(s, d0)), end: fromMin(Math.min(e, d1)) });
    }
    return out;
  });
  const holiday = db.prepare('SELECT * FROM holidays WHERE date = ?').get(date);
  return {
    date, holiday,
    resources: resources.map(r => ({
      ...r,
      windows: availableWindows(cal, r.id, date).map(w => ({ start: fromMin(w.s), end: fromMin(w.e), tag: w.tag })),
      exceptions: exFor(r.id),
      holds: holds.filter(h => h.resource_id === r.id),
    })),
  };
}));

// ---------- resources ----------
api.get('/resources', wrap(req => {
  const where = ['1=1']; const args: any[] = [];
  if (req.query.department) { where.push('r.department_id = ?'); args.push(Number(req.query.department)); }
  if (req.query.kind) { where.push('r.kind = ?'); args.push(String(req.query.kind)); }
  if (req.query.q) { where.push('(r.name LIKE ? OR ro.label LIKE ?)'); args.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  const now = nowStr();
  return db.prepare(`SELECT r.*, ro.label role_label, ro.turnover_min, d.name department, d.color,
      (SELECT COUNT(*) FROM resource_exceptions x WHERE x.resource_id = r.id AND (x.end_at > ? OR x.recur_weeks IS NOT NULL)) exception_count,
      (SELECT x.type FROM resource_exceptions x WHERE x.resource_id = r.id AND x.start_at <= ? AND x.end_at > ? LIMIT 1) current_exception
    FROM resources r JOIN roles ro ON ro.code = r.role_code JOIN departments d ON d.id = r.department_id
    WHERE ${where.join(' AND ')} ORDER BY d.id, ro.label, r.name`).all(now, now, now, ...args);
}));

api.get('/resources/:id', wrap(req => {
  const id = Number(req.params.id);
  const r = db.prepare(`SELECT r.*, ro.label role_label, ro.turnover_min, d.name department, d.color FROM resources r JOIN roles ro ON ro.code = r.role_code
    JOIN departments d ON d.id = r.department_id WHERE r.id = ?`).get(id) as any;
  if (!r) throw new HttpError(404, 'Resource not found');
  const templates = db.prepare('SELECT * FROM resource_templates WHERE resource_id = ? ORDER BY weekday, start_min').all(id);
  const exceptions = db.prepare(`SELECT * FROM resource_exceptions WHERE resource_id = ? AND (end_at > ? OR recur_weeks IS NOT NULL) ORDER BY start_at`).all(id, nowStr());
  const usedBy = db.prepare(`SELECT DISTINCT t.id, t.name FROM type_requirements q JOIN appointment_types t ON t.id = q.type_id
    WHERE '|' || q.role_codes || '|' LIKE ? ORDER BY t.name`).all(`%|${r.role_code}|%`);
  const today = todayStr();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map(date => {
    const u = utilization(date).resources.find(x => x.id === id)!;
    return { date, available_min: u.available_min, booked_min: u.booked_min, pct: u.pct };
  });
  return { ...r, templates, exceptions, usedBy, week };
}));

api.put('/resources/:id/templates', wrap(req => {
  const id = Number(req.params.id);
  const rows = parse(z.array(z.object({ weekday: z.number().int().min(0).max(6), start_min: z.number().int().min(0).max(2880), end_min: z.number().int().min(1).max(2880),
    tag: z.enum(['general', 'urgent', 'walkin']).default('general'), release_hours: z.number().int().min(0).default(0), week_parity: z.number().int().min(0).max(1).nullable().optional(),
    effective_from: d.nullable().optional(), effective_to: d.nullable().optional() })), req.body);
  for (const r of rows) if (r.end_min <= r.start_min) throw new HttpError(400, 'Each working window must end after it starts');
  db.transaction(() => {
    db.prepare('DELETE FROM resource_templates WHERE resource_id = ?').run(id);
    const ins = db.prepare(`INSERT INTO resource_templates (resource_id, weekday, start_min, end_min, tag, release_hours, week_parity, effective_from, effective_to) VALUES (?,?,?,?,?,?,?,?,?)`);
    for (const r of rows) ins.run(id, r.weekday, r.start_min, r.end_min, r.tag, r.release_hours, r.week_parity ?? null, r.effective_from ?? null, r.effective_to ?? null);
  })();
  audit('update', 'resource_templates', id, { windows: rows.length });
  // flag future bookings that now fall outside working hours
  const res = db.prepare('SELECT name, role_code FROM resources WHERE id = ?').get(id) as any;
  const future = db.prepare(`SELECT ar.*, a.id appt_id FROM appointment_resources ar JOIN appointments a ON a.id = ar.appointment_id
    WHERE ar.resource_id = ? AND ar.released = 0 AND a.status IN ('booked','confirmed') AND ar.start_at > ?`).all(id, nowStr()) as any[];
  let flagged = 0;
  if (future.length) {
    const cal = new Calendar(toMin(nowStr()), toMin(future[future.length - 1].end_at) + DAY, [res.role_code]);
    for (const f of future) {
      if (!cal.containing(id, toMin(f.start_at), toMin(f.end_at))) {
        const exists = db.prepare(`SELECT 1 FROM reschedule_queue WHERE appointment_id = ? AND status = 'pending'`).get(f.appt_id);
        if (!exists) {
          db.prepare('UPDATE appointments SET at_risk = 1 WHERE id = ?').run(f.appt_id);
          db.prepare('INSERT INTO reschedule_queue (appointment_id, reason, created_at) VALUES (?,?,?)').run(f.appt_id, `${res.name}: working hours changed`, nowStr());
          flagged++;
        }
      }
    }
  }
  notify(flagged ? 'warning' : 'success', 'system', 'Working hours saved', flagged ? `${flagged} booked appointment(s) fall outside the new hours and were added to the reschedule queue.` : `${res.name} now has ${rows.length} weekly working windows.`, flagged ? '/exceptions' : `/resources?id=${id}`);
  broadcast('schedule-changed', {});
  return { ok: true, flagged };
}));

// ---------- exceptions ----------
const exceptionSchema = z.object({
  resource_id: z.number(), type: z.enum(['leave', 'sick', 'training', 'conference', 'maintenance', 'breakdown', 'calibration', 'cleaning', 'other']),
  planned: z.boolean().optional(), start_at: dt, end_at: dt, recur_weeks: z.number().int().min(1).max(12).nullable().optional(),
  recur_until: d.nullable().optional(), reason: z.string().optional(), source: z.string().optional(),
});
api.post('/exceptions/preview', wrap(req => ({ impacted: previewImpact(parse(exceptionSchema, req.body)) })));
api.post('/exceptions', wrap(req => createException(parse(exceptionSchema, req.body))));
api.delete('/exceptions/:id', wrap(req => { deleteException(Number(req.params.id)); return { ok: true }; }));
api.get('/exceptions', wrap(() => db.prepare(`SELECT x.*, r.name resource_name, r.kind, ro.label role_label, d.name department,
    (SELECT COUNT(*) FROM reschedule_queue q WHERE q.exception_id = x.id AND q.status = 'pending') pending
  FROM resource_exceptions x JOIN resources r ON r.id = x.resource_id JOIN roles ro ON ro.code = r.role_code JOIN departments d ON d.id = r.department_id
  WHERE x.end_at > ? OR x.recur_weeks IS NOT NULL ORDER BY x.start_at`).all(`${addDays(todayStr(), -1)}T00:00`)));

api.get('/holidays', wrap(() => db.prepare('SELECT * FROM holidays WHERE date >= ? ORDER BY date').all(addDays(todayStr(), -30))));
api.post('/holidays', wrap(req => {
  const b = parse(z.object({ date: d, name: z.string().min(2) }), req.body);
  const info = db.prepare('INSERT INTO holidays (date, name) VALUES (?,?)').run(b.date, b.name);
  const hit = db.prepare(`SELECT DISTINCT a.id FROM appointments a JOIN appointment_resources ar ON ar.appointment_id = a.id JOIN resources r ON r.id = ar.resource_id
    WHERE a.start_at >= ? AND a.start_at < ? AND a.status IN ('booked','confirmed') AND r.always_on = 0`).all(`${b.date}T00:00`, `${addDays(b.date, 1)}T00:00`) as any[];
  for (const h of hit) {
    db.prepare('UPDATE appointments SET at_risk = 1 WHERE id = ?').run(h.id);
    db.prepare('INSERT INTO reschedule_queue (appointment_id, reason, created_at) VALUES (?,?,?)').run(h.id, `Facility holiday: ${b.name}`, nowStr());
  }
  notify(hit.length ? 'warning' : 'info', 'exception', `Holiday added: ${b.name}`, hit.length ? `${hit.length} appointments on ${b.date} need a new time.` : `${b.date} is closed for elective services. 24x7 services keep running.`, hit.length ? '/exceptions' : undefined);
  broadcast('schedule-changed', { date: b.date });
  return { id: info.lastInsertRowid, impacted: hit.length };
}));
api.delete('/holidays/:id', wrap(req => { db.prepare('DELETE FROM holidays WHERE id = ?').run(Number(req.params.id)); broadcast('schedule-changed', {}); return { ok: true }; }));

// ---------- reschedule queue ----------
api.get('/queue', wrap(() => queue('pending')));
api.get('/queue/:id/suggestions', wrap(req => suggestions(Number(req.params.id))));
api.post('/queue/auto', wrap(() => autoResolve()));
api.post('/queue/:id/dismiss', wrap(req => {
  const q = db.prepare('SELECT * FROM reschedule_queue WHERE id = ?').get(Number(req.params.id)) as any;
  if (!q) throw new HttpError(404, 'Queue item not found');
  db.prepare(`UPDATE reschedule_queue SET status = 'dismissed', resolved_at = ? WHERE id = ?`).run(nowStr(), q.id);
  const left = (db.prepare(`SELECT COUNT(*) c FROM reschedule_queue WHERE appointment_id = ? AND status = 'pending'`).get(q.appointment_id) as any).c;
  if (!left) db.prepare('UPDATE appointments SET at_risk = 0 WHERE id = ?').run(q.appointment_id);
  broadcast('schedule-changed', {});
  return { ok: true };
}));

// ---------- waitlist ----------
api.get('/waitlist', wrap(() => db.prepare(`SELECT w.*, p.full_name patient_name, p.mrn, t.name type_name, c.icon category_icon FROM waitlist w
  JOIN patients p ON p.id = w.patient_id JOIN appointment_types t ON t.id = w.type_id JOIN categories c ON c.id = t.category_id
  WHERE w.status IN ('waiting','offered') ORDER BY CASE w.priority WHEN 'urgent' THEN 0 ELSE 1 END, w.created_at`).all()));
api.post('/waitlist', wrap(req => {
  const b = parse(z.object({ patientId: z.number(), typeId: z.number(), earliest: d, latest: d, priority: z.enum(['routine', 'urgent']).optional(), notes: z.string().optional() }), req.body);
  const info = db.prepare('INSERT INTO waitlist (patient_id, type_id, earliest, latest, priority, notes, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(b.patientId, b.typeId, b.earliest, b.latest, b.priority ?? 'routine', b.notes ?? null, nowStr());
  const t = loadType(b.typeId).type;
  notify('info', 'waitlist', 'Added to waitlist', `${t.name}, ${b.earliest} to ${b.latest}. You will be alerted when a matching slot frees up.`, '/frontdesk?tab=waitlist');
  return { id: info.lastInsertRowid };
}));
api.patch('/waitlist/:id', wrap(req => {
  const b = parse(z.object({ status: z.enum(['waiting', 'offered', 'booked', 'removed']) }), req.body);
  db.prepare('UPDATE waitlist SET status = ? WHERE id = ?').run(b.status, Number(req.params.id));
  return { ok: true };
}));

// ---------- reminders outbox ----------
api.get('/reminders', wrap(req => {
  const date = String(req.query.date ?? todayStr());
  return db.prepare(`SELECT m.*, a.ref, p.full_name patient_name FROM reminders m JOIN appointments a ON a.id = m.appointment_id JOIN patients p ON p.id = a.patient_id
    WHERE m.send_at >= ? AND m.send_at < ? ORDER BY m.send_at`).all(`${date}T00:00`, `${addDays(date, 1)}T00:00`);
}));

// ---------- notifications ----------
api.get('/notifications', wrap(() => db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 60').all()));
api.post('/notifications/read-all', wrap(() => { db.prepare('UPDATE notifications SET read = 1').run(); return { ok: true }; }));
api.post('/notifications/:id/read', wrap(req => { db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(Number(req.params.id)); return { ok: true }; }));

// ---------- analytics ----------
api.get('/analytics/summary', wrap(() => summary()));
api.get('/analytics/durations', wrap(req => durationAnalysis(num(req.query.days) ?? 60)));
api.get('/analytics/utilization', wrap(req => utilization(String(req.query.date ?? todayStr()), num(req.query.department))));

// ---------- errors ----------
api.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message ?? 'Unexpected error', ...(err.extra ? { detail: err.extra } : {}) });
});
