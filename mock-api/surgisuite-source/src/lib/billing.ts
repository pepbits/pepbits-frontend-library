import { db } from "../db.js";

// Illustrative fee schedule constants — replace with the payer contract in production.
const ANESTHESIA_CONVERSION = 22.5;
const ANESTHESIA_BASE_UNITS: Record<string, number> = { Major: 8, Intermediate: 5, Minor: 3, "Day Care": 3 };
const ASA_UNITS: Record<string, number> = { I: 0, II: 0, III: 1, IV: 2, V: 3, VI: 0 };
const ROOM_RATE_PER_30: Record<string, number> = { Hybrid: 980, "Laminar flow": 720, General: 540, "Day care": 380 };
const SUPPLY_MARKUP = 1.25;

export type ChargeLine = {
  group: "Surgeon" | "Assistant" | "Anesthesia" | "Facility" | "Supplies" | "Implants";
  code: string;
  description: string;
  modifiers: string;
  units: number;
  amount: number;
  note?: string;
};

type ProcRow = {
  id: number; cpt: string; name: string; fee: number; is_addon: number; role: string;
  modifiers: string; laterality: string; performed: number; surgeon: string | null; procedure_id: number;
};

export function buildClaim(caseId: number) {
  const c = db
    .prepare(
      `SELECT c.*, t.kind theatre_kind, p.insurer, p.policy_no FROM cases c
       LEFT JOIN theatres t ON t.id = c.theatre_id JOIN patients p ON p.id = c.patient_id WHERE c.id = ?`,
    )
    .get(caseId) as Record<string, any>;
  const procs = db
    .prepare(
      `SELECT cp.id, cp.procedure_id, cp.role, cp.modifiers, cp.laterality, cp.performed, p.cpt, p.name, p.fee, p.is_addon, s.name surgeon
       FROM case_procedures cp JOIN procedures p ON p.id = cp.procedure_id LEFT JOIN staff s ON s.id = cp.surgeon_id
       WHERE cp.case_id = ? ORDER BY cp.sort`,
    )
    .all(caseId) as ProcRow[];
  const anyPerformed = procs.some((p) => p.performed);
  const billable = anyPerformed ? procs.filter((p) => p.performed) : procs;

  const lines: ChargeLine[] = [];
  const issues: { level: "error" | "warning"; message: string }[] = [];

  // Surgeon professional fees with multiple-procedure reduction (-51) and bilateral (-50)
  const primaryFirst = [...billable].sort((a, b) => (a.is_addon - b.is_addon) || (b.fee - a.fee));
  let fullPriceUsed = false;
  for (const p of primaryFirst) {
    const mods = new Set(p.modifiers.split(",").map((m) => m.trim()).filter(Boolean));
    let factor = 1;
    let note = "";
    if (!p.is_addon) {
      if (fullPriceUsed) { factor = 0.5; mods.add("51"); note = "Multiple procedure reduction 50%"; }
      fullPriceUsed = true;
    } else {
      note = "Add-on code, exempt from -51";
    }
    if (p.laterality === "Bilateral") { factor *= 1.5; mods.add("50"); note = [note, "Bilateral 150%"].filter(Boolean).join("; "); }
    if (p.laterality === "Left") mods.add("LT");
    if (p.laterality === "Right") mods.add("RT");
    lines.push({
      group: "Surgeon", code: p.cpt, description: `${p.name}${p.surgeon ? ` — ${p.surgeon}` : ""}`,
      modifiers: [...mods].join(", "), units: 1, amount: round(p.fee * factor), note,
    });
  }

  // Assistant surgeon (-80) at 16% of primary surgical fees
  const assistant = db
    .prepare(`SELECT s.name FROM case_team t JOIN staff s ON s.id = t.staff_id WHERE t.case_id = ? AND t.role = 'Assistant Surgeon' LIMIT 1`)
    .get(caseId) as { name: string } | undefined;
  if (assistant && billable.length) {
    const top = primaryFirst.find((p) => !p.is_addon) ?? primaryFirst[0];
    lines.push({ group: "Assistant", code: top.cpt, description: `Assistant at surgery — ${assistant.name}`, modifiers: "80", units: 1, amount: round(top.fee * 0.16), note: "16% of primary fee" });
  }

  // Anesthesia: (base + time + physical status) × conversion
  const ms = Object.fromEntries(
    (db.prepare(`SELECT code, ts FROM case_milestones WHERE case_id = ?`).all(caseId) as { code: string; ts: string }[]).map((m) => [m.code, m.ts]),
  );
  if (ms.ANES_START && ms.ANES_END) {
    const minutes = Math.round((Date.parse(ms.ANES_END) - Date.parse(ms.ANES_START)) / 60000);
    const timeUnits = Math.round((minutes / 15) * 10) / 10;
    const base = ANESTHESIA_BASE_UNITS[c.op_type] ?? 5;
    const asa = String(c.asa_class).replace("E", "");
    const ps = ASA_UNITS[asa] ?? 0;
    const units = base + timeUnits + ps + (String(c.asa_class).endsWith("E") ? 2 : 0);
    lines.push({
      group: "Anesthesia", code: "ANES", description: `Anesthesia ${minutes} min (${c.anesthesia_type ?? "type not set"})`,
      modifiers: `AA, P${["I", "II", "III", "IV", "V", "VI"].indexOf(asa) + 1}`, units, amount: round(units * ANESTHESIA_CONVERSION),
      note: `${base} base + ${timeUnits} time + ${ps} PS units`,
    });
  } else {
    issues.push({ level: "warning", message: "Anesthesia start and end times are missing, so anesthesia can't be billed yet." });
  }

  // Facility room time
  if (ms.IN_ROOM && ms.OUT_OF_ROOM) {
    const minutes = Math.round((Date.parse(ms.OUT_OF_ROOM) - Date.parse(ms.IN_ROOM)) / 60000);
    const blocks = Math.ceil(minutes / 30);
    const rate = ROOM_RATE_PER_30[c.theatre_kind] ?? 540;
    lines.push({ group: "Facility", code: "OR-TIME", description: `Operating room time ${minutes} min (${c.theatre_kind ?? "General"})`, modifiers: "", units: blocks, amount: round(blocks * rate), note: `${blocks} × 30 min` });
  }

  // Supplies and implants actually used
  const items = db
    .prepare(
      `SELECT ci.qty_used, ci.lot_no, ci.serial_no, i.sku, i.name, i.unit_cost, i.billable, i.is_implant FROM case_items ci
       JOIN inventory_items i ON i.id = ci.item_id WHERE ci.case_id = ? AND ci.qty_used > 0`,
    )
    .all(caseId) as { qty_used: number; lot_no: string; serial_no: string; sku: string; name: string; unit_cost: number; billable: number; is_implant: number }[];
  for (const it of items) {
    if (!it.billable) continue;
    if (it.is_implant && (!it.lot_no || !it.serial_no)) issues.push({ level: "error", message: `Implant ${it.name} needs lot and serial numbers before billing.` });
    lines.push({
      group: it.is_implant ? "Implants" : "Supplies", code: it.sku, description: it.name, modifiers: "",
      units: it.qty_used, amount: round(it.qty_used * it.unit_cost * SUPPLY_MARKUP),
      note: it.is_implant ? `Lot ${it.lot_no ?? "—"} / SN ${it.serial_no ?? "—"}` : undefined,
    });
  }

  // Coding validation (medical necessity: CPT ↔ ICD-10 mapping)
  const dx = db
    .prepare(`SELECT d.id, d.icd10, cd.is_primary FROM case_diagnoses cd JOIN diagnoses d ON d.id = cd.diagnosis_id WHERE cd.case_id = ?`)
    .all(caseId) as { id: number; icd10: string; is_primary: number }[];
  if (!dx.some((d) => d.is_primary)) issues.push({ level: "error", message: "Add a primary diagnosis (ICD-10)." });
  if (!procs.some((p) => p.role === "Primary")) issues.push({ level: "error", message: "Add a primary procedure (CPT)." });
  if (!anyPerformed && procs.length) issues.push({ level: "warning", message: "No procedure is marked as performed; the claim uses planned procedures." });
  const mapStmt = db.prepare(`SELECT 1 FROM procedure_diagnoses WHERE procedure_id = ? AND diagnosis_id = ?`);
  const anyMap = db.prepare(`SELECT 1 FROM procedure_diagnoses WHERE procedure_id = ? LIMIT 1`);
  for (const p of billable) {
    if (p.is_addon) continue;
    if (anyMap.get(p.procedure_id) && !dx.some((d) => mapStmt.get(p.procedure_id, d.id))) {
      issues.push({ level: "warning", message: `CPT ${p.cpt} has no linked diagnosis on this case. Check medical necessity.` });
    }
  }
  const auth = db
    .prepare(`SELECT status, reference_no, valid_until FROM approvals WHERE case_id = ? AND kind = 'PRE_AUTH' ORDER BY id DESC LIMIT 1`)
    .get(caseId) as { status: string; reference_no: string | null; valid_until: string | null } | undefined;
  if (c.insurer) {
    if (!auth || auth.status !== "Approved") issues.push({ level: "error", message: "Insurance pre-authorization is not approved." });
    else if (auth.valid_until && auth.valid_until < String(c.scheduled_start).slice(0, 10)) issues.push({ level: "error", message: "Pre-authorization expired before the surgery date." });
  }

  const totals: Record<string, number> = {};
  for (const l of lines) totals[l.group] = round((totals[l.group] ?? 0) + l.amount);
  const total = round(lines.reduce((a, l) => a + l.amount, 0));
  return {
    payer: c.insurer ?? "Self-pay",
    policyNo: c.policy_no,
    authorization: auth?.reference_no ?? null,
    diagnoses: dx.map((d) => d.icd10),
    lines, totals, total, issues,
    readyToSubmit: !issues.some((i) => i.level === "error"),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
