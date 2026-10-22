import { db } from '../db';
import { DAY, addDays, dayStart, nowMin, percentile, toMin, todayStr } from '../lib/time';
import { Calendar, availableWindows } from './availability';

const round5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);

/** Planned vs actual duration per appointment type, from completed visits with real timestamps. */
export function durationAnalysis(days = 60, minSamples = 5) {
  const since = `${addDays(todayStr(), -days)}T00:00`;
  const rows = db.prepare(`SELECT a.type_id, a.actual_start, a.actual_end, a.checked_in_at, a.start_at, t.name, t.duration_min, c.name category, c.icon
    FROM appointments a JOIN appointment_types t ON t.id = a.type_id JOIN categories c ON c.id = t.category_id
    WHERE a.status = 'completed' AND a.actual_start IS NOT NULL AND a.actual_end IS NOT NULL AND a.start_at >= ?`).all(since) as any[];
  const by = new Map<number, any>();
  for (const r of rows) {
    if (!by.has(r.type_id)) by.set(r.type_id, { type_id: r.type_id, name: r.name, category: r.category, icon: r.icon, planned: r.duration_min, durs: [] as number[], waits: [] as number[], late: [] as number[] });
    const g = by.get(r.type_id);
    g.durs.push(toMin(r.actual_end) - toMin(r.actual_start));
    if (r.checked_in_at) g.waits.push(Math.max(0, toMin(r.actual_start) - toMin(r.checked_in_at)));
    g.late.push(toMin(r.actual_start) - toMin(r.start_at));
  }
  return [...by.values()].filter(g => g.durs.length >= minSamples).map(g => {
    const med = percentile(g.durs, 50), p75 = percentile(g.durs, 75), p90 = percentile(g.durs, 90);
    const suggested = round5(p75);
    const over = g.durs.filter((d: number) => d > g.planned).length / g.durs.length;
    return {
      type_id: g.type_id, name: g.name, category: g.category, icon: g.icon, planned: g.planned, samples: g.durs.length,
      median: Math.round(med), p75: Math.round(p75), p90: Math.round(p90), min: Math.min(...g.durs), max: Math.max(...g.durs),
      overrun_rate: Math.round(over * 100), median_wait: Math.round(percentile(g.waits, 50)), median_start_delay: Math.round(percentile(g.late, 50)),
      suggested, action: Math.abs(suggested - g.planned) >= 5 ? (suggested > g.planned ? 'lengthen' : 'shorten') : 'keep',
      histogram: histogram(g.durs, g.planned),
    };
  }).sort((a, b) => Math.abs(b.suggested - b.planned) - Math.abs(a.suggested - a.planned));
}

function histogram(durs: number[], planned: number) {
  const lo = Math.min(...durs, planned), hi = Math.max(...durs, planned);
  const bins = 12; const w = Math.max(1, (hi - lo) / bins);
  const counts = Array(bins).fill(0);
  for (const d of durs) counts[Math.min(bins - 1, Math.floor((d - lo) / w))]++;
  return { lo, hi, width: w, counts };
}

/** Booked vs available minutes per resource for one day. */
export function utilization(date: string, departmentId?: number) {
  const d0 = dayStart(date);
  const cal = new Calendar(d0, d0 + DAY);
  const resources = db.prepare(`SELECT r.id, r.name, r.kind, r.role_code, r.capacity, r.department_id, ro.label role_label, d.name department, d.color
    FROM resources r JOIN roles ro ON ro.code = r.role_code JOIN departments d ON d.id = r.department_id WHERE r.active = 1 ${departmentId ? 'AND r.department_id = ?' : ''}`)
    .all(...(departmentId ? [departmentId] : [])) as any[];
  const out = resources.map(r => {
    const wins = availableWindows(cal, r.id, date);
    const avail = wins.reduce((s, w) => s + (w.e - w.s), 0) * r.capacity;
    const booked = cal.holds(r.id).reduce((s, h) => s + Math.max(0, Math.min(h.e, d0 + DAY) - Math.max(h.s, d0)), 0);
    return { ...r, available_min: avail, booked_min: booked, pct: avail ? Math.min(100, Math.round((booked / avail) * 100)) : 0 };
  });
  const byKind: Record<string, { available: number; booked: number }> = {};
  for (const r of out) {
    byKind[r.kind] ??= { available: 0, booked: 0 };
    byKind[r.kind].available += r.available_min; byKind[r.kind].booked += r.booked_min;
  }
  return { date, resources: out, byKind: Object.entries(byKind).map(([kind, v]) => ({ kind, ...v, pct: v.available ? Math.round((v.booked / v.available) * 100) : 0 })) };
}

