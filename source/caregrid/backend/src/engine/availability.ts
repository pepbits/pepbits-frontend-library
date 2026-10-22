import { db } from '../db';
import { DAY, Interval, dateOf, dayStart, fromMin, nowMin, overlaps, subtract, toMin, weekParity, weekday } from '../lib/time';

export interface TypeRow {
  id: number; category_id: number; name: string; mode: string; pattern: string; duration_min: number; slot_step_min: number;
  slot_model: string; min_notice_min: number; max_advance_days: number; window_start: number | null; window_end: number | null;
  travel_min: number; recurring: number; prep_instructions: string | null; requires_consent: number;
}
export interface Requirement { id: number; seq: number; roles: string[]; offset: number; duration: number | null; is_primary: number }
interface ResourceRow { id: number; role_code: string; name: string; kind: string; capacity: number; always_on: number; turnover_min: number }
export interface Window extends Interval { tag: 'general' | 'urgent' | 'walkin'; release: number }
interface Hold extends Interval { appt: number }

export interface Assignment {
  requirement_id: number; resource_id: number; resource_name: string; role_code: string; kind: string;
  start: string; end: string; hold_start: string; hold_end: string;
}
export interface Slot { start: string; end: string; assignments: Assignment[]; reserved?: string; score: number }

export interface SearchOptions {
  typeId: number;
  fromDate: string;           // YYYY-MM-DD
  days?: number;              // how many days to scan
  priority?: 'routine' | 'urgent';
  source?: string;
  patientId?: number;
  preferredResourceIds?: number[];
  excludeApptId?: number;     // when rescheduling, ignore this appointment's own holds
  exactStart?: string;        // only test this start time
  allowPast?: boolean;        // seeding / back-entry
  daypart?: 'any' | 'morning' | 'afternoon' | 'evening';
  limitPerDay?: number;
  maxSlots?: number;
  ignoreNotice?: boolean;
}

export interface SearchResult {
  type: TypeRow;
  requirements: Requirement[];
  days: { date: string; slots: Slot[]; total: number }[];
  firstAvailable: Slot | null;
  blockers: { role: string; label: string; count: number }[];
  scanned: number;
}

const stmtType = () => db.prepare('SELECT * FROM appointment_types WHERE id = ?');
const stmtReqs = () => db.prepare('SELECT * FROM type_requirements WHERE type_id = ? ORDER BY seq');

export function loadType(typeId: number): { type: TypeRow; reqs: Requirement[] } {
  const type = stmtType().get(typeId) as TypeRow | undefined;
  if (!type) throw Object.assign(new Error('Appointment type not found'), { status: 404 });
  const reqs = (stmtReqs().all(typeId) as any[]).map(r => ({
    id: r.id, seq: r.seq, roles: String(r.role_codes).split('|'), offset: r.offset_min, duration: r.duration_min, is_primary: r.is_primary,
  }));
  return { type, reqs };
}

/** Builds working windows and existing holds for a set of resources over a time range. */
export class Calendar {
  private windowsBy = new Map<number, Window[]>();
  private holdsBy = new Map<number, Hold[]>();
  private loadBy = new Map<string, number>();
  readonly resources = new Map<number, ResourceRow>();
  readonly byRole = new Map<string, ResourceRow[]>();

