// Demo records, dated relative to today so follow-up windows and admissions are always live.
import type {
  AdmissionRequest, AppState, Case, ComplaintEntry, Coverage, DurationUnit, Encounter, EncounterStatus, EncounterType,
  Episode, Patient, StartType,
} from "@/lib/types";
import { toDateInput } from "@/lib/utils";
import { COMPLAINTS } from "./master";

const COUNTER_FOR: Record<EncounterType, string> = {
  OP: "ctr-op", FOLLOW_UP: "ctr-op", HEALTH_CHECK: "ctr-op", EMERGENCY: "ctr-er", IP: "ctr-adm", DAY_CARE: "ctr-adm",
  NO_CONSULT: "ctr-diag", OUTSIDE: "ctr-diag", TELE: "ctr-virtual", HOME_VISIT: "ctr-virtual",
};

export function createDemoData(now = new Date()): { state: AppState; sequences: Record<string, number> } {
  const at = (daysAgo: number, hour = 10, min = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, min, 0, 0);
    return d.toISOString();
  };
  const dayFrom = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return toDateInput(d);
  };
  const cc = (code: string, duration?: number, unit?: DurationUnit): ComplaintEntry => ({
    code, label: COMPLAINTS.find((c) => c.code === code)!.label, duration, unit,
  });

  const cov = (
    id: string, priority: Coverage["priority"], payerId: string, networkId: string, planId: string, memberId: string,
    tpaId?: string, expired = false,
  ): Coverage => ({
    id, priority, payerId, tpaId, networkId, planId, memberId, policyNumber: `POL-${memberId.slice(-6)}`,
    validFrom: dayFrom(expired ? -500 : -200), validTo: dayFrom(expired ? -30 : 165), relationship: "Self",
  });

  const patients: Patient[] = [
    {
      id: "p1", mrn: "MRN-100231", firstName: "Aisha", lastName: "Khan", dob: "1988-04-12", gender: "Female",
      phone: "+1 415 555 0142", email: "aisha.khan@example.com", nationalId: "ID-88412-K", nationality: "Canadian",
      bloodGroup: "B+", address: "22 Linden Ave", city: "Riverside", emergencyName: "Imran Khan", emergencyPhone: "+1 415 555 0190",
      allergies: "Penicillin",
      coverages: [
        cov("c1", "Primary", "pay-meridian", "net-mer-gold", "pl-mer-gold-plus", "MER-4471029", "tpa-medassist"),
        cov("c2", "Secondary", "pay-helix", "net-hel-gold", "pl-hel-open", "HLX-2290315"),
      ],
      createdAt: at(400),
    },
    {
      id: "p2", mrn: "MRN-100232", firstName: "Rahul", lastName: "Verma", dob: "1975-09-03", gender: "Male",
      phone: "+1 415 555 0177", nationalId: "ID-75903-V", bloodGroup: "O+", address: "9 Harbor Rd", city: "Bayview",
      coverages: [cov("c3", "Primary", "pay-northstar", "net-nor-gold", "pl-nor-prime", "NST-8812201", "tpa-claimpoint")],
      createdAt: at(380),
    },
    {
      id: "p3", mrn: "MRN-100233", firstName: "Sofia", middleName: "Elena", lastName: "Martinez", dob: "1993-01-27", gender: "Female",
      phone: "+1 415 555 0123", email: "sofia.m@example.com", bloodGroup: "A+", address: "140 Grove St", city: "Riverside",
      coverages: [
        cov("c4", "Primary", "pay-cedar", "net-ced-plat", "pl-ced-elite", "CED-5501287", "tpa-vista"),
        cov("c5", "Secondary", "pay-harbor", "net-har-gold", "pl-har-pref", "BHC-1209934", "tpa-carelink"),
      ],
      createdAt: at(120),
    },
    {
      id: "p4", mrn: "MRN-100234", firstName: "James", lastName: "O'Connor", dob: "1960-06-18", gender: "Male",
      phone: "+1 415 555 0168", nationalId: "ID-60618-O", city: "Northgate", address: "3 Mill Lane",
      coverages: [cov("c6", "Primary", "pay-state", "net-sta-basic", "pl-sta-gen", "STH-0042871", "tpa-vista")],
      createdAt: at(700),
    },
    {
      id: "p5", mrn: "MRN-100235", firstName: "Mei", lastName: "Chen", dob: "2018-11-02", gender: "Female",
      phone: "+1 415 555 0105", emergencyName: "Lin Chen", emergencyPhone: "+1 415 555 0105", city: "Bayview",
      coverages: [cov("c7", "Primary", "pay-helix", "net-hel-basic", "pl-hel-comm", "HLX-7781002")],
      createdAt: at(200),
    },
    {
      id: "p6", mrn: "MRN-100236", firstName: "Daniel", lastName: "Mensah", dob: "1982-02-14", gender: "Male",
      phone: "+1 415 555 0199", city: "Eastport", coverages: [], createdAt: at(0, 8),
    },
    {
      id: "p7", mrn: "MRN-100237", firstName: "Layla", lastName: "Hassan", dob: "1999-07-21", gender: "Female",
      phone: "+1 415 555 0136", email: "layla.h@example.com", vip: true, city: "Riverside", address: "55 Crescent Park",
      coverages: [cov("c8", "Primary", "pay-meridian", "net-mer-plat", "pl-mer-plat-comp", "MER-9900213", "tpa-carelink")],
      createdAt: at(60),
    },
    {
      id: "p8", mrn: "MRN-100238", firstName: "Victor", lastName: "Novak", dob: "1955-03-09", gender: "Male",
      phone: "+1 415 555 0181", address: "71 Orchard Close", city: "Northgate",
      coverages: [
        cov("c9", "Primary", "pay-harbor", "net-har-gold", "pl-har-pref", "BHC-3301876"),
        cov("c10", "Secondary", "pay-meridian", "net-mer-basic", "pl-mer-ess", "MER-1102938", "tpa-medassist", true),
      ],
      createdAt: at(900),
    },
    {
      id: "p9", mrn: "MRN-100239", firstName: "Grace", lastName: "Adeyemi", dob: "1970-12-30", gender: "Female",
      phone: "+1 415 555 0114", email: "grace.a@example.com", city: "Bayview",
      coverages: [cov("c11", "Primary", "pay-northstar", "net-nor-silver", "pl-nor-select", "NST-4410987", "tpa-claimpoint")],
      createdAt: at(30),
    },
    {
      id: "p10", mrn: "MRN-100240", firstName: "Ibrahim", lastName: "Al-Sayed", dob: "1990-05-05", gender: "Male",
      phone: "+1 415 555 0158", city: "Eastport",
      coverages: [cov("c12", "Primary", "pay-cedar", "net-ced-silver", "pl-ced-std", "CED-6620031", "tpa-medassist")],
      createdAt: at(2),
    },
    {
      id: "p11", mrn: "MRN-100241", firstName: "Emma", lastName: "Larsen", dob: "1985-08-16", gender: "Female",
      phone: "+1 415 555 0127", email: "emma.larsen@example.com", city: "Riverside",
      coverages: [cov("c13", "Primary", "pay-meridian", "net-mer-gold", "pl-mer-gold-fam", "MER-5512094", "tpa-medassist")],
      createdAt: at(90),
    },
    {
      id: "p12", mrn: "MRN-100242", firstName: "Kenji", lastName: "Watanabe", dob: "2001-10-11", gender: "Male",
      phone: "+1 415 555 0193", city: "Northgate", coverages: [], createdAt: at(5),
    },
  ];

  const ep = (
    id: string, code: number, patientId: string, title: string, kind: Episode["kind"], departmentId: string,
    startDaysAgo: number, practitionerId?: string, status: Episode["status"] = "Active",
  ): Episode => ({ id, code: `EP-${code}`, patientId, title, kind, departmentId, practitionerId, status, startDate: at(startDaysAgo) });

  const episodes: Episode[] = [
    ep("e1", 5001, "p1", "Hypertension management", "Chronic care", "dep-card", 120, "pr-3"),
    ep("e2", 5002, "p2", "Right knee osteoarthritis", "Surgical", "dep-ortho", 20, "pr-5"),
    ep("e3", 5003, "p3", "Pregnancy, second trimester", "Maternity", "dep-obg", 25, "pr-8"),
    ep("e4", 5004, "p4", "Type 2 diabetes", "Chronic care", "dep-endo", 300, "pr-11"),
    ep("e5", 5005, "p5", "Viral fever", "Acute illness", "dep-peds", 0, "pr-7"),
    ep("e6", 5006, "p6", "Road traffic injury", "Acute illness", "dep-er", 0, "pr-13"),
    ep("e7", 5007, "p7", "Atopic dermatitis", "Acute illness", "dep-derm", 8, "pr-9"),
    ep("e8", 5008, "p8", "Post-stroke rehabilitation", "Rehabilitation", "dep-physio", 45, "pr-12"),
    ep("e9", 5009, "p9", "Annual wellness", "Preventive", "dep-wellness", 0, "pr-14"),
    ep("e10", 5010, "p10", "Lower back pain imaging", "Acute illness", "dep-rad", 1),
    ep("e11", 5011, "p11", "Seasonal allergy", "Acute illness", "dep-gm", 1, "pr-1"),
    ep("e12", 5012, "p1", "Gastritis", "Acute illness", "dep-gm", 200, "pr-2", "Closed"),
    ep("e13", 5013, "p11", "Gallstone disease", "Surgical", "dep-surg", 6, "pr-15"),
  ];

  const cs = (
    id: string, code: number, patientId: string, episodeId: string, title: string, departmentId: string, openedDaysAgo: number,
    complaints: ComplaintEntry[], extra: Partial<Case> = {},
  ): Case => ({
    id, code: `CS-${code}`, patientId, episodeId, title, departmentId, complaints, status: "Open",
    openedAt: at(openedDaysAgo, 9), medicoLegal: false, ...extra,
  });

  const cases: Case[] = [
    cs("cs1", 3001, "p1", "e1", "Raised blood pressure", "dep-card", 120, [cc("CC-HBP", 2, "weeks")], { status: "Closed", closedAt: at(90), provisionalDiagnosis: "Essential hypertension" }),
    cs("cs2", 3002, "p1", "e1", "Blood pressure review", "dep-card", 4, [cc("CC-HBP", 1, "weeks"), cc("CC-REV")], { provisionalDiagnosis: "Essential hypertension" }),
    cs("cs3", 3003, "p1", "e12", "Epigastric pain", "dep-gm", 200, [cc("CC-EPI", 5, "days")], { status: "Closed", closedAt: at(185), provisionalDiagnosis: "Gastritis" }),
    cs("cs4", 3004, "p2", "e2", "Right knee pain", "dep-ortho", 20, [cc("CC-KNE", 3, "months")], { provisionalDiagnosis: "Osteoarthritis of right knee" }),
    cs("cs5", 3005, "p3", "e3", "Antenatal care", "dep-obg", 25, [cc("CC-ANC")]),
    cs("cs6", 3006, "p4", "e4", "Sugar control review", "dep-endo", 19, [cc("CC-SUG", 1, "months")], { provisionalDiagnosis: "Type 2 diabetes, poorly controlled" }),
    cs("cs7", 3007, "p4", "e4", "Non-healing wound, left foot", "dep-endo", 1, [cc("CC-WND", 3, "weeks")], { provisionalDiagnosis: "Diabetic foot ulcer" }),
    cs("cs8", 3008, "p5", "e5", "Fever and cough", "dep-peds", 0, [cc("CC-FEV", 2, "days"), cc("CC-COU", 2, "days")]),
    cs("cs9", 3009, "p6", "e6", "Road traffic injury", "dep-er", 0, [cc("CC-RTA", 1, "hours")], {
      medicoLegal: true, mlcNumber: "MLC-2026-0418", policeStation: "Eastport Police Station", provisionalDiagnosis: "Closed fracture, right femur",
    }),
    cs("cs10", 3010, "p7", "e7", "Skin rash", "dep-derm", 8, [cc("CC-RAS", 10, "days"), cc("CC-ITC", 10, "days")]),
    cs("cs11", 3011, "p8", "e8", "Rehabilitation after stroke", "dep-physio", 45, [cc("CC-WEA", 2, "months")]),
    cs("cs12", 3012, "p9", "e9", "Annual health check", "dep-wellness", 0, [cc("CC-CHK")]),
    cs("cs13", 3013, "p10", "e10", "Low back pain", "dep-rad", 1, [cc("CC-BAC", 6, "weeks")]),
    cs("cs14", 3014, "p11", "e11", "Sneezing and itchy eyes", "dep-gm", 1, [cc("CC-SNZ", 5, "days")]),
    cs("cs15", 3015, "p11", "e13", "Right upper abdominal pain", "dep-surg", 6, [cc("CC-ABD", 3, "weeks"), cc("CC-VOM", 1, "weeks")], { provisionalDiagnosis: "Symptomatic gallstones" }),
  ];

  let n = 7000;
  const enc = (
    patientId: string, caseId: string, type: EncounterType, startType: StartType, departmentId: string, start: string,
    status: EncounterStatus, extra: Partial<Encounter> = {},
  ): Encounter => {
    n += 1;
    const p = patients.find((x) => x.id === patientId)!;
    const c = cases.find((x) => x.id === caseId)!;
    return {
      id: `x${n}`, code: `ENC-${n}`, patientId, episodeId: c.episodeId, caseId, type, startType, departmentId, start, status,
      priority: type === "EMERGENCY" ? "Emergency" : type === "IP" ? "Urgent" : "Routine",
      billingMode: p.coverages.length ? "Insurance" : "Self pay",
      coverageIds: p.coverages.length ? [p.coverages[0].id] : [],
      counterId: COUNTER_FOR[type],
      createdAt: start,
      ...extra,
    };
  };
  const withComplaints = (list: ComplaintEntry[]) => ({ complaints: list, chiefComplaint: list.map((c) => c.label).join(", ") });

  const encounters: Encounter[] = [];
  const push = (e: Encounter) => (encounters.push(e), e);
  const caseOf = (id: string) => cases.find((c) => c.id === id)!.complaints;

  push(enc("p1", "cs1", "OP", "APPOINTMENT", "dep-card", at(120, 9, 30), "Completed", { practitionerId: "pr-3", ...withComplaints(caseOf("cs1")) }));
  push(enc("p1", "cs2", "OP", "APPOINTMENT", "dep-card", at(4, 11), "Completed", { practitionerId: "pr-3", ...withComplaints(caseOf("cs2")) }));
  push(enc("p1", "cs3", "OP", "WALK_IN", "dep-gm", at(200, 16), "Completed", { practitionerId: "pr-2", ...withComplaints(caseOf("cs3")) }));

  const r1 = push(enc("p2", "cs4", "OP", "WALK_IN", "dep-ortho", at(20, 10, 15), "Completed", { practitionerId: "pr-5", ...withComplaints(caseOf("cs4")) }));
  push(enc("p2", "cs4", "FOLLOW_UP", "APPOINTMENT", "dep-ortho", at(12, 12), "Completed", { practitionerId: "pr-5", parentEncounterId: r1.id, followUpDerived: true, followUpChargeable: false, chiefComplaint: "MRI review" }));
  const rahulIp = push(enc("p2", "cs4", "IP", "ELECTIVE", "dep-ortho", at(2, 7, 30), "In progress", {
    practitionerId: "pr-5", wardId: "w-surg", bed: "4B-03", admissionReason: "Total knee replacement, right",
    expectedStayDays: 4, authNumber: "AUTH-55120", admissionRequestId: "ar1", chiefComplaint: "Knee pain",
  }));

  const s1 = push(enc("p3", "cs5", "OP", "APPOINTMENT", "dep-obg", at(25, 9), "Completed", { practitionerId: "pr-8", ...withComplaints(caseOf("cs5")) }));
  push(enc("p3", "cs5", "FOLLOW_UP", "APPOINTMENT", "dep-obg", at(10, 9, 30), "Completed", { practitionerId: "pr-8", parentEncounterId: s1.id, followUpDerived: true, followUpChargeable: false, chiefComplaint: "Anomaly scan review" }));
  push(enc("p3", "cs5", "FOLLOW_UP", "APPOINTMENT", "dep-obg", at(0, 15, 30), "Planned", { practitionerId: "pr-8", parentEncounterId: s1.id, followUpDerived: true, followUpChargeable: false, chiefComplaint: "Routine antenatal visit" }));

  push(enc("p4", "cs6", "OP", "APPOINTMENT", "dep-endo", at(19, 10), "Completed", { practitionerId: "pr-11", ...withComplaints(caseOf("cs6")) }));
  push(enc("p4", "cs6", "NO_CONSULT", "ORDER_ONLY", "dep-lab", at(18, 8), "Completed", { services: ["HbA1c", "Lipid profile"] }));
  const jamesOp = push(enc("p4", "cs7", "OP", "WALK_IN", "dep-endo", at(1, 11, 20), "Completed", { practitionerId: "pr-11", ...withComplaints(caseOf("cs7")) }));

  push(enc("p5", "cs8", "OP", "WALK_IN", "dep-peds", at(0, 9, 10), "Arrived", { practitionerId: "pr-7", ...withComplaints(caseOf("cs8")) }));
  const danielEr = push(enc("p6", "cs9", "EMERGENCY", "AMBULANCE", "dep-er", at(0, 8, 5), "In progress", {
    practitionerId: "pr-13", triage: "Level 2", broughtBy: "City ambulance service", broughtByPhone: "+1 415 555 0911", ...withComplaints(caseOf("cs9")),
  }));
  push(enc("p7", "cs10", "OP", "APPOINTMENT", "dep-derm", at(8, 14), "Completed", { practitionerId: "pr-9", ...withComplaints(caseOf("cs10")) }));
  push(enc("p8", "cs11", "HOME_VISIT", "SCHEDULED_VISIT", "dep-physio", at(0, 11), "Planned", { practitionerId: "pr-12", visitAddress: "71 Orchard Close, Northgate", visitTeam: "Physio + nurse", ...withComplaints(caseOf("cs11")) }));
  push(enc("p9", "cs12", "HEALTH_CHECK", "APPOINTMENT", "dep-wellness", at(0, 8, 30), "In progress", { packageId: "pk-women", ...withComplaints(caseOf("cs12")) }));
  push(enc("p10", "cs13", "OUTSIDE", "EXTERNAL_REFERRAL", "dep-rad", at(1, 13), "Completed", { referringFacility: "Eastport Family Clinic", referringDoctor: "Dr. Paul Hart", services: ["MRI knee"], ...withComplaints(caseOf("cs13")) }));
  push(enc("p11", "cs14", "TELE", "SCHEDULED_CALL", "dep-gm", at(1, 18), "Completed", { practitionerId: "pr-1", teleChannel: "Video", teleLink: "https://meet.example.health/r/8k2-q9d", ...withComplaints(caseOf("cs14")) }));
  const emmaOp = push(enc("p11", "cs15", "OP", "APPOINTMENT", "dep-surg", at(6, 10, 40), "Completed", { practitionerId: "pr-15", ...withComplaints(caseOf("cs15")) }));

  const planned = (daysAhead: number, hour: number) => at(-daysAhead, hour);
  const ar = (r: Omit<AdmissionRequest, "createdAt" | "updatedAt" | "specialNeeds" | "isolation"> & Partial<AdmissionRequest>): AdmissionRequest => ({
    specialNeeds: [], isolation: "None", createdAt: at(1, 12), updatedAt: at(1, 12), ...r,
  });

  const admissionRequests: AdmissionRequest[] = [
    ar({
      id: "ar1", code: "AR-6001", patientId: "p2", caseId: "cs4", episodeId: "e2", sourceEncounterId: r1.id, requestedById: "pr-5",
      admittingDepartmentId: "dep-ortho", admittingPractitionerId: "pr-5", urgency: "Elective", plannedDate: at(2, 7),
      expectedStayDays: 4, bedCategory: "General", reason: "Total knee replacement, right", plannedProcedure: "Right total knee arthroplasty",
      specialNeeds: ["Walker or wheelchair"], billingMode: "Insurance", coverageId: "c3", authStatus: "Approved", authNumber: "AUTH-55120",
      estimatedCost: 14200, status: "Admitted", admittedEncounterId: rahulIp.id, createdAt: at(12, 12), updatedAt: at(2, 7, 30),
    }),
    ar({
      id: "ar2", code: "AR-6002", patientId: "p4", caseId: "cs7", episodeId: "e4", sourceEncounterId: jamesOp.id, requestedById: "pr-11",
      admittingDepartmentId: "dep-endo", admittingPractitionerId: "pr-11", urgency: "Urgent", plannedDate: planned(0, 14),
      expectedStayDays: 5, bedCategory: "General", isolation: "Contact", reason: "Infected diabetic foot ulcer, IV antibiotics and debridement",
      plannedProcedure: "Wound debridement, left foot", specialNeeds: ["Diabetic diet", "Fall risk"], billingMode: "Insurance", coverageId: "c6",
      authStatus: "Approved", authNumber: "AUTH-77031", estimatedCost: 6800, status: "Ready",
    }),
    ar({
      id: "ar3", code: "AR-6003", patientId: "p6", caseId: "cs9", episodeId: "e6", sourceEncounterId: danielEr.id, requestedById: "pr-13",
      admittingDepartmentId: "dep-ortho", admittingPractitionerId: "pr-5", urgency: "Emergency", plannedDate: at(0, 9, 40),
      expectedStayDays: 6, bedCategory: "General", reason: "Closed fracture of right femur for fixation", plannedProcedure: "Intramedullary nailing, right femur",
      specialNeeds: ["Oxygen", "Walker or wheelchair"], billingMode: "Self pay", authStatus: "Not required", estimatedCost: 9500,
      depositCollected: false, status: "Pending", notes: "Medico-legal case. Police informed.", createdAt: at(0, 9, 30), updatedAt: at(0, 9, 30),
    }),
    ar({
      id: "ar4", code: "AR-6004", patientId: "p11", caseId: "cs15", episodeId: "e13", sourceEncounterId: emmaOp.id, requestedById: "pr-15",
      admittingDepartmentId: "dep-surg", admittingPractitionerId: "pr-15", urgency: "Elective", plannedDate: planned(3, 7),
      expectedStayDays: 2, bedCategory: "Semi-private", reason: "Symptomatic gallstones", plannedProcedure: "Laparoscopic cholecystectomy",
      billingMode: "Insurance", coverageId: "c13", authStatus: "Pending", estimatedCost: 5400, status: "Pending",
      createdAt: at(6, 11), updatedAt: at(6, 11),
    }),
  ];

  return {
    state: { patients, episodes, cases, encounters, admissionRequests },
    sequences: { mrn: 100242, encounter: n, episode: 5013, case: 3015, admission_request: 6004 },
  };
}
