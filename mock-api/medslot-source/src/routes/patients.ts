import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { idParam, parse, notFound, bools } from "../lib/http.js";
import { audit } from "../lib/audit.js";
import { requireRole } from "../middleware/auth.js";
import { DATE_RE, nowLocal } from "../lib/time.js";

export const patientsRouter = Router();
const B = ["is_provisional", "sms_opt_in", "email_opt_in", "whatsapp_opt_in"];
const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").transform((s) => s.replace(/[ ()-]/g, ""));

/** New (unknown) patients: only name + phone are required. Everything else can be completed at the desk. */
const quick = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  phone,
  dob: z.string().regex(DATE_RE, "Use YYYY-MM-DD").nullish(),
  sex: z.enum(["female", "male", "other", "unknown"]).default("unknown"),
  email: z.string().trim().email("Enter a valid email").nullish().or(z.literal("").transform(() => null)),
  sms_opt_in: z.boolean().default(true),
  email_opt_in: z.boolean().default(true),
  whatsapp_opt_in: z.boolean().default(false),
  consent: z.literal(true, { error: "Patient consent to store their details is required" }),
});
const full = quick.extend({
  address: z.string().trim().nullish(),
  city: z.string().trim().nullish(),
  postal_code: z.string().trim().nullish(),
  preferred_language: z.string().trim().nullish(),
  insurance_provider: z.string().trim().nullish(),
  insurance_member_id: z.string().trim().nullish(),
  emergency_contact_name: z.string().trim().nullish(),
  emergency_contact_phone: z.string().trim().nullish(),
  consent: z.boolean().optional(),
});

/** Masks for list views so full identifiers are only shown on the detail page (minimum necessary). */
const maskPhone = (p: string) => (p.length > 4 ? p.slice(0, 3) + "•".repeat(Math.max(0, p.length - 5)) + p.slice(-2) : p);

patientsRouter.get("/", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const where = ["1=1"]; const args: unknown[] = [];
  if(req.user!.role==="provider"){where.push("EXISTS(SELECT 1 FROM appointments a JOIN appointment_resources ar ON ar.appointment_id=a.id WHERE a.patient_id=p.id AND ar.resource_id=?)");args.push(req.user!.resource_id);}
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.push("(p.first_name || ' ' || p.last_name LIKE ? OR p.mrn LIKE ? OR p.email LIKE ? OR (? <> '' AND p.phone LIKE ?))");
    args.push(`%${q}%`, `%${q}%`, `%${q}%`, digits, `%${digits}%`);
  }
  if (req.query.provisional === "1") where.push("p.is_provisional = 1");
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows = db.prepare(`
    SELECT p.id, p.mrn, p.first_name, p.last_name, p.dob, p.sex, p.phone, p.email, p.is_provisional, p.sms_opt_in, p.email_opt_in, p.whatsapp_opt_in, p.created_at,
      (SELECT MAX(start_at) FROM appointments a WHERE a.patient_id = p.id AND a.status = 'completed') AS last_visit,
      (SELECT MIN(start_at) FROM appointments a WHERE a.patient_id = p.id AND a.status IN ('scheduled','confirmed','requested') AND a.start_at >= ?) AS next_visit
    FROM patients p WHERE ${where.join(" AND ")} ORDER BY p.updated_at DESC LIMIT ?`).all(nowLocal(), ...args, limit) as Record<string, any>[];
  res.json(rows.map((r) => ({ ...bools(r, B), phone_masked: maskPhone(r.phone) })));
});

