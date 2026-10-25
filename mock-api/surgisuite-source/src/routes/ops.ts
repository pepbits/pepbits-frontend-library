import { Router } from "express";
import { db, audit, now } from "../db.js";
import { HttpError, requireRole } from "../auth.js";
import { body, idParam, required, userOf } from "../lib/http.js";
import { decideApproval } from "./cases.js";

export const opsRouter = Router();

const localDate = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

type MsMap = Record<string, string>;
function milestoneMap(caseIds: number[]): Record<number, MsMap> {
  if (!caseIds.length) return {};
  const rows = db.prepare(`SELECT case_id, code, ts FROM case_milestones WHERE case_id IN (${caseIds.map(() => "?").join(",")})`).all(...caseIds) as { case_id: number; code: string; ts: string }[];
  const out: Record<number, MsMap> = {};
  rows.forEach((r) => ((out[r.case_id] ??= {})[r.code] = r.ts));
  return out;
}
const mins = (a?: string, b?: string) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : null);

// ---------- Live board ----------
opsRouter.get("/dashboard", (req, res) => {
  const today = String(req.query.date ?? localDate());
  const theatres = db.prepare(`SELECT * FROM theatres ORDER BY code`).all() as Record<string, any>[];
  const cases = db.prepare(
    `SELECT c.id, c.case_no, c.theatre_id, c.scheduled_start, c.est_duration_min, c.status, c.case_class, c.asa_class, c.delay_reason,
            p.name patient_name, p.mrn, p.allergies, pr.name procedure_name, pr.cpt, pr.specialty,
            (SELECT s.name FROM case_team ct JOIN staff s ON s.id = ct.staff_id WHERE ct.case_id = c.id AND ct.role = 'Primary Surgeon' LIMIT 1) surgeon,
            (SELECT s.name FROM case_team ct JOIN staff s ON s.id = ct.staff_id WHERE ct.case_id = c.id AND ct.role = 'Anesthesiologist' LIMIT 1) anesthesiologist
     FROM cases c JOIN patients p ON p.id = c.patient_id
     LEFT JOIN case_procedures cp ON cp.case_id = c.id AND cp.role = 'Primary' LEFT JOIN procedures pr ON pr.id = cp.procedure_id
     WHERE date(c.scheduled_start, 'localtime') = ?
        OR c.status IN ('CHECKED_IN','IN_OR','IN_SURGERY')
        OR (c.status IN ('RECOVERY','COMPLETED') AND datetime(c.scheduled_start) >= datetime('now','-18 hours')
            AND NOT EXISTS (SELECT 1 FROM case_milestones m WHERE m.case_id = c.id AND m.code = 'ROOM_READY'))
     GROUP BY c.id ORDER BY c.scheduled_start`,
  ).all(today) as Record<string, any>[];
  const ms = milestoneMap(cases.map((c) => c.id));
  cases.forEach((c) => (c.milestones = ms[c.id] ?? {}));

  const board = theatres.map((t) => {
    const list = cases.filter((c) => c.theatre_id === t.id && c.status !== "CANCELLED");
    const current = list.find((c) => ["IN_OR", "IN_SURGERY"].includes(c.status));
    const turnover = !current ? list.filter((c) => c.milestones.OUT_OF_ROOM && !c.milestones.ROOM_READY).pop() : undefined;
    const next = list.find((c) => ["SCHEDULED", "PENDING_APPROVAL", "CHECKED_IN", "REQUESTED"].includes(c.status) && c !== current);
    const state = t.status === "Maintenance" ? "Maintenance" : current ? (current.status === "IN_SURGERY" ? "Surgery" : "Anesthesia") : turnover ? "Turnover" : "Idle";
    return {
      ...t, state, current: current ?? null, turnover: turnover ?? null, next: next ?? null,
      done: list.filter((c) => c.status === "COMPLETED" || c.status === "RECOVERY").length, total: list.length,
      timeline: list.map((c) => ({ id: c.id, case_no: c.case_no, start: c.scheduled_start, est: c.est_duration_min, status: c.status, procedure: c.procedure_name, inRoom: c.milestones.IN_ROOM ?? null, outRoom: c.milestones.OUT_OF_ROOM ?? null })),
    };
  });

  // KPIs
  const active = cases.filter((c) => c.status !== "CANCELLED");
  const firstCases = theatres.map((t) => active.find((c) => c.theatre_id === t.id)).filter(Boolean) as Record<string, any>[];
  const firstStarted = firstCases.filter((c) => c.milestones.IN_ROOM);
  const onTime = firstStarted.filter((c) => (mins(c.scheduled_start, c.milestones.IN_ROOM) ?? 99) <= 5).length;
  const turnovers: number[] = [];
  theatres.forEach((t) => {
    const l = active.filter((c) => c.theatre_id === t.id);
    for (let i = 1; i < l.length; i++) {
      const m = mins(l[i - 1].milestones.OUT_OF_ROOM, l[i].milestones.IN_ROOM);
      if (m !== null && m > 0 && m < 240) turnovers.push(m);
    }
  });
  const pendingApprovals = (db.prepare(`SELECT COUNT(*) n FROM approvals a JOIN cases c ON c.id = a.case_id WHERE a.status = 'Pending' AND a.required = 1 AND c.status NOT IN ('CANCELLED','COMPLETED')`).get() as { n: number }).n;
  const lowStock = (db.prepare(`SELECT COUNT(*) n FROM inventory_items WHERE stock_qty - reserved_qty <= reorder_level`).get() as { n: number }).n;
  const expiring = (db.prepare(`SELECT COUNT(*) n FROM inventory_items WHERE expiry IS NOT NULL AND expiry <= date('now', '+45 day')`).get() as { n: number }).n;
  const equipmentDown = db.prepare(`SELECT code, name, status FROM equipment WHERE status != 'Ready'`).all();
  const alerts = db.prepare(
    `SELECT e.id, e.ts, e.kind, e.text, e.severity, c.id case_id, c.case_no, t.code theatre_code FROM case_events e JOIN cases c ON c.id = e.case_id LEFT JOIN theatres t ON t.id = c.theatre_id
     WHERE e.severity IN ('critical','warning') AND datetime(e.ts) >= datetime('now', '-24 hours') ORDER BY e.ts DESC LIMIT 12`,
  ).all();

  res.json({
    date: today,
    board,
    kpis: {
      total: active.length,
      completed: active.filter((c) => c.status === "COMPLETED").length,
      inProgress: active.filter((c) => ["IN_OR", "IN_SURGERY"].includes(c.status)).length,
      recovery: active.filter((c) => c.status === "RECOVERY").length,
      upcoming: active.filter((c) => ["SCHEDULED", "PENDING_APPROVAL", "CHECKED_IN", "REQUESTED"].includes(c.status)).length,
      cancelled: cases.length - active.length,
      onTimeStart: firstStarted.length ? Math.round((onTime / firstStarted.length) * 100) : null,
      avgTurnover: turnovers.length ? Math.round(turnovers.reduce((a, b) => a + b, 0) / turnovers.length) : null,
      pendingApprovals, lowStock, expiring,
    },
    equipmentDown,
    alerts,
  });
});

