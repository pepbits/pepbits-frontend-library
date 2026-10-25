import { Router } from "express";
import { db, audit } from "../db.js";
import { hashPin, HttpError, login, logout, requireAuth, requireRole } from "../auth.js";
import { body, idParam, required, userOf } from "../lib/http.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const b = body(req);
  const result = login(String(required(b.empCode, "Employee code")).toUpperCase(), String(required(b.pin, "PIN")));
  audit(result.user.id, "session", null, "login");
  res.json(result);
});

// Public directory used by the sign-in screen to pick a demo user.
authRouter.get("/directory", (_req, res) => {
  res.json(db.prepare(`SELECT emp_code, name, role, title FROM staff WHERE active = 1 ORDER BY role, name`).all());
});

authRouter.get("/me", requireAuth, (req, res) => res.json(userOf(req)));

authRouter.post("/logout", requireAuth, (req, res) => {
  logout(String(req.headers.authorization).slice(7));
  res.json({ ok: true });
});

export const mastersRouter = Router();

mastersRouter.get("/lookups", (_req, res) => {
  const rows = db.prepare(`SELECT category, code, label FROM lookups WHERE active = 1 ORDER BY category, sort`).all() as { category: string; code: string; label: string }[];
  const grouped: Record<string, string[]> = {};
  rows.forEach((r) => (grouped[r.category] ??= []).push(r.label));
  res.json(grouped);
});

mastersRouter.post("/lookups", (req, res) => {
  requireRole(req, ["ADMIN"], "edit lookup lists");
  const b = body(req);
  const cat = String(required(b.category, "Category"));
  const label = String(required(b.label, "Label"));
  const sort = (db.prepare(`SELECT COALESCE(MAX(sort),0)+1 s FROM lookups WHERE category = ?`).get(cat) as { s: number }).s;
  db.prepare(`INSERT INTO lookups (category, code, label, sort) VALUES (?,?,?,?)`).run(cat, label, label, sort);
  audit(userOf(req).id, "lookup", null, "created", { cat, label });
  res.status(201).json({ ok: true });
});

// ---------- Procedures (CPT master) ----------
mastersRouter.get("/procedures", (req, res) => {
  const q = `%${String(req.query.q ?? "").trim()}%`;
  const spec = String(req.query.specialty ?? "");
  const rows = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM procedure_diagnoses pd WHERE pd.procedure_id = p.id) dx_count,
              (SELECT COUNT(*) FROM preference_items pi WHERE pi.procedure_id = p.id) item_count
       FROM procedures p WHERE (p.cpt LIKE ? OR p.name LIKE ?) AND (? = '' OR p.specialty = ?) ORDER BY p.specialty, p.name`,
    )
    .all(q, q, spec, spec);
  res.json(rows);
});

mastersRouter.get("/procedures/:id", (req, res) => {
  const id = idParam(req);
  const p = db.prepare(`SELECT * FROM procedures WHERE id = ?`).get(id);
  if (!p) throw new HttpError(404, "Procedure not found.");
  const diagnoses = db.prepare(`SELECT d.* FROM procedure_diagnoses pd JOIN diagnoses d ON d.id = pd.diagnosis_id WHERE pd.procedure_id = ?`).all(id);
  const items = db.prepare(`SELECT pi.qty, i.* FROM preference_items pi JOIN inventory_items i ON i.id = pi.item_id WHERE pi.procedure_id = ?`).all(id);
  res.json({ ...p, diagnoses, items });
});

function procFields(b: Record<string, any>) {
  return [
    String(required(b.cpt, "CPT code")).trim(), String(required(b.name, "Name")).trim(), String(required(b.specialty, "Specialty")),
    String(b.op_type ?? "Intermediate"), b.default_approach ?? "Open", Number(b.default_duration_min ?? 60), Number(b.t_time_min ?? 120),
    String(b.wound_class ?? "I"), Number(b.rvu ?? 0), Number(b.fee ?? 0), b.is_addon ? 1 : 0, b.high_risk ? 1 : 0, b.requires_implant ? 1 : 0,
  ];
}

mastersRouter.post("/procedures", (req, res) => {
  requireRole(req, ["ADMIN", "BILLING", "OT_COORDINATOR"], "add procedures");
  const f = procFields(body(req));
  if (!/^\d{4}[0-9A-Z]$/.test(String(f[0]))) throw new HttpError(400, "CPT codes are five characters, for example 47562.");
  const exists = db.prepare(`SELECT 1 FROM procedures WHERE cpt = ?`).get(f[0]);
  if (exists) throw new HttpError(409, `CPT ${f[0]} already exists.`);
  const r = db.prepare(
    `INSERT INTO procedures (cpt, name, specialty, op_type, default_approach, default_duration_min, t_time_min, wound_class, rvu, fee, is_addon, high_risk, requires_implant) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(...f);
  audit(userOf(req).id, "procedure", Number(r.lastInsertRowid), "created", { cpt: f[0] });
  res.status(201).json({ id: r.lastInsertRowid });
});

