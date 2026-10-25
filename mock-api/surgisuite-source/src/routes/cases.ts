import { Router, type Request } from "express";
import { db, audit, now } from "../db.js";
import { HttpError, requireRole, signatureHash, verifySigner } from "../auth.js";
import { body, idParam, optNum, required, userOf } from "../lib/http.js";
import {
  MILESTONES, assertCanEdit, blockingApprovals, checklistComplete, countsReconciled, findConflicts,
  milestoneBlockers, missingConsents, nextCaseNo, refreshApprovalStatus, seedCaseScaffold,
} from "../lib/workflow.js";
import { aldrete, nnis, rcri, surgicalApgar } from "../lib/scores.js";
import { buildClaim } from "../lib/billing.js";

export const casesRouter = Router();

type CaseRow = Record<string, any> & { id: number; status: string; case_class: string; case_no: string };

function getCase(id: number): CaseRow {
  const c = db.prepare(`SELECT * FROM cases WHERE id = ?`).get(id) as CaseRow | undefined;
  if (!c) throw new HttpError(404, "Case not found.");
  return c;
}

function event(caseId: number, kind: string, text: string, staffId: number | null, severity = "info") {
  db.prepare(`INSERT INTO case_events (case_id, ts, kind, text, severity, staff_id) VALUES (?,?,?,?,?,?)`).run(caseId, now(), kind, text, severity, staffId);
}

function touch(caseId: number) {
  db.prepare(`UPDATE cases SET updated_at = ? WHERE id = ?`).run(now(), caseId);
}

/** Documentation stays editable until the operative report is signed. */
function lockedAfterSurgery(c: CaseRow) {
  if (c.status === "CANCELLED") throw new HttpError(409, "This case is cancelled and read-only.");
  const r = db.prepare(`SELECT status FROM reports WHERE case_id = ?`).get(c.id) as { status: string } | undefined;
  if (r?.status === "Signed") throw new HttpError(409, "The operative report is signed, so case documentation is locked. Start an amendment to change it.");
}

// ---------- List ----------
casesRouter.get("/", (req, res) => {
  const { date, from, to, status, theatre, q, surgeon } = req.query as Record<string, string | undefined>;
  const where: string[] = [];
  const args: unknown[] = [];
  if (date) { where.push(`date(c.scheduled_start, 'localtime') = ?`); args.push(date); }
  if (from) { where.push(`date(c.scheduled_start, 'localtime') >= ?`); args.push(from); }
  if (to) { where.push(`date(c.scheduled_start, 'localtime') <= ?`); args.push(to); }
  if (status) { where.push(`c.status IN (${status.split(",").map(() => "?").join(",")})`); args.push(...status.split(",")); }
  if (theatre) { where.push(`c.theatre_id = ?`); args.push(Number(theatre)); }
  if (surgeon) { where.push(`EXISTS (SELECT 1 FROM case_team t WHERE t.case_id = c.id AND t.staff_id = ?)`); args.push(Number(surgeon)); }
  if (q) { where.push(`(p.name LIKE ? OR p.mrn LIKE ? OR c.case_no LIKE ? OR pr.name LIKE ? OR pr.cpt LIKE ?)`); args.push(...Array(5).fill(`%${q}%`)); }
  const rows = db.prepare(
    `SELECT c.id, c.case_no, c.scheduled_start, c.est_duration_min, c.status, c.case_class, c.op_type, c.asa_class, c.laterality, c.anesthesia_type,
            p.id patient_id, p.name patient_name, p.mrn, p.sex, p.dob, p.allergies,
            t.id theatre_id, t.code theatre_code, t.name theatre_name,
            pr.cpt, pr.name procedure_name, pr.specialty,
            (SELECT s.name FROM case_team ct JOIN staff s ON s.id = ct.staff_id WHERE ct.case_id = c.id AND ct.role = 'Primary Surgeon' LIMIT 1) surgeon,
            (SELECT s.name FROM case_team ct JOIN staff s ON s.id = ct.staff_id WHERE ct.case_id = c.id AND ct.role = 'Anesthesiologist' LIMIT 1) anesthesiologist,
            (SELECT COUNT(*) FROM case_procedures x WHERE x.case_id = c.id) procedure_count,
            (SELECT code FROM case_milestones m WHERE m.case_id = c.id ORDER BY m.ts DESC LIMIT 1) last_milestone,
            (SELECT ts FROM case_milestones m WHERE m.case_id = c.id AND m.code = 'IN_ROOM') in_room,
            (SELECT ts FROM case_milestones m WHERE m.case_id = c.id AND m.code = 'INCISION') incision,
            (SELECT ts FROM case_milestones m WHERE m.case_id = c.id AND m.code = 'OUT_OF_ROOM') out_of_room,
            (SELECT COUNT(*) FROM approvals a WHERE a.case_id = c.id AND a.status = 'Pending' AND a.required = 1) pending_approvals
     FROM cases c JOIN patients p ON p.id = c.patient_id LEFT JOIN theatres t ON t.id = c.theatre_id
     LEFT JOIN case_procedures cp ON cp.case_id = c.id AND cp.role = 'Primary' LEFT JOIN procedures pr ON pr.id = cp.procedure_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     GROUP BY c.id ORDER BY c.scheduled_start ${from || to || date ? "ASC" : "DESC"} LIMIT 500`,
  ).all(...args);
  res.json(rows);
});

// ---------- Conflicts ----------
casesRouter.post("/check-conflicts", (req, res) => {
  const b = body(req);
  res.json(
    findConflicts({
      start: String(required(b.scheduledStart, "Start time")), durationMin: Number(b.estDurationMin ?? 60), theatreId: b.theatreId,
      staffIds: b.staffIds ?? [], equipmentIds: b.equipmentIds ?? [], excludeCaseId: b.excludeCaseId,
    }),
  );
});