  constructor(public from: number, public to: number, roleCodes?: string[], excludeApptId?: number) {
    const roleFilter = roleCodes && roleCodes.length ? `AND r.role_code IN (${roleCodes.map(() => '?').join(',')})` : '';
    const rows = db.prepare(`SELECT r.id, r.role_code, r.name, r.kind, r.capacity, r.always_on, ro.turnover_min
      FROM resources r JOIN roles ro ON ro.code = r.role_code WHERE r.active = 1 ${roleFilter}`).all(...(roleCodes ?? [])) as ResourceRow[];
    for (const r of rows) {
      this.resources.set(r.id, r);
      if (!this.byRole.has(r.role_code)) this.byRole.set(r.role_code, []);
      this.byRole.get(r.role_code)!.push(r);
    }
    if (!rows.length) return;
    const ids = rows.map(r => r.id);
    const inIds = `(${ids.join(',')})`;
    const firstDay = dayStart(dateOf(from)) - DAY;      // include previous day for overnight windows
    const lastDay = dayStart(dateOf(to)) + DAY;
    const holidays = new Set((db.prepare('SELECT date FROM holidays').all() as { date: string }[]).map(h => h.date));
    const templates = db.prepare(`SELECT * FROM resource_templates WHERE resource_id IN ${inIds}`).all() as any[];
    const tByRes = new Map<number, any[]>();
    for (const t of templates) { if (!tByRes.has(t.resource_id)) tByRes.set(t.resource_id, []); tByRes.get(t.resource_id)!.push(t); }

    const exRows = db.prepare(`SELECT * FROM resource_exceptions WHERE resource_id IN ${inIds}`).all() as any[];
    const exBy = new Map<number, Interval[]>();
    for (const x of exRows) {
      const s0 = toMin(x.start_at), e0 = toMin(x.end_at);
      const step = x.recur_weeks ? x.recur_weeks * 7 * DAY : 0;
      const until = x.recur_until ? toMin(x.recur_until) : lastDay + DAY;
      for (let k = 0; ; k++) {
        const s = s0 + k * step, e = e0 + k * step;
        if (s > lastDay + DAY || (k > 0 && s > until)) break;
        if (e >= firstDay) { if (!exBy.has(x.resource_id)) exBy.set(x.resource_id, []); exBy.get(x.resource_id)!.push({ s, e }); }
        if (!step) break;
      }
    }

    for (const r of rows) {
      const wins: Window[] = [];
      for (let d = firstDay; d <= lastDay; d += DAY) {
        const ds = dateOf(d);
        const wd = weekday(d), par = weekParity(d);
        const closed = holidays.has(ds) && !r.always_on;
        if (closed) continue;
        for (const t of tByRes.get(r.id) ?? []) {
          if (t.weekday !== wd) continue;
          if (t.week_parity !== null && t.week_parity !== undefined && t.week_parity !== par) continue;
          if (t.effective_from && ds < t.effective_from) continue;
          if (t.effective_to && ds > t.effective_to) continue;
          wins.push({ s: d + t.start_min, e: d + t.end_min, tag: t.tag, release: t.release_hours });
        }
      }
      // remove exceptions, keep tags
      const blocks = exBy.get(r.id) ?? [];
      let cut: Window[] = [];
      for (const w of wins) for (const piece of subtract([w], blocks)) cut.push({ ...piece, tag: w.tag, release: w.release });
      cut.sort((a, b) => a.s - b.s);
      const merged: Window[] = [];
      for (const w of cut) {
        const last = merged[merged.length - 1];
        if (last && last.tag === w.tag && w.s <= last.e) last.e = Math.max(last.e, w.e);
        else merged.push({ ...w });
      }
      this.windowsBy.set(r.id, merged);
    }

    const holds = db.prepare(`SELECT ar.resource_id, ar.hold_start, ar.hold_end, ar.appointment_id FROM appointment_resources ar
      JOIN appointments a ON a.id = ar.appointment_id
      WHERE ar.resource_id IN ${inIds} AND ar.released = 0 AND a.status NOT IN ('cancelled','no_show')
      AND ar.hold_end > ? AND ar.hold_start < ?`).all(fromMin(firstDay), fromMin(lastDay + DAY)) as any[];
    for (const h of holds) {
      if (excludeApptId && h.appointment_id === excludeApptId) continue;
      const hold = { s: toMin(h.hold_start), e: toMin(h.hold_end), appt: h.appointment_id };
      if (!this.holdsBy.has(h.resource_id)) this.holdsBy.set(h.resource_id, []);
      this.holdsBy.get(h.resource_id)!.push(hold);
      const key = `${h.resource_id}:${dateOf(hold.s)}`;
      this.loadBy.set(key, (this.loadBy.get(key) ?? 0) + (hold.e - hold.s));
    }
  }

