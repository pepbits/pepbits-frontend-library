import { db, migrate, SCHEMA } from "./db.js";
import { hashPin, signatureHash } from "./auth.js";
import { CHECKLIST_TEMPLATE, COUNT_ITEMS, MILESTONES } from "./lib/workflow.js";
import { aldrete, nnis, surgicalApgar } from "./lib/scores.js";
import {
  ALLERGIES, COMORBIDITIES, DIAGNOSES, EQUIPMENT, FIRST_NAMES, INSURERS, INVENTORY, LAST_NAMES, LOOKUPS,
  PROCEDURES, SECONDARY_FOR, STAFF, THEATRES,
} from "./seed-data.js";

// Deterministic PRNG so every seed looks the same relative to "now".
let s = 20261001;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const iso = (d: Date) => d.toISOString();
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export function seed(reset = false) {
  if (reset) throw new Error("Hosted seed reset is disabled");
  if (reset) {
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[];
    db.pragma("foreign_keys = OFF");
    for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name}"`);
    db.pragma("foreign_keys = ON");
  }
  migrate();
  const existing = db.prepare(`SELECT COUNT(*) n FROM staff`).get() as { n: number };
  if (existing.n > 0) return false;

  const tx = db.transaction(() => seedAll());
  tx();
  return true;
}