mastersRouter.put("/procedures/:id", (req, res) => {
  requireRole(req, ["ADMIN", "BILLING", "OT_COORDINATOR"], "edit procedures");
  const id = idParam(req);
  const f = procFields(body(req));
  db.prepare(
    `UPDATE procedures SET cpt=?, name=?, specialty=?, op_type=?, default_approach=?, default_duration_min=?, t_time_min=?, wound_class=?, rvu=?, fee=?, is_addon=?, high_risk=?, requires_implant=? WHERE id = ?`,
  ).run(...f, id);
  audit(userOf(req).id, "procedure", id, "updated", body(req));
  res.json({ ok: true });
});

mastersRouter.put("/procedures/:id/mapping", (req, res) => {
  requireRole(req, ["ADMIN", "BILLING"], "edit CPT–ICD mapping");
  const id = idParam(req);
  const ids = (body(req).diagnosisIds ?? []) as number[];
  db.transaction(() => {
    db.prepare(`DELETE FROM procedure_diagnoses WHERE procedure_id = ?`).run(id);
    const ins = db.prepare(`INSERT INTO procedure_diagnoses (procedure_id, diagnosis_id) VALUES (?,?)`);
    ids.forEach((d) => ins.run(id, d));
  })();
  audit(userOf(req).id, "procedure", id, "mapping updated", { diagnosisIds: ids });
  res.json({ ok: true });
});

mastersRouter.put("/procedures/:id/preference", (req, res) => {
  requireRole(req, ["ADMIN", "SURGEON", "OT_COORDINATOR", "SCRUB_NURSE"], "edit preference cards");
  const id = idParam(req);
  const items = (body(req).items ?? []) as { itemId: number; qty: number }[];
  db.transaction(() => {
    db.prepare(`DELETE FROM preference_items WHERE procedure_id = ?`).run(id);
    const ins = db.prepare(`INSERT INTO preference_items (procedure_id, item_id, qty) VALUES (?,?,?)`);
    items.filter((i) => i.qty > 0).forEach((i) => ins.run(id, i.itemId, i.qty));
  })();
  audit(userOf(req).id, "procedure", id, "preference card updated", { items });
  res.json({ ok: true });
});

// ---------- Diagnoses (ICD-10) ----------
mastersRouter.get("/diagnoses", (req, res) => {
  const q = `%${String(req.query.q ?? "").trim()}%`;
  res.json(db.prepare(`SELECT * FROM diagnoses WHERE icd10 LIKE ? OR description LIKE ? ORDER BY category, icd10 LIMIT 200`).all(q, q));
});

mastersRouter.post("/diagnoses", (req, res) => {
  requireRole(req, ["ADMIN", "BILLING", "SURGEON"], "add diagnoses");
  const b = body(req);
  const icd = String(required(b.icd10, "ICD-10 code")).toUpperCase().trim();
  if (!/^[A-Z]\d{2}(\.[0-9A-Z]{1,4})?$/.test(icd)) throw new HttpError(400, "ICD-10 codes look like K80.20 or C61.");
  if (db.prepare(`SELECT 1 FROM diagnoses WHERE icd10 = ?`).get(icd)) throw new HttpError(409, `${icd} already exists.`);
  const r = db.prepare(`INSERT INTO diagnoses (icd10, description, category) VALUES (?,?,?)`).run(icd, String(required(b.description, "Description")), String(b.category ?? "Other"));
  audit(userOf(req).id, "diagnosis", Number(r.lastInsertRowid), "created", { icd });
  res.status(201).json({ id: r.lastInsertRowid });
});

// ---------- Theatres & equipment ----------
mastersRouter.get("/theatres", (_req, res) => res.json(db.prepare(`SELECT * FROM theatres ORDER BY code`).all()));

mastersRouter.post("/theatres", (req, res) => {
  requireRole(req, ["ADMIN"], "add theatres");
  const b = body(req);
  const r = db.prepare(`INSERT INTO theatres (code, name, kind, location, open_time, close_time) VALUES (?,?,?,?,?,?)`).run(
    String(required(b.code, "Code")), String(required(b.name, "Name")), String(b.kind ?? "General"), b.location ?? "", b.open_time ?? "07:00", b.close_time ?? "19:00",
  );
  audit(userOf(req).id, "theatre", Number(r.lastInsertRowid), "created", b);
  res.status(201).json({ id: r.lastInsertRowid });
});

mastersRouter.patch("/theatres/:id", (req, res) => {
  requireRole(req, ["ADMIN", "OT_COORDINATOR"], "change theatre status");
  const id = idParam(req);
  const status = String(required(body(req).status, "Status"));
  db.prepare(`UPDATE theatres SET status = ? WHERE id = ?`).run(status, id);
  audit(userOf(req).id, "theatre", id, "status", { status });
  res.json({ ok: true });
});

mastersRouter.get("/equipment", (_req, res) => {
  res.json(db.prepare(`SELECT e.*, t.code theatre_code FROM equipment e LEFT JOIN theatres t ON t.id = e.home_theatre_id ORDER BY e.category, e.name`).all());
});

