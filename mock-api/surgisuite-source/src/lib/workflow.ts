import { db, now } from "../db.js";
import { HttpError } from "../auth.js";

export const STATUSES = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "CHECKED_IN",
  "IN_OR",
  "IN_SURGERY",
  "RECOVERY",
  "COMPLETED",
  "CANCELLED",
  "POSTPONED",
] as const;

export type Milestone = {
  code: string;
  label: string;
  requires?: string;
  status?: string;
};

export const MILESTONES: Milestone[] = [
  { code: "IN_PREOP", label: "In pre-op", status: "CHECKED_IN" },
  { code: "IN_ROOM", label: "In room", requires: "IN_PREOP", status: "IN_OR" },
  { code: "ANES_START", label: "Anesthesia start", requires: "IN_ROOM" },
  { code: "INDUCTION_DONE", label: "Induction complete", requires: "ANES_START" },
  { code: "TIME_OUT", label: "Time-out", requires: "INDUCTION_DONE" },
  { code: "INCISION", label: "Incision", requires: "TIME_OUT", status: "IN_SURGERY" },
  { code: "CLOSURE_END", label: "Closure complete", requires: "INCISION" },
  { code: "ANES_END", label: "Anesthesia end", requires: "CLOSURE_END" },
  { code: "OUT_OF_ROOM", label: "Out of room", requires: "ANES_END", status: "RECOVERY" },
  { code: "PACU_IN", label: "PACU arrival", requires: "OUT_OF_ROOM" },
  { code: "PACU_OUT", label: "PACU discharge", requires: "PACU_IN", status: "COMPLETED" },
  { code: "ROOM_READY", label: "Room ready", requires: "OUT_OF_ROOM" },
];

export const CHECKLIST_TEMPLATE: Record<string, string[]> = {
  SIGN_IN: [
    "Patient identity, site, procedure and consent confirmed",
    "Surgical site marked",
    "Anesthesia machine and medication check complete",
    "Pulse oximeter on and working",
    "Known allergies reviewed",
    "Difficult airway or aspiration risk assessed",
    "Risk of >500 ml blood loss assessed; blood available if needed",
  ],
  TIME_OUT: [
    "Team members introduced by name and role",
    "Patient, site and procedure confirmed aloud",
    "Antibiotic prophylaxis given within the last 60 minutes",
    "Surgeon reviewed critical or unexpected steps",
    "Anesthesia reviewed patient-specific concerns",
    "Sterility confirmed, including indicator results",
    "Essential imaging displayed",
  ],
  SIGN_OUT: [
    "Procedure name recorded",
    "Instrument, sponge and needle counts correct",
    "Specimens labelled with patient name",
    "Equipment problems addressed",
    "Recovery concerns handed over",
  ],
};

export const COUNT_ITEMS = ["Sponges", "Needles", "Instruments", "Blades"];

export function seedCaseScaffold(caseId: number) {
  const insC = db.prepare(`INSERT INTO checklist_items (case_id, phase, item, sort) VALUES (?,?,?,?)`);
  for (const [phase, items] of Object.entries(CHECKLIST_TEMPLATE)) {
    items.forEach((item, i) => insC.run(caseId, phase, item, i));
  }
  const insCount = db.prepare(`INSERT INTO counts (case_id, item) VALUES (?,?)`);
  COUNT_ITEMS.forEach((c) => insCount.run(caseId, c));
  const dx = db
    .prepare(`SELECT d.description FROM case_diagnoses cd JOIN diagnoses d ON d.id = cd.diagnosis_id WHERE cd.case_id = ? ORDER BY cd.is_primary DESC LIMIT 1`)
    .get(caseId) as { description: string } | undefined;
  db.prepare(`INSERT INTO reports (case_id, indication, updated_at) VALUES (?,?,?)`).run(caseId, dx ? `${dx.description}.` : "", now());
}

export function checklistComplete(caseId: number, phase: string) {
  const r = db
    .prepare(`SELECT COUNT(*) total, SUM(checked) done FROM checklist_items WHERE case_id = ? AND phase = ?`)
    .get(caseId, phase) as { total: number; done: number | null };
  return r.total > 0 && (r.done ?? 0) === r.total;
}

export function countsReconciled(caseId: number) {
  const rows = db.prepare(`SELECT * FROM counts WHERE case_id = ?`).all(caseId) as {
    initial: number; added: number; final: number | null; verified_by: number | null; witness_id: number | null;
  }[];
  return rows.length > 0 && rows.every((r) => r.final !== null && r.final === r.initial + r.added && r.verified_by && r.witness_id);
}

type CaseRow = { id: number; status: string; case_class: string };

export function blockingApprovals(caseId: number) {
  return db
    .prepare(`SELECT kind, status FROM approvals WHERE case_id = ? AND required = 1 AND status != 'Approved'`)
    .all(caseId) as { kind: string; status: string }[];
}

export function missingConsents(caseId: number) {
  const have = new Set(
    (db.prepare(`SELECT kind FROM consents WHERE case_id = ?`).all(caseId) as { kind: string }[]).map((r) => r.kind),
  );
  return ["SURGERY", "ANESTHESIA"].filter((k) => !have.has(k));
}