  windows(id: number) { return this.windowsBy.get(id) ?? []; }
  holds(id: number) { return this.holdsBy.get(id) ?? []; }
  load(id: number, date: string) { return this.loadBy.get(`${id}:${date}`) ?? 0; }

  /** Returns the window containing [s,e] or null. */
  containing(id: number, s: number, e: number): Window | null {
    for (const w of this.windows(id)) if (w.s <= s && w.e >= e) return w;
    return null;
  }

  isFree(id: number, s: number, e: number): boolean {
    const r = this.resources.get(id)!;
    const over = this.holds(id).filter(h => h.s < e && s < h.e);
    if (over.length < r.capacity) return true;
    // sweep to find peak concurrency inside [s,e]
    const pts: [number, number][] = [];
    for (const h of over) { pts.push([Math.max(h.s, s), 1]); pts.push([Math.min(h.e, e), -1]); }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0, peak = 0;
    for (const [, d] of pts) { cur += d; peak = Math.max(peak, cur); }
    return peak < r.capacity;
  }

  addHold(id: number, s: number, e: number, appt: number) {
    if (!this.holdsBy.has(id)) this.holdsBy.set(id, []);
    this.holdsBy.get(id)!.push({ s, e, appt });
    const key = `${id}:${dateOf(s)}`;
    this.loadBy.set(key, (this.loadBy.get(key) ?? 0) + (e - s));
  }
}

function windowAllowed(w: Window, slotStart: number, now: number, priority: string, source?: string): boolean {
  if (w.tag === 'general') return true;
  if (priority === 'urgent') return true;
  if (w.tag === 'walkin' && source === 'walkin') return true;
  return slotStart - now <= w.release * 60;
}

function patientBusy(patientId: number | undefined, s: number, e: number, excludeAppt?: number): boolean {
  if (!patientId) return false;
  const rows = db.prepare(`SELECT id, start_at, end_at FROM appointments WHERE patient_id = ? AND status IN ('booked','confirmed','checked_in','in_progress')
     AND start_at < ? AND end_at > ?`).all(patientId, fromMin(e), fromMin(s)) as any[];
  return rows.some(r => r.id !== excludeAppt);
}