// ---------- Create ----------
casesRouter.post("/", (req, res) => {
  requireRole(req, ["SURGEON", "OT_COORDINATOR", "ASSISTANT_SURGEON"], "book cases");
  const b = body(req);
  const user = userOf(req);
  const patientId = Number(required(b.patientId, "Patient"));
  const procedures = (b.procedures ?? []) as { procedureId: number; role?: string; surgeonId?: number; approach?: string; laterality?: string; modifiers?: string }[];
  const diagnoses = (b.diagnoses ?? []) as { diagnosisId: number; isPrimary?: boolean }[];
  const team = (b.team ?? []) as { staffId: number; role: string }[];
  const equipmentIds = (b.equipmentIds ?? []) as number[];
  if (!procedures.length) throw new HttpError(400, "Add at least one procedure.");
  if (!procedures.some((p) => (p.role ?? "Primary") === "Primary")) throw new HttpError(400, "One procedure must be marked primary.");
  if (!diagnoses.length) throw new HttpError(400, "Add at least one diagnosis.");
  if (!team.some((t) => t.role === "Primary Surgeon")) throw new HttpError(400, "Assign a primary surgeon.");
  const start = String(required(b.scheduledStart, "Start time"));
  if (Number.isNaN(Date.parse(start))) throw new HttpError(400, "Start time is not a valid date.");
  const theatreId = Number(required(b.theatreId, "Theatre"));

  const procRows = procedures.map((p) => {
    const row = db.prepare(`SELECT * FROM procedures WHERE id = ?`).get(p.procedureId) as Record<string, any> | undefined;
    if (!row) throw new HttpError(400, `Procedure ${p.procedureId} not found.`);
    return row;
  });
  const primary = procRows[procedures.findIndex((p) => (p.role ?? "Primary") === "Primary")];
  const est = Number(b.estDurationMin ?? procRows.reduce((a, p) => a + p.default_duration_min, 0) + 35);
  const caseClass = String(b.caseClass ?? "Elective");

  const conflicts = findConflicts({ start, durationMin: est, theatreId, staffIds: team.map((t) => t.staffId), equipmentIds });
  if (conflicts.length && !b.force) throw new HttpError(409, "The booking overlaps other cases.", { conflicts });

  const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(patientId) as Record<string, any> | undefined;
  if (!patient) throw new HttpError(400, "Patient not found.");
  const ts = now();
  const caseId = db.transaction(() => {
    const r = db.prepare(
      `INSERT INTO cases (case_no, patient_id, theatre_id, scheduled_start, est_duration_min, case_class, op_type, anesthesia_type, position, laterality, wound_class, asa_class, status, notes, rcri, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'REQUESTED',?,'{}',?,?,?)`,
    ).run(
      nextCaseNo(), patientId, theatreId, new Date(start).toISOString(), est, caseClass, b.opType ?? primary.op_type,
      b.anesthesiaType ?? null, b.position ?? null, b.laterality ?? "N/A", b.woundClass ?? primary.wound_class, b.asaClass ?? "II", b.notes ?? null, user.id, ts, ts,
    );
    const id = Number(r.lastInsertRowid);
    const insP = db.prepare(`INSERT INTO case_procedures (case_id, procedure_id, role, surgeon_id, approach, laterality, modifiers, sort) VALUES (?,?,?,?,?,?,?,?)`);
    const surgeonId = team.find((t) => t.role === "Primary Surgeon")!.staffId;
    procedures.forEach((p, i) => insP.run(id, p.procedureId, p.role ?? (i === 0 ? "Primary" : "Secondary"), p.surgeonId ?? surgeonId, p.approach ?? procRows[i].default_approach, p.laterality ?? b.laterality ?? "N/A", p.modifiers ?? "", i));
    const insD = db.prepare(`INSERT OR IGNORE INTO case_diagnoses (case_id, diagnosis_id, is_primary) VALUES (?,?,?)`);
    const hasPrimaryDx = diagnoses.some((d) => d.isPrimary);
    diagnoses.forEach((d, i) => insD.run(id, d.diagnosisId, d.isPrimary || (!hasPrimaryDx && i === 0) ? 1 : 0));
    const insT = db.prepare(`INSERT INTO case_team (case_id, staff_id, role) VALUES (?,?,?)`);
    team.forEach((t) => insT.run(id, t.staffId, t.role));
    const insE = db.prepare(`INSERT OR IGNORE INTO case_equipment (case_id, equipment_id) VALUES (?,?)`);
    equipmentIds.forEach((e) => insE.run(id, e));
    // Preference card → pick list + stock reservation
    const pref = db.prepare(
      `SELECT item_id, SUM(qty) qty FROM preference_items WHERE procedure_id IN (${procedures.map(() => "?").join(",")}) GROUP BY item_id`,
    ).all(...procedures.map((p) => p.procedureId)) as { item_id: number; qty: number }[];
    const insI = db.prepare(`INSERT INTO case_items (case_id, item_id, qty_planned) VALUES (?,?,?)`);
    pref.forEach((p) => {
      insI.run(id, p.item_id, p.qty);
      db.prepare(`UPDATE inventory_items SET reserved_qty = reserved_qty + ? WHERE id = ?`).run(p.qty, p.item_id);
    });
    seedCaseScaffold(id);
    // Approvals
    const insA = db.prepare(`INSERT INTO approvals (case_id, kind, required, requested_by, requested_at, remarks) VALUES (?,?,?,?,?,?)`);
    if (patient.insurer) insA.run(id, "PRE_AUTH", caseClass === "Emergency" ? 0 : 1, user.id, ts, caseClass === "Emergency" ? "Emergency: retrospective authorization" : null);
    insA.run(id, "ANESTHESIA_FITNESS", caseClass === "Emergency" ? 0 : 1, user.id, ts, null);
    const highCostImplant = db.prepare(
      `SELECT 1 FROM preference_items pi JOIN inventory_items i ON i.id = pi.item_id WHERE pi.procedure_id IN (${procedures.map(() => "?").join(",")}) AND i.is_implant = 1 AND i.unit_cost > 1000 LIMIT 1`,
    ).get(...procedures.map((p) => p.procedureId));
    if (highCostImplant) insA.run(id, "HIGH_COST_IMPLANT", 1, user.id, ts, null);
    if (procRows.some((p) => p.high_risk) && primary.op_type === "Major") insA.run(id, "HOD_APPROVAL", caseClass === "Emergency" ? 0 : 1, user.id, ts, null);
    if (conflicts.length) event(id, "conflict", `Booked despite overlap: ${conflicts.map((c) => c.message).join(" ")}`, user.id, "warning");
    event(id, "created", `Case booked for ${new Date(start).toLocaleString()}.`, user.id);
    audit(user.id, "case", id, "created", { procedures: procedures.map((p) => p.procedureId), conflictsOverridden: conflicts.length }, id);
    return id;
  })();
  refreshApprovalStatus(caseId);
  res.status(201).json({ id: caseId, case_no: getCase(caseId).case_no });
});

// ---------- Full bundle ----------
casesRouter.get("/:id", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(c.patient_id);
  const theatre = db.prepare(`SELECT * FROM theatres WHERE id = ?`).get(c.theatre_id);
  const diagnoses = db.prepare(`SELECT cd.id, cd.is_primary, d.id diagnosis_id, d.icd10, d.description, d.category FROM case_diagnoses cd JOIN diagnoses d ON d.id = cd.diagnosis_id WHERE cd.case_id = ? ORDER BY cd.is_primary DESC`).all(id);
  const procedures = db.prepare(
    `SELECT cp.*, p.cpt, p.name, p.specialty, p.op_type, p.fee, p.is_addon, p.default_duration_min, s.name surgeon_name,
       (SELECT COUNT(*) FROM procedure_diagnoses pd JOIN case_diagnoses cd ON cd.diagnosis_id = pd.diagnosis_id AND cd.case_id = cp.case_id WHERE pd.procedure_id = cp.procedure_id) linked_dx,
       (SELECT COUNT(*) FROM procedure_diagnoses pd WHERE pd.procedure_id = cp.procedure_id) mapped_dx
     FROM case_procedures cp JOIN procedures p ON p.id = cp.procedure_id LEFT JOIN staff s ON s.id = cp.surgeon_id WHERE cp.case_id = ? ORDER BY cp.sort`,
  ).all(id);
  const team = db.prepare(`SELECT ct.*, s.name, s.emp_code, s.title, s.role staff_role FROM case_team ct JOIN staff s ON s.id = ct.staff_id WHERE ct.case_id = ? ORDER BY ct.id`).all(id);
  const equipment = db.prepare(`SELECT e.* FROM case_equipment ce JOIN equipment e ON e.id = ce.equipment_id WHERE ce.case_id = ?`).all(id);
  const milestones = db.prepare(`SELECT m.code, m.ts, s.name recorded_by FROM case_milestones m LEFT JOIN staff s ON s.id = m.recorded_by WHERE m.case_id = ?`).all(id);
  const checklist = db.prepare(`SELECT ci.*, s.name checked_by_name FROM checklist_items ci LEFT JOIN staff s ON s.id = ci.checked_by WHERE ci.case_id = ? ORDER BY ci.phase, ci.sort`).all(id);
  const counts = db.prepare(`SELECT c.*, v.name verified_by_name, w.name witness_name FROM counts c LEFT JOIN staff v ON v.id = c.verified_by LEFT JOIN staff w ON w.id = c.witness_id WHERE c.case_id = ? ORDER BY c.id`).all(id);
  const vitals = db.prepare(`SELECT * FROM anesthesia_vitals WHERE case_id = ? ORDER BY ts`).all(id);
  const meds = db.prepare(`SELECT m.*, s.name given_by_name FROM anesthesia_meds m LEFT JOIN staff s ON s.id = m.given_by WHERE m.case_id = ? ORDER BY ts`).all(id);
  const events = db.prepare(`SELECT e.*, s.name staff_name FROM case_events e LEFT JOIN staff s ON s.id = e.staff_id WHERE e.case_id = ? ORDER BY ts DESC`).all(id);
  const orders = db.prepare(`SELECT o.*, s.name ordered_by_name FROM case_orders o LEFT JOIN staff s ON s.id = o.ordered_by WHERE o.case_id = ? ORDER BY ordered_at DESC`).all(id);
  const items = db.prepare(
    `SELECT ci.*, i.sku, i.name, i.category, i.uom, i.unit_cost, i.is_implant, i.stock_qty, i.sterile_status, i.expiry FROM case_items ci JOIN inventory_items i ON i.id = ci.item_id WHERE ci.case_id = ? ORDER BY i.category, i.name`,
  ).all(id);
  const approvals = db.prepare(
    `SELECT a.*, r.name requested_by_name, ap.name approver_name, w.name witness_name FROM approvals a LEFT JOIN staff r ON r.id = a.requested_by
     LEFT JOIN staff ap ON ap.id = a.approver_id LEFT JOIN staff w ON w.id = a.witness_id WHERE a.case_id = ? ORDER BY a.id`,
  ).all(id);
  const consents = db.prepare(`SELECT c.*, o.name obtained_by_name, w.name witness_name FROM consents c LEFT JOIN staff o ON o.id = c.obtained_by LEFT JOIN staff w ON w.id = c.witness_id WHERE c.case_id = ? ORDER BY ts`).all(id);
  const scores = db.prepare(`SELECT sc.*, s.name recorded_by_name FROM scores sc LEFT JOIN staff s ON s.id = sc.recorded_by WHERE sc.case_id = ? ORDER BY ts DESC`).all(id);
  const report = db.prepare(
    `SELECT r.*, s.name signed_by_name, cs.name cosigned_by_name, w.name witness_name FROM reports r LEFT JOIN staff s ON s.id = r.signed_by
     LEFT JOIN staff cs ON cs.id = r.cosigned_by LEFT JOIN staff w ON w.id = r.witness_id WHERE r.case_id = ?`,
  ).get(id);
  const done = new Set((milestones as { code: string }[]).map((m) => m.code));
  const nextMilestones = MILESTONES.filter((m) => !done.has(m.code) && (!m.requires || done.has(m.requires))).map((m) => ({
    ...m, blockers: milestoneBlockers(c, m.code),
  }));
  const readiness = {
    approvals: blockingApprovals(id),
    consents: missingConsents(id),
    signIn: checklistComplete(id, "SIGN_IN"),
    timeOut: checklistComplete(id, "TIME_OUT"),
    signOut: checklistComplete(id, "SIGN_OUT"),
    counts: countsReconciled(id),
    sterileTraysPending: (items as { category: string; sterile_status: string }[]).filter((i) => i.category === "Instrument tray" && i.sterile_status !== "Sterile").length,
    stockShort: (items as { qty_planned: number; stock_qty: number; consumed: number; name: string }[]).filter((i) => !i.consumed && i.qty_planned > i.stock_qty).map((i) => i.name),
  };
  res.json({
    ...c, rcri: JSON.parse(c.rcri || "{}"), patient, theatre, diagnoses, procedures, team, equipment, milestones, checklist, counts,
    vitals, meds, events, orders, items, approvals, consents, scores, report, nextMilestones, readiness,
    milestoneDefs: MILESTONES,
  });
});