/** Returns blocking reasons for recording a milestone. Empty array means allowed. */
export function milestoneBlockers(c: CaseRow, code: string): string[] {
  const m = MILESTONES.find((x) => x.code === code);
  if (!m) return ["Unknown milestone."];
  const issues: string[] = [];
  if (["CANCELLED", "POSTPONED", "REQUESTED", "PENDING_APPROVAL"].includes(c.status) && c.case_class !== "Emergency") {
    issues.push("Case must be scheduled with all approvals before it can start.");
  }
  if (m.requires) {
    const has = db.prepare(`SELECT 1 FROM case_milestones WHERE case_id = ? AND code = ?`).get(c.id, m.requires);
    if (!has) issues.push(`Record "${MILESTONES.find((x) => x.code === m.requires)!.label}" first.`);
  }
  if (code === "IN_ROOM") {
    if (!checklistComplete(c.id, "SIGN_IN")) issues.push("Complete the Sign-in checklist.");
    if (c.case_class !== "Emergency") {
      const missing = missingConsents(c.id);
      if (missing.length) issues.push(`Record consent: ${missing.map((k) => k.toLowerCase()).join(", ")}.`);
    }
    const team = db.prepare(`SELECT role FROM case_team WHERE case_id = ?`).all(c.id) as { role: string }[];
    if (!team.some((t) => t.role === "Primary Surgeon")) issues.push("Assign a primary surgeon.");
    if (!team.some((t) => t.role === "Anesthesiologist")) issues.push("Assign an anesthesiologist.");
  }
  if (code === "INCISION" && !checklistComplete(c.id, "TIME_OUT")) issues.push("Complete the Time-out checklist.");
  if (code === "OUT_OF_ROOM") {
    if (!checklistComplete(c.id, "SIGN_OUT")) issues.push("Complete the Sign-out checklist.");
    if (!countsReconciled(c.id)) issues.push("Reconcile and witness all counts.");
  }
  if (code === "PACU_OUT") {
    const s = db
      .prepare(`SELECT value FROM scores WHERE case_id = ? AND kind = 'ALDRETE' ORDER BY ts DESC LIMIT 1`)
      .get(c.id) as { value: number } | undefined;
    if (!s || s.value < 9) issues.push("Record an Aldrete score of 9 or more before PACU discharge.");
  }
  return issues;
}

export function assertCanEdit(c: CaseRow) {
  if (["CANCELLED"].includes(c.status)) throw new HttpError(409, "This case is cancelled and read-only.");
}

/** Moves a case between REQUESTED / PENDING_APPROVAL / SCHEDULED based on approvals. */
export function refreshApprovalStatus(caseId: number) {
  const c = db.prepare(`SELECT id, status, case_class FROM cases WHERE id = ?`).get(caseId) as CaseRow;
  if (!["REQUESTED", "PENDING_APPROVAL", "SCHEDULED"].includes(c.status)) return c.status;
  const blocking = blockingApprovals(caseId);
  const next = c.case_class === "Emergency" || blocking.length === 0 ? "SCHEDULED" : "PENDING_APPROVAL";
  if (next !== c.status) db.prepare(`UPDATE cases SET status = ?, updated_at = ? WHERE id = ?`).run(next, now(), caseId);
  return next;
}

export function nextCaseNo() {
  const year = new Date().getFullYear();
  const r = db.prepare(`SELECT COUNT(*) n FROM cases WHERE case_no LIKE ?`).get(`SX-${year}-%`) as { n: number };
  return `SX-${year}-${String(r.n + 1).padStart(5, "0")}`;
}

export type Conflict = { kind: string; message: string; case_no: string };

/** Detects overlapping bookings for theatre, team members and equipment. */
export function findConflicts(opts: {
  start: string;
  durationMin: number;
  theatreId?: number | null;
  staffIds?: number[];
  equipmentIds?: number[];
  excludeCaseId?: number;
}): Conflict[] {
  const start = new Date(opts.start).getTime();
  const end = start + opts.durationMin * 60000;
  const rows = db
    .prepare(
      `SELECT id, case_no, theatre_id, scheduled_start, est_duration_min FROM cases
       WHERE status NOT IN ('CANCELLED','POSTPONED','COMPLETED') AND id != ? AND date(scheduled_start) BETWEEN date(?, '-1 day') AND date(?, '+1 day')`,
    )
    .all(opts.excludeCaseId ?? -1, opts.start, opts.start) as {
    id: number; case_no: string; theatre_id: number; scheduled_start: string; est_duration_min: number;
  }[];
  const overlapping = rows.filter((r) => {
    const s = new Date(r.scheduled_start).getTime();
    const e = s + r.est_duration_min * 60000;
    return s < end && e > start;
  });
  const conflicts: Conflict[] = [];
  for (const r of overlapping) {
    if (opts.theatreId && r.theatre_id === opts.theatreId) {
      conflicts.push({ kind: "theatre", case_no: r.case_no, message: `Theatre is booked for ${r.case_no}.` });
    }
    if (opts.staffIds?.length) {
      const busy = db
        .prepare(
          `SELECT s.name FROM case_team t JOIN staff s ON s.id = t.staff_id WHERE t.case_id = ? AND t.staff_id IN (${opts.staffIds.map(() => "?").join(",")})`,
        )
        .all(r.id, ...opts.staffIds) as { name: string }[];
      busy.forEach((b) => conflicts.push({ kind: "staff", case_no: r.case_no, message: `${b.name} is assigned to ${r.case_no}.` }));
    }
    if (opts.equipmentIds?.length) {
      const busy = db
        .prepare(
          `SELECT e.name FROM case_equipment ce JOIN equipment e ON e.id = ce.equipment_id WHERE ce.case_id = ? AND ce.equipment_id IN (${opts.equipmentIds.map(() => "?").join(",")})`,
        )
        .all(r.id, ...opts.equipmentIds) as { name: string }[];
      busy.forEach((b) => conflicts.push({ kind: "equipment", case_no: r.case_no, message: `${b.name} is in use for ${r.case_no}.` }));
    }
  }
  return conflicts;
}