export function summary() {
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const statusCounts = db.prepare(`SELECT status, COUNT(*) c FROM appointments WHERE start_at >= ? AND start_at < ? GROUP BY status`).all(`${today}T00:00`, `${tomorrow}T00:00`) as any[];
  const counts: Record<string, number> = {};
  for (const s of statusCounts) counts[s.status] = s.c;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const since = `${addDays(today, -30)}T00:00`;
  const ns = db.prepare(`SELECT SUM(status = 'no_show') ns, SUM(status IN ('completed','no_show')) base FROM appointments WHERE start_at >= ? AND start_at < ?`).get(since, `${today}T00:00`) as any;
  const waits = (db.prepare(`SELECT checked_in_at, actual_start FROM appointments WHERE status IN ('completed','in_progress') AND checked_in_at IS NOT NULL AND actual_start IS NOT NULL AND start_at >= ?`)
    .all(`${addDays(today, -14)}T00:00`) as any[]).map(r => Math.max(0, toMin(r.actual_start) - toMin(r.checked_in_at)));
  const queuePending = (db.prepare(`SELECT COUNT(*) c FROM reschedule_queue WHERE status = 'pending'`).get() as any).c;
  const waitlist = (db.prepare(`SELECT COUNT(*) c FROM waitlist WHERE status IN ('waiting','offered')`).get() as any).c;
  const hourly = db.prepare(`SELECT CAST(substr(start_at, 12, 2) AS INTEGER) h, COUNT(*) c FROM appointments WHERE start_at >= ? AND start_at < ? AND status != 'cancelled' GROUP BY h`)
    .all(`${today}T00:00`, `${tomorrow}T00:00`) as any[];
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourly.find(x => x.h === h)?.c ?? 0 }));
  const mix = db.prepare(`SELECT c.name, c.icon, d.color, COUNT(*) c FROM appointments a JOIN appointment_types t ON t.id = a.type_id JOIN categories c ON c.id = t.category_id
    JOIN departments d ON d.id = c.department_id WHERE a.start_at >= ? AND a.start_at < ? AND a.status != 'cancelled' GROUP BY c.id ORDER BY c DESC`).all(`${today}T00:00`, `${tomorrow}T00:00`);
  const now = nowMin();
  const next = db.prepare(`SELECT a.id, a.ref, a.start_at, a.status, a.priority, a.at_risk, p.full_name patient_name, t.name type_name, c.icon, d.color
    FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN appointment_types t ON t.id = a.type_id JOIN categories c ON c.id = t.category_id JOIN departments d ON d.id = c.department_id
    WHERE a.start_at >= ? AND a.status IN ('booked','confirmed','checked_in') ORDER BY a.start_at LIMIT 8`).all(`${today}T${String(Math.floor((now % DAY) / 60)).padStart(2, '0')}:00`);
  const util = utilization(today);
  const exceptionsToday = db.prepare(`SELECT x.*, r.name resource_name, r.kind FROM resource_exceptions x JOIN resources r ON r.id = x.resource_id
    WHERE x.start_at < ? AND x.end_at > ? ORDER BY x.start_at`).all(`${tomorrow}T00:00`, `${today}T00:00`);
  const busiest = util.resources.filter(r => r.available_min > 0).sort((a, b) => b.pct - a.pct).slice(0, 6);
  return {
    date: today, total, counts, noShowRate: ns.base ? Math.round((ns.ns / ns.base) * 1000) / 10 : 0,
    medianWait: Math.round(percentile(waits, 50)), queuePending, waitlist, hours, mix, next, utilization: util.byKind, busiest, exceptionsToday,
  };
}