// ---------- Update header / reschedule ----------
casesRouter.patch("/:id", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  assertCanEdit(c);
  const b = body(req);
  const user = userOf(req);
  const fields = ["theatre_id", "scheduled_start", "est_duration_min", "case_class", "op_type", "anesthesia_type", "position", "laterality", "wound_class", "asa_class", "notes", "ebl_ml", "delay_reason"];
  const updates = fields.filter((f) => b[f] !== undefined);
  if (!updates.length) return res.json({ ok: true });
  if ((b.scheduled_start || b.theatre_id || b.est_duration_min) && !["REQUESTED", "PENDING_APPROVAL", "SCHEDULED", "POSTPONED"].includes(c.status)) {
    throw new HttpError(409, "The case has started, so it can't be rescheduled.");
  }
  if (b.scheduled_start || b.theatre_id || b.est_duration_min) {
    const team = (db.prepare(`SELECT staff_id FROM case_team WHERE case_id = ?`).all(id) as { staff_id: number }[]).map((t) => t.staff_id);
    const conflicts = findConflicts({
      start: b.scheduled_start ?? c.scheduled_start, durationMin: Number(b.est_duration_min ?? c.est_duration_min), theatreId: b.theatre_id ?? c.theatre_id,
      staffIds: team, excludeCaseId: id,
    });
    if (conflicts.length && !b.force) throw new HttpError(409, "The new time overlaps other cases.", { conflicts });
  }
  if (b.ebl_ml !== undefined && b.ebl_ml !== null && (Number(b.ebl_ml) < 0 || Number(b.ebl_ml) > 20000)) throw new HttpError(400, "Blood loss must be between 0 and 20,000 ml.");
  const values = updates.map((f) => (f === "scheduled_start" ? new Date(b[f]).toISOString() : b[f]));
  db.prepare(`UPDATE cases SET ${updates.map((f) => `${f} = ?`).join(", ")}, updated_at = ?${c.status === "POSTPONED" && b.scheduled_start ? ", status = 'REQUESTED'" : ""} WHERE id = ?`).run(...values, now(), id);
  if (c.status === "POSTPONED" && b.scheduled_start) refreshApprovalStatus(id);
  const before = Object.fromEntries(updates.map((f) => [f, c[f]]));
  audit(user.id, "case", id, "updated", { before, after: Object.fromEntries(updates.map((f, i) => [f, values[i]])) }, id);
  if (b.scheduled_start || b.theatre_id) event(id, "rescheduled", `Rescheduled to ${new Date(b.scheduled_start ?? c.scheduled_start).toLocaleString()}.`, user.id);
  res.json({ ok: true });
});

function releaseReservations(caseId: number) {
  const items = db.prepare(`SELECT item_id, qty_planned FROM case_items WHERE case_id = ? AND consumed = 0`).all(caseId) as { item_id: number; qty_planned: number }[];
  items.forEach((i) => db.prepare(`UPDATE inventory_items SET reserved_qty = MAX(0, reserved_qty - ?) WHERE id = ?`).run(i.qty_planned, i.item_id));
}

casesRouter.post("/:id/cancel", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  const reason = String(required(body(req).reason, "Cancellation reason"));
  if (["IN_SURGERY", "RECOVERY", "COMPLETED", "CANCELLED"].includes(c.status)) throw new HttpError(409, `A case that is ${c.status.toLowerCase().replace("_", " ")} can't be cancelled.`);
  db.transaction(() => {
    releaseReservations(id);
    db.prepare(`UPDATE cases SET status = 'CANCELLED', cancel_reason = ?, updated_at = ? WHERE id = ?`).run(reason, now(), id);
    event(id, "cancelled", `Cancelled: ${reason}.`, userOf(req).id, "warning");
    audit(userOf(req).id, "case", id, "cancelled", { reason, from: c.status }, id);
  })();
  res.json({ ok: true });
});

casesRouter.post("/:id/postpone", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  const reason = String(required(body(req).reason, "Reason"));
  if (!["REQUESTED", "PENDING_APPROVAL", "SCHEDULED", "CHECKED_IN"].includes(c.status)) throw new HttpError(409, "Only cases that have not entered the room can be postponed.");
  db.prepare(`UPDATE cases SET status = 'POSTPONED', delay_reason = ?, updated_at = ? WHERE id = ?`).run(reason, now(), id);
  event(id, "postponed", `Postponed: ${reason}.`, userOf(req).id, "warning");
  audit(userOf(req).id, "case", id, "postponed", { reason }, id);
  res.json({ ok: true });
});

// ---------- Diagnoses ----------
casesRouter.post("/:id/diagnoses", (req, res) => {
  const id = idParam(req);
  lockedAfterSurgery(getCase(id));
  const b = body(req);
  const dx = Number(required(b.diagnosisId, "Diagnosis"));
  db.transaction(() => {
    if (b.isPrimary) db.prepare(`UPDATE case_diagnoses SET is_primary = 0 WHERE case_id = ?`).run(id);
    db.prepare(`INSERT INTO case_diagnoses (case_id, diagnosis_id, is_primary) VALUES (?,?,?) ON CONFLICT(case_id, diagnosis_id) DO UPDATE SET is_primary = excluded.is_primary`).run(id, dx, b.isPrimary ? 1 : 0);
  })();
  audit(userOf(req).id, "case_diagnosis", dx, "added", b, id);
  touch(id);
  res.json({ ok: true });
});

casesRouter.delete("/:id/diagnoses/:rowId", (req, res) => {
  const id = idParam(req);
  lockedAfterSurgery(getCase(id));
  const rowId = idParam(req, "rowId");
  const row = db.prepare(`SELECT is_primary FROM case_diagnoses WHERE id = ? AND case_id = ?`).get(rowId, id) as { is_primary: number } | undefined;
  if (row?.is_primary) throw new HttpError(409, "Set another diagnosis as primary before removing this one.");
  db.prepare(`DELETE FROM case_diagnoses WHERE id = ? AND case_id = ?`).run(rowId, id);
  audit(userOf(req).id, "case_diagnosis", rowId, "removed", null, id);
  res.json({ ok: true });
});

