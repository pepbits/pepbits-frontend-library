/**
 * Seeds a realistic multi-department hospital. Run `npm run seed` (add `-- --force` to wipe and reseed).
 * Appointment times are generated relative to today so the calendar and KPIs always have data.
 */
import {hashPassword} from "./lib/password.js";
import { db, migrate } from "./db.js";
import { addDays, addMinutes, nowLocal, todayLocal, weekday } from "./lib/time.js";
import { getResource, resourceConflict, windowsFor } from "./lib/availability.js";

migrate();
if ((db.prepare("SELECT COUNT(*) n FROM users").get() as {n:number}).n) throw Error("Existing MedSlot database must never be reseeded");

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pickOne = <T>(a: T[]) => a[Math.floor(rand() * a.length)];

const run = db.transaction(() => {
  /* Departments & specialties */
  const depts: Record<string, number> = {};
  const specs: Record<string, number> = {};
  const deptData: [string, string, string, string, string[]][] = [
    ["General Medicine", "GM", "#0F7A68", "Block A, Ground floor", ["Internal Medicine", "Family Medicine", "Telemedicine"]],
    ["Cardiology", "CAR", "#C2413A", "Block B, 2nd floor", ["Interventional Cardiology", "Electrophysiology"]],
    ["Orthopaedics", "ORT", "#3E6FB0", "Block B, 1st floor", ["Sports Medicine", "Joint Replacement"]],
    ["Paediatrics", "PED", "#D9932B", "Block A, 1st floor", ["Neonatology", "Child Development"]],
    ["Obstetrics & Gynaecology", "OBG", "#A8457E", "Block C, 1st floor", ["Antenatal Care"]],
    ["Dermatology", "DER", "#7A5BA6", "Block A, 2nd floor", ["Cosmetic Dermatology"]],
    ["Dental", "DEN", "#2F8FA0", "Block D, Ground floor", ["Endodontics", "Orthodontics", "General Dentistry"]],
    ["Laboratory", "LAB", "#5C7A2E", "Block A, Basement", ["Pathology", "Biochemistry"]],
    ["Radiology", "RAD", "#45607A", "Block C, Ground floor", ["MRI", "CT", "Ultrasound", "X-ray"]],
    ["Surgery", "SUR", "#8C3B2E", "Block E, 3rd floor (Theatres)", ["General Surgery", "Orthopaedic Surgery"]],
    ["Pharmacy", "PHA", "#2E7D4F", "Main lobby", ["Clinical Pharmacy"]],
    ["Long-term Care", "LTC", "#6B6152", "Block F", ["Geriatrics", "Palliative Care"]],
    ["Physiotherapy", "PHY", "#3D8A7A", "Block D, 1st floor", ["Musculoskeletal", "Neuro Rehab"]],
  ];
  const insD = db.prepare("INSERT INTO departments (name, code, color, location, description) VALUES (?,?,?,?,?)");
  const insS = db.prepare("INSERT INTO specialties (department_id, name) VALUES (?,?)");
  for (const [name, code, color, loc, sp] of deptData) {
    depts[code] = Number(insD.run(name, code, color, loc, null).lastInsertRowid);
    for (const s of sp) specs[s] = Number(insS.run(depts[code], s).lastInsertRowid);
  }

  /* Resource types */
  const types: Record<string, number> = {};
  const typeData: [string, string, number, string][] = [
    ["Doctor", "person", 15, "stethoscope"], ["Surgeon", "person", 30, "scalpel"], ["Anaesthetist", "person", 30, "syringe"],
    ["Dentist", "person", 30, "tooth"], ["Nurse", "person", 15, "nurse"], ["Pharmacist", "person", 10, "pill"],
    ["Physiotherapist", "person", 30, "activity"], ["Operating theatre", "room", 30, "door"], ["Consultation room", "room", 15, "door"],
    ["Dental chair", "chair", 30, "armchair"], ["Sample collection bay", "chair", 10, "droplet"], ["MRI scanner", "equipment", 30, "scan"],
    ["CT scanner", "equipment", 15, "scan"], ["X-ray unit", "equipment", 10, "scan"], ["Ultrasound machine", "equipment", 20, "wave"],
    ["Day-care bed", "bed", 60, "bed"], ["Pharmacy counter", "room", 10, "counter"],
  ];
  const insT = db.prepare("INSERT INTO resource_types (name, category, default_slot_minutes, icon) VALUES (?,?,?,?)");
  for (const [n, c, m, i] of typeData) types[n] = Number(insT.run(n, c, m, i).lastInsertRowid);

  /* Resources */
  const res: Record<string, number> = {};
  const insR = db.prepare(`INSERT INTO resources (name, title, resource_type_id, department_id, specialty_id, slot_minutes, capacity, location) VALUES (?,?,?,?,?,?,?,?)`);
  const R = (name: string, title: string | null, type: string, dept: string, spec: string | null, slot?: number, cap = 1, loc: string | null = null) =>
    (res[name] = Number(insR.run(name, title, types[type], depts[dept], spec ? specs[spec] : null, slot ?? typeData.find((t) => t[0] === type)![2], cap, loc).lastInsertRowid));

  R("Dr. Arjun Mehta", "MD, Internal Medicine", "Doctor", "GM", "Internal Medicine", 15, 1, "A-012");
  R("Dr. Kavya Nair", "MBBS, Family Medicine", "Doctor", "GM", "Family Medicine", 15, 1, "A-014");
  R("Dr. Meera Iyer", "DM, Cardiology", "Doctor", "CAR", "Interventional Cardiology", 20, 1, "B-204");
  R("Dr. Samuel D'Souza", "DM, Electrophysiology", "Doctor", "CAR", "Electrophysiology", 20, 1, "B-206");
  R("Dr. Rohan Kapoor", "MS, Orthopaedics", "Doctor", "ORT", "Sports Medicine", 15, 1, "B-108");
  R("Dr. Ananya Rao", "MD, Paediatrics", "Doctor", "PED", "Child Development", 15, 1, "A-110");
  R("Nurse Priya Thomas", "RN, Immunisation", "Nurse", "PED", null, 10, 1, "A-115");
  R("Dr. Fatima Sheikh", "MS, Obstetrics", "Doctor", "OBG", "Antenatal Care", 20, 1, "C-102");
  R("Dr. Vikram Sethi", "MD, Dermatology", "Doctor", "DER", "Cosmetic Dermatology", 15, 1, "A-220");
  R("Dr. Neha Joshi", "BDS, MDS Endodontics", "Dentist", "DEN", "Endodontics", 30, 1, "D-003");
  R("Dr. Karan Malhotra", "BDS, General Dentistry", "Dentist", "DEN", "General Dentistry", 30, 1, "D-005");
  R("Dental Chair 1", null, "Dental chair", "DEN", null, 30, 1, "D-003");
  R("Dental Chair 2", null, "Dental chair", "DEN", null, 30, 1, "D-005");
  R("Dental Chair 3", null, "Dental chair", "DEN", null, 30, 1, "D-007");
  R("Collection Bay A", null, "Sample collection bay", "LAB", "Pathology", 10, 2, "Basement, Lab reception");
  R("Collection Bay B", null, "Sample collection bay", "LAB", "Biochemistry", 10, 2, "Basement, Lab reception");
  R("MRI 1 (3T Siemens)", null, "MRI scanner", "RAD", "MRI", 30, 1, "C-010");
  R("CT 1 (128-slice)", null, "CT scanner", "RAD", "CT", 15, 1, "C-012");
  R("X-ray Room 1", null, "X-ray unit", "RAD", "X-ray", 10, 1, "C-014");
  R("Ultrasound 1", null, "Ultrasound machine", "RAD", "Ultrasound", 20, 1, "C-016");
  R("Ultrasound 2", null, "Ultrasound machine", "RAD", "Ultrasound", 20, 1, "C-017");
  R("Dr. Aditya Verma", "MS, General Surgery", "Surgeon", "SUR", "General Surgery", 30, 1, null);
  R("Dr. Ishaan Reddy", "MS, Ortho Surgery", "Surgeon", "SUR", "Orthopaedic Surgery", 30, 1, null);
  R("Dr. Lakshmi Pillai", "MD, Anaesthesiology", "Anaesthetist", "SUR", null, 30, 1, null);
  R("Dr. Omar Siddiqui", "MD, Anaesthesiology", "Anaesthetist", "SUR", null, 30, 1, null);
  R("Operating Theatre 1", null, "Operating theatre", "SUR", null, 30, 1, "E-301");
  R("Operating Theatre 2", null, "Operating theatre", "SUR", null, 30, 1, "E-302");
  R("Pharmacist Ritu Bansal", "PharmD", "Pharmacist", "PHA", "Clinical Pharmacy", 10, 1, "Lobby counter 2");
  R("Pickup Counter", null, "Pharmacy counter", "PHA", null, 10, 3, "Main lobby");
  R("Dr. George Mathew", "MD, Geriatrics", "Doctor", "LTC", "Geriatrics", 30, 1, "F-101");
  R("Day-care Bed 1", null, "Day-care bed", "LTC", "Palliative Care", 60, 1, "F-Ward 1");
  R("Day-care Bed 2", null, "Day-care bed", "LTC", "Palliative Care", 60, 1, "F-Ward 1");
  R("Physio Sana Khan", "MPT, Musculoskeletal", "Physiotherapist", "PHY", "Musculoskeletal", 30, 1, "D-110");
  R("Physio Daniel Fernandes", "MPT, Neuro Rehab", "Physiotherapist", "PHY", "Neuro Rehab", 45, 1, "D-112");

  /* Weekly schedules */
  const insSch = db.prepare("INSERT INTO schedules (resource_id, weekday, start_time, end_time) VALUES (?,?,?,?)");
  const hours = (names: string[], days: number[], spans: [string, string][]) => {
    for (const n of names) for (const d of days) for (const [s, e] of spans) insSch.run(res[n], d, s, e);
  };
  const MF = [1, 2, 3, 4, 5], MS = [1, 2, 3, 4, 5, 6], ALL = [0, 1, 2, 3, 4, 5, 6];
  const doctors = ["Dr. Arjun Mehta", "Dr. Kavya Nair", "Dr. Meera Iyer", "Dr. Samuel D'Souza", "Dr. Rohan Kapoor", "Dr. Ananya Rao", "Dr. Fatima Sheikh", "Dr. Vikram Sethi", "Nurse Priya Thomas"];
  hours(doctors, MF, [["09:00", "13:00"], ["14:00", "17:30"]]);
  hours(["Dr. Arjun Mehta", "Dr. Ananya Rao", "Nurse Priya Thomas"], [6], [["09:00", "13:00"]]);
  hours(["Dr. Neha Joshi", "Dr. Karan Malhotra", "Dental Chair 1", "Dental Chair 2", "Dental Chair 3"], MS, [["09:30", "13:30"], ["14:30", "18:30"]]);
  hours(["Collection Bay A", "Collection Bay B"], MS, [["07:00", "14:00"]]);
  hours(["MRI 1 (3T Siemens)", "CT 1 (128-slice)"], ALL, [["07:00", "22:00"]]);
  hours(["X-ray Room 1", "Ultrasound 1", "Ultrasound 2"], MS, [["08:00", "20:00"]]);
  hours(["Dr. Aditya Verma", "Dr. Ishaan Reddy", "Dr. Lakshmi Pillai", "Dr. Omar Siddiqui", "Operating Theatre 1", "Operating Theatre 2"], MF, [["08:00", "18:00"]]);
  hours(["Pharmacist Ritu Bansal"], MS, [["09:00", "19:00"]]);
  hours(["Pickup Counter"], ALL, [["08:00", "21:00"]]);
  hours(["Dr. George Mathew"], [1, 3, 5], [["10:00", "16:00"]]);
  hours(["Day-care Bed 1", "Day-care Bed 2"], MS, [["08:00", "20:00"]]);
  hours(["Physio Sana Khan", "Physio Daniel Fernandes"], MS, [["08:00", "12:00"], ["15:00", "19:00"]]);

  /* Services with the resources they need */
  const insSv = db.prepare(`INSERT INTO services (name, code, category, department_id, specialty_id, duration_minutes, buffer_minutes, prep_instructions, requires_order, requires_referral, price)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insReq = db.prepare("INSERT INTO service_requirements (service_id, resource_type_id, role, is_primary, sort) VALUES (?,?,?,?,?)");
  const insLink = db.prepare("INSERT INTO service_resources (service_id, resource_id) VALUES (?,?)");
  const svc: Record<string, number> = {};
  const S = (code: string, name: string, cat: string, dept: string, spec: string | null, dur: number, buf: number, needs: [string, string][], who: string[],
    o: { prep?: string; order?: boolean; referral?: boolean; price?: number } = {}) => {
    const id = Number(insSv.run(name, code, cat, depts[dept], spec ? specs[spec] : null, dur, buf, o.prep ?? null, o.order ? 1 : 0, o.referral ? 1 : 0, o.price ?? null).lastInsertRowid);
    needs.forEach(([t, role], i) => insReq.run(id, types[t], role, i === 0 ? 1 : 0, i));
    for (const w of who) insLink.run(id, res[w]);
    svc[code] = id;
  };
  S("GM-CON", "General consultation", "consultation", "GM", "Internal Medicine", 15, 0, [["Doctor", "Doctor"]], ["Dr. Arjun Mehta", "Dr. Kavya Nair"], { price: 600 });
  S("GM-TEL", "Video consultation", "telehealth", "GM", "Telemedicine", 15, 0, [["Doctor", "Doctor"]], ["Dr. Arjun Mehta", "Dr. Kavya Nair"], { price: 500, prep: "You'll receive a video link 15 minutes before the call." });
  S("CAR-CON", "Cardiology consultation", "consultation", "CAR", "Interventional Cardiology", 20, 0, [["Doctor", "Cardiologist"]], ["Dr. Meera Iyer", "Dr. Samuel D'Souza"], { price: 1200, prep: "Bring previous ECGs, echo reports and your current medicines." });
  S("ORT-CON", "Orthopaedic consultation", "consultation", "ORT", "Sports Medicine", 15, 0, [["Doctor", "Orthopaedician"]], ["Dr. Rohan Kapoor"], { price: 900 });
  S("PED-CON", "Paediatric consultation", "consultation", "PED", "Child Development", 15, 0, [["Doctor", "Paediatrician"]], ["Dr. Ananya Rao"], { price: 700 });
  S("PED-VAC", "Child vaccination", "vaccination", "PED", null, 10, 5, [["Nurse", "Nurse"]], ["Nurse Priya Thomas"], { prep: "Bring the child's vaccination card." });
  S("OBG-ANC", "Antenatal check-up", "consultation", "OBG", "Antenatal Care", 20, 0, [["Doctor", "Obstetrician"]], ["Dr. Fatima Sheikh"], { price: 900 });
  S("DER-CON", "Dermatology consultation", "consultation", "DER", "Cosmetic Dermatology", 15, 0, [["Doctor", "Dermatologist"]], ["Dr. Vikram Sethi"], { price: 800 });
  S("DEN-CHK", "Dental check-up & cleaning", "dental", "DEN", "General Dentistry", 30, 10, [["Dentist", "Dentist"], ["Dental chair", "Chair"]], ["Dr. Neha Joshi", "Dr. Karan Malhotra", "Dental Chair 1", "Dental Chair 2", "Dental Chair 3"], { price: 1000 });
  S("DEN-RCT", "Root canal treatment", "dental", "DEN", "Endodontics", 60, 15, [["Dentist", "Endodontist"], ["Dental chair", "Chair"]], ["Dr. Neha Joshi", "Dental Chair 1", "Dental Chair 2"], { price: 6500, prep: "Eat a light meal beforehand. Plan for numbness for 2–3 hours." });
  S("LAB-CBC", "Complete blood count", "lab", "LAB", "Pathology", 10, 0, [["Sample collection bay", "Collection bay"]], ["Collection Bay A", "Collection Bay B"], { order: true, price: 350 });
  S("LAB-LIP", "Fasting lipid profile", "lab", "LAB", "Biochemistry", 10, 0, [["Sample collection bay", "Collection bay"]], ["Collection Bay A", "Collection Bay B"], { order: true, price: 650, prep: "Fast for 10–12 hours before the test. Water is fine." });
  S("RAD-XRC", "Chest X-ray", "radiology", "RAD", "X-ray", 10, 5, [["X-ray unit", "X-ray unit"]], ["X-ray Room 1"], { order: true, price: 450, prep: "Remove jewellery and metal items." });
  S("RAD-MRB", "MRI brain", "radiology", "RAD", "MRI", 45, 15, [["MRI scanner", "MRI scanner"]], ["MRI 1 (3T Siemens)"], { order: true, price: 8500, prep: "Tell staff about any implants, pacemaker or metal in your body. Arrive 30 minutes early." });
  S("RAD-CTA", "CT abdomen with contrast", "radiology", "RAD", "CT", 20, 10, [["CT scanner", "CT scanner"]], ["CT 1 (128-slice)"], { order: true, price: 5500, prep: "Fast for 4 hours. A kidney function test is needed before contrast." });
  S("RAD-USG", "Ultrasound abdomen", "radiology", "RAD", "Ultrasound", 20, 5, [["Ultrasound machine", "Ultrasound"]], ["Ultrasound 1", "Ultrasound 2"], { order: true, price: 1500, prep: "Fast for 6 hours and arrive with a full bladder." });
  S("SUR-ARS", "Knee arthroscopy", "surgery", "SUR", "Orthopaedic Surgery", 90, 30, [["Surgeon", "Surgeon"], ["Operating theatre", "Theatre"], ["Anaesthetist", "Anaesthetist"]],
    ["Dr. Ishaan Reddy", "Operating Theatre 1", "Operating Theatre 2", "Dr. Lakshmi Pillai", "Dr. Omar Siddiqui"], { referral: true, price: 85000, prep: "Nothing to eat or drink after midnight. Complete pre-op tests 48 hours before." });
  S("SUR-LAP", "Laparoscopic appendectomy", "surgery", "SUR", "General Surgery", 60, 30, [["Surgeon", "Surgeon"], ["Operating theatre", "Theatre"], ["Anaesthetist", "Anaesthetist"]],
    ["Dr. Aditya Verma", "Operating Theatre 1", "Operating Theatre 2", "Dr. Lakshmi Pillai", "Dr. Omar Siddiqui"], { referral: true, price: 95000, prep: "Nothing to eat or drink after midnight." });
  S("SUR-PRE", "Pre-anaesthesia check-up", "procedure", "SUR", null, 30, 0, [["Anaesthetist", "Anaesthetist"]], ["Dr. Lakshmi Pillai", "Dr. Omar Siddiqui"], { price: 800 });
  S("PHA-MTM", "Medication review", "pharmacy", "PHA", "Clinical Pharmacy", 15, 0, [["Pharmacist", "Pharmacist"]], ["Pharmacist Ritu Bansal"], { prep: "Bring all your current medicines in their packs." });
  S("PHA-FLU", "Flu vaccination", "vaccination", "PHA", null, 10, 0, [["Pharmacist", "Pharmacist"]], ["Pharmacist Ritu Bansal"], { price: 1200 });
  S("PHA-PCK", "Prescription pickup", "pharmacy", "PHA", null, 10, 0, [["Pharmacy counter", "Counter"]], ["Pickup Counter"]);
  S("LTC-CPR", "Care plan review", "consultation", "LTC", "Geriatrics", 30, 0, [["Doctor", "Geriatrician"]], ["Dr. George Mathew"]);
  S("LTC-DCB", "Day-care infusion", "admission", "LTC", "Palliative Care", 240, 30, [["Day-care bed", "Bed"]], ["Day-care Bed 1", "Day-care Bed 2"], { order: true, prep: "Bring a companion and your medication chart." });
  S("PHY-MSK", "Physiotherapy session", "therapy", "PHY", "Musculoskeletal", 30, 0, [["Physiotherapist", "Physiotherapist"]], ["Physio Sana Khan", "Physio Daniel Fernandes"], { price: 700, prep: "Wear loose, comfortable clothing." });

  /* Users */
  const insU = db.prepare("INSERT INTO users (name, email, password_hash, role, resource_id) VALUES (?,?,?,?,?)");
  insU.run("Hospital Admin", "admin@medslot.health", hashPassword("Admin@12345"), "admin", null);
  insU.run("Front Desk", "frontdesk@medslot.health", hashPassword("Desk@12345"), "scheduler", null);
  insU.run("Dr. Meera Iyer", "meera.iyer@medslot.health", hashPassword("Doctor@12345"), "provider", res["Dr. Meera Iyer"]);

  /* Holidays */
  const year = Number(todayLocal().slice(0, 4));
  const insH = db.prepare("INSERT INTO holidays (date, name, department_id) VALUES (?,?,?)");
  insH.run(`${year}-11-08`, "Diwali", null);
  insH.run(`${year}-12-25`, "Christmas Day", null);
  insH.run(`${year + 1}-01-01`, "New Year's Day", null);
  insH.run(`${year + 1}-01-26`, "Republic Day", null);
  insH.run(addDays(todayLocal(), 9), "Dental equipment servicing", depts["DEN"]);

  /* Blocks: leave and maintenance */
  const insB = db.prepare("INSERT INTO resource_blocks (resource_id, start_at, end_at, kind, reason) VALUES (?,?,?,?,?)");
  insB.run(res["MRI 1 (3T Siemens)"], `${addDays(todayLocal(), 3)}T07:00`, `${addDays(todayLocal(), 3)}T11:00`, "maintenance", "Quarterly coil calibration");
  insB.run(res["Dr. Rohan Kapoor"], `${addDays(todayLocal(), 5)}T00:00`, `${addDays(todayLocal(), 8)}T00:00`, "leave", "Conference");

  /* Patients */
  const first = ["Asha", "Rahul", "Sneha", "Vivek", "Pooja", "Imran", "Divya", "Karthik", "Anjali", "Suresh", "Nisha", "Harish", "Ritika", "Manoj", "Zara", "Abhishek",
    "Lavanya", "Deepak", "Shreya", "Farhan", "Gita", "Yash", "Meenal", "Tarun", "Aisha", "Nikhil", "Sunita", "Prakash", "Tanvi", "Joseph", "Rekha", "Aman", "Bhavna",
    "Chetan", "Esha", "Gaurav", "Hema", "Irfan", "Jaya", "Kunal"];
  const last = ["Verma", "Sharma", "Patel", "Iyer", "Khan", "Reddy", "Das", "Menon", "Gupta", "Singh", "Joshi", "Nair", "Fernandes", "Chopra", "Bose", "Kulkarni", "Agarwal", "Thomas"];
  const insP = db.prepare(`INSERT INTO patients (mrn, first_name, last_name, dob, sex, phone, email, address, city, postal_code, insurance_provider, insurance_member_id,
    emergency_contact_name, emergency_contact_phone, is_provisional, sms_opt_in, email_opt_in, whatsapp_opt_in, consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const patients: number[] = [];
  const yy = String(year).slice(2);
  const N = 240;
  for (let i = 0; i < N; i++) {
    const f = first[i % first.length];
    const l = last[(i * 7 + Math.floor(i / first.length)) % last.length];
    const prov = i % 9 === 4 ? 1 : 0;
    const sex = ["Asha", "Sneha", "Pooja", "Divya", "Anjali", "Nisha", "Ritika", "Zara", "Lavanya", "Shreya", "Gita", "Meenal", "Aisha", "Sunita", "Tanvi", "Rekha", "Bhavna", "Esha", "Hema", "Jaya"].includes(f) ? "female" : "male";
    const id = i + 1;
    insP.run(`${prov ? "TMP" : "MRN"}${yy}${String(id).padStart(6, "0")}`, f, l,
      prov ? null : `${1950 + Math.floor(rand() * 60)}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 27)).padStart(2, "0")}`,
      sex, `+9198${String(10000000 + Math.floor(rand() * 89999999))}`, prov ? null : `${f.toLowerCase()}.${l.toLowerCase()}@example.com`,
      prov ? null : `${10 + i} ${pickOne(["MG Road", "Park Street", "Lake View", "Residency Road", "Church Street"])}`, prov ? null : pickOne(["Bengaluru", "Kochi", "Chennai", "Mumbai", "Pune"]),
      prov ? null : `5600${String(i).padStart(2, "0")}`, prov ? null : pickOne(["Star Health", "HDFC Ergo", "ICICI Lombard", "Niva Bupa", null]), prov ? null : `POL${100000 + i * 37}`,
      prov ? null : `${pickOne(first)} ${l}`, prov ? null : `+9197${String(10000000 + Math.floor(rand() * 89999999))}`, prov, 1, prov ? 0 : 1, i % 3 === 0 ? 1 : 0, nowLocal());
    patients.push(id);
  }

  return { svc, res };
});

const { svc } = run();

/* Appointments: last 30 days and next 14 days, conflict-checked like a real booking. */
const reasons: Record<string, string[]> = {
  consultation: ["Persistent cough for 2 weeks", "Follow-up on blood pressure", "Chest discomfort on exertion", "Knee pain after running", "Annual health check", "Skin rash on arms", "Fever and body ache"],
  telehealth: ["Review of lab results", "Medication refill discussion"],
  dental: ["Tooth sensitivity", "Routine cleaning", "Pain in lower molar"],
  lab: ["Ordered by physician: routine panel", "Pre-operative workup"],
  radiology: ["Ordered: rule out fracture", "Headache evaluation", "Abdominal pain evaluation"],
  surgery: ["Elective procedure, referred by consultant"],
  procedure: ["Pre-operative assessment"],
  pharmacy: ["Polypharmacy review", "Collect monthly prescription"],
  vaccination: ["Seasonal flu vaccine", "Scheduled immunisation"],
  therapy: ["Post-surgery rehabilitation", "Lower back pain"],
  admission: ["Scheduled infusion therapy"],
};
const svcRows = db.prepare(`SELECT s.*, (SELECT json_group_array(json_object('type', q.resource_type_id, 'role', q.role)) FROM service_requirements q WHERE q.service_id = s.id ORDER BY q.sort) req FROM services s`).all() as Record<string, any>[];
const candStmt = db.prepare("SELECT r.id FROM service_resources x JOIN resources r ON r.id = x.resource_id WHERE x.service_id = ? AND r.resource_type_id = ?");
const insA = db.prepare(`INSERT INTO appointments (ref_code, patient_id, service_id, department_id, start_at, end_at, status, patient_kind, visit_type, priority, source, reason,
  requested_at, preferred_at, booked_by, confirmed_at, checked_in_at, started_at, completed_at, cancelled_at, cancel_reason, no_show_at, notify_channels, order_ref, referral_source)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insAR = db.prepare("INSERT INTO appointment_resources (appointment_id, resource_id, role, start_at, end_at) VALUES (?,?,?,?,?)");
const insEv = db.prepare("INSERT INTO appointment_events (appointment_id, from_status, to_status, note, user_id, created_at) VALUES (?,?,?,?,?,datetime('now'))");
const patientBusy = db.prepare(`SELECT 1 FROM appointments WHERE patient_id = ? AND status NOT IN ('cancelled','no_show','rescheduled') AND start_at < ? AND end_at > ?`);
const seenPatients = new Set<number>();
const now = nowLocal();
const today = todayLocal();
let count = 0, code = 1000;

db.transaction(() => {
  for (let d = -30; d <= 14; d++) {
    const date = addDays(today, d);
    const busyFactor = weekday(date) === 0 ? 0.08 : d > 7 ? 0.14 : 0.3;
    for (const s of svcRows) {
      const req = JSON.parse(s.req) as { type: number; role: string }[];
      const primaries = candStmt.all(s.id, req[0].type) as { id: number }[];
      for (const p of primaries) {
        const pr = getResource(p.id);
        for (const w of windowsFor(pr, date)) {
          for (let t = w.start; addMinutes(t, s.duration_minutes) <= w.end; t = addMinutes(t, Math.max(w.slot, s.duration_minutes))) {
            if (rand() > busyFactor * (s.category === "surgery" ? 0.35 : 1)) continue;
            const end = addMinutes(t, s.duration_minutes);
            const occ = addMinutes(end, s.buffer_minutes);
            const picks = [{ id: p.id, role: req[0].role }];
            let ok = !resourceConflict(pr, t, occ);
            for (const r of req.slice(1)) {
              if (!ok) break;
              const c = (candStmt.all(s.id, r.type) as { id: number }[]).find((x) => !picks.some((pp) => pp.id === x.id) && !resourceConflict(getResource(x.id), t, occ));
              if (!c) ok = false; else picks.push({ id: c.id, role: r.role });
            }
            if (!ok) continue;
            const pid = 1 + Math.floor(rand() * 240);
            if (patientBusy.get(pid, occ, t)) continue;
            const kind = seenPatients.has(pid) ? "existing" : "new";
            seenPatients.add(pid);
            const leadDays = Math.floor(rand() * 12) + (s.category === "surgery" ? 7 : 0);
            const requested = addMinutes(addDays(date, -leadDays) + "T10:00", Math.floor(rand() * 480));
            const reqAt = requested > now ? now : requested;
            const x = rand();
            let status = "scheduled";
            const stamps: Record<string, string | null> = { confirmed_at: null, checked_in_at: null, started_at: null, completed_at: null, cancelled_at: null, no_show_at: null };
            let cancelReason: string | null = null;
            if (end <= now) {
              if (x < 0.72) { status = "completed"; stamps.confirmed_at = reqAt; stamps.checked_in_at = addMinutes(t, Math.floor(rand() * 20) - 10); stamps.started_at = addMinutes(t, Math.floor(rand() * 25)); stamps.completed_at = end; }
              else if (x < 0.82) { status = "no_show"; stamps.no_show_at = addMinutes(t, 30); }
              else if (x < 0.95) { status = "cancelled"; stamps.cancelled_at = addMinutes(t, -60 * 24); cancelReason = pickOne(["Patient unwell", "Travel conflict", "Feeling better", "Booked elsewhere"]); }
              else { status = "completed"; stamps.checked_in_at = addMinutes(t, 5); stamps.started_at = addMinutes(t, 12); stamps.completed_at = end; }
            } else if (t <= now) {
              status = x < 0.5 ? "in_progress" : "checked_in"; stamps.confirmed_at = reqAt; stamps.checked_in_at = addMinutes(t, -8); if (status === "in_progress") stamps.started_at = t;
            } else {
              status = x < 0.45 ? "confirmed" : x < 0.9 ? "scheduled" : x < 0.95 ? "requested" : "cancelled";
              if (status === "confirmed") stamps.confirmed_at = reqAt;
              if (status === "cancelled") { stamps.cancelled_at = reqAt; cancelReason = "Patient request"; }
            }
            const info = insA.run(`AP-${(code++).toString(36).toUpperCase().padStart(6, "0")}`, pid, s.id, s.department_id, t, end, status, kind,
              s.category === "surgery" ? "procedure" : kind === "new" ? "new_visit" : pickOne(["follow_up", "review", "new_visit"]),
              rand() < 0.08 ? "urgent" : "routine", pickOne(["front_desk", "phone", "online", "online", "walk_in", "referral", "whatsapp"]),
              pickOne(reasons[s.category] ?? ["Consultation"]), reqAt, rand() < 0.3 ? t : null, pickOne([1, 2]),
              stamps.confirmed_at, stamps.checked_in_at, stamps.started_at, stamps.completed_at, stamps.cancelled_at, cancelReason, stamps.no_show_at,
              pickOne(["sms,email", "sms,email,whatsapp", "sms", "whatsapp,email"]), s.requires_order ? `ORD-${10000 + count}` : null, s.requires_referral ? "Dr. Rohan Kapoor, OPD" : null);
            const aid = Number(info.lastInsertRowid);
            for (const pk of picks) insAR.run(aid, pk.id, pk.role, t, occ);
            insEv.run(aid, null, status, "Seeded", 1);
            count++;
          }
        }
      }
    }
  }
})();

/* Notification templates: global defaults, plus overrides at department, specialty, resource-type and resource level. */
const insTpl = db.prepare("INSERT INTO notification_templates (event, channel, scope_type, scope_id, subject, body) VALUES (?,?,?,?,?,?)");
const g = (event: string, sms: string, emailSubject: string, email: string, wa?: string) => {
  insTpl.run(event, "sms", "global", 0, null, sms);
  insTpl.run(event, "whatsapp", "global", 0, null, wa ?? sms);
  insTpl.run(event, "email", "global", 0, emailSubject, email);
};
// SMS/WhatsApp defaults avoid service names (minimum necessary PHI on a lock screen).
g("booked",
  "{{facility_name}}: Hi {{patient_first_name}}, your appointment is booked for {{appointment_datetime}}. Ref {{ref_code}}. Reply C to confirm.",
  "Your appointment is booked – {{ref_code}}",
  "Hi {{patient_first_name}},\n\nYour appointment is booked.\n\nWhen: {{appointment_datetime}}\nService: {{service_name}}\nWith: {{resource_name}}\nWhere: {{department_name}}, {{location}}\nReference: {{ref_code}}\n\n{{prep_instructions}}\n\nTo change or cancel, call us or reply to this email.\n\n{{facility_name}}",
  "Hi {{patient_first_name}} 👋 Your appointment at {{facility_name}} is booked for *{{appointment_datetime}}*. Reference: {{ref_code}}.");
g("confirmed",
  "{{facility_name}}: Your appointment on {{appointment_datetime}} is confirmed. Ref {{ref_code}}.",
  "Appointment confirmed – {{appointment_date}}",
  "Hi {{patient_first_name}},\n\nYour appointment on {{appointment_datetime}} with {{resource_name}} is confirmed.\nReference: {{ref_code}}\n\n{{prep_instructions}}\n\n{{facility_name}}");
g("reminder",
  "Reminder from {{facility_name}}: you have an appointment on {{appointment_datetime}} at {{location}}. Ref {{ref_code}}.",
  "Reminder: your appointment on {{appointment_date}}",
  "Hi {{patient_first_name}},\n\nThis is a reminder of your appointment in about {{reminder_hours}} hours.\n\nWhen: {{appointment_datetime}}\nWhere: {{department_name}}, {{location}}\n\n{{prep_instructions}}\n\nPlease arrive 10 minutes early with a photo ID.\n\n{{facility_name}}");
g("rescheduled",
  "{{facility_name}}: your appointment has moved to {{appointment_datetime}}. New ref {{ref_code}}.",
  "Your appointment has been rescheduled",
  "Hi {{patient_first_name}},\n\nYour appointment has been moved to {{appointment_datetime}} with {{resource_name}}.\nNew reference: {{ref_code}}\n\n{{facility_name}}");
g("cancelled",
  "{{facility_name}}: your appointment on {{appointment_datetime}} (ref {{ref_code}}) is cancelled. Call us to rebook.",
  "Your appointment has been cancelled",
  "Hi {{patient_first_name}},\n\nYour appointment on {{appointment_datetime}} (ref {{ref_code}}) has been cancelled.\nReason: {{cancel_reason}}\n\nCall us any time to book a new time.\n\n{{facility_name}}");
g("no_show",
  "{{facility_name}}: we missed you today. Call us to book a new time. Ref {{ref_code}}.",
  "We missed you today",
  "Hi {{patient_first_name}},\n\nWe missed you at your appointment on {{appointment_datetime}}. Your health matters to us. Please call to book a new time.\n\n{{facility_name}}");
const ids = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { id: number }).id;
insTpl.run("booked", "email", "department", ids("SELECT id FROM departments WHERE code='RAD'"), "Your scan is booked – please read the preparation steps",
  "Hi {{patient_first_name}},\n\nYour {{service_name}} is booked for {{appointment_datetime}} at {{location}}.\n\nBefore your scan:\n{{prep_instructions}}\n\nBring your doctor's order and any previous scans. Reference: {{ref_code}}\n\n{{facility_name}} Radiology");
insTpl.run("reminder", "sms", "specialty", ids("SELECT id FROM specialties WHERE name='Biochemistry'"), null,
  "{{facility_name}} Lab: your test is on {{appointment_datetime}}. Fast for 10–12 hours before (water is fine). Ref {{ref_code}}.");
insTpl.run("booked", "sms", "resource_type", ids("SELECT id FROM resource_types WHERE name='Operating theatre'"), null,
  "{{facility_name}}: your procedure is scheduled for {{appointment_datetime}}. Our surgical coordinator will call you within 24 hours. Ref {{ref_code}}.");
insTpl.run("booked", "whatsapp", "resource", ids("SELECT id FROM resources WHERE name='Dr. Meera Iyer'"), null,
  "Hi {{patient_first_name}}, Dr. Meera Iyer's clinic has booked you for *{{appointment_datetime}}*, room B-204. Please bring your previous ECGs. Ref {{ref_code}}.");