// ---------- Analytics ----------
opsRouter.get("/analytics", (req, res) => {
  const to = String(req.query.to ?? localDate());
  const from = String(req.query.from ?? localDate(new Date(Date.now() - 21 * 86400000)));
  const cases = db.prepare(
    `SELECT c.*, pr.specialty, pr.cpt, pr.name procedure_name, pr.default_duration_min, t.code theatre_code,
       (SELECT s.name FROM case_team ct JOIN staff s ON s.id = ct.staff_id WHERE ct.case_id = c.id AND ct.role = 'Primary Surgeon' LIMIT 1) surgeon
     FROM cases c LEFT JOIN case_procedures cp ON cp.case_id = c.id AND cp.role = 'Primary' LEFT JOIN procedures pr ON pr.id = cp.procedure_id
     LEFT JOIN theatres t ON t.id = c.theatre_id
     WHERE date(c.scheduled_start, 'localtime') BETWEEN ? AND ? GROUP BY c.id ORDER BY c.scheduled_start`,
  ).all(from, to) as Record<string, any>[];
  const ms = milestoneMap(cases.map((c) => c.id));
  const completed = cases.filter((c) => c.status === "COMPLETED");
  const cancelled = cases.filter((c) => c.status === "CANCELLED");
  const dayKey = (iso: string) => localDate(new Date(iso));

  // first-case on-time & turnover & utilization
  const groups: Record<string, Record<string, any>[]> = {};
  cases.filter((c) => c.status !== "CANCELLED").forEach((c) => (groups[`${c.theatre_code}|${dayKey(c.scheduled_start)}`] ??= []).push(c));
  let firstTotal = 0, firstOnTime = 0;
  const turnovers: number[] = [];
  const util: Record<string, { used: number; days: Set<string> }> = {};
  for (const [key, list] of Object.entries(groups)) {
    const [theatre, day] = key.split("|");
    const f = list[0];
    if (ms[f.id]?.IN_ROOM) { firstTotal++; if ((mins(f.scheduled_start, ms[f.id].IN_ROOM) ?? 99) <= 5) firstOnTime++; }
    for (let i = 1; i < list.length; i++) {
      const m = mins(ms[list[i - 1].id]?.OUT_OF_ROOM, ms[list[i].id]?.IN_ROOM);
      if (m !== null && m > 0 && m < 240) turnovers.push(m);
    }
    const u = (util[theatre] ??= { used: 0, days: new Set() });
    u.days.add(day);
    list.forEach((c) => (u.used += Math.max(0, mins(ms[c.id]?.IN_ROOM, ms[c.id]?.OUT_OF_ROOM) ?? 0)));
  }
  const utilization = Object.entries(util).map(([theatre, u]) => ({ theatre, pct: Math.round((u.used / (u.days.size * 600)) * 100), hours: Math.round(u.used / 6) / 10 })).sort((a, b) => a.theatre.localeCompare(b.theatre));

  const bySpec: Record<string, { cases: number; actual: number[]; est: number[]; revenue: number }> = {};
  completed.forEach((c) => {
    const s = (bySpec[c.specialty ?? "Other"] ??= { cases: 0, actual: [], est: [], revenue: 0 });
    s.cases++;
    const d = mins(ms[c.id]?.INCISION, ms[c.id]?.CLOSURE_END);
    if (d !== null) { s.actual.push(d); s.est.push(c.default_duration_min); }
  });
  const fees = db.prepare(
    `SELECT pr.specialty, SUM(pr.fee) fee FROM case_procedures cp JOIN procedures pr ON pr.id = cp.procedure_id JOIN cases c ON c.id = cp.case_id
     WHERE cp.performed = 1 AND c.status = 'COMPLETED' AND date(c.scheduled_start, 'localtime') BETWEEN ? AND ? GROUP BY pr.specialty`,
  ).all(from, to) as { specialty: string; fee: number }[];
  fees.forEach((f) => { if (bySpec[f.specialty]) bySpec[f.specialty].revenue = Math.round(f.fee); });
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const specialties = Object.entries(bySpec).map(([specialty, s]) => ({ specialty, cases: s.cases, avgActual: avg(s.actual), avgPlanned: avg(s.est), revenue: s.revenue })).sort((a, b) => b.cases - a.cases);

  const countBy = (arr: Record<string, any>[], key: string) => {
    const o: Record<string, number> = {};
    arr.forEach((c) => c[key] && (o[c[key]] = (o[c[key]] ?? 0) + 1));
    return Object.entries(o).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  };

  const daily: Record<string, { completed: number; cancelled: number }> = {};
  cases.forEach((c) => {
    const d = (daily[dayKey(c.scheduled_start)] ??= { completed: 0, cancelled: 0 });
    if (c.status === "COMPLETED") d.completed++;
    if (c.status === "CANCELLED") d.cancelled++;
  });

  const scoreRows = db.prepare(
    `SELECT s.kind, s.band, COUNT(*) n FROM scores s JOIN cases c ON c.id = s.case_id WHERE date(c.scheduled_start, 'localtime') BETWEEN ? AND ? AND s.kind IN ('SURGICAL_APGAR','NNIS') GROUP BY s.kind, s.band`,
  ).all(from, to) as { kind: string; band: string; n: number }[];

  const surgeons: Record<string, { cases: number; dur: number[]; onTime: number; starts: number }> = {};
  completed.forEach((c) => {
    if (!c.surgeon) return;
    const s = (surgeons[c.surgeon] ??= { cases: 0, dur: [], onTime: 0, starts: 0 });
    s.cases++;
    const d = mins(ms[c.id]?.IN_ROOM, ms[c.id]?.OUT_OF_ROOM);
    if (d !== null) s.dur.push(d);
    if (ms[c.id]?.IN_ROOM) { s.starts++; if ((mins(c.scheduled_start, ms[c.id].IN_ROOM) ?? 99) <= 10) s.onTime++; }
  });

  const implantSpend = (db.prepare(
    `SELECT COALESCE(SUM(ci.qty_used * i.unit_cost),0) v FROM case_items ci JOIN inventory_items i ON i.id = ci.item_id JOIN cases c ON c.id = ci.case_id
     WHERE i.is_implant = 1 AND date(c.scheduled_start, 'localtime') BETWEEN ? AND ?`,
  ).get(from, to) as { v: number }).v;
  const reportsSigned = (db.prepare(
    `SELECT SUM(r.status = 'Signed') signed, COUNT(*) total FROM reports r JOIN cases c ON c.id = r.case_id WHERE c.status = 'COMPLETED' AND date(c.scheduled_start, 'localtime') BETWEEN ? AND ?`,
  ).get(from, to) as { signed: number; total: number });

  res.json({
    from, to,
    totals: {
      cases: cases.length, completed: completed.length, cancelled: cancelled.length,
      cancellationRate: cases.length ? Math.round((cancelled.length / cases.length) * 1000) / 10 : 0,
      onTimeStart: firstTotal ? Math.round((firstOnTime / firstTotal) * 100) : null,
      avgTurnover: avg(turnovers), implantSpend: Math.round(implantSpend),
      reportCompletion: reportsSigned.total ? Math.round((reportsSigned.signed / reportsSigned.total) * 100) : null,
    },
    utilization, specialties,
    delayReasons: countBy(cases, "delay_reason"),
    cancelReasons: countBy(cancelled, "cancel_reason"),
    daily: Object.entries(daily).map(([date, v]) => ({ date, ...v })),
    scores: scoreRows,
    surgeons: Object.entries(surgeons).map(([name, s]) => ({ name, cases: s.cases, avgRoomMin: avg(s.dur), onTimePct: s.starts ? Math.round((s.onTime / s.starts) * 100) : null })).sort((a, b) => b.cases - a.cases),
  });
});