// ---------- Procedures ----------
casesRouter.post("/:id/procedures", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  lockedAfterSurgery(c);
  const b = body(req);
  const procId = Number(required(b.procedureId, "Procedure"));
  const proc = db.prepare(`SELECT * FROM procedures WHERE id = ?`).get(procId) as Record<string, any> | undefined;
  if (!proc) throw new HttpError(400, "Procedure not found.");
  const role = String(b.role ?? (proc.is_addon ? "Add-on" : "Secondary"));
  if (role === "Primary" && db.prepare(`SELECT 1 FROM case_procedures WHERE case_id = ? AND role = 'Primary'`).get(id)) {
    throw new HttpError(409, "This case already has a primary procedure. Add this one as secondary.");
  }
  const sort = (db.prepare(`SELECT COALESCE(MAX(sort),0)+1 s FROM case_procedures WHERE case_id = ?`).get(id) as { s: number }).s;
  const started = ["IN_SURGERY", "RECOVERY"].includes(c.status);
  db.prepare(`INSERT INTO case_procedures (case_id, procedure_id, role, surgeon_id, approach, laterality, modifiers, planned, performed, sort) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, procId, role, b.surgeonId ?? null, b.approach ?? proc.default_approach, b.laterality ?? "N/A", b.modifiers ?? "", started ? 0 : 1, started ? 1 : 0, sort,
  );
  if (started) event(id, "procedure", `Unplanned procedure added during surgery: ${proc.cpt} ${proc.name}.`, userOf(req).id, "warning");
  audit(userOf(req).id, "case_procedure", procId, "added", b, id);
  touch(id);
  res.status(201).json({ ok: true });
});

casesRouter.patch("/:id/procedures/:rowId", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  lockedAfterSurgery(c);
  const rowId = idParam(req, "rowId");
  const b = body(req);
  const allowed = ["role", "surgeon_id", "approach", "laterality", "modifiers", "performed"];
  const ups = allowed.filter((f) => b[f] !== undefined);
  if (b.performed && !["IN_SURGERY", "RECOVERY", "COMPLETED"].includes(c.status)) throw new HttpError(409, "Mark procedures as performed after incision.");
  if (b.modifiers && !String(b.modifiers).split(",").every((m: string) => /^[0-9A-Z]{2}$/.test(m.trim()))) throw new HttpError(400, "Modifiers are two characters, separated by commas (for example 51, RT).");
  if (ups.length) db.prepare(`UPDATE case_procedures SET ${ups.map((f) => `${f} = ?`).join(", ")} WHERE id = ? AND case_id = ?`).run(...ups.map((f) => b[f]), rowId, id);
  audit(userOf(req).id, "case_procedure", rowId, "updated", b, id);
  touch(id);
  res.json({ ok: true });
});

casesRouter.delete("/:id/procedures/:rowId", (req, res) => {
  const id = idParam(req);
  lockedAfterSurgery(getCase(id));
  const rowId = idParam(req, "rowId");
  const row = db.prepare(`SELECT role FROM case_procedures WHERE id = ? AND case_id = ?`).get(rowId, id) as { role: string } | undefined;
  if (row?.role === "Primary") throw new HttpError(409, "The primary procedure can't be removed. Change another procedure to primary first.");
  db.prepare(`DELETE FROM case_procedures WHERE id = ? AND case_id = ?`).run(rowId, id);
  audit(userOf(req).id, "case_procedure", rowId, "removed", null, id);
  res.json({ ok: true });
});

// ---------- Team ----------
casesRouter.post("/:id/team", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  assertCanEdit(c);
  const b = body(req);
  const staffId = Number(required(b.staffId, "Staff member"));
  const role = String(required(b.role, "Role"));
  const staff = db.prepare(`SELECT name, role FROM staff WHERE id = ?`).get(staffId) as { name: string; role: string } | undefined;
  if (!staff) throw new HttpError(400, "Staff member not found.");
  const roleRules: Record<string, string[]> = {
    "Primary Surgeon": ["SURGEON"], "Secondary Surgeon": ["SURGEON"], "Assistant Surgeon": ["SURGEON", "ASSISTANT_SURGEON"],
    Anesthesiologist: ["ANESTHESIOLOGIST"], "Anesthesia Technician": ["ANESTHESIA_TECH"], "Scrub Nurse": ["SCRUB_NURSE"],
    "Circulating Nurse": ["CIRCULATING_NURSE"], Radiographer: ["RADIOGRAPHER"], Perfusionist: ["PERFUSIONIST"],
  };
  if (roleRules[role] && !roleRules[role].includes(staff.role)) throw new HttpError(400, `${staff.name} isn't credentialed as ${role.toLowerCase()}.`);
  if (role === "Primary Surgeon" && db.prepare(`SELECT 1 FROM case_team WHERE case_id = ? AND role = 'Primary Surgeon' AND time_out IS NULL`).get(id)) {
    throw new HttpError(409, "A primary surgeon is already assigned. Sign them out first to hand over.");
  }
  const conflicts = findConflicts({ start: c.scheduled_start, durationMin: c.est_duration_min, staffIds: [staffId], excludeCaseId: id });
  if (conflicts.length && !b.force) throw new HttpError(409, `${staff.name} is booked elsewhere at this time.`, { conflicts });
  const inRoom = ["IN_OR", "IN_SURGERY"].includes(c.status);
  db.prepare(`INSERT INTO case_team (case_id, staff_id, role, time_in) VALUES (?,?,?,?)`).run(id, staffId, role, inRoom ? now() : null);
  if (inRoom) event(id, "team", `${staff.name} joined as ${role.toLowerCase()}.`, userOf(req).id);
  audit(userOf(req).id, "case_team", staffId, "assigned", { role }, id);
  res.status(201).json({ ok: true });
});

casesRouter.patch("/:id/team/:rowId", (req, res) => {
  const id = idParam(req);
  const rowId = idParam(req, "rowId");
  const b = body(req);
  const row = db.prepare(`SELECT ct.*, s.name FROM case_team ct JOIN staff s ON s.id = ct.staff_id WHERE ct.id = ? AND ct.case_id = ?`).get(rowId, id) as Record<string, any> | undefined;
  if (!row) throw new HttpError(404, "Team member not found.");
  const ts = now();
  if (b.action === "in") db.prepare(`UPDATE case_team SET time_in = ?, time_out = NULL WHERE id = ?`).run(ts, rowId);
  else if (b.action === "out") {
    if (!row.time_in) throw new HttpError(409, `${row.name} hasn't been signed in.`);
    db.prepare(`UPDATE case_team SET time_out = ? WHERE id = ?`).run(ts, rowId);
  } else throw new HttpError(400, "Action must be in or out.");
  event(id, "team", `${row.name} (${row.role.toLowerCase()}) signed ${b.action}.`, userOf(req).id);
  audit(userOf(req).id, "case_team", rowId, `time ${b.action}`, null, id);
  res.json({ ok: true });
});

casesRouter.delete("/:id/team/:rowId", (req, res) => {
  const id = idParam(req);
  const rowId = idParam(req, "rowId");
  const row = db.prepare(`SELECT time_in FROM case_team WHERE id = ? AND case_id = ?`).get(rowId, id) as { time_in: string | null } | undefined;
  if (row?.time_in) throw new HttpError(409, "This person has a recorded time in. Sign them out instead so the record stays complete.");
  db.prepare(`DELETE FROM case_team WHERE id = ? AND case_id = ?`).run(rowId, id);
  audit(userOf(req).id, "case_team", rowId, "removed", null, id);
  res.json({ ok: true });
});

casesRouter.put("/:id/equipment", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  assertCanEdit(c);
  const ids = (body(req).equipmentIds ?? []) as number[];
  const conflicts = findConflicts({ start: c.scheduled_start, durationMin: c.est_duration_min, equipmentIds: ids, excludeCaseId: id });
  if (conflicts.length && !body(req).force) throw new HttpError(409, "Some equipment is in use at this time.", { conflicts });
  const down = db.prepare(`SELECT name FROM equipment WHERE id IN (${ids.map(() => "?").join(",") || "NULL"}) AND status != 'Ready'`).all(...ids) as { name: string }[];
  db.transaction(() => {
    db.prepare(`DELETE FROM case_equipment WHERE case_id = ?`).run(id);
    ids.forEach((e) => db.prepare(`INSERT INTO case_equipment (case_id, equipment_id) VALUES (?,?)`).run(id, e));
  })();
  audit(userOf(req).id, "case_equipment", null, "set", { ids }, id);
  res.json({ ok: true, warnings: down.map((d) => `${d.name} is not marked ready.`) });
});

