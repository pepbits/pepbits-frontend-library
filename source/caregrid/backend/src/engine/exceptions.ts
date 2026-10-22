import { db } from '../db';
import { audit, broadcast, notify } from '../lib/events';
import { DAY, Interval, dateOf, fromMin, nowMin, nowStr, toMin } from '../lib/time';
import { search } from './availability';
import { HttpError, reschedule } from './booking';

export interface ExceptionInput {
  resource_id: number; type: string; planned?: boolean; start_at: string; end_at: string;
  recur_weeks?: number | null; recur_until?: string | null; reason?: string; source?: string;
}

function occurrences(x: ExceptionInput, horizonDays = 180): Interval[] {
  const s0 = toMin(x.start_at), e0 = toMin(x.end_at);
  if (e0 <= s0) throw new HttpError(400, 'End must be after start');
  if (!x.recur_weeks) return [{ s: s0, e: e0 }];
  const step = x.recur_weeks * 7 * DAY;
  const until = x.recur_until ? toMin(x.recur_until) + DAY : nowMin() + horizonDays * DAY;
  const out: Interval[] = [];
  for (let k = 0; s0 + k * step <= until && k < 200; k++) out.push({ s: s0 + k * step, e: e0 + k * step });
  return out;
}

/** Which upcoming appointments would lose this resource? */
export function previewImpact(x: ExceptionInput) {
  const occ = occurrences(x);
  const now = nowMin();
  const rows = db.prepare(`SELECT DISTINCT a.id, a.ref, a.start_at, a.end_at, a.status, a.priority, p.full_name patient_name, p.phone, t.name type_name,
      ar.start_at seg_start, ar.end_at seg_end
    FROM appointment_resources ar JOIN appointments a ON a.id = ar.appointment_id JOIN patients p ON p.id = a.patient_id
    JOIN appointment_types t ON t.id = a.type_id
    WHERE ar.resource_id = ? AND ar.released = 0 AND a.status IN ('booked','confirmed') AND ar.end_at > ? ORDER BY a.start_at`)
    .all(x.resource_id, fromMin(now)) as any[];
  const hit = rows.filter(r => occ.some(o => toMin(r.seg_start) < o.e && o.s < toMin(r.seg_end)));
  const seen = new Set<number>();
  return hit.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

export function createException(x: ExceptionInput) {
  const res = db.prepare('SELECT r.*, ro.label role_label FROM resources r JOIN roles ro ON ro.code = r.role_code WHERE r.id = ?').get(x.resource_id) as any;
  if (!res) throw new HttpError(404, 'Resource not found');
  const impacted = previewImpact(x);
  const planned = x.planned ?? !['sick', 'breakdown'].includes(x.type);
  const id = db.transaction(() => {
    const info = db.prepare(`INSERT INTO resource_exceptions (resource_id, type, planned, start_at, end_at, recur_weeks, recur_until, reason, source, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(x.resource_id, x.type, planned ? 1 : 0, x.start_at, x.end_at, x.recur_weeks ?? null, x.recur_until ?? null,
      x.reason ?? null, x.source ?? 'manual', nowStr());
    const exId = Number(info.lastInsertRowid);
    const reason = `${res.name}: ${x.type}${x.reason ? ` (${x.reason})` : ''}`;
    for (const a of impacted) {
      db.prepare('UPDATE appointments SET at_risk = 1, updated_at = ? WHERE id = ?').run(nowStr(), a.id);
      db.prepare('INSERT INTO reschedule_queue (appointment_id, exception_id, reason, created_at) VALUES (?,?,?,?)').run(a.id, exId, reason, nowStr());
    }
    return exId;
  })();
  audit('create', 'exception', id, { ...x, impacted: impacted.length });
  const level = impacted.length ? (planned ? 'warning' : 'critical') : 'info';
  notify(level, 'exception', `${res.name} unavailable`,
    impacted.length ? `${impacted.length} appointment${impacted.length > 1 ? 's' : ''} need a new time. Open the reschedule queue to fix them in one step.`
      : `Blocked ${x.start_at.replace('T', ' ')} to ${x.end_at.replace('T', ' ')}. No booked appointments were affected.`,
    impacted.length ? '/exceptions' : `/resources?id=${x.resource_id}`);
  broadcast('schedule-changed', { date: x.start_at.slice(0, 10) });
  return { id, impacted };
}

export function deleteException(id: number) {
  const x = db.prepare('SELECT * FROM resource_exceptions WHERE id = ?').get(id) as any;
  if (!x) throw new HttpError(404, 'Exception not found');
  db.transaction(() => {
    const items = db.prepare(`SELECT appointment_id FROM reschedule_queue WHERE exception_id = ? AND status = 'pending'`).all(id) as any[];
    db.prepare(`UPDATE reschedule_queue SET status = 'dismissed', resolved_at = ? WHERE exception_id = ? AND status = 'pending'`).run(nowStr(), id);
    for (const it of items) {
      const left = db.prepare(`SELECT COUNT(*) c FROM reschedule_queue WHERE appointment_id = ? AND status = 'pending'`).get(it.appointment_id) as any;
      if (!left.c) db.prepare('UPDATE appointments SET at_risk = 0 WHERE id = ?').run(it.appointment_id);
    }
    db.prepare('DELETE FROM resource_exceptions WHERE id = ?').run(id);
  })();
  audit('delete', 'exception', id);
  notify('success', 'exception', 'Block removed', 'The resource is available again and affected appointments are back to normal.', `/resources?id=${x.resource_id}`);
  broadcast('schedule-changed', {});
}

export function queue(status = 'pending') {
  return db.prepare(`SELECT q.*, a.ref, a.start_at, a.end_at, a.priority, a.status appt_status, a.type_id, a.patient_id,
      p.full_name patient_name, p.phone, p.preferred_channel, t.name type_name, c.icon category_icon, d.color dept_color,
      x.type exception_type, x.planned
    FROM reschedule_queue q JOIN appointments a ON a.id = q.appointment_id JOIN patients p ON p.id = a.patient_id
    JOIN appointment_types t ON t.id = a.type_id JOIN categories c ON c.id = t.category_id JOIN departments d ON d.id = c.department_id
    LEFT JOIN resource_exceptions x ON x.id = q.exception_id
    WHERE q.status = ? ORDER BY CASE a.priority WHEN 'urgent' THEN 0 ELSE 1 END, a.start_at`).all(status);
}

/** Best alternative times: closest to the original time, keeping the same people/machines where possible. */
export function suggestions(queueId: number, count = 4) {
  const q = db.prepare('SELECT q.*, a.* FROM reschedule_queue q JOIN appointments a ON a.id = q.appointment_id WHERE q.id = ?').get(queueId) as any;
  if (!q) throw new HttpError(404, 'Queue item not found');
  const exRes = q.exception_id ? (db.prepare('SELECT resource_id FROM resource_exceptions WHERE id = ?').get(q.exception_id) as any)?.resource_id : null;
  const keep = (db.prepare('SELECT resource_id FROM appointment_resources WHERE appointment_id = ?').all(q.appointment_id) as any[])
    .map(r => r.resource_id).filter((r: number) => r !== exRes);
  const original = toMin(q.start_at);
  const from = Math.max(nowMin(), original - 3 * DAY);
  const res = search({ typeId: q.type_id, fromDate: dateOf(from), days: 14, priority: q.priority, patientId: q.patient_id,
    excludeApptId: q.appointment_id, preferredResourceIds: keep, limitPerDay: 200, maxSlots: 1500 });
  const all = res.days.flatMap(d => d.slots);
  const ranked = all.map(s => {
    const kept = s.assignments.filter(a => keep.includes(a.resource_id)).length;
    const dist = Math.abs(toMin(s.start) - original);
    return { ...s, kept, distance_min: dist, rank: dist - kept * 90 };
  }).sort((a, b) => a.rank - b.rank);
  const picked: typeof ranked = [];
  for (const s of ranked) {
    if (picked.some(p => Math.abs(toMin(p.start) - toMin(s.start)) < 60)) continue;
    picked.push(s);
    if (picked.length >= count) break;
  }
  return { original: q.start_at, keepCount: keep.length, suggestions: picked, blockers: res.blockers };
}

export function autoResolve() {
  const items = queue('pending') as any[];
  let moved = 0; const failed: { id: number; patient: string; reason: string }[] = [];
  for (const it of items) {
    try {
      const s = suggestions(it.id, 1).suggestions[0];
      if (!s) { failed.push({ id: it.id, patient: it.patient_name, reason: 'No alternative time within 14 days' }); continue; }
      reschedule(it.appointment_id, s.start, s.assignments, 'Auto-resolved from reschedule queue');
      moved++;
    } catch (e: any) { failed.push({ id: it.id, patient: it.patient_name, reason: e.message }); }
  }
  notify(failed.length ? 'warning' : 'success', 'reschedule', `${moved} appointment${moved === 1 ? '' : 's'} moved automatically`,
    failed.length ? `${failed.length} still need a manual decision.` : 'The reschedule queue is clear.', '/exceptions');
  return { moved, failed };
}