// ---------- Approvals queue ----------
opsRouter.get("/approvals", (req, res) => {
  const status = String(req.query.status ?? "Pending");
  res.json(
    db.prepare(
      `SELECT a.*, c.case_no, c.scheduled_start, c.case_class, c.status case_status, p.name patient_name, p.mrn, p.insurer, p.policy_no,
              pr.cpt, pr.name procedure_name, r.name requested_by_name, ap.name approver_name,
              (SELECT s.name FROM case_team ct JOIN staff s ON s.id = ct.staff_id WHERE ct.case_id = c.id AND ct.role = 'Primary Surgeon' LIMIT 1) surgeon
       FROM approvals a JOIN cases c ON c.id = a.case_id JOIN patients p ON p.id = c.patient_id
       LEFT JOIN case_procedures cp ON cp.case_id = c.id AND cp.role = 'Primary' LEFT JOIN procedures pr ON pr.id = cp.procedure_id
       LEFT JOIN staff r ON r.id = a.requested_by LEFT JOIN staff ap ON ap.id = a.approver_id
       WHERE (? = 'All' OR a.status = ?) AND c.status != 'CANCELLED' GROUP BY a.id ORDER BY c.scheduled_start LIMIT 300`,
    ).all(status, status),
  );
});

opsRouter.post("/approvals/:aid/decide", (req, res) => res.json(decideApproval(req)));