// ---------- Milestones ----------
casesRouter.post("/:id/milestones", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  const b = body(req);
  const code = String(required(b.code, "Milestone"));
  const m = MILESTONES.find((x) => x.code === code);
  if (!m) throw new HttpError(400, "Unknown milestone.");
  if (db.prepare(`SELECT 1 FROM case_milestones WHERE case_id = ? AND code = ?`).get(id, code)) throw new HttpError(409, `${m.label} is already recorded.`);
  const blockers = milestoneBlockers(c, code);
  if (blockers.length) throw new HttpError(422, `Can't record ${m.label.toLowerCase()} yet.`, { blockers });
  const ts = b.ts ? new Date(b.ts).toISOString() : now();
  if (Date.parse(ts) > Date.now() + 60000) throw new HttpError(400, "Milestones can't be recorded in the future.");
  if (m.requires) {
    const prev = db.prepare(`SELECT ts FROM case_milestones WHERE case_id = ? AND code = ?`).get(id, m.requires) as { ts: string };
    if (ts < prev.ts) throw new HttpError(400, `${m.label} can't be earlier than the previous milestone.`);
  }
  const user = userOf(req);
  db.transaction(() => {
    db.prepare(`INSERT INTO case_milestones (case_id, code, ts, recorded_by) VALUES (?,?,?,?)`).run(id, code, ts, user.id);
    if (m.status) db.prepare(`UPDATE cases SET status = ?, updated_at = ? WHERE id = ?`).run(m.status, now(), id);
    if (code === "IN_ROOM") db.prepare(`UPDATE case_team SET time_in = COALESCE(time_in, ?) WHERE case_id = ?`).run(ts, id);
    if (code === "OUT_OF_ROOM") {
      db.prepare(`UPDATE case_team SET time_out = COALESCE(time_out, ?) WHERE case_id = ? AND time_in IS NOT NULL`).run(ts, id);
      const n = nnis(id);
      db.prepare(`INSERT INTO scores (case_id, kind, value, band, details, recorded_by, ts) VALUES (?,?,?,?,?,?,?)`).run(id, "NNIS", n.value, n.band, JSON.stringify(n.details), user.id, ts);
    }
    if (code === "IN_ROOM") {
      const sched = Date.parse(c.scheduled_start);
      const late = Math.round((Date.parse(ts) - sched) / 60000);
      if (late > 10 && !c.delay_reason && b.delayReason) db.prepare(`UPDATE cases SET delay_reason = ? WHERE id = ?`).run(b.delayReason, id);
      if (late > 10) event(id, "delay", `Started ${late} min late${b.delayReason ? `: ${b.delayReason}` : ""}.`, user.id, "warning");
    }
    event(id, "milestone", `${m.label} recorded.`, user.id);
    audit(user.id, "milestone", null, "recorded", { code, ts }, id);
  })();
  res.status(201).json({ ok: true, status: m.status ?? c.status });
});

casesRouter.patch("/:id/milestones/:code", (req, res) => {
  const id = idParam(req);
  const code = String(req.params.code);
  const b = body(req);
  const reason = String(required(b.reason, "Correction reason"));
  const ts = new Date(String(required(b.ts, "Time"))).toISOString();
  const prev = db.prepare(`SELECT ts FROM case_milestones WHERE case_id = ? AND code = ?`).get(id, code) as { ts: string } | undefined;
  if (!prev) throw new HttpError(404, "Milestone not recorded.");
  db.prepare(`UPDATE case_milestones SET ts = ? WHERE case_id = ? AND code = ?`).run(ts, id, code);
  event(id, "correction", `${MILESTONES.find((m) => m.code === code)?.label} corrected (${reason}).`, userOf(req).id, "warning");
  audit(userOf(req).id, "milestone", null, "corrected", { code, from: prev.ts, to: ts, reason }, id);
  res.json({ ok: true });
});

// ---------- Checklist ----------
casesRouter.patch("/:id/checklist/:itemId", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  assertCanEdit(c);
  const itemId = idParam(req, "itemId");
  const checked = body(req).checked ? 1 : 0;
  const item = db.prepare(`SELECT phase FROM checklist_items WHERE id = ? AND case_id = ?`).get(itemId, id) as { phase: string } | undefined;
  if (!item) throw new HttpError(404, "Checklist item not found.");
  const lockAt: Record<string, string> = { SIGN_IN: "IN_ROOM", TIME_OUT: "INCISION", SIGN_OUT: "OUT_OF_ROOM" };
  if (!checked && db.prepare(`SELECT 1 FROM case_milestones WHERE case_id = ? AND code = ?`).get(id, lockAt[item.phase])) {
    throw new HttpError(409, "This checklist was completed and the case has moved on. It can't be unticked.");
  }
  db.prepare(`UPDATE checklist_items SET checked = ?, checked_by = ?, ts = ? WHERE id = ?`).run(checked, checked ? userOf(req).id : null, checked ? now() : null, itemId);
  audit(userOf(req).id, "checklist", itemId, checked ? "checked" : "unchecked", null, id);
  res.json({ ok: true });
});

// ---------- Counts ----------
casesRouter.patch("/:id/counts/:countId", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  lockedAfterSurgery(c);
  const countId = idParam(req, "countId");
  const b = body(req);
  const row = db.prepare(`SELECT * FROM counts WHERE id = ? AND case_id = ?`).get(countId, id) as Record<string, any> | undefined;
  if (!row) throw new HttpError(404, "Count not found.");
  const initial = optNum(b.initial) ?? row.initial;
  const added = optNum(b.added) ?? row.added;
  const final = b.final === undefined ? row.final : optNum(b.final);
  if ([initial, added, final ?? 0].some((n) => n < 0)) throw new HttpError(400, "Counts can't be negative.");
  db.prepare(`UPDATE counts SET initial = ?, added = ?, final = ?, verified_by = NULL, witness_id = NULL, ts = NULL WHERE id = ?`).run(initial, added, final, countId);
  if (final !== null && final !== initial + added) event(id, "count", `${row.item} count discrepancy: expected ${initial + added}, counted ${final}.`, userOf(req).id, "critical");
  audit(userOf(req).id, "count", countId, "updated", { initial, added, final }, id);
  res.json({ ok: true });
});

casesRouter.post("/:id/counts/:countId/verify", (req, res) => {
  const id = idParam(req);
  const countId = idParam(req, "countId");
  const b = body(req);
  const user = userOf(req);
  const row = db.prepare(`SELECT * FROM counts WHERE id = ? AND case_id = ?`).get(countId, id) as Record<string, any> | undefined;
  if (!row) throw new HttpError(404, "Count not found.");
  if (row.final === null) throw new HttpError(409, "Enter the final count first.");
  if (row.final !== row.initial + row.added) throw new HttpError(422, `${row.item} count doesn't match. Search the field, then request a portable X-ray if still missing.`);
  verifySigner(user.id, String(b.pin ?? ""), "Your");
  const witnessId = Number(required(b.witnessId, "Witness"));
  if (witnessId === user.id) throw new HttpError(400, "The witness must be a different person.");
  verifySigner(witnessId, String(b.witnessPin ?? ""), "Witness");
  db.prepare(`UPDATE counts SET verified_by = ?, witness_id = ?, ts = ? WHERE id = ?`).run(user.id, witnessId, now(), countId);
  audit(user.id, "count", countId, "verified", { witnessId }, id);
  res.json({ ok: true });
});

