// Source seed: Teleconsult 01 backend/src/store.ts (fictional patients, staff and visits).
// All records are synthetic demo data. The source module-level arrays were wrapped in a factory so each
// tenant/application/branch receives its own typed clone, with "today" computed from the configured clock.
import type {
  Allergy,
  Appointment,
  ChatMessage,
  Encounter,
  Patient,
  Staff,
  Triage,
  Vitals,
} from "./types.ts";
import { nowIso, uid } from "./ids.ts";

export type VitalBaseline = { hr: number; spo2: number; sys: number; dia: number; rr: number; temp: number };
export interface TeleconsultSeed {
  staff: Staff[];
  patients: Patient[];
  appointments: Appointment[];
  encounters: Encounter[];
  messages: ChatMessage[];
  vitalBaselines: Record<string, VitalBaseline>;
}

export const emptyTriage = (cc = ""): Triage => ({
  chiefComplaint: cc,
  onset: "",
  painScore: 0,
  redFlags: [],
  screening: {},
  nurseNote: "",
});

export function blankEncounter(appt: Appointment, id: string = uid("enc"), at: string = nowIso()): Encounter {
  const pv = appt.preVisit;
  return {
    id,
    appointmentId: appt.id,
    patientId: appt.patientId,
    status: "draft",
    triage: {
      ...emptyTriage(appt.reason),
      onset: pv?.duration ?? "",
      painScore: pv ? Math.min(10, pv.severity) : 0,
    },
    vitals: [],
    soap: {
      subjective: pv
        ? `Patient-reported before visit: ${pv.symptoms.join(", ").toLowerCase()} for ${pv.duration}, severity ${pv.severity}/10.${pv.notes ? ` "${pv.notes}"` : ""}\n`
        : "",
      objective: "",
      assessment: "",
      plan: "",
    },
    diagnoses: [],
    prescriptions: [],
    orders: [],
    scores: [],
    allergiesReviewed: false,
    recording: { consent: pv?.recordingConsent ?? false, active: false, seconds: 0 },
    transcript: [],
    followUp: null,
    patientInstructions: "",
    sickNoteDays: 0,
    updatedAt: at,
    version: 1,
  };
}