// ---------- Inventory ----------
opsRouter.get("/inventory", (req, res) => {
  const q = `%${String(req.query.q ?? "")}%`;
  const cat = String(req.query.category ?? "");
  const flag = String(req.query.flag ?? "");
  const rows = db.prepare(
    `SELECT i.*, (i.stock_qty - i.reserved_qty) available,
       (SELECT COALESCE(SUM(ci.qty_used),0) FROM case_items ci JOIN cases c ON c.id = ci.case_id WHERE ci.item_id = i.id AND datetime(c.scheduled_start) >= datetime('now','-30 day')) used_30d
     FROM inventory_items i WHERE (i.name LIKE ? OR i.sku LIKE ? OR i.vendor LIKE ?) AND (? = '' OR i.category = ?)
     ${flag === "low" ? "AND i.stock_qty - i.reserved_qty <= i.reorder_level" : ""}
     ${flag === "expiring" ? "AND i.expiry IS NOT NULL AND i.expiry <= date('now','+45 day')" : ""}
     ${flag === "cssd" ? "AND i.category = 'Instrument tray' AND i.sterile_status != 'Sterile'" : ""}
     ORDER BY i.category, i.name`,
  ).all(q, q, q, cat, cat);
  res.json(rows);
});

opsRouter.post("/inventory/:id/receive", (req, res) => {
  requireRole(req, ["ADMIN", "OT_COORDINATOR", "SCRUB_NURSE", "CIRCULATING_NURSE"], "receive stock");
  const id = idParam(req);
  const b = body(req);
  const qty = Number(required(b.qty, "Quantity"));
  if (!(qty > 0 && qty <= 10000)) throw new HttpError(400, "Quantity must be between 1 and 10,000.");
  if (b.expiry && b.expiry <= new Date().toISOString().slice(0, 10)) throw new HttpError(400, "That lot is already expired.");
  db.prepare(`UPDATE inventory_items SET stock_qty = stock_qty + ?, lot_no = COALESCE(?, lot_no), expiry = COALESCE(?, expiry) WHERE id = ?`).run(qty, b.lotNo || null, b.expiry || null, id);
  audit(userOf(req).id, "inventory", id, "received", { qty, lot: b.lotNo, expiry: b.expiry });
  res.json({ ok: true });
});