// ---------- Anesthesia ----------
casesRouter.post("/:id/vitals", (req, res) => {
  requireRole(req, ["ANESTHESIOLOGIST", "ANESTHESIA_TECH", "CIRCULATING_NURSE"], "record vitals");
  const id = idParam(req);
  const c = getCase(id);
  if (!["IN_OR", "IN_SURGERY", "RECOVERY"].includes(c.status)) throw new HttpError(409, "Vitals are recorded while the patient is in the room or recovery.");
  const b = body(req);
  const v = { hr: optNum(b.hr), sbp: optNum(b.sbp), dbp: optNum(b.dbp), spo2: optNum(b.spo2), etco2: optNum(b.etco2), temp: optNum(b.temp) };
  const ranges: Record<string, [number, number]> = { hr: [20, 250], sbp: [30, 260], dbp: [15, 160], spo2: [50, 100], etco2: [0, 100], temp: [30, 43] };
  for (const [k, [lo, hi]] of Object.entries(ranges)) {
    const val = v[k as keyof typeof v];
    if (val !== null && (val < lo || val > hi)) throw new HttpError(400, `${k.toUpperCase()} ${val} is outside the possible range (${lo}–${hi}).`);
  }
  db.prepare(`INSERT INTO anesthesia_vitals (case_id, ts, hr, sbp, dbp, spo2, etco2, temp, recorded_by) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, now(), v.hr, v.sbp, v.dbp, v.spo2, v.etco2, v.temp, userOf(req).id);
  if ((v.spo2 !== null && v.spo2 < 90) || (v.sbp !== null && v.sbp < 80)) event(id, "alert", `Abnormal vitals: SpO₂ ${v.spo2 ?? "—"}%, SBP ${v.sbp ?? "—"}.`, userOf(req).id, "critical");
  res.status(201).json({ ok: true });
});

casesRouter.post("/:id/meds", (req, res) => {
  requireRole(req, ["ANESTHESIOLOGIST", "ANESTHESIA_TECH"], "record anesthesia drugs");
  const id = idParam(req);
  const c = getCase(id);
  if (!["IN_OR", "IN_SURGERY", "RECOVERY"].includes(c.status)) throw new HttpError(409, "Drugs are recorded while the patient is in the room or recovery.");
  const b = body(req);
  const drug = String(required(b.drug, "Drug"));
  const dose = Number(required(b.dose, "Dose"));
  if (!(dose > 0)) throw new HttpError(400, "Dose must be greater than zero.");
  const allergies = String((db.prepare(`SELECT allergies FROM patients WHERE id = ?`).get(c.patient_id) as { allergies: string }).allergies).toLowerCase();
  const allergyHit = allergies !== "nkda" && allergies.split(/[,;]/).some((a) => a.trim() && drug.toLowerCase().includes(a.trim()));
  const cephalosporinPenicillin = allergies.includes("penicillin") && /cef/i.test(drug);
  if ((allergyHit || cephalosporinPenicillin) && !b.overrideAllergy) {
    throw new HttpError(422, `Allergy alert: patient is allergic to ${allergies}.`, { allergy: true, blockers: [cephalosporinPenicillin ? "Penicillin allergy: possible cross-reactivity with cephalosporins." : `Recorded allergy matches ${drug}.`] });
  }
  db.prepare(`INSERT INTO anesthesia_meds (case_id, ts, drug, dose, unit, route, given_by) VALUES (?,?,?,?,?,?,?)`).run(id, now(), drug, dose, String(b.unit ?? "mg"), String(b.route ?? "IV"), userOf(req).id);
  if (b.overrideAllergy) event(id, "alert", `Allergy alert overridden for ${drug}: ${b.overrideReason ?? "no reason given"}.`, userOf(req).id, "critical");
  audit(userOf(req).id, "anesthesia_med", null, "given", { drug, dose, override: !!b.overrideAllergy }, id);
  res.status(201).json({ ok: true });
});

casesRouter.post("/:id/events", (req, res) => {
  const id = idParam(req);
  getCase(id);
  const b = body(req);
  event(id, String(b.kind ?? "note"), String(required(b.text, "Note")), userOf(req).id, String(b.severity ?? "info"));
  audit(userOf(req).id, "event", null, "added", b, id);
  res.status(201).json({ ok: true });
});

// ---------- Orders (imaging / lab / blood) ----------
casesRouter.post("/:id/orders", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  assertCanEdit(c);
  const b = body(req);
  const kind = String(required(b.kind, "Order type"));
  if (!["IMAGING", "LAB", "BLOOD"].includes(kind)) throw new HttpError(400, "Order type must be imaging, lab or blood.");
  const qty = kind === "BLOOD" ? Number(b.quantity ?? 1) : null;
  if (kind === "BLOOD" && !(qty! >= 1 && qty! <= 10)) throw new HttpError(400, "Blood orders are 1 to 10 units.");
  db.prepare(`INSERT INTO case_orders (case_id, kind, test, priority, quantity, ordered_by, ordered_at) VALUES (?,?,?,?,?,?,?)`).run(
    id, kind, String(required(b.test, "Test")), String(b.priority ?? "STAT"), qty, userOf(req).id, now(),
  );
  event(id, "order", `${kind.toLowerCase()} ordered: ${b.test}${qty ? ` × ${qty}` : ""}.`, userOf(req).id);
  audit(userOf(req).id, "order", null, "placed", b, id);
  res.status(201).json({ ok: true });
});

casesRouter.patch("/:id/orders/:orderId", (req, res) => {
  const id = idParam(req);
  const orderId = idParam(req, "orderId");
  const b = body(req);
  const o = db.prepare(`SELECT * FROM case_orders WHERE id = ? AND case_id = ?`).get(orderId, id) as Record<string, any> | undefined;
  if (!o) throw new HttpError(404, "Order not found.");
  if (o.status === "Resulted" && b.status !== "Corrected") throw new HttpError(409, "This order already has a result.");
  const status = String(b.status ?? "Resulted");
  if (status === "Resulted" && !b.result) throw new HttpError(400, "Enter the result.");
  db.prepare(`UPDATE case_orders SET status = ?, result = COALESCE(?, result), critical = ?, radiation_mgy = COALESCE(?, radiation_mgy), fluoro_sec = COALESCE(?, fluoro_sec), resulted_at = ? WHERE id = ?`).run(
    status, b.result ?? null, b.critical ? 1 : 0, optNum(b.radiationMgy), optNum(b.fluoroSec), status === "Resulted" ? now() : null, orderId,
  );
  if (b.critical) event(id, "alert", `Critical result — ${o.test}: ${b.result}.`, userOf(req).id, "critical");
  audit(userOf(req).id, "order", orderId, status.toLowerCase(), b, id);
  res.json({ ok: true });
});

// ---------- Materials ----------
casesRouter.post("/:id/items", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  lockedAfterSurgery(c);
  const b = body(req);
  const itemId = Number(required(b.itemId, "Item"));
  const qty = Number(b.qty ?? 1);
  const item = db.prepare(`SELECT * FROM inventory_items WHERE id = ?`).get(itemId) as Record<string, any> | undefined;
  if (!item) throw new HttpError(400, "Item not found.");
  if (item.expiry && item.expiry < new Date().toISOString().slice(0, 10)) throw new HttpError(409, `${item.name} is expired (lot ${item.lot_no}). Pick another lot.`);
  const existing = db.prepare(`SELECT id FROM case_items WHERE case_id = ? AND item_id = ?`).get(id, itemId);
  if (existing) db.prepare(`UPDATE case_items SET qty_planned = qty_planned + ? WHERE case_id = ? AND item_id = ?`).run(qty, id, itemId);
  else db.prepare(`INSERT INTO case_items (case_id, item_id, qty_planned) VALUES (?,?,?)`).run(id, itemId, qty);
  db.prepare(`UPDATE inventory_items SET reserved_qty = reserved_qty + ? WHERE id = ?`).run(qty, itemId);
  audit(userOf(req).id, "case_item", itemId, "added", { qty }, id);
  res.status(201).json({ ok: true, warning: item.stock_qty - item.reserved_qty < qty ? `Only ${item.stock_qty} ${item.uom} in stock.` : null });
});

casesRouter.patch("/:id/items/:rowId", (req, res) => {
  const id = idParam(req);
  lockedAfterSurgery(getCase(id));
  const rowId = idParam(req, "rowId");
  const b = body(req);
  const row = db.prepare(`SELECT ci.*, i.is_implant FROM case_items ci JOIN inventory_items i ON i.id = ci.item_id WHERE ci.id = ? AND ci.case_id = ?`).get(rowId, id) as Record<string, any> | undefined;
  if (!row) throw new HttpError(404, "Item not found on this case.");
  if (row.consumed) throw new HttpError(409, "Usage is already posted to inventory.");
  const used = optNum(b.qtyUsed) ?? row.qty_used;
  const wasted = optNum(b.qtyWasted) ?? row.qty_wasted;
  if (used < 0 || wasted < 0) throw new HttpError(400, "Quantities can't be negative.");
  db.prepare(`UPDATE case_items SET qty_used = ?, qty_wasted = ?, lot_no = COALESCE(?, lot_no), serial_no = COALESCE(?, serial_no) WHERE id = ?`).run(used, wasted, b.lotNo ?? null, b.serialNo ?? null, rowId);
  audit(userOf(req).id, "case_item", rowId, "usage", b, id);
  res.json({ ok: true });
});

casesRouter.post("/:id/items/post", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  if (!["IN_SURGERY", "RECOVERY", "COMPLETED"].includes(c.status)) throw new HttpError(409, "Post usage after the procedure has started.");
  const rows = db.prepare(`SELECT ci.*, i.name, i.is_implant, i.stock_qty FROM case_items ci JOIN inventory_items i ON i.id = ci.item_id WHERE ci.case_id = ? AND ci.consumed = 0`).all(id) as Record<string, any>[];
  const missing = rows.filter((r) => r.is_implant && r.qty_used > 0 && (!r.lot_no || !r.serial_no)).map((r) => r.name);
  if (missing.length) throw new HttpError(422, "Implants need lot and serial numbers.", { blockers: missing.map((m) => `${m}: scan or enter lot and serial.`) });
  db.transaction(() => {
    for (const r of rows) {
      const take = r.qty_used + r.qty_wasted;
      db.prepare(`UPDATE inventory_items SET stock_qty = MAX(0, stock_qty - ?), reserved_qty = MAX(0, reserved_qty - ?) WHERE id = ?`).run(take, r.qty_planned, r.item_id);
      db.prepare(`UPDATE case_items SET consumed = 1 WHERE id = ?`).run(r.id);
    }
  })();
  event(id, "inventory", `Usage posted for ${rows.length} items.`, userOf(req).id);
  audit(userOf(req).id, "case_item", null, "posted", { count: rows.length }, id);
  res.json({ ok: true, posted: rows.length });
});

// ---------- Approvals ----------
casesRouter.post("/:id/approvals", (req, res) => {
  const id = idParam(req);
  getCase(id);
  const b = body(req);
  const kind = String(required(b.kind, "Approval type"));
  if (db.prepare(`SELECT 1 FROM approvals WHERE case_id = ? AND kind = ? AND status = 'Pending'`).get(id, kind)) throw new HttpError(409, "A request of this type is already pending.");
  db.prepare(`INSERT INTO approvals (case_id, kind, required, requested_by, requested_at, remarks) VALUES (?,?,?,?,?,?)`).run(id, kind, b.required === false ? 0 : 1, userOf(req).id, now(), b.remarks ?? null);
  audit(userOf(req).id, "approval", null, "requested", b, id);
  refreshApprovalStatus(id);
  res.status(201).json({ ok: true });
});

// ---------- Consents (with witness) ----------
casesRouter.post("/:id/consents", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  assertCanEdit(c);
  const b = body(req);
  const user = userOf(req);
  const kind = String(required(b.kind, "Consent type"));
  if (kind === "ANESTHESIA") requireRole(req, ["ANESTHESIOLOGIST"], "take anesthesia consent");
  else requireRole(req, ["SURGEON", "ASSISTANT_SURGEON"], "take surgical consent");
  if (db.prepare(`SELECT 1 FROM consents WHERE case_id = ? AND kind = ?`).get(id, kind)) throw new HttpError(409, "This consent is already recorded.");
  verifySigner(user.id, String(b.pin ?? ""), "Your");
  const witnessId = Number(required(b.witnessId, "Witness"));
  if (witnessId === user.id) throw new HttpError(400, "The witness must be a different person from the clinician taking consent.");
  verifySigner(witnessId, String(b.witnessPin ?? ""), "Witness");
  const ts = now();
  const payload = { caseId: id, kind, signedBy: b.signedByName, relationship: b.relationship, risks: b.risksExplained };
  db.prepare(`INSERT INTO consents (case_id, kind, signed_by_name, relationship, risks_explained, obtained_by, witness_id, ts, signature_hash) VALUES (?,?,?,?,?,?,?,?,?)`).run(
    id, kind, String(required(b.signedByName, "Signed by")), String(b.relationship ?? "Self"), String(required(b.risksExplained, "Risks explained")), user.id, witnessId, ts, signatureHash(payload, user.id, ts),
  );
  event(id, "consent", `${kind.toLowerCase()} consent signed by ${b.signedByName} (${b.relationship ?? "Self"}), witnessed.`, user.id);
  audit(user.id, "consent", null, "recorded", { kind, witnessId }, id);
  res.status(201).json({ ok: true });
});

// ---------- Scores ----------
casesRouter.post("/:id/scores", (req, res) => {
  const id = idParam(req);
  const c = getCase(id);
  const b = body(req);
  const kind = String(required(b.kind, "Score"));
  let result: { value: number; band: string; details: unknown } | null = null;
  if (kind === "RCRI") {
    result = rcri(b.inputs ?? {});
    db.prepare(`UPDATE cases SET rcri = ? WHERE id = ?`).run(JSON.stringify(b.inputs ?? {}), id);
  } else if (kind === "ALDRETE") {
    if (!["RECOVERY", "COMPLETED"].includes(c.status)) throw new HttpError(409, "Aldrete is scored in recovery.");
    result = aldrete(b.inputs ?? {});
  } else if (kind === "SURGICAL_APGAR") {
    result = surgicalApgar(id);
    if (!result) throw new HttpError(422, "Surgical Apgar needs blood loss and at least one set of vitals.");
  } else if (kind === "NNIS") {
    result = nnis(id);
  } else throw new HttpError(400, "Unknown score.");
  db.prepare(`INSERT INTO scores (case_id, kind, value, band, details, recorded_by, ts) VALUES (?,?,?,?,?,?,?)`).run(id, kind, result.value, result.band, JSON.stringify(result.details), userOf(req).id, now());
  audit(userOf(req).id, "score", null, "recorded", { kind, value: result.value }, id);
  res.status(201).json(result);
});

// ---------- Operative report ----------
const REPORT_FIELDS = ["indication", "findings", "technique", "specimens", "complications", "drains", "postop_plan"] as const;

function reportPayload(r: Record<string, any>) {
  return Object.fromEntries(REPORT_FIELDS.map((f) => [f, r[f]]));
}

casesRouter.put("/:id/report", (req, res) => {
  const id = idParam(req);
  const r = db.prepare(`SELECT * FROM reports WHERE case_id = ?`).get(id) as Record<string, any>;
  if (r.status === "Signed") throw new HttpError(409, "The report is signed. Start an amendment to change it.");
  const b = body(req);
  const ups = REPORT_FIELDS.filter((f) => b[f] !== undefined);
  if (ups.length) db.prepare(`UPDATE reports SET ${ups.map((f) => `${f} = ?`).join(", ")}, updated_at = ? WHERE case_id = ?`).run(...ups.map((f) => String(b[f])), now(), id);
  audit(userOf(req).id, "report", r.id, "draft saved", null, id);
  res.json({ ok: true });
});

function reportBlockers(caseId: number) {
  const c = getCase(caseId);
  const r = db.prepare(`SELECT * FROM reports WHERE case_id = ?`).get(caseId) as Record<string, any>;
  const issues: string[] = [];
  if (!["RECOVERY", "COMPLETED"].includes(c.status)) issues.push("The patient must be out of the room.");
  for (const f of ["indication", "findings", "technique", "postop_plan"]) if (!String(r[f] ?? "").trim()) issues.push(`Complete "${f.replace("_", "-")}".`);
  if (!db.prepare(`SELECT 1 FROM case_procedures WHERE case_id = ? AND performed = 1`).get(caseId)) issues.push("Mark at least one procedure as performed.");
  if (!countsReconciled(caseId)) issues.push("Counts must be reconciled and witnessed.");
  if (c.ebl_ml === null || c.ebl_ml === undefined) issues.push("Record estimated blood loss.");
  const pendingOrders = db.prepare(`SELECT test FROM case_orders WHERE case_id = ? AND status != 'Resulted'`).all(caseId) as { test: string }[];
  pendingOrders.forEach((o) => issues.push(`Result pending: ${o.test}.`));
  return issues;
}

casesRouter.get("/:id/report/check", (req, res) => res.json({ blockers: reportBlockers(idParam(req)) }));

casesRouter.post("/:id/report/sign", (req, res) => {
  const id = idParam(req);
  const user = userOf(req);
  requireRole(req, ["SURGEON"], "sign operative reports");
  const isPrimary = db.prepare(`SELECT 1 FROM case_team WHERE case_id = ? AND staff_id = ? AND role IN ('Primary Surgeon','Secondary Surgeon')`).get(id, user.id);
  if (!isPrimary && user.role !== "ADMIN") throw new HttpError(403, "Only the operating surgeon can sign this report.");
  const r = db.prepare(`SELECT * FROM reports WHERE case_id = ?`).get(id) as Record<string, any>;
  if (r.status === "Signed") throw new HttpError(409, "Already signed.");
  const blockers = reportBlockers(id);
  if (blockers.length) throw new HttpError(422, "The report can't be signed yet.", { blockers });
  const b = body(req);
  verifySigner(user.id, String(b.pin ?? ""), "Your");
  let witnessId: number | null = null;
  if (b.witnessId) {
    witnessId = Number(b.witnessId);
    if (witnessId === user.id) throw new HttpError(400, "The witness must be a different person.");
    verifySigner(witnessId, String(b.witnessPin ?? ""), "Witness");
  }
  const ts = now();
  const hash = signatureHash(reportPayload(r), user.id, ts);
  db.prepare(`UPDATE reports SET status = 'Signed', signed_by = ?, signed_at = ?, witness_id = ?, witnessed_at = ?, signature_hash = ?, updated_at = ? WHERE case_id = ?`).run(
    user.id, ts, witnessId, witnessId ? ts : null, hash, ts, id,
  );
  event(id, "report", `Operative report v${r.version} signed${witnessId ? " and witnessed" : ""}.`, user.id);
  audit(user.id, "report", r.id, "signed", { version: r.version, hash, witnessId }, id);
  res.json({ ok: true, hash });
});

casesRouter.post("/:id/report/cosign", (req, res) => {
  const id = idParam(req);
  const user = userOf(req);
  requireRole(req, ["SURGEON", "APPROVER"], "co-sign reports");
  const r = db.prepare(`SELECT * FROM reports WHERE case_id = ?`).get(id) as Record<string, any>;
  if (r.status !== "Signed") throw new HttpError(409, "The report must be signed before it can be co-signed.");
  if (r.signed_by === user.id) throw new HttpError(400, "You signed this report. A co-signature must come from someone else.");
  verifySigner(user.id, String(body(req).pin ?? ""), "Your");
  db.prepare(`UPDATE reports SET cosigned_by = ?, cosigned_at = ? WHERE case_id = ?`).run(user.id, now(), id);
  audit(user.id, "report", r.id, "co-signed", null, id);
  res.json({ ok: true });
});

casesRouter.post("/:id/report/amend", (req, res) => {
  const id = idParam(req);
  const user = userOf(req);
  requireRole(req, ["SURGEON"], "amend reports");
  const reason = String(required(body(req).reason, "Amendment reason"));
  const r = db.prepare(`SELECT * FROM reports WHERE case_id = ?`).get(id) as Record<string, any>;
  if (r.status !== "Signed") throw new HttpError(409, "Only signed reports can be amended.");
  db.transaction(() => {
    db.prepare(`INSERT INTO report_versions (report_id, version, snapshot, signature_hash, amended_by, reason, ts) VALUES (?,?,?,?,?,?,?)`).run(
      r.id, r.version, JSON.stringify({ ...reportPayload(r), signed_by: r.signed_by, signed_at: r.signed_at }), r.signature_hash, user.id, reason, now(),
    );
    db.prepare(`UPDATE reports SET status = 'Draft', version = version + 1, signed_by = NULL, signed_at = NULL, cosigned_by = NULL, cosigned_at = NULL, witness_id = NULL, witnessed_at = NULL, signature_hash = NULL, updated_at = ? WHERE case_id = ?`).run(now(), id);
  })();
  event(id, "report", `Amendment started (v${r.version + 1}): ${reason}.`, user.id, "warning");
  audit(user.id, "report", r.id, "amendment started", { reason }, id);
  res.json({ ok: true });
});

casesRouter.get("/:id/report/verify", (req, res) => {
  const id = idParam(req);
  const r = db.prepare(`SELECT * FROM reports WHERE case_id = ?`).get(id) as Record<string, any>;
  const versions = db.prepare(`SELECT v.*, s.name amended_by_name FROM report_versions v LEFT JOIN staff s ON s.id = v.amended_by WHERE report_id = ? ORDER BY version DESC`).all(r.id);
  if (r.status !== "Signed") return res.json({ signed: false, valid: false, versions });
  const expected = signatureHash(reportPayload(r), r.signed_by, r.signed_at);
  res.json({ signed: true, valid: expected === r.signature_hash, hash: r.signature_hash, versions });
});

// ---------- Billing & audit ----------
casesRouter.get("/:id/claim", (req, res) => {
  const id = idParam(req);
  getCase(id);
  res.json(buildClaim(id));
});

casesRouter.get("/:id/audit", (req, res) => {
  const id = idParam(req);
  res.json(db.prepare(`SELECT a.*, s.name staff_name FROM audit_log a LEFT JOIN staff s ON s.id = a.staff_id WHERE a.case_id = ? ORDER BY a.ts DESC LIMIT 300`).all(id));
});

export function decideApproval(req: Request) {
  const aid = idParam(req, "aid");
  const user = userOf(req);
  const b = body(req);
  const a = db.prepare(`SELECT * FROM approvals WHERE id = ?`).get(aid) as Record<string, any> | undefined;
  if (!a) throw new HttpError(404, "Approval not found.");
  if (a.status !== "Pending") throw new HttpError(409, `Already ${a.status.toLowerCase()}.`);
  const who: Record<string, string[]> = {
    PRE_AUTH: ["BILLING", "OT_COORDINATOR"], ANESTHESIA_FITNESS: ["ANESTHESIOLOGIST"], HIGH_COST_IMPLANT: ["APPROVER"],
    HOD_APPROVAL: ["APPROVER"], ICU_BED: ["APPROVER", "OT_COORDINATOR"],
  };
  requireRole(req, who[a.kind] ?? ["APPROVER"], `decide ${a.kind.toLowerCase().replace(/_/g, " ")} requests`);
  const decision = String(required(b.decision, "Decision"));
  if (!["Approved", "Rejected"].includes(decision)) throw new HttpError(400, "Decision must be approved or rejected.");
  if (decision === "Rejected" && !b.remarks) throw new HttpError(400, "Give a reason for rejecting.");
  if (a.kind === "PRE_AUTH" && decision === "Approved" && !b.referenceNo) throw new HttpError(400, "Enter the insurer's authorization number.");
  verifySigner(user.id, String(b.pin ?? ""), "Your");
  let witnessId: number | null = null;
  if (b.witnessId) {
    witnessId = Number(b.witnessId);
    if (witnessId === user.id) throw new HttpError(400, "The witness must be a different person.");
    verifySigner(witnessId, String(b.witnessPin ?? ""), "Witness");
  }
  const ts = now();
  db.prepare(`UPDATE approvals SET status = ?, approver_id = ?, decided_at = ?, reference_no = ?, valid_until = ?, remarks = ?, witness_id = ?, signature_hash = ? WHERE id = ?`).run(
    decision, user.id, ts, b.referenceNo ?? null, b.validUntil ?? null, b.remarks ?? null, witnessId, signatureHash({ aid, decision, remarks: b.remarks }, user.id, ts), aid,
  );
  event(a.case_id, "approval", `${a.kind.replace(/_/g, " ").toLowerCase()} ${decision.toLowerCase()}${b.remarks ? `: ${b.remarks}` : ""}.`, user.id, decision === "Rejected" ? "warning" : "info");
  audit(user.id, "approval", aid, decision.toLowerCase(), { kind: a.kind, witnessId }, a.case_id);
  const status = refreshApprovalStatus(a.case_id);
  return { ok: true, caseStatus: status };
}