patientsRouter.get("/:id", (req, res) => {
  const id = idParam(req);
  const p = db.prepare("SELECT * FROM patients WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!p) throw notFound("Patient");
  audit(req, "view", "patient", id);
  const provider=req.user!.role==="provider";
  const appts = db.prepare(`
    SELECT a.id, a.ref_code, a.start_at, a.end_at, a.status, a.reason, a.visit_type, s.name AS service_name, d.name AS department_name,
      (SELECT group_concat(r.name, ', ') FROM appointment_resources ar JOIN resources r ON r.id = ar.resource_id WHERE ar.appointment_id = a.id) AS resources
    FROM appointments a JOIN services s ON s.id = a.service_id JOIN departments d ON d.id = a.department_id
    WHERE a.patient_id = ? ${provider?"AND EXISTS(SELECT 1 FROM appointment_resources ar WHERE ar.appointment_id=a.id AND ar.resource_id=?)":""} ORDER BY a.start_at DESC`).all(id,...(provider?[req.user!.resource_id]:[]));
  res.json({ ...bools(p, B), appointments: appts });
});

function duplicateOf(b: { first_name: string; last_name: string; phone: string; dob?: string | null }, exceptId = -1) {
  return db.prepare(`SELECT id, mrn, first_name, last_name FROM patients WHERE id <> ? AND phone = ? AND lower(first_name) = lower(?) AND lower(last_name) = lower(?)
    AND (? IS NULL OR dob IS NULL OR dob = ?) LIMIT 1`).get(exceptId, b.phone, b.first_name, b.last_name, b.dob ?? null, b.dob ?? null) as Record<string, any> | undefined;
}

patientsRouter.post("/", requireRole("admin", "scheduler"), (req, res) => {
  const provisional = req.query.mode !== "full";
  const b = parse(provisional ? quick : full, req.body) as z.infer<typeof full>;
  const dup = duplicateOf(b);
  if (dup) return res.status(409).json({ error: `This looks like an existing patient (${dup.mrn}). Use the existing record`, details: { duplicate: dup } });
  const id = db.transaction(() => {
    const info = db.prepare(`INSERT INTO patients (mrn, first_name, last_name, dob, sex, phone, email, address, city, postal_code, preferred_language,
      insurance_provider, insurance_member_id, emergency_contact_name, emergency_contact_phone, is_provisional, sms_opt_in, email_opt_in, whatsapp_opt_in, consent_at)
      VALUES ('TMP-' || hex(randomblob(6)),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      b.first_name, b.last_name, b.dob ?? null, b.sex, b.phone, b.email ?? null, b.address ?? null, b.city ?? null, b.postal_code ?? null,
      b.preferred_language ?? "English", b.insurance_provider ?? null, b.insurance_member_id ?? null, b.emergency_contact_name ?? null,
      b.emergency_contact_phone ?? null, provisional ? 1 : 0, b.sms_opt_in ? 1 : 0, b.email_opt_in ? 1 : 0, b.whatsapp_opt_in ? 1 : 0, nowLocal());
    const id = Number(info.lastInsertRowid);
    const mrn = `${provisional ? "TMP" : "MRN"}${new Date().getFullYear().toString().slice(2)}${String(id).padStart(6, "0")}`;
    db.prepare("UPDATE patients SET mrn = ? WHERE id = ?").run(mrn, id);
    return id;
  })();
  audit(req, "create", "patient", id, { provisional });
  const p = db.prepare("SELECT * FROM patients WHERE id = ?").get(id) as Record<string, unknown>;
  res.status(201).json(bools(p, B));
});

/** Updating with full details converts a provisional (new, unknown) patient to a registered one. */
patientsRouter.put("/:id", requireRole("admin", "scheduler"), (req, res) => {
  const id = idParam(req);
  const b = parse(full, req.body);
  const cur = db.prepare("SELECT * FROM patients WHERE id = ?").get(id) as Record<string, any> | undefined;
  if (!cur) throw notFound("Patient");
  const complete = !!(b.dob && b.address && b.emergency_contact_phone);
  const mrn = cur.is_provisional && complete ? cur.mrn.replace(/^TMP/, "MRN") : cur.mrn;
  db.prepare(`UPDATE patients SET first_name=?, last_name=?, dob=?, sex=?, phone=?, email=?, address=?, city=?, postal_code=?, preferred_language=?,
    insurance_provider=?, insurance_member_id=?, emergency_contact_name=?, emergency_contact_phone=?, sms_opt_in=?, email_opt_in=?, whatsapp_opt_in=?,
    is_provisional=?, mrn=?, updated_at=datetime('now') WHERE id=?`).run(b.first_name, b.last_name, b.dob ?? null, b.sex, b.phone, b.email ?? null,
    b.address ?? null, b.city ?? null, b.postal_code ?? null, b.preferred_language ?? "English", b.insurance_provider ?? null, b.insurance_member_id ?? null,
    b.emergency_contact_name ?? null, b.emergency_contact_phone ?? null, b.sms_opt_in ? 1 : 0, b.email_opt_in ? 1 : 0, b.whatsapp_opt_in ? 1 : 0,
    cur.is_provisional && !complete ? 1 : 0, mrn, id);
  audit(req, "update", "patient", id, { registered: cur.is_provisional && complete });
  res.json({ ok: true, mrn, is_provisional: !!(cur.is_provisional && !complete) });
});