export function search(opts: SearchOptions, cal?: Calendar): SearchResult {
  const { type, reqs } = loadType(opts.typeId);
  const priority = opts.priority ?? 'routine';
  const days = Math.max(1, Math.min(opts.days ?? 7, 62));
  const now = nowMin();
  const roleCodes = [...new Set(reqs.flatMap(r => r.roles))];
  const fromDay = dayStart(opts.fromDate);
  const toDay = fromDay + days * DAY;
  const maxReqEnd = Math.max(...reqs.map(r => r.offset + (r.duration ?? type.duration_min)));
  const minOffset = Math.min(0, ...reqs.map(r => r.offset));
  const calendar = cal ?? new Calendar(fromDay + minOffset - DAY, toDay + maxReqEnd + DAY, roleCodes, opts.excludeApptId);
  const earliest = opts.allowPast ? -Infinity : now + (opts.ignoreNotice ? 0 : type.min_notice_min);
  const latest = now + type.max_advance_days * DAY;
  const step = Math.max(5, type.slot_step_min);
  const limitPerDay = opts.limitPerDay ?? 48;
  const maxSlots = opts.maxSlots ?? 400;
  const preferred = new Set(opts.preferredResourceIds ?? []);
  const blockers = new Map<string, number>();
  const result: SearchResult['days'] = [];
  let first: Slot | null = null;
  let scanned = 0, totalSlots = 0;

  for (let d = fromDay; d < toDay; d += DAY) {
    const date = dateOf(d);
    const dayRes = { date, slots: [] as Slot[], total: 0 };
    let lo = type.window_start ?? 0, hi = type.window_end ?? DAY - step;
    if (opts.daypart === 'morning') { lo = Math.max(lo, 0); hi = Math.min(hi, 12 * 60 - step); }
    if (opts.daypart === 'afternoon') { lo = Math.max(lo, 12 * 60); hi = Math.min(hi, 17 * 60 - step); }
    if (opts.daypart === 'evening') { lo = Math.max(lo, 17 * 60); hi = Math.min(hi, DAY - step); }
    const starts: number[] = [];
    if (opts.exactStart) { const x = toMin(opts.exactStart); if (x >= d && x < d + DAY) starts.push(x); }
    else for (let m = Math.ceil(lo / step) * step; m <= hi; m += step) starts.push(d + m);

    for (const t of starts) {
      if (t < earliest || t > latest) continue;
      scanned++;
      const assigned: { req: Requirement; res: ResourceRow; s: number; e: number; hs: number; he: number; tag: string }[] = [];
      let ok = true;
      for (const req of reqs) {
        const s = t + req.offset;
        const e = s + (req.duration ?? type.duration_min);
        let cands: ResourceRow[] = [];
        for (const rc of req.roles) cands = cands.concat(calendar.byRole.get(rc) ?? []);
        // ordering: preferred, continuity with an earlier segment of same role, then least loaded
        const sameRoleEarlier = new Set(assigned.filter(a => req.roles.includes(a.res.role_code)).map(a => a.res.id));
        cands = cands.slice().sort((a, b) =>
          (Number(preferred.has(b.id)) - Number(preferred.has(a.id))) ||
          (Number(sameRoleEarlier.has(b.id)) - Number(sameRoleEarlier.has(a.id))) ||
          (calendar.load(a.id, date) - calendar.load(b.id, date)) || (a.id - b.id));
        let picked: (typeof assigned)[number] | null = null;
        for (const c of cands) {
          if (assigned.some(a => a.res.id === c.id && a.s < e && s < a.e)) continue;
          const w = calendar.containing(c.id, s, e);
          if (!w || !windowAllowed(w, t, now, priority, opts.source)) continue;
          const hs = s - type.travel_min, he = e + c.turnover_min + type.travel_min;
          if (!calendar.isFree(c.id, hs, he)) continue;
          picked = { req, res: c, s, e, hs, he, tag: w.tag };
          break;
        }
        if (!picked) {
          ok = false;
          const key = req.roles.join('|');
          blockers.set(key, (blockers.get(key) ?? 0) + 1);
          break;
        }
        assigned.push(picked);
      }
      if (!ok) continue;
      const end = t + type.duration_min;
      if (patientBusy(opts.patientId, t, end, opts.excludeApptId)) { blockers.set('patient', (blockers.get('patient') ?? 0) + 1); continue; }
      const prefHits = assigned.filter(a => preferred.has(a.res.id)).length;
      const reserved = assigned.find(a => a.tag !== 'general')?.tag;
      const slot: Slot = {
        start: fromMin(t), end: fromMin(end), reserved,
        score: prefHits * 100 - Math.round((t - fromDay) / 60),
        assignments: assigned.map(a => ({
          requirement_id: a.req.id, resource_id: a.res.id, resource_name: a.res.name, role_code: a.res.role_code, kind: a.res.kind,
          start: fromMin(a.s), end: fromMin(a.e), hold_start: fromMin(a.hs), hold_end: fromMin(a.he),
        })),
      };
      dayRes.total++;
      if (!first) first = slot;
      if (dayRes.slots.length < limitPerDay && totalSlots < maxSlots) { dayRes.slots.push(slot); totalSlots++; }
    }
    result.push(dayRes);
  }

  const labels = new Map((db.prepare('SELECT code, label FROM roles').all() as any[]).map(r => [r.code, r.label]));
  const blockerList = [...blockers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([role, count]) => ({
    role, count, label: role === 'patient' ? 'Patient already has an appointment' : role.split('|').map(r => labels.get(r) ?? r).join(' or '),
  }));
  return { type, requirements: reqs, days: result, firstAvailable: first, blockers: blockerList, scanned };
}

/** Effective available minutes for a resource on a date (working windows minus exceptions). */
export function availableWindows(cal: Calendar, resourceId: number, date: string): Window[] {
  const d0 = dayStart(date), d1 = d0 + DAY;
  return cal.windows(resourceId).filter(w => overlaps(w, { s: d0, e: d1 })).map(w => ({ ...w, s: Math.max(w.s, d0), e: Math.min(w.e, d1) }));
}