mastersRouter.post("/equipment", (req, res) => {
  requireRole(req, ["ADMIN", "OT_COORDINATOR"], "add equipment");
  const b = body(req);
  const r = db.prepare(`INSERT INTO equipment (code, name, category, home_theatre_id, status) VALUES (?,?,?,?,?)`).run(
    String(required(b.code, "Code")), String(required(b.name, "Name")), String(b.category ?? "General"), b.home_theatre_id ?? null, b.status ?? "Ready",
  );
  audit(userOf(req).id, "equipment", Number(r.lastInsertRowid), "created", b);
  res.status(201).json({ id: r.lastInsertRowid });
});

mastersRouter.patch("/equipment/:id", (req, res) => {
  requireRole(req, ["ADMIN", "OT_COORDINATOR", "CIRCULATING_NURSE"], "change equipment status");
  const id = idParam(req);
  const status = String(required(body(req).status, "Status"));
  db.prepare(`UPDATE equipment SET status = ? WHERE id = ?`).run(status, id);
  audit(userOf(req).id, "equipment", id, "status", { status });
  res.json({ ok: true });
});

// ---------- Staff ----------
mastersRouter.get("/staff", (req, res) => {
  const role = String(req.query.role ?? "");
  res.json(
    db.prepare(`SELECT id, emp_code, name, role, specialty, title, email, phone, active FROM staff WHERE (? = '' OR role = ?) ORDER BY role, name`).all(role, role),
  );
});

mastersRouter.post("/staff", (req, res) => {
  requireRole(req, ["ADMIN"], "add staff");
  const b = body(req);
  const pin = String(required(b.pin, "PIN"));
  if (!/^\d{4,6}$/.test(pin)) throw new HttpError(400, "PIN must be 4 to 6 digits.");
  const r = db.prepare(`INSERT INTO staff (emp_code, name, role, specialty, title, email, phone, pin_hash) VALUES (?,?,?,?,?,?,?,?)`).run(
    String(required(b.emp_code, "Employee code")).toUpperCase(), String(required(b.name, "Name")), String(required(b.role, "Role")),
    b.specialty ?? null, b.title ?? null, b.email ?? null, b.phone ?? null, hashPin(pin),
  );
  audit(userOf(req).id, "staff", Number(r.lastInsertRowid), "created", { ...b, pin: undefined });
  res.status(201).json({ id: r.lastInsertRowid });
});

mastersRouter.patch("/staff/:id", (req, res) => {
  requireRole(req, ["ADMIN"], "edit staff");
  const id = idParam(req);
  const b = body(req);
  if (b.active !== undefined) db.prepare(`UPDATE staff SET active = ? WHERE id = ?`).run(b.active ? 1 : 0, id);
  if (b.pin) db.prepare(`UPDATE staff SET pin_hash = ? WHERE id = ?`).run(hashPin(String(b.pin)), id);
  audit(userOf(req).id, "staff", id, "updated", { active: b.active, pinReset: !!b.pin });
  res.json({ ok: true });
});

// ---------- Patients ----------
mastersRouter.get("/patients", (req, res) => {
  const q = `%${String(req.query.q ?? "").trim()}%`;
  res.json(db.prepare(`SELECT * FROM patients WHERE name LIKE ? OR mrn LIKE ? ORDER BY name LIMIT 50`).all(q, q));
});

mastersRouter.get("/patients/:id", (req, res) => {
  const id = idParam(req);
  const p = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(id);
  if (!p) throw new HttpError(404, "Patient not found.");
  const cases = db.prepare(
    `SELECT c.id, c.case_no, c.scheduled_start, c.status, pr.name procedure_name, pr.cpt FROM cases c
     LEFT JOIN case_procedures cp ON cp.case_id = c.id AND cp.role = 'Primary' LEFT JOIN procedures pr ON pr.id = cp.procedure_id
     WHERE c.patient_id = ? ORDER BY c.scheduled_start DESC`,
  ).all(id);
  res.json({ ...p, cases });
});

mastersRouter.post("/patients", (req, res) => {
  const b = body(req);
  const name = String(required(b.name, "Name")).trim();
  const dob = String(required(b.dob, "Date of birth"));
  const mrn = b.mrn ? String(b.mrn) : `MRN${Date.now().toString().slice(-6)}`;
  if (db.prepare(`SELECT 1 FROM patients WHERE mrn = ?`).get(mrn)) throw new HttpError(409, `MRN ${mrn} already exists.`);
  const r = db.prepare(
    `INSERT INTO patients (mrn, name, dob, sex, blood_group, phone, allergies, comorbidities, weight_kg, height_cm, insurer, policy_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(mrn, name, dob, String(required(b.sex, "Sex")), b.blood_group ?? null, b.phone ?? null, b.allergies || "NKDA", b.comorbidities ?? "", b.weight_kg ?? null, b.height_cm ?? null, b.insurer || null, b.policy_no || null);
  audit(userOf(req).id, "patient", Number(r.lastInsertRowid), "created", { mrn });
  res.status(201).json({ id: r.lastInsertRowid, mrn });
});