export function buildSeed(nowMs: number = Date.now(), utcOffsetMinutes = 0): TeleconsultSeed {
  const iso = new Date(nowMs).toISOString();
  let n = 0;
  const uid = (prefix: string) => `${prefix}_seed${(++n).toString(36)}`;
  const STAFF: Staff[] = [
    { id: "d1", name: "Dr. Meera Iyer", role: "doctor", title: "MD, MRCP", specialty: "General medicine", languages: ["English", "Hindi", "Tamil"], rating: 4.9, yearsExperience: 14, bio: "Family physician focused on long-term conditions and same-day virtual care.", color: "#0F8B8D" },
    { id: "d2", name: "Dr. Daniel Okafor", role: "doctor", title: "MD, FACC", specialty: "Cardiology", languages: ["English", "Yoruba"], rating: 4.8, yearsExperience: 18, bio: "Cardiologist for hypertension, rhythm problems and heart failure follow-up.", color: "#3B5BA9" },
    { id: "d3", name: "Dr. Sofia Lindqvist", role: "doctor", title: "MD", specialty: "Psychiatry", languages: ["English", "Swedish"], rating: 4.9, yearsExperience: 11, bio: "Psychiatrist for anxiety, depression and sleep, with a measurement-based approach.", color: "#7A4FA3" },
    { id: "d4", name: "Dr. Arjun Rao", role: "doctor", title: "MD, DCH", specialty: "Pediatrics", languages: ["English", "Kannada", "Hindi"], rating: 4.7, yearsExperience: 9, bio: "Pediatrician for acute childhood illness, asthma and growth concerns.", color: "#C47A16" },
    { id: "d5", name: "Dr. Hannah Cole", role: "doctor", title: "MD", specialty: "Dermatology", languages: ["English", "German"], rating: 4.8, yearsExperience: 12, bio: "Dermatologist using photo-assisted video review for rashes, acne and eczema.", color: "#B5446E" },
    { id: "n1", name: "Priya Nair, RN", role: "nurse", title: "RN, BSN", specialty: "Telehealth nursing", languages: ["English", "Malayalam"], rating: 4.9, yearsExperience: 8, bio: "Triage and remote monitoring lead.", color: "#2E9D63" },
    { id: "n2", name: "Tom Becker, RN", role: "nurse", title: "RN", specialty: "Telehealth nursing", languages: ["English", "German"], rating: 4.8, yearsExperience: 6, bio: "Chronic care nurse.", color: "#4F7C8A" },
  ];

  const daysAgo = (d: number) => new Date(nowMs - d * 86400000).toISOString();
  // "Today" and its opening hours follow the tenant's configured UTC offset, not the host time zone.
  const atToday = (h: number, m: number, dayOffset = 0) => {
    const local = new Date(nowMs + utcOffsetMinutes * 60000);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset, h, m) - utcOffsetMinutes * 60000).toISOString();
  };

  const allergy = (substance: string, category: Allergy["category"], reaction: string, severity: Allergy["severity"], allergyClass?: string): Allergy => ({
    id: uid("alg"),
    substance,
    category,
    allergyClass,
    reaction,
    severity,
    status: "active",
    recordedAt: daysAgo(400),
    recordedBy: "n1",
  });

  const phone = { name: "Patient phone", kind: "phone" as const, connected: true };

  const PATIENTS: Patient[] = [
    {
      id: "p1", mrn: "TC-100231", firstName: "Ana", lastName: "Ruiz", dob: "1991-04-12", sex: "female", phone: "+1 415 555 0142", email: "ana.ruiz@example.com", language: "Spanish", address: "214 Alvarado St, San Francisco", bloodGroup: "O+", heightCm: 164, weightKg: 61,
      insurance: { payer: "Blue Harbor Health", memberId: "BHH-88231" }, emergencyContact: { name: "Luis Ruiz", phone: "+1 415 555 0177", relation: "Brother" },
      allergies: [allergy("Penicillin", "drug", "Anaphylaxis", "severe", "penicillin")], noKnownAllergies: false,
      medications: [{ id: uid("med"), name: "Salbutamol inhaler 100 mcg", dose: "2 puffs", frequency: "As needed", status: "active", since: daysAgo(900) }],
      problems: [{ code: "J45.909", display: "Asthma, uncomplicated", since: daysAgo(3000), status: "active" }],
      devices: [phone, { name: "Pulse oximeter", kind: "oximeter", connected: true }, { name: "Smart thermometer", kind: "thermometer", connected: true }],
      smoking: "never", pregnant: false, createdAt: daysAgo(900),
    },
    {
      id: "p2", mrn: "TC-100232", firstName: "Rahul", lastName: "Mehta", dob: "1967-09-03", sex: "male", phone: "+1 408 555 0119", email: "rahul.m@example.com", language: "English", address: "88 Rose Ave, San Jose", bloodGroup: "B+", heightCm: 172, weightKg: 86,
      insurance: { payer: "Pacific Shield", memberId: "PS-221904" }, emergencyContact: { name: "Kavya Mehta", phone: "+1 408 555 0190", relation: "Spouse" },
      allergies: [allergy("Sulfonamides", "drug", "Widespread rash", "moderate", "sulfonamide")], noKnownAllergies: false,
      medications: [
        { id: uid("med"), name: "Amlodipine 5 mg", dose: "5 mg", frequency: "Once daily", status: "active", since: daysAgo(700) },
        { id: uid("med"), name: "Metformin 500 mg", dose: "500 mg", frequency: "Twice daily", status: "active", since: daysAgo(1200) },
        { id: uid("med"), name: "Atorvastatin 20 mg", dose: "20 mg", frequency: "At night", status: "active", since: daysAgo(700) },
      ],
      problems: [
        { code: "I10", display: "Essential hypertension", since: daysAgo(1500), status: "active" },
        { code: "E11.9", display: "Type 2 diabetes mellitus", since: daysAgo(1300), status: "active" },
        { code: "E78.5", display: "Hyperlipidemia", since: daysAgo(800), status: "active" },
      ],
      devices: [phone, { name: "Omron BP cuff", kind: "bp-cuff", connected: true }, { name: "Glucometer", kind: "glucometer", connected: true }],
      smoking: "former", createdAt: daysAgo(1500),
    },
    {
      id: "p3", mrn: "TC-100233", firstName: "Grace", lastName: "Thompson", dob: "1953-01-27", sex: "female", phone: "+1 650 555 0133", email: "grace.t@example.com", language: "English", address: "9 Laurel Ct, Palo Alto", bloodGroup: "A-", heightCm: 158, weightKg: 70,
      insurance: { payer: "Medicare Advantage Plus", memberId: "MAP-550213" }, emergencyContact: { name: "Michael Thompson", phone: "+1 650 555 0160", relation: "Son" },
      allergies: [allergy("NSAIDs", "drug", "GI bleed", "severe", "nsaid")], noKnownAllergies: false,
      medications: [
        { id: uid("med"), name: "Warfarin 5 mg", dose: "As per INR", frequency: "Once daily", status: "active", since: daysAgo(600) },
        { id: uid("med"), name: "Bisoprolol 2.5 mg", dose: "2.5 mg", frequency: "Once daily", status: "active", since: daysAgo(600) },
        { id: uid("med"), name: "Furosemide 40 mg", dose: "40 mg", frequency: "Morning", status: "active", since: daysAgo(300) },
      ],
      problems: [
        { code: "I48.91", display: "Atrial fibrillation", since: daysAgo(600), status: "active" },
        { code: "I50.9", display: "Heart failure", since: daysAgo(300), status: "active" },
      ],
      devices: [phone, { name: "BP cuff", kind: "bp-cuff", connected: true }, { name: "Pulse oximeter", kind: "oximeter", connected: true }],
      smoking: "never", createdAt: daysAgo(700),
    },
    {
      id: "p4", mrn: "TC-100234", firstName: "Kwame", lastName: "Mensah", dob: "1996-06-18", sex: "male", phone: "+1 510 555 0154", email: "kwame.mensah@example.com", language: "English", address: "1450 Grand Ave, Oakland", bloodGroup: "O+", heightCm: 181, weightKg: 77,
      insurance: { payer: "Blue Harbor Health", memberId: "BHH-90110" }, emergencyContact: { name: "Efua Mensah", phone: "+1 510 555 0101", relation: "Mother" },
      allergies: [], noKnownAllergies: true, medications: [], problems: [],
      devices: [phone, { name: "Smartwatch", kind: "watch", connected: true }],
      smoking: "never", createdAt: daysAgo(200),
    },
    {
      id: "p5", mrn: "TC-100235", firstName: "Lena", lastName: "Fischer", dob: "1984-11-02", sex: "female", phone: "+1 415 555 0188", email: "lena.f@example.com", language: "German", address: "33 Hayes St, San Francisco", bloodGroup: "AB+", heightCm: 170, weightKg: 64,
      insurance: { payer: "Pacific Shield", memberId: "PS-310045" }, emergencyContact: { name: "Jonas Fischer", phone: "+1 415 555 0122", relation: "Partner" },
      allergies: [allergy("Latex", "environment", "Contact urticaria", "moderate")], noKnownAllergies: false,
      medications: [{ id: uid("med"), name: "Sertraline 50 mg", dose: "50 mg", frequency: "Once daily", status: "active", since: daysAgo(120) }],
      problems: [{ code: "F41.1", display: "Generalized anxiety disorder", since: daysAgo(150), status: "active" }],
      devices: [phone], smoking: "never", pregnant: false, createdAt: daysAgo(160),
    },
    {
      id: "p6", mrn: "TC-100236", firstName: "Yuki", lastName: "Tanaka", dob: "1999-02-14", sex: "female", phone: "+1 408 555 0166", email: "yuki.t@example.com", language: "Japanese", address: "70 Pine St, Cupertino", bloodGroup: "A+", heightCm: 160, weightKg: 52,
      insurance: { payer: "Blue Harbor Health", memberId: "BHH-77410" }, emergencyContact: { name: "Hiro Tanaka", phone: "+1 408 555 0144", relation: "Father" },
      allergies: [allergy("Peanut", "food", "Lip swelling, wheeze", "severe")], noKnownAllergies: false,
      medications: [{ id: uid("med"), name: "Emollient cream", dose: "Apply", frequency: "Twice daily", status: "active", since: daysAgo(500) }],
      problems: [{ code: "L20.9", display: "Atopic dermatitis", since: daysAgo(4000), status: "active" }],
      devices: [phone], smoking: "never", pregnant: false, createdAt: daysAgo(500),
    },
    {
      id: "p7", mrn: "TC-100237", firstName: "Omar", lastName: "Haddad", dob: "1978-08-09", sex: "male", phone: "+1 650 555 0109", email: "omar.h@example.com", language: "Arabic", address: "501 El Camino, Redwood City", bloodGroup: "B-", heightCm: 177, weightKg: 92,
      insurance: { payer: "Pacific Shield", memberId: "PS-118803" }, emergencyContact: { name: "Leila Haddad", phone: "+1 650 555 0111", relation: "Spouse" },
      allergies: [], noKnownAllergies: true, medications: [], problems: [],
      devices: [phone], smoking: "current", createdAt: daysAgo(90),
    },
    {
      id: "p8", mrn: "TC-100238", firstName: "Sarah", lastName: "O'Connor", dob: "1994-03-21", sex: "female", phone: "+1 415 555 0175", email: "sarah.oc@example.com", language: "English", address: "12 Noe St, San Francisco", bloodGroup: "O-", heightCm: 168, weightKg: 63,
      insurance: { payer: "Blue Harbor Health", memberId: "BHH-66120" }, emergencyContact: { name: "Ciara O'Connor", phone: "+1 415 555 0170", relation: "Sister" },
      allergies: [allergy("Amoxicillin", "drug", "Itchy rash", "mild", "penicillin")], noKnownAllergies: false,
      medications: [], problems: [], devices: [phone], smoking: "never", pregnant: false, createdAt: daysAgo(300),
    },
    {
      id: "p9", mrn: "TC-100239", firstName: "Liam", lastName: "Novak", dob: "2018-05-30", sex: "male", phone: "+1 510 555 0136", email: "novak.family@example.com", language: "English", address: "77 Shattuck Ave, Berkeley", bloodGroup: "A+", heightCm: 128, weightKg: 26, guardian: "Eva Novak (mother)",
      insurance: { payer: "Kids First", memberId: "KF-44120" }, emergencyContact: { name: "Eva Novak", phone: "+1 510 555 0136", relation: "Mother" },
      allergies: [allergy("Egg", "food", "Hives", "moderate")], noKnownAllergies: false,
      medications: [], problems: [], devices: [phone, { name: "Smart thermometer", kind: "thermometer", connected: true }], smoking: "never", createdAt: daysAgo(1200),
    },
    {
      id: "p10", mrn: "TC-100240", firstName: "Fatima", lastName: "Al-Sayed", dob: "1962-12-05", sex: "female", phone: "+1 408 555 0128", email: "fatima.as@example.com", language: "Arabic", address: "2400 Moorpark Ave, San Jose", bloodGroup: "B+", heightCm: 160, weightKg: 79,
      insurance: { payer: "Medicare Advantage Plus", memberId: "MAP-660021" }, emergencyContact: { name: "Yusuf Al-Sayed", phone: "+1 408 555 0129", relation: "Son" },
      allergies: [], noKnownAllergies: true,
      medications: [
        { id: uid("med"), name: "Levothyroxine 50 mcg", dose: "50 mcg", frequency: "Once daily", status: "active", since: daysAgo(2000) },
        { id: uid("med"), name: "Metformin 500 mg", dose: "1000 mg", frequency: "Twice daily", status: "active", since: daysAgo(900) },
      ],
      problems: [
        { code: "E03.9", display: "Hypothyroidism", since: daysAgo(2000), status: "active" },
        { code: "E11.9", display: "Type 2 diabetes mellitus", since: daysAgo(900), status: "active" },
      ],
      devices: [phone, { name: "Glucometer", kind: "glucometer", connected: true }], smoking: "never", createdAt: daysAgo(2000),
    },
  ];

  // Baselines feed the remote-vitals simulator
  const VITAL_BASELINES: Record<string, VitalBaseline> = {
    p1: { hr: 104, spo2: 95, sys: 118, dia: 74, rr: 20, temp: 38.4 },
    p2: { hr: 78, spo2: 97, sys: 148, dia: 92, rr: 15, temp: 36.7 },
    p3: { hr: 92, spo2: 94, sys: 104, dia: 62, rr: 19, temp: 36.6 },
    p4: { hr: 88, spo2: 98, sys: 122, dia: 78, rr: 16, temp: 38.2 },
    p5: { hr: 86, spo2: 99, sys: 116, dia: 72, rr: 17, temp: 36.6 },
    p6: { hr: 72, spo2: 99, sys: 110, dia: 70, rr: 14, temp: 36.7 },
    p7: { hr: 76, spo2: 98, sys: 132, dia: 84, rr: 15, temp: 36.6 },
    p8: { hr: 84, spo2: 99, sys: 118, dia: 76, rr: 16, temp: 37.6 },
    p9: { hr: 108, spo2: 98, sys: 100, dia: 62, rr: 22, temp: 38.3 },
    p10: { hr: 80, spo2: 97, sys: 136, dia: 82, rr: 16, temp: 36.8 },
  };

  const pre = (symptoms: string[], duration: string, severity: number, notes: string, consent = true) => ({
    completed: true,
    symptoms,
    duration,
    severity,
    notes,
    shareDeviceData: true,
    recordingConsent: consent,
    deviceCheck: { camera: true, mic: true, network: "good" as const },
  });

  const minsAgo = (m: number) => new Date(nowMs - m * 60000).toISOString();

  const APPOINTMENTS: Appointment[] = [
    { id: "a1", patientId: "p7", clinicianId: "d1", start: atToday(8, 30), durationMin: 15, mode: "video", reason: "Low back pain after lifting", priority: "routine", status: "completed", createdBy: "patient", joinedAt: atToday(8, 27), startedAt: atToday(8, 31), endedAt: atToday(8, 46), preVisit: pre(["Back pain"], "4 days", 5, "Hurts more when bending") },
    { id: "a2", patientId: "p1", clinicianId: "d1", start: atToday(9, 30), durationMin: 15, mode: "video", reason: "Fever and cough for 3 days", priority: "routine", status: "waiting", createdBy: "patient", joinedAt: minsAgo(7), preVisit: pre(["Fever", "Cough", "Shortness of breath"], "3 days", 6, "Using my inhaler more than usual") },
    { id: "a3", patientId: "p3", clinicianId: "d1", start: atToday(9, 45), durationMin: 20, mode: "video", reason: "Dizziness on standing", priority: "urgent", status: "ready", createdBy: "staff", joinedAt: minsAgo(18), triagedBy: "n1", preVisit: pre(["Dizziness", "Fatigue"], "2 days", 6, "Nearly fell in the kitchen yesterday") },
    { id: "a4", patientId: "p4", clinicianId: "d1", start: atToday(10, 0), durationMin: 15, mode: "video", reason: "Sore throat and fever", priority: "routine", status: "waiting", createdBy: "patient", joinedAt: minsAgo(3), preVisit: pre(["Sore throat", "Fever"], "2 days", 5, "Painful to swallow, no cough") },
    { id: "a5", patientId: "p2", clinicianId: "d1", start: atToday(10, 30), durationMin: 20, mode: "video", reason: "Blood pressure and diabetes follow-up", priority: "routine", status: "booked", createdBy: "staff" },
    { id: "a6", patientId: "p5", clinicianId: "d3", start: atToday(11, 0), durationMin: 30, mode: "video", reason: "Anxiety medication review", priority: "routine", status: "booked", createdBy: "patient" },
    { id: "a7", patientId: "p6", clinicianId: "d5", start: atToday(11, 30), durationMin: 15, mode: "video", reason: "Eczema flare on arms", priority: "routine", status: "booked", createdBy: "patient" },
    { id: "a8", patientId: "p8", clinicianId: "d1", start: atToday(12, 0), durationMin: 15, mode: "video", reason: "Burning when passing urine", priority: "routine", status: "booked", createdBy: "patient" },
    { id: "a9", patientId: "p9", clinicianId: "d4", start: atToday(14, 0), durationMin: 15, mode: "video", reason: "Ear pain and fever", priority: "routine", status: "booked", createdBy: "patient" },
    { id: "a10", patientId: "p10", clinicianId: "d1", start: atToday(15, 0), durationMin: 20, mode: "video", reason: "Diabetes review", priority: "routine", status: "booked", createdBy: "staff" },
    { id: "a11", patientId: "p2", clinicianId: "d2", start: atToday(10, 0, 1), durationMin: 20, mode: "video", reason: "Cardiology opinion on BP", priority: "routine", status: "booked", createdBy: "staff" },
    { id: "a12", patientId: "p1", clinicianId: "d1", start: atToday(9, 0, 2), durationMin: 15, mode: "audio", reason: "Follow-up after chest infection", priority: "routine", status: "booked", createdBy: "staff" },
    // History
    { id: "h1", patientId: "p2", clinicianId: "d1", start: daysAgo(92), durationMin: 20, mode: "video", reason: "Hypertension review", priority: "routine", status: "completed", createdBy: "staff" },
    { id: "h2", patientId: "p3", clinicianId: "d2", start: daysAgo(35), durationMin: 20, mode: "video", reason: "AF follow-up", priority: "routine", status: "completed", createdBy: "staff" },
    { id: "h3", patientId: "p1", clinicianId: "d1", start: daysAgo(180), durationMin: 15, mode: "video", reason: "Asthma review", priority: "routine", status: "completed", createdBy: "patient" },
  ];

  const v = (p: Partial<Vitals>, source: Vitals["source"], at: string): Vitals => ({ id: uid("vit"), recordedAt: at, source, ...p });

  function signed(appt: Appointment, by: string, partial: Partial<Encounter>): Encounter {
    return { ...blankEncounter(appt, uid("enc"), iso), status: "signed", signedAt: appt.endedAt ?? appt.start, signedBy: by, allergiesReviewed: true, ...partial };
  }

  const a = (id: string) => APPOINTMENTS.find((x) => x.id === id)!;

  const ENCOUNTERS: Encounter[] = [
    signed(a("a1"), "d1", {
      vitals: [v({ hr: 76, spo2: 98, sys: 132, dia: 84, rr: 15, temp: 36.6, pain: 5 }, "device", atToday(8, 32))],
      soap: {
        subjective: "4 days of lower back pain after lifting boxes. No leg weakness, numbness, bladder or bowel change.",
        objective: "Walking comfortably on video. Forward flexion limited by pain. Heel and toe walking normal.",
        assessment: "Mechanical low back pain without red flags.",
        plan: "Naproxen 7 days, stay active, physiotherapy referral. Return if red flags.",
      },
      diagnoses: [{ code: "M54.50", display: "Low back pain, unspecified", type: "primary", certainty: "confirmed", addToProblemList: false }],
      prescriptions: [{ id: uid("rx"), drugId: "naproxen", name: "Naproxen", strength: "500 mg", form: "tablet", dose: "500 mg", route: "oral", frequency: "Twice daily with food", durationDays: 7, quantity: 14, refills: 0, instructions: "Take with food. Stop if stomach pain.", prn: false }],
      orders: [{ id: uid("ord"), kind: "referral", code: "REF-PHYSIO", name: "Physiotherapy", priority: "routine", notes: "Mechanical LBP", orderedBy: "d1", orderedByRole: "doctor", status: "signed" }],
      patientInstructions: "Keep moving gently, use heat packs, and take naproxen with food. Seek urgent help if you develop numbness around the groin, leg weakness or bladder problems.",
      followUp: { inDays: 14, mode: "video", note: "If not improving" },
    }),
    signed(a("h1"), "d1", {
      vitals: [v({ hr: 80, sys: 152, dia: 94 }, "device", daysAgo(92))],
      soap: { subjective: "Home BP averaging 150/92.", objective: "Remote BP 152/94.", assessment: "Hypertension above target.", plan: "Amlodipine started 5 mg. Home BP diary." },
      diagnoses: [{ code: "I10", display: "Essential (primary) hypertension", type: "primary", certainty: "confirmed", addToProblemList: false }],
      followUp: { inDays: 90, mode: "video", note: "BP and diabetes review" },
    }),
    signed(a("h2"), "d2", {
      vitals: [v({ hr: 84, sys: 118, dia: 70, spo2: 96 }, "device", daysAgo(35))],
      soap: { subjective: "Stable, mild ankle swelling.", objective: "Irregular pulse on oximeter trace.", assessment: "AF, rate controlled. HF stable.", plan: "Continue warfarin and bisoprolol. INR monthly." },
      diagnoses: [{ code: "I48.91", display: "Unspecified atrial fibrillation", type: "primary", certainty: "confirmed", addToProblemList: false }],
    }),
    signed(a("h3"), "d1", {
      soap: { subjective: "Using reliever twice a week.", objective: "Speaking full sentences.", assessment: "Asthma partially controlled.", plan: "Inhaler technique reviewed." },
      diagnoses: [{ code: "J45.909", display: "Unspecified asthma, uncomplicated", type: "primary", certainty: "confirmed", addToProblemList: false }],
    }),
    // Grace has been triaged by the nurse and is ready for the doctor
    {
      ...blankEncounter(a("a3"), uid("enc"), iso),
      triage: {
        chiefComplaint: "Dizziness on standing for 2 days, near-fall yesterday",
        onset: "2 days",
        painScore: 0,
        redFlags: ["Near-fall", "On anticoagulant"],
        screening: { fever: false, chestPain: false, breathless: false, travel: false, fall: true, newMeds: true },
        nurseNote: "Furosemide increased from 20 to 40 mg last week by cardiology. Lightheaded on standing, no syncope, no head injury. Drinking less due to nausea. Daughter present on call.",
        completedBy: "n1",
        completedAt: minsAgo(10),
      },
      vitals: [v({ hr: 94, spo2: 94, sys: 102, dia: 60, rr: 19, temp: 36.6, pain: 0, consciousness: "alert" }, "nurse", minsAgo(12))],
      allergiesReviewed: true,
    },
  ];

  const MESSAGES: ChatMessage[] = [
    { id: uid("msg"), appointmentId: "a2", from: "patient", author: "Ana Ruiz", text: "Hi, I'm in the waiting room. My oximeter is connected.", at: minsAgo(6) },
  ];

  return { staff: STAFF, patients: PATIENTS, appointments: APPOINTMENTS, encounters: ENCOUNTERS, messages: MESSAGES, vitalBaselines: VITAL_BASELINES };
}
