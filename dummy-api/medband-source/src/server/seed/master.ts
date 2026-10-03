// Seed source for reference data. Inserted into SQLite on first run.
import type { Complaint, Counter, Department, HealthPackage, MasterData, Payer, Plan, PlanNetwork, Practitioner, Tpa, Ward } from "@/lib/master-data";

export const TPAS: Tpa[] = [
  { id: "tpa-medassist", name: "MedAssist TPA" },
  { id: "tpa-claimpoint", name: "ClaimPoint Administrators" },
  { id: "tpa-carelink", name: "CareLink Health Services" },
  { id: "tpa-vista", name: "Vista Claims Management" },
];

export const PAYERS: Payer[] = [
  { id: "pay-meridian", name: "Meridian Health Assurance", short: "Meridian", tpaIds: ["tpa-medassist", "tpa-carelink"], tpaRequired: true },
  { id: "pay-northstar", name: "Northstar Insurance", short: "Northstar", tpaIds: ["tpa-claimpoint"], tpaRequired: true },
  { id: "pay-helix", name: "Helix Mutual", short: "Helix", tpaIds: [], tpaRequired: false },
  { id: "pay-cedar", name: "Cedarline Health", short: "Cedarline", tpaIds: ["tpa-vista", "tpa-medassist"], tpaRequired: true },
  { id: "pay-harbor", name: "Blue Harbor Care", short: "Blue Harbor", tpaIds: ["tpa-carelink"], tpaRequired: false },
  { id: "pay-state", name: "State Health Scheme", short: "State scheme", tpaIds: ["tpa-vista"], tpaRequired: true },
];

export const NETWORKS: PlanNetwork[] = [
  { id: "net-mer-plat", payerId: "pay-meridian", name: "Meridian Platinum", tier: "Platinum" },
  { id: "net-mer-gold", payerId: "pay-meridian", name: "Meridian Gold", tier: "Gold" },
  { id: "net-mer-basic", payerId: "pay-meridian", name: "Meridian Essential", tier: "Basic" },
  { id: "net-nor-gold", payerId: "pay-northstar", name: "Northstar Prime", tier: "Gold" },
  { id: "net-nor-silver", payerId: "pay-northstar", name: "Northstar Select", tier: "Silver" },
  { id: "net-hel-gold", payerId: "pay-helix", name: "Helix Open Access", tier: "Gold" },
  { id: "net-hel-basic", payerId: "pay-helix", name: "Helix Community", tier: "Basic" },
  { id: "net-ced-plat", payerId: "pay-cedar", name: "Cedarline Elite", tier: "Platinum" },
  { id: "net-ced-silver", payerId: "pay-cedar", name: "Cedarline Standard", tier: "Silver" },
  { id: "net-har-gold", payerId: "pay-harbor", name: "Harbor Preferred", tier: "Gold" },
  { id: "net-sta-basic", payerId: "pay-state", name: "State General Network", tier: "Basic" },
];

export const PLANS: Plan[] = [
  { id: "pl-mer-plat-comp", networkId: "net-mer-plat", name: "Platinum Comprehensive", copayPct: 0, opLimit: 20000, ipCovered: true, teleCovered: true },
  { id: "pl-mer-gold-plus", networkId: "net-mer-gold", name: "Gold Plus", copayPct: 10, opLimit: 10000, ipCovered: true, teleCovered: true },
  { id: "pl-mer-gold-fam", networkId: "net-mer-gold", name: "Gold Family", copayPct: 15, opLimit: 8000, ipCovered: true, teleCovered: false },
  { id: "pl-mer-ess", networkId: "net-mer-basic", name: "Essential Care", copayPct: 20, opLimit: 3000, ipCovered: true, teleCovered: false },
  { id: "pl-nor-prime", networkId: "net-nor-gold", name: "Prime Corporate", copayPct: 10, opLimit: 12000, ipCovered: true, teleCovered: true },
  { id: "pl-nor-select", networkId: "net-nor-silver", name: "Select Individual", copayPct: 20, opLimit: 5000, ipCovered: true, teleCovered: true },
  { id: "pl-hel-open", networkId: "net-hel-gold", name: "Open Access 80", copayPct: 20, opLimit: 9000, ipCovered: true, teleCovered: true },
  { id: "pl-hel-comm", networkId: "net-hel-basic", name: "Community Basic", copayPct: 30, opLimit: 2000, ipCovered: false, teleCovered: false },
  { id: "pl-ced-elite", networkId: "net-ced-plat", name: "Elite Global", copayPct: 0, opLimit: 30000, ipCovered: true, teleCovered: true },
  { id: "pl-ced-std", networkId: "net-ced-silver", name: "Standard Plus", copayPct: 15, opLimit: 6000, ipCovered: true, teleCovered: false },
  { id: "pl-har-pref", networkId: "net-har-gold", name: "Preferred Family", copayPct: 10, opLimit: 10000, ipCovered: true, teleCovered: true },
  { id: "pl-sta-gen", networkId: "net-sta-basic", name: "General Entitlement", copayPct: 0, opLimit: 1500, ipCovered: true, teleCovered: false },
];