opsRouter.patch("/inventory/:id", (req, res) => {
  requireRole(req, ["ADMIN", "OT_COORDINATOR", "SCRUB_NURSE", "CIRCULATING_NURSE"], "update inventory");
  const id = idParam(req);
  const b = body(req);
  if (b.sterile_status) db.prepare(`UPDATE inventory_items SET sterile_status = ? WHERE id = ?`).run(String(b.sterile_status), id);
  if (b.reorder_level !== undefined) db.prepare(`UPDATE inventory_items SET reorder_level = ? WHERE id = ?`).run(Number(b.reorder_level), id);
  audit(userOf(req).id, "inventory", id, "updated", b);
  res.json({ ok: true });
});

opsRouter.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ cases: [], patients: [] });
  const like = `%${q}%`;
  res.json({
    cases: db.prepare(
      `SELECT c.id, c.case_no, c.status, c.scheduled_start, p.name patient_name, pr.name procedure_name FROM cases c JOIN patients p ON p.id = c.patient_id
       LEFT JOIN case_procedures cp ON cp.case_id = c.id AND cp.role = 'Primary' LEFT JOIN procedures pr ON pr.id = cp.procedure_id
       WHERE c.case_no LIKE ? OR p.name LIKE ? OR p.mrn LIKE ? GROUP BY c.id ORDER BY abs(julianday(c.scheduled_start) - julianday('now')) LIMIT 8`,
    ).all(like, like, like),
    patients: db.prepare(`SELECT id, name, mrn, dob FROM patients WHERE name LIKE ? OR mrn LIKE ? LIMIT 5`).all(like, like),
  });
});

opsRouter.get("/health", (_req, res) => res.json({ ok: true, ts: now() }));