function seedAll() {
  const nowTs = new Date().toISOString();
  // ---------- Masters ----------
  const insL = db.prepare(`INSERT INTO lookups (category, code, label, sort) VALUES (?,?,?,?)`);
  for (const [cat, list] of Object.entries(LOOKUPS)) list.forEach((v, i) => insL.run(cat, v, v, i));

  const pin = hashPin("1234");
  const insS = db.prepare(`INSERT INTO staff (emp_code, name, role, specialty, title, email, phone, pin_hash) VALUES (?,?,?,?,?,?,?,?)`);
  const staffId: Record<string, number> = {};
  for (const [code, name, role, spec, title] of STAFF) {
    const email = name.toLowerCase().replace(/^dr\. /, "").replace(/[^a-z]+/g, ".") + "@surgisuite.health";
    staffId[code] = Number(insS.run(code, name, role, spec, title, email, `+1 555 0${int(100, 999)}`, pin).lastInsertRowid);
  }
  const staffByRole = (role: string) => STAFF.filter((x) => x[2] === role).map((x) => staffId[x[0]]);
  const surgeonsBySpec = (spec: string) => STAFF.filter((x) => x[2] === "SURGEON" && x[3] === spec).map((x) => staffId[x[0]]);

  const insT = db.prepare(`INSERT INTO theatres (code, name, kind, location) VALUES (?,?,?,?)`);
  const theatreId: Record<string, number> = {};
  for (const [code, name, kind, loc] of THEATRES) theatreId[code] = Number(insT.run(code, name, kind, loc).lastInsertRowid);

  const insE = db.prepare(`INSERT INTO equipment (code, name, category, home_theatre_id, status, last_service, next_service) VALUES (?,?,?,?,?,?,?)`);
  const equipId: Record<string, number> = {};
  for (const [code, name, cat, home, status] of EQUIPMENT) {
    const last = new Date(Date.now() - int(20, 160) * 86400000);
    equipId[code] = Number(insE.run(code, name, cat, home ? theatreId[home] : null, status, iso(last).slice(0, 10), iso(addMin(last, 180 * 1440)).slice(0, 10)).lastInsertRowid);
  }

  const insI = db.prepare(
    `INSERT INTO inventory_items (sku, name, category, uom, unit_cost, stock_qty, reorder_level, vendor, is_implant, billable, lot_no, expiry, sterile_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const itemId: Record<string, number> = {};
  for (const [sku, name, cat, uom, cost, stock, reorder, vendor, implant, billable] of INVENTORY) {
    const expiryDays = sku === "CON-HEM-01" ? 25 : sku === "IMP-IOL-01" ? 40 : int(120, 900);
    const sterile = cat === "Instrument tray" ? pick(["Sterile", "Sterile", "Sterile", "In CSSD"]) : "Sterile";
    itemId[sku] = Number(
      insI.run(sku, name, cat, uom, cost, stock, reorder, vendor, implant ?? 0, billable ?? 1, `L${int(10000, 99999)}`,
        cat === "Instrument tray" ? null : iso(new Date(Date.now() + expiryDays * 86400000)).slice(0, 10), sterile).lastInsertRowid,
    );
  }

  const insD = db.prepare(`INSERT INTO diagnoses (icd10, description, category) VALUES (?,?,?)`);
  const dxId: Record<string, number> = {};
  for (const [icd, desc, cat] of DIAGNOSES) dxId[icd] = Number(insD.run(icd, desc, cat).lastInsertRowid);

  const insP = db.prepare(
    `INSERT INTO procedures (cpt, name, specialty, op_type, default_approach, default_duration_min, t_time_min, wound_class, rvu, fee, is_addon, high_risk, requires_implant) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const insPD = db.prepare(`INSERT INTO procedure_diagnoses (procedure_id, diagnosis_id) VALUES (?,?)`);
  const insPI = db.prepare(`INSERT INTO preference_items (procedure_id, item_id, qty) VALUES (?,?,?)`);
  const procId: Record<string, number> = {};
  for (const p of PROCEDURES) {
    const id = Number(insP.run(p.cpt, p.name, p.specialty, p.opType, p.approach, p.dur, p.t, p.wound, p.rvu, p.fee, p.addon ? 1 : 0, p.highRisk ? 1 : 0, p.implant ? 1 : 0).lastInsertRowid);
    procId[p.cpt] = id;
    p.dx.forEach((d) => insPD.run(id, dxId[d]));
    p.items.forEach(([sku, q]) => insPI.run(id, itemId[sku], q));
  }

  const insPat = db.prepare(
    `INSERT INTO patients (mrn, name, dob, sex, blood_group, phone, allergies, comorbidities, weight_kg, height_cm, insurer, policy_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const patientIds: number[] = [];
  const femaleNames = new Set(["Olivia", "Emma", "Ava", "Zara", "Mia", "Isla", "Amelia", "Sofia", "Chloe", "Leila", "Grace", "Hana", "Maya", "Nadia", "Elif", "Ruth", "Keira", "Ines", "Yara", "Anya"]);
  for (let i = 0; i < 64; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const sex = femaleNames.has(first) ? "F" : "M";
    const age = int(19, 86);
    const dob = new Date(Date.now() - (age * 365 + int(0, 364)) * 86400000);
    const insurer = pick(INSURERS);
    patientIds.push(Number(insPat.run(
      `MRN${String(400120 + i * 13)}`, `${first} ${last}`, iso(dob).slice(0, 10), sex,
      pick(["A+", "O+", "B+", "AB+", "O-", "A-"]), `+1 555 1${int(100, 999)}`, pick(ALLERGIES), pick(COMORBIDITIES),
      int(52, 118), int(152, 192), insurer, insurer ? `POL-${int(100000, 999999)}` : null,
    ).lastInsertRowid));
  }

  // ---------- Cases ----------
  const now = new Date();
  const insCase = db.prepare(
    `INSERT INTO cases (case_no, patient_id, theatre_id, scheduled_start, est_duration_min, case_class, op_type, anesthesia_type, position, laterality, wound_class, asa_class, status, ebl_ml, delay_reason, cancel_reason, notes, rcri, created_by, created_at, updated_at)
     VALUES (@case_no,@patient_id,@theatre_id,@scheduled_start,@est,@case_class,@op_type,@anesthesia_type,@position,@laterality,@wound_class,@asa_class,@status,@ebl,@delay_reason,@cancel_reason,@notes,@rcri,@created_by,@created_at,@created_at)`,
  );
  const insCD = db.prepare(`INSERT OR IGNORE INTO case_diagnoses (case_id, diagnosis_id, is_primary) VALUES (?,?,?)`);
  const insCP = db.prepare(`INSERT INTO case_procedures (case_id, procedure_id, role, surgeon_id, approach, laterality, modifiers, performed, sort) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insTeam = db.prepare(`INSERT INTO case_team (case_id, staff_id, role, time_in, time_out) VALUES (?,?,?,?,?)`);
  const insCE = db.prepare(`INSERT OR IGNORE INTO case_equipment (case_id, equipment_id) VALUES (?,?)`);
  const insMs = db.prepare(`INSERT INTO case_milestones (case_id, code, ts, recorded_by) VALUES (?,?,?,?)`);
  const insChk = db.prepare(`INSERT INTO checklist_items (case_id, phase, item, checked, checked_by, ts, sort) VALUES (?,?,?,?,?,?,?)`);
  const insCnt = db.prepare(`INSERT INTO counts (case_id, item, initial, added, final, verified_by, witness_id, ts) VALUES (?,?,?,?,?,?,?,?)`);
  const insVit = db.prepare(`INSERT INTO anesthesia_vitals (case_id, ts, hr, sbp, dbp, spo2, etco2, temp, recorded_by) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insMed = db.prepare(`INSERT INTO anesthesia_meds (case_id, ts, drug, dose, unit, route, given_by) VALUES (?,?,?,?,?,?,?)`);
  const insOrd = db.prepare(`INSERT INTO case_orders (case_id, kind, test, priority, status, result, critical, radiation_mgy, fluoro_sec, quantity, ordered_by, ordered_at, resulted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insItem = db.prepare(`INSERT OR IGNORE INTO case_items (case_id, item_id, qty_planned, qty_used, lot_no, serial_no, consumed) VALUES (?,?,?,?,?,?,?)`);
  const insAppr = db.prepare(`INSERT INTO approvals (case_id, kind, status, required, requested_by, requested_at, approver_id, decided_at, reference_no, valid_until, remarks, signature_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insCons = db.prepare(`INSERT INTO consents (case_id, kind, signed_by_name, relationship, risks_explained, obtained_by, witness_id, ts, signature_hash) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insScore = db.prepare(`INSERT INTO scores (case_id, kind, value, band, details, recorded_by, ts) VALUES (?,?,?,?,?,?,?)`);
  const insRep = db.prepare(`INSERT INTO reports (case_id, indication, findings, technique, specimens, complications, drains, postop_plan, status, signed_by, signed_at, witness_id, witnessed_at, signature_hash, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insEvt = db.prepare(`INSERT INTO case_events (case_id, ts, kind, text, severity, staff_id) VALUES (?,?,?,?,?,?)`);
  const insAud = db.prepare(`INSERT INTO audit_log (ts, staff_id, entity, entity_id, case_id, action, detail) VALUES (?,?,?,?,?,?,?)`);

  let seq = 0;
  const year = now.getFullYear();
  const coordinator = staffId.OTC001;
  const approverIds = staffByRole("APPROVER");
  const anesIds = staffByRole("ANESTHESIOLOGIST");
  const anesTech = staffByRole("ANESTHESIA_TECH");
  const scrub = staffByRole("SCRUB_NURSE");
  const circ = staffByRole("CIRCULATING_NURSE");
  const assistants = staffByRole("ASSISTANT_SURGEON");
  const radiographers = staffByRole("RADIOGRAPHER");
  const billing = staffId.BIL001;

  type Phase = "past" | "live" | "future";
  function makeCase(theatreCode: string, start: Date, phase: Phase, opts: { cancelled?: boolean; pendingApproval?: boolean } = {}) {
    const theatreSpecs = THEATRES.find((t) => t[0] === theatreCode)![4];
    const candidates = PROCEDURES.filter((p) => theatreSpecs.includes(p.specialty) && !p.addon);
    const proc = pick(candidates);
    const surgeons = surgeonsBySpec(proc.specialty);
    const surgeon = pick(surgeons);
    const patientId = pick(patientIds);
    const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(patientId) as Record<string, any>;
    const caseClass = rnd() < 0.08 ? "Emergency" : rnd() < 0.12 ? "Urgent" : "Elective";
    const lat = proc.laterality ? pick(["Left", "Right"]) : "N/A";
    const asa = pick(proc.highRisk ? ["III", "III", "IV", "II"] : ["I", "II", "II", "III"]) + (caseClass === "Emergency" ? "E" : "");
    const actualDur = Math.round(proc.dur * (0.8 + rnd() * 0.55));
    const secondaryCpt = SECONDARY_FOR[proc.cpt] && rnd() < 0.55 ? pick(SECONDARY_FOR[proc.cpt]) : null;
    const secondary = secondaryCpt ? PROCEDURES.find((p) => p.cpt === secondaryCpt)! : null;
    const est = proc.dur + 35 + (secondary?.dur ?? 0);
    seq++;
    const status = opts.cancelled ? "CANCELLED" : phase === "past" ? "COMPLETED" : opts.pendingApproval ? "PENDING_APPROVAL" : "SCHEDULED";
    const createdAt = iso(addMin(start, -int(3, 21) * 1440));
    const rcriInputs = proc.specialty === "Cardiothoracic" || proc.specialty === "Vascular Surgery"
      ? { highRiskSurgery: !!proc.highRisk, ischemicHeartDisease: proc.cpt === "33533", heartFailure: rnd() < 0.2, cerebrovascularDisease: proc.cpt === "35301", insulinDiabetes: rnd() < 0.25, creatinineOver2: proc.cpt === "36821" }
      : {};
    const caseId = Number(insCase.run({
      case_no: `SX-${year}-${String(seq).padStart(5, "0")}`, patient_id: patientId, theatre_id: theatreId[theatreCode],
      scheduled_start: iso(start), est, case_class: caseClass, op_type: proc.opType, anesthesia_type: proc.anesthesia,
      position: proc.position, laterality: lat, wound_class: proc.wound, asa_class: asa, status,
      ebl: null, delay_reason: null, cancel_reason: opts.cancelled ? pick(LOOKUPS.CANCEL_REASON) : null,
      notes: null, rcri: JSON.stringify(rcriInputs), created_by: coordinator, created_at: createdAt,
    }).lastInsertRowid);
    insAud.run(createdAt, coordinator, "case", caseId, caseId, "created", JSON.stringify({ procedure: proc.cpt }));

    // Diagnoses and procedures
    insCD.run(caseId, dxId[pick(proc.dx)], 1);
    const comorb = String(patient.comorbidities);
    if (comorb.includes("Hypertension")) insCD.run(caseId, dxId["I10"], 0);
    if (comorb.includes("diabetes")) insCD.run(caseId, dxId["E11.9"], 0);
    if (comorb.includes("COPD")) insCD.run(caseId, dxId["J44.9"], 0);
    if (comorb.includes("anticoagulation")) insCD.run(caseId, dxId["Z79.01"], 0);
    const performed = phase === "past" && !opts.cancelled ? 1 : 0;
    insCP.run(caseId, procId[proc.cpt], "Primary", surgeon, proc.approach, lat, "", performed, 0);
    let assistantId: number | null = null;
    let anesthId = pick(anesIds);
    if (secondary) {
      const secSurgeon = secondary.specialty === "Anesthesiology" ? anesthId : surgeon;
      insCP.run(caseId, procId[secondary.cpt], secondary.addon ? "Add-on" : "Secondary", secSurgeon, secondary.approach, secondary.laterality ? lat : "N/A", "", performed, 1);
    }

    // Team
    const team: [number, string][] = [[surgeon, "Primary Surgeon"], [anesthId, "Anesthesiologist"], [pick(anesTech), "Anesthesia Technician"], [pick(scrub), "Scrub Nurse"], [pick(circ), "Circulating Nurse"]];
    if (proc.opType === "Major" || rnd() < 0.4) {
      const specAssist = STAFF.filter((x) => x[2] === "ASSISTANT_SURGEON" && x[3] === proc.specialty).map((x) => staffId[x[0]]);
      assistantId = specAssist.length ? pick(specAssist) : pick(assistants);
      team.push([assistantId, "Assistant Surgeon"]);
    }
    if (secondary && !secondary.addon && proc.specialty === "General Surgery") {
      const other = surgeonsBySpec("General Surgery").filter((x) => x !== surgeon);
      if (other.length) team.push([pick(other), "Secondary Surgeon"]);
    }
    const usesImaging = (proc.equipment ?? []).some((e) => e.startsWith("EQ-CARM"));
    if (usesImaging) team.push([pick(radiographers), "Radiographer"]);
    if (proc.specialty === "Cardiothoracic" && proc.opType === "Major") team.push([staffId.PER001, "Perfusionist"]);
    (proc.equipment ?? []).forEach((e) => insCE.run(caseId, equipId[e]));

    // Preference card items
    const allItems = [...proc.items, ...(secondary?.items ?? [])];
    for (const [sku, qty] of allItems) {
      const inv = INVENTORY.find((x) => x[0] === sku)!;
      const used = performed ? qty + (rnd() < 0.1 ? 1 : 0) : 0;
      const isImplant = !!inv[8];
      insItem.run(caseId, itemId[sku], qty, used, isImplant && performed ? `L${int(10000, 99999)}` : null, isImplant && performed ? `SN${int(1000000, 9999999)}` : null, performed);
    }

    // Approvals
    const requested = createdAt;
    const approvedAt = iso(addMin(new Date(createdAt), int(120, 2880)));
    const approvalsDone = phase !== "future" || !opts.pendingApproval;
    const needAuth = !!patient.insurer;
    if (needAuth) {
      const ok = approvalsDone || rnd() < 0.4;
      insAppr.run(caseId, "PRE_AUTH", ok ? "Approved" : "Pending", caseClass === "Emergency" ? 0 : 1, coordinator, requested,
        ok ? billing : null, ok ? approvedAt : null, ok ? `PA-${int(1000000, 9999999)}` : null,
        ok ? iso(addMin(start, 30 * 1440)).slice(0, 10) : null, ok ? `Approved by ${patient.insurer}` : null, null);
    }
    {
      const ok = approvalsDone || rnd() < 0.5;
      insAppr.run(caseId, "ANESTHESIA_FITNESS", ok ? "Approved" : "Pending", 1, surgeon, requested, ok ? anesthId : null, ok ? approvedAt : null, null, null, ok ? `ASA ${asa}. Fit for ${proc.anesthesia.toLowerCase()}.` : null, ok ? signatureHash({ caseId, kind: "ANESTHESIA_FITNESS" }, anesthId, approvedAt) : null);
    }
    if (proc.implant && proc.items.some(([sku]) => (INVENTORY.find((x) => x[0] === sku)![4]) > 1000)) {
      const ok = approvalsDone;
      const ap = pick(approverIds);
      insAppr.run(caseId, "HIGH_COST_IMPLANT", ok ? "Approved" : "Pending", 1, surgeon, requested, ok ? ap : null, ok ? approvedAt : null, null, null, ok ? "Implant cost within contract." : null, ok ? signatureHash({ caseId, kind: "HIGH_COST_IMPLANT" }, ap, approvedAt) : null);
    }
    if (proc.highRisk && proc.opType === "Major") {
      const ok = approvalsDone;
      const ap = staffId.APR002;
      insAppr.run(caseId, "HOD_APPROVAL", ok ? "Approved" : "Pending", 1, surgeon, requested, ok ? ap : null, ok ? approvedAt : null, null, null, ok ? "High-risk case reviewed at surgical meeting." : null, ok ? signatureHash({ caseId, kind: "HOD_APPROVAL" }, ap, approvedAt) : null);
    }

    if (opts.cancelled || phase === "future") {
      // Scaffold empty checklist/counts/report for future cases
      for (const [ph, items] of Object.entries(CHECKLIST_TEMPLATE)) items.forEach((it, i) => insChk.run(caseId, ph, it, 0, null, null, i));
      COUNT_ITEMS.forEach((c) => insCnt.run(caseId, c, 0, 0, null, null, null, null));
      insRep.run(caseId, "", "", "", "", "None", "", "", "Draft", null, null, null, null, null, nowTs);
      if (phase === "future" && rnd() < 0.5 && !opts.pendingApproval) {
        const t = iso(addMin(start, -int(1, 4) * 1440));
        insCons.run(caseId, "SURGERY", patient.name, "Self", "Bleeding, infection, injury to nearby structures, need for further surgery.", surgeon, pick(circ), t, signatureHash({ caseId, kind: "SURGERY" }, surgeon, t));
        insCons.run(caseId, "ANESTHESIA", patient.name, "Self", "Sore throat, nausea, dental injury, awareness, allergic reaction.", anesthId, pick(circ), t, signatureHash({ caseId, kind: "ANESTHESIA" }, anesthId, t));
      }
      team.forEach(([sid, role]) => insTeam.run(caseId, sid, role, null, null));
      return caseId;
    }

    // ---- Past or live: build the timeline ----
    const delay = rnd() < 0.72 ? int(-5, 8) : int(15, 45);
    const delayReason = delay > 10 ? pick(LOOKUPS.DELAY_REASON) : null;
    const t: Record<string, Date> = {};
    t.IN_PREOP = addMin(start, -int(40, 70));
    t.IN_ROOM = addMin(start, delay);
    t.ANES_START = addMin(t.IN_ROOM, int(2, 5));
    t.INDUCTION_DONE = addMin(t.ANES_START, int(8, 18));
    t.TIME_OUT = addMin(t.INDUCTION_DONE, int(4, 10));
    t.INCISION = addMin(t.TIME_OUT, int(2, 6));
    t.CLOSURE_END = addMin(t.INCISION, actualDur + (secondary?.dur ?? 0));
    t.ANES_END = addMin(t.CLOSURE_END, int(8, 15));
    t.OUT_OF_ROOM = addMin(t.ANES_END, int(3, 8));
    t.PACU_IN = addMin(t.OUT_OF_ROOM, int(2, 5));
    t.PACU_OUT = addMin(t.PACU_IN, int(45, 95));
    t.ROOM_READY = addMin(t.OUT_OF_ROOM, int(18, 35));
    const reached = (code: string) => t[code] <= now;
    const recorder: Record<string, number> = {};
    const circNurse = team.find((x) => x[1] === "Circulating Nurse")![0];
    const scrubNurse = team.find((x) => x[1] === "Scrub Nurse")![0];
    for (const m of MILESTONES) {
      if (!reached(m.code)) continue;
      recorder[m.code] = ["ANES_START", "INDUCTION_DONE", "ANES_END"].includes(m.code) ? anesthId : circNurse;
      insMs.run(caseId, m.code, iso(t[m.code]), recorder[m.code]);
      insEvt.run(caseId, iso(t[m.code]), "milestone", `${m.label} recorded.`, "info", recorder[m.code]);
    }
    let liveStatus = "SCHEDULED";
    for (const m of MILESTONES) if (reached(m.code) && m.status) liveStatus = m.status;
    team.forEach(([sid, role]) => insTeam.run(caseId, sid, role, reached("IN_ROOM") ? iso(t.IN_ROOM) : null, reached("OUT_OF_ROOM") ? iso(t.OUT_OF_ROOM) : null));

    // Checklists
    const phaseDone: Record<string, string> = { SIGN_IN: "IN_ROOM", TIME_OUT: "INCISION", SIGN_OUT: "OUT_OF_ROOM" };
    for (const [ph, items] of Object.entries(CHECKLIST_TEMPLATE)) {
      const done = reached(phaseDone[ph]);
      items.forEach((it, i) => insChk.run(caseId, ph, it, done ? 1 : 0, done ? circNurse : null, done ? iso(addMin(t[phaseDone[ph]], -2)) : null, i));
    }
    // Counts
    COUNT_ITEMS.forEach((c) => {
      const initial = c === "Sponges" ? 20 : c === "Needles" ? int(6, 12) : c === "Instruments" ? int(28, 64) : 3;
      const added = c === "Sponges" && rnd() < 0.4 ? 10 : 0;
      const fin = reached("OUT_OF_ROOM") ? initial + added : null;
      insCnt.run(caseId, c, reached("IN_ROOM") ? initial : 0, added, fin, fin !== null ? scrubNurse : null, fin !== null ? circNurse : null, fin !== null ? iso(addMin(t.OUT_OF_ROOM, -6)) : null);
    });
    // Consents (always before surgery)
    const ct = iso(addMin(start, -int(1, 3) * 1440));
    insCons.run(caseId, "SURGERY", patient.name, "Self", "Bleeding, infection, injury to nearby structures, need for further surgery.", surgeon, circNurse, ct, signatureHash({ caseId, kind: "SURGERY" }, surgeon, ct));
    insCons.run(caseId, "ANESTHESIA", patient.name, "Self", "Sore throat, nausea, dental injury, awareness, allergic reaction.", anesthId, circNurse, ct, signatureHash({ caseId, kind: "ANESTHESIA" }, anesthId, ct));
    if (proc.implant) insCons.run(caseId, "IMPLANT", patient.name, "Self", "Implant failure, loosening, infection, revision surgery.", surgeon, circNurse, ct, signatureHash({ caseId, kind: "IMPLANT" }, surgeon, ct));

    // Vitals every 10 minutes from anesthesia start
    if (reached("ANES_START")) {
      const end = reached("ANES_END") ? t.ANES_END : now;
      let hrBase = int(64, 88);
      let sbp = int(115, 145);
      for (let ts = t.ANES_START; ts <= end; ts = addMin(ts, 10)) {
        hrBase = Math.max(48, Math.min(115, hrBase + int(-6, 6)));
        sbp = Math.max(78, Math.min(170, sbp + int(-10, 9)));
        insVit.run(caseId, iso(ts), hrBase, sbp, Math.round(sbp * 0.58 + int(-4, 4)), int(95, 100), reached("INDUCTION_DONE") && ts >= t.INDUCTION_DONE ? int(32, 40) : null, Math.round((36.1 + rnd() * 0.9) * 10) / 10, anesthId);
      }
      const ga = proc.anesthesia.startsWith("General");
      const meds: [string, number, string, string, number][] = ga
        ? [["Midazolam", 2, "mg", "IV", 0], ["Fentanyl", 100, "mcg", "IV", 1], ["Propofol", int(120, 200), "mg", "IV", 2], ["Rocuronium", 50, "mg", "IV", 3], ["Cefazolin", 2, "g", "IV", 6], ["Dexamethasone", 8, "mg", "IV", 12], ["Ondansetron", 4, "mg", "IV", actualDur]]
        : [["Midazolam", 1, "mg", "IV", 0], ["Bupivacaine 0.5% heavy", 2.6, "ml", "Intrathecal", 4], ["Cefazolin", 2, "g", "IV", 8], ["Phenylephrine", 100, "mcg", "IV", 14]];
      if (proc.highRisk) meds.push(["Tranexamic acid", 1, "g", "IV", 20]);
      for (const [drug, dose, unit, route, off] of meds) {
        const ts = addMin(t.ANES_START, off);
        if (ts <= now) insMed.run(caseId, iso(ts), drug, dose, unit, route, anesthId);
      }
    }
    // Intra-op orders
    if (reached("INCISION")) {
      const ordBy = anesthId;
      if (usesImaging) {
        const ts = addMin(t.INCISION, int(15, 40));
        if (ts <= now) {
          const sec = int(20, 140);
          insOrd.run(caseId, "IMAGING", "C-arm fluoroscopy", "STAT", "Resulted", "Implant position satisfactory on AP and lateral views.", 0, Math.round(sec * 0.35 * 10) / 10, sec, null, surgeon, iso(ts), iso(addMin(ts, 3)));
        }
      }
      if (proc.highRisk || proc.opType === "Major") {
        const ts = addMin(t.INCISION, int(30, 70));
        if (ts <= now) {
          const hb = Math.round((8 + rnd() * 5) * 10) / 10;
          insOrd.run(caseId, "LAB", "Hemoglobin / hematocrit", "STAT", "Resulted", `Hb ${hb} g/dL`, hb < 8.5 ? 1 : 0, null, null, null, ordBy, iso(ts), iso(addMin(ts, 12)));
          insOrd.run(caseId, "LAB", "Arterial blood gas", "STAT", "Resulted", `pH 7.${int(34, 43)}, pCO2 ${int(36, 46)}, pO2 ${int(140, 260)}, lactate ${(0.8 + rnd() * 1.8).toFixed(1)}`, 0, null, null, null, ordBy, iso(ts), iso(addMin(ts, 8)));
          if (hb < 8.5) {
            insOrd.run(caseId, "BLOOD", "Packed red cells", "STAT", "Resulted", "2 units issued and transfused. Bedside check: 2 staff.", 0, null, null, 2, ordBy, iso(addMin(ts, 13)), iso(addMin(ts, 30)));
            insEvt.run(caseId, iso(addMin(ts, 14)), "alert", `Critical hemoglobin ${hb} g/dL. Transfusion started.`, "critical", ordBy);
          }
        }
      }
      if (["C71.9", "C50.911", "C18.7"].some((d) => proc.dx.includes(d))) {
        const ts = addMin(t.INCISION, int(40, 90));
        if (ts <= now) insOrd.run(caseId, "LAB", "Frozen section", "STAT", reached("CLOSURE_END") ? "Resulted" : "In progress", reached("CLOSURE_END") ? "Margins clear of tumor (>2 mm)." : null, 0, null, null, null, surgeon, iso(ts), reached("CLOSURE_END") ? iso(addMin(ts, 25)) : null);
      }
    }
    // Events
    if (delayReason) insEvt.run(caseId, iso(t.IN_ROOM), "delay", `Start delayed ${delay} min: ${delayReason}.`, "warning", circNurse);

    const ebl = reached("CLOSURE_END") ? (proc.highRisk ? int(150, 1200) : int(10, 250)) : null;
    db.prepare(`UPDATE cases SET status = ?, ebl_ml = ?, delay_reason = ? WHERE id = ?`).run(phase === "past" ? "COMPLETED" : liveStatus, ebl, delayReason, caseId);

    // Scores
    if (reached("CLOSURE_END")) {
      const sa = surgicalApgar(caseId);
      if (sa) insScore.run(caseId, "SURGICAL_APGAR", sa.value, sa.band, JSON.stringify(sa.details), anesthId, iso(t.CLOSURE_END));
      const n = nnis(caseId);
      insScore.run(caseId, "NNIS", n.value, n.band, JSON.stringify(n.details), surgeon, iso(t.CLOSURE_END));
    }
    if (reached("PACU_OUT")) {
      const al = aldrete({ activity: 2, respiration: 2, circulation: 2, consciousness: rnd() < 0.7 ? 2 : 1, oxygenation: 2 });
      insScore.run(caseId, "ALDRETE", al.value, al.band, JSON.stringify(al.details), circNurse, iso(addMin(t.PACU_OUT, -3)));
    }

    // Report
    const dxRow = db.prepare(`SELECT d.description FROM case_diagnoses cd JOIN diagnoses d ON d.id = cd.diagnosis_id WHERE cd.case_id = ? AND cd.is_primary = 1`).get(caseId) as { description: string };
    const report = {
      indication: `${dxRow.description}.`,
      findings: reached("CLOSURE_END") ? `Findings consistent with pre-operative diagnosis. ${proc.name} completed as planned.` : "",
      technique: reached("CLOSURE_END") ? `${proc.approach} approach under ${proc.anesthesia.toLowerCase()}. Patient positioned ${proc.position.toLowerCase()}. Standard prep and drape. ${proc.name} performed${lat !== "N/A" ? ` on the ${lat.toLowerCase()} side` : ""}. Hemostasis secured. Layered closure.` : "",
      specimens: proc.dx.some((d) => d.startsWith("C") || d.startsWith("K")) ? "Sent to histopathology." : "None",
      complications: "None",
      drains: proc.items.some(([s]) => s === "CON-DRN-15") ? "15 Fr closed suction drain" : "None",
      postop_plan: "Routine post-operative observations. Analgesia as charted. Mobilize as tolerated. Review in clinic in 2 weeks.",
    };
    const signed = phase === "past" && rnd() < 0.88;
    const signedAt = signed ? iso(addMin(t.PACU_OUT ?? t.OUT_OF_ROOM, int(10, 240))) : null;
    const witness = signed && rnd() < 0.5 && assistantId ? assistantId : null;
    insRep.run(caseId, report.indication, report.findings, report.technique, report.specimens, report.complications, report.drains, report.postop_plan,
      signed ? "Signed" : "Draft", signed ? surgeon : null, signedAt, witness, witness ? signedAt : null,
      signed ? signatureHash(report, surgeon, signedAt!) : null, signedAt ?? nowTs);
    if (signed) insAud.run(signedAt, surgeon, "report", caseId, caseId, "signed", null);
    return caseId;
  }

  // History: last 21 days, weekdays only
  for (let d = 21; d >= 1; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    if (day.getDay() === 0) continue;
    for (const [code] of THEATRES) {
      if (day.getDay() === 6 && !["OT-01", "OT-06"].includes(code)) continue;
      let cursor = new Date(day);
      cursor.setHours(7, 30 + int(0, 2) * 15, 0, 0);
      const count = int(2, 4);
      for (let i = 0; i < count; i++) {
        const cancelled = rnd() < 0.05;
        const id = makeCase(code, cursor, "past", { cancelled });
        const est = (db.prepare(`SELECT est_duration_min FROM cases WHERE id = ?`).get(id) as { est_duration_min: number }).est_duration_min;
        cursor = addMin(cursor, est + 30);
        cursor.setMinutes(Math.ceil(cursor.getMinutes() / 15) * 15, 0, 0);
        if (cursor.getHours() >= 17) break;
      }
    }
  }

  // Today: each theatre runs a chain of cases that started a few hours ago,
  // so the board shows finished, live and upcoming cases whenever you seed.
  THEATRES.forEach(([code], idx) => {
    let cursor = new Date(now.getTime() - (150 + idx * 30 + int(0, 60)) * 60000);
    cursor.setMinutes(Math.floor(cursor.getMinutes() / 15) * 15, 0, 0);
    for (let i = 0; i < 4; i++) {
      const phase = cursor <= now ? "live" : "future";
      const id = makeCase(code, cursor, phase, { pendingApproval: phase === "future" && i === 3 && rnd() < 0.5 });
      const ready = db.prepare(`SELECT ts FROM case_milestones WHERE case_id = ? AND code = 'ROOM_READY'`).get(id) as { ts: string } | undefined;
      const est = (db.prepare(`SELECT est_duration_min FROM cases WHERE id = ?`).get(id) as { est_duration_min: number }).est_duration_min;
      const planned = addMin(cursor, est + 30);
      cursor = ready ? new Date(Math.max(Date.parse(ready.ts) + 5 * 60000, planned.getTime())) : planned;
      cursor.setMinutes(Math.ceil(cursor.getMinutes() / 15) * 15, 0, 0);
    }
  });

  // Future: next 7 days
  for (let d = 1; d <= 7; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    if (day.getDay() === 0) continue;
    for (const [code] of THEATRES) {
      if (day.getDay() === 6 && code !== "OT-01") continue;
      let cursor = new Date(day);
      cursor.setHours(8, 0, 0, 0);
      const count = int(1, 3);
      for (let i = 0; i < count; i++) {
        makeCase(code, cursor, "future", { pendingApproval: rnd() < 0.3 });
        const est = (db.prepare(`SELECT est_duration_min FROM cases ORDER BY id DESC LIMIT 1`).get() as { est_duration_min: number }).est_duration_min;
        cursor = addMin(cursor, est + 30);
        cursor.setMinutes(Math.ceil(cursor.getMinutes() / 15) * 15, 0, 0);
      }
    }
  }

  // Reserve stock for upcoming cases
  db.exec(`UPDATE inventory_items SET reserved_qty = COALESCE((
    SELECT SUM(ci.qty_planned) FROM case_items ci JOIN cases c ON c.id = ci.case_id
    WHERE ci.item_id = inventory_items.id AND ci.consumed = 0 AND c.status NOT IN ('CANCELLED','COMPLETED','POSTPONED')), 0)`);
  // Keep stock healthy except for a few deliberately short items that demo the reorder alerts.
  const shortList = ["CON-HEM-01", "SUT-SIL-20", "IMP-THA-HD", "IMP-AVR-23"];
  const rows = db.prepare(`SELECT id, sku, reserved_qty, reorder_level FROM inventory_items`).all() as { id: number; sku: string; reserved_qty: number; reorder_level: number }[];
  for (const r of rows) {
    if (shortList.includes(r.sku)) continue;
    db.prepare(`UPDATE inventory_items SET stock_qty = MAX(stock_qty, ?) WHERE id = ?`).run(r.reserved_qty + r.reorder_level * 2 + int(2, 20), r.id);
  }
}