export const DEPARTMENTS: Department[] = [
  { id: "dep-gm", name: "General Medicine", followUpDays: 7, freeFollowUps: 1, consults: true },
  { id: "dep-card", name: "Cardiology", followUpDays: 14, freeFollowUps: 2, consults: true },
  { id: "dep-ortho", name: "Orthopedics", followUpDays: 14, freeFollowUps: 2, consults: true },
  { id: "dep-peds", name: "Pediatrics", followUpDays: 7, freeFollowUps: 1, consults: true },
  { id: "dep-obg", name: "Obstetrics & Gynecology", followUpDays: 30, freeFollowUps: 3, consults: true },
  { id: "dep-derm", name: "Dermatology", followUpDays: 10, freeFollowUps: 1, consults: true },
  { id: "dep-ent", name: "ENT", followUpDays: 10, freeFollowUps: 1, consults: true },
  { id: "dep-endo", name: "Endocrinology", followUpDays: 21, freeFollowUps: 2, consults: true },
  { id: "dep-physio", name: "Physiotherapy", followUpDays: 30, freeFollowUps: 0, consults: true },
  { id: "dep-er", name: "Emergency Medicine", followUpDays: 3, freeFollowUps: 1, consults: true },
  { id: "dep-lab", name: "Laboratory", followUpDays: 0, freeFollowUps: 0, consults: false },
  { id: "dep-rad", name: "Radiology", followUpDays: 0, freeFollowUps: 0, consults: false },
  { id: "dep-wellness", name: "Preventive Health", followUpDays: 15, freeFollowUps: 1, consults: true },
  { id: "dep-surg", name: "General Surgery", followUpDays: 14, freeFollowUps: 1, consults: true },
];

export const PRACTITIONERS: Practitioner[] = [
  { id: "pr-1", name: "Dr. Anika Rao", departmentId: "dep-gm", title: "Consultant", tele: true },
  { id: "pr-2", name: "Dr. Samuel Okafor", departmentId: "dep-gm", title: "Specialist", tele: true },
  { id: "pr-3", name: "Dr. Leila Haddad", departmentId: "dep-card", title: "Consultant", tele: true },
  { id: "pr-4", name: "Dr. Marco Bianchi", departmentId: "dep-card", title: "Specialist", tele: false },
  { id: "pr-5", name: "Dr. Priya Menon", departmentId: "dep-ortho", title: "Consultant", tele: false },
  { id: "pr-6", name: "Dr. Tomás Ruiz", departmentId: "dep-ortho", title: "Specialist", tele: true },
  { id: "pr-7", name: "Dr. Hana Kim", departmentId: "dep-peds", title: "Consultant", tele: true },
  { id: "pr-8", name: "Dr. Fatima Zahra", departmentId: "dep-obg", title: "Consultant", tele: true },
  { id: "pr-9", name: "Dr. Ethan Brooks", departmentId: "dep-derm", title: "Specialist", tele: true },
  { id: "pr-10", name: "Dr. Nadia Petrova", departmentId: "dep-ent", title: "Consultant", tele: false },
  { id: "pr-11", name: "Dr. Arjun Shah", departmentId: "dep-endo", title: "Consultant", tele: true },
  { id: "pr-12", name: "Grace Liu, PT", departmentId: "dep-physio", title: "Physiotherapist", tele: true },
  { id: "pr-13", name: "Dr. Omar Siddiqui", departmentId: "dep-er", title: "Emergency physician", tele: false },
  { id: "pr-14", name: "Dr. Claire Dubois", departmentId: "dep-wellness", title: "Family physician", tele: true },
  { id: "pr-15", name: "Dr. Kwame Asante", departmentId: "dep-surg", title: "Consultant surgeon", tele: false },
  { id: "pr-16", name: "Dr. Elif Demir", departmentId: "dep-er", title: "Emergency physician", tele: false },
];

export const WARDS: Ward[] = [
  { id: "w-med", name: "Medical Ward 3A", category: "General", beds: ["3A-01", "3A-02", "3A-04", "3A-07", "3A-09"] },
  { id: "w-surg", name: "Surgical Ward 4B", category: "General", beds: ["4B-02", "4B-03", "4B-05", "4B-11"] },
  { id: "w-semi", name: "Semi-private 4C", category: "Semi-private", beds: ["4C-01", "4C-02", "4C-03", "4C-04"] },
  { id: "w-pvt", name: "Private Suites 5", category: "Private", beds: ["P5-01", "P5-02", "P5-03"] },
  { id: "w-mat", name: "Maternity Suite", category: "Maternity", beds: ["MS-01", "MS-03", "MS-04"] },
  { id: "w-icu", name: "Intensive Care", category: "ICU", beds: ["ICU-1", "ICU-2", "ICU-5"] },
  { id: "w-day", name: "Day Care Unit", category: "Day care", beds: ["DC-01", "DC-02", "DC-03", "DC-04", "DC-05", "DC-06"] },
];

export const SERVICES: string[] = [
  "Complete blood count",
  "Lipid profile",
  "HbA1c",
  "Thyroid panel",
  "Chest X-ray",
  "Ultrasound abdomen",
  "ECG",
  "MRI knee",
  "Vaccination",
  "Wound dressing",
  "Medication refill",
  "Physiotherapy session",
  "Injection administration",
  "Blood sample collection",
];

export const PACKAGES: HealthPackage[] = [
  { id: "pk-exec", name: "Executive health check", items: 42 },
  { id: "pk-heart", name: "Heart health screen", items: 18 },
  { id: "pk-women", name: "Women's wellness", items: 26 },
  { id: "pk-pre", name: "Pre-employment screen", items: 12 },
  { id: "pk-senior", name: "Senior citizen check", items: 34 },
];

// Local complaint codes. Map them to SNOMED CT findings in production.
const cc = (code: string, label: string, category: string): Complaint => ({ code, label, category });
export const COMPLAINTS: Complaint[] = [
  cc("CC-FEV", "Fever", "General"),
  cc("CC-FAT", "Tiredness or weakness", "General"),
  cc("CC-DIZ", "Dizziness", "General"),
  cc("CC-WTL", "Weight loss", "General"),
  cc("CC-COU", "Cough", "Respiratory"),
  cc("CC-SOB", "Shortness of breath", "Respiratory"),
  cc("CC-STH", "Sore throat", "Respiratory"),
  cc("CC-SNZ", "Sneezing and itchy eyes", "Respiratory"),
  cc("CC-CHP", "Chest pain", "Heart and circulation"),
  cc("CC-PAL", "Palpitations", "Heart and circulation"),
  cc("CC-HBP", "High blood pressure reading", "Heart and circulation"),
  cc("CC-LEG", "Leg swelling", "Heart and circulation"),
  cc("CC-ABD", "Abdominal pain", "Digestive"),
  cc("CC-EPI", "Epigastric pain or heartburn", "Digestive"),
  cc("CC-VOM", "Nausea or vomiting", "Digestive"),
  cc("CC-DIA", "Diarrhoea", "Digestive"),
  cc("CC-HEA", "Headache", "Brain and nerves"),
  cc("CC-SEI", "Seizure", "Brain and nerves"),
  cc("CC-WEA", "Weakness on one side", "Brain and nerves"),
  cc("CC-LOC", "Fainting or loss of consciousness", "Brain and nerves"),
  cc("CC-KNE", "Knee pain", "Bones and joints"),
  cc("CC-BAC", "Back pain", "Bones and joints"),
  cc("CC-JNT", "Joint swelling", "Bones and joints"),
  cc("CC-NEC", "Neck pain", "Bones and joints"),
  cc("CC-RTA", "Road traffic injury", "Injury"),
  cc("CC-FAL", "Fall", "Injury"),
  cc("CC-CUT", "Cut or laceration", "Injury"),
  cc("CC-BUR", "Burn", "Injury"),
  cc("CC-ASL", "Assault injury", "Injury"),
  cc("CC-RAS", "Skin rash", "Skin"),
  cc("CC-ITC", "Itching", "Skin"),
  cc("CC-WND", "Non-healing wound", "Skin"),
  cc("CC-ANC", "Antenatal check-up", "Pregnancy and women's health"),
  cc("CC-PVB", "Bleeding in pregnancy", "Pregnancy and women's health"),
  cc("CC-MEN", "Menstrual problems", "Pregnancy and women's health"),
  cc("CC-EAR", "Ear pain", "Ear, nose, throat and eye"),
  cc("CC-EYE", "Red or painful eye", "Ear, nose, throat and eye"),
  cc("CC-SUG", "High blood sugar", "Hormones and metabolism"),
  cc("CC-THY", "Thyroid review", "Hormones and metabolism"),
  cc("CC-REV", "Review of reports", "Reviews and routine care"),
  cc("CC-MED", "Medication refill", "Reviews and routine care"),
  cc("CC-CHK", "Routine check-up", "Reviews and routine care"),
  cc("CC-OTH", "Other", "Other"),
];

export const COUNTERS: Counter[] = [
  { id: "ctr-op", name: "OP registration", location: "Main lobby, counter 2", encounterTypes: ["OP", "FOLLOW_UP", "HEALTH_CHECK"] },
  { id: "ctr-er", name: "Emergency registration", location: "Emergency entrance", encounterTypes: ["EMERGENCY"] },
  { id: "ctr-adm", name: "Admissions desk", location: "Ground floor, west wing", encounterTypes: ["IP", "DAY_CARE"] },
  { id: "ctr-diag", name: "Diagnostics counter", location: "Lab and imaging block", encounterTypes: ["NO_CONSULT", "OUTSIDE"] },
  { id: "ctr-virtual", name: "Home and virtual care", location: "Care coordination office", encounterTypes: ["TELE", "HOME_VISIT"] },
];

export const MASTER_SEED: MasterData = {
  payers: PAYERS, tpas: TPAS, networks: NETWORKS, plans: PLANS, departments: DEPARTMENTS, practitioners: PRACTITIONERS,
  wards: WARDS, services: SERVICES, packages: PACKAGES, complaints: COMPLAINTS, counters: COUNTERS,
};
