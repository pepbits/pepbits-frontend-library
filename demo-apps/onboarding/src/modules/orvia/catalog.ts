// Fictional Orvia catalogue ported unchanged from the source demo (orvia-health-onboarding, lib/catalog.ts).
/**
 * Everything the onboarding flow knows about healthcare organizations.
 * Replace or extend with data from your backend; the UI reads only from here.
 */

export type IconName =
  | "hospital"
  | "clinic"
  | "pharmacy"
  | "lab"
  | "radiology"
  | "homecare"
  | "telehealth"
  | "network"
  | "single"
  | "opd"
  | "ipd"
  | "er"
  | "daycare"
  | "icu"
  | "ot"
  | "ltc"
  | "rehab"
  | "retail"
  | "collection";

/* ------------------------------------------------------------------ */
/* Facility types                                                      */
/* ------------------------------------------------------------------ */

export type FacilityTypeId =
  | "hospital"
  | "clinic"
  | "pharmacy"
  | "laboratory"
  | "radiology"
  | "homecare"
  | "telehealth";

export interface FacilityType {
  id: FacilityTypeId;
  label: string;
  /** Singular noun for sentences like "Register as a hospital" */
  noun: string;
  icon: IconName;
  summary: string;
  description: string;
  careSettings: string[];
  modules: string[];
}

export const FACILITY_TYPES: FacilityType[] = [
  {
    id: "hospital",
    label: "Hospital",
    noun: "hospital",
    icon: "hospital",
    summary: "Wards, theatres, ICU and emergency",
    description:
      "Run admissions to discharge on one chart: bed management, nursing and eMAR, theatre scheduling and a 24/7 emergency department, with charges captured at the bedside.",
    careSettings: ["opd", "ipd", "er", "daycare", "icu", "ot"],
    modules: [
      "mpi", "scheduling", "queue", "portal",
      "ehr", "cpoe", "cds", "nursing", "adt", "theatre", "triage", "discharge",
      "lis", "ris", "dispensing", "inventory", "formulary",
      "billing", "eligibility", "claims", "ar", "denials", "contracts",
      "hr", "analytics", "quality",
    ],
  },
  {
    id: "clinic",
    label: "Clinic or polyclinic",
    noun: "clinic",
    icon: "clinic",
    summary: "Outpatient practices and day care",
    description:
      "Book, check in, consult and bill in one pass. Specialty templates, e-prescriptions and patient reminders keep the day moving without paper.",
    careSettings: ["opd", "daycare", "telehealth"],
    modules: [
      "mpi", "scheduling", "queue", "portal", "referrals",
      "ehr", "cpoe", "cds", "erx",
      "billing", "eligibility", "claims", "ar",
      "analytics",
    ],
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    noun: "pharmacy",
    icon: "pharmacy",
    summary: "Retail, hospital or chain dispensing",
    description:
      "Verify and dispense against e-prescriptions, track every batch and expiry, run controlled-substance registers and bill insurers or cash at the counter.",
    careSettings: ["retail"],
    modules: [
      "mpi", "dispensing", "inventory", "formulary", "erx", "controlled",
      "billing", "eligibility", "claims", "ar",
      "materials", "analytics",
    ],
  },
  {
    id: "laboratory",
    label: "Diagnostic laboratory",
    noun: "laboratory",
    icon: "lab",
    summary: "Clinical, reference and collection labs",
    description:
      "Accession, barcode and track samples from collection to analyzer, validate results and release reports coded in LOINC, straight to the ordering clinician.",
    careSettings: ["collection", "opd"],
    modules: [
      "mpi", "scheduling", "portal",
      "lis", "samples", "reporting",
      "billing", "eligibility", "claims", "ar",
      "analytics", "quality",
    ],
  },
  {
    id: "radiology",
    label: "Radiology and imaging",
    noun: "imaging center",
    icon: "radiology",
    summary: "X-ray, CT, MRI, ultrasound",
    description:
      "Schedule modalities, run worklists, connect PACS over DICOM and let radiologists report with structured templates and critical-result alerts.",
    careSettings: ["opd", "daycare"],
    modules: [
      "mpi", "scheduling", "queue", "portal",
      "ris", "reporting",
      "billing", "eligibility", "claims", "ar",
      "analytics",
    ],
  },
  {
    id: "homecare",
    label: "Home care",
    noun: "home care provider",
    icon: "homecare",
    summary: "Nursing and therapy at home",
    description:
      "Plan visits, route field staff, document offline on mobile and bill per visit or per episode, with care plans shared back to the referring doctor.",
    careSettings: ["homecare", "rehab", "ltc"],
    modules: [
      "mpi", "scheduling", "portal", "referrals",
      "ehr", "nursing", "careplans",
      "billing", "eligibility", "claims", "ar",
      "hr", "analytics",
    ],
  },
  {
    id: "telehealth",
    label: "Telehealth",
    noun: "telehealth provider",
    icon: "telehealth",
    summary: "Virtual consults and remote care",
    description:
      "Video visits with consent capture, e-prescriptions sent to the patient's pharmacy and remote monitoring readings filed to the chart.",
    careSettings: ["telehealth", "opd"],
    modules: [
      "mpi", "scheduling", "portal",
      "ehr", "cpoe", "erx", "cds",
      "billing", "eligibility", "claims", "ar",
      "analytics",
    ],
  },
];

export const NETWORK_PROFILE = {
  id: "network" as const,
  label: "Multi-facility network",
  noun: "healthcare group",
  icon: "network" as IconName,
  summary: "Groups with many entities",
  description:
    "Run hospitals, clinics, pharmacies and labs as separate entities under one workspace: one patient index across the group, shared formularies and price lists, and consolidated revenue reporting.",
  careSettings: ["opd", "ipd", "er", "icu", "ot", "telehealth", "homecare", "retail"],
  modules: [
    "mpi", "scheduling", "referrals", "portal",
    "ehr", "cpoe", "adt",
    "lis", "ris", "dispensing", "inventory",
    "billing", "claims", "ar", "contracts",
    "hr", "materials", "analytics", "quality",
  ],
};

export function isFacilityType(value: string): value is FacilityTypeId {
  return FACILITY_TYPES.some((t) => t.id === value);
}

export function facilityType(id: string): FacilityType | undefined {
  return FACILITY_TYPES.find((t) => t.id === id);
}

/* ------------------------------------------------------------------ */
/* Care settings                                                       */
/* ------------------------------------------------------------------ */

export interface CareSetting {
  id: string;
  label: string;
  description: string;
  icon: IconName;
}

export const CARE_SETTINGS: CareSetting[] = [
  { id: "opd", label: "Outpatient", description: "Consultations and follow-ups", icon: "opd" },
  { id: "ipd", label: "Inpatient", description: "Admissions, wards and beds", icon: "ipd" },
  { id: "er", label: "Emergency", description: "Triage and resuscitation", icon: "er" },
  { id: "daycare", label: "Day care and day surgery", description: "Same-day procedures", icon: "daycare" },
  { id: "icu", label: "Critical care", description: "ICU, NICU, PICU, CCU", icon: "icu" },
  { id: "ot", label: "Operating theatre", description: "Surgery and anesthesia", icon: "ot" },
  { id: "homecare", label: "Home care", description: "Visits at the patient's home", icon: "homecare" },
  { id: "telehealth", label: "Telehealth", description: "Video and remote monitoring", icon: "telehealth" },
  { id: "ltc", label: "Long-term care", description: "Nursing homes and hospice", icon: "ltc" },
  { id: "rehab", label: "Rehabilitation", description: "Physio and occupational therapy", icon: "rehab" },
  { id: "retail", label: "Pharmacy counter", description: "Walk-in dispensing and OTC", icon: "retail" },
  { id: "collection", label: "Sample collection", description: "Collection centers and home draws", icon: "collection" },
];

export function careSetting(id: string) {
  return CARE_SETTINGS.find((c) => c.id === id);
}

/* ------------------------------------------------------------------ */
/* Specialties                                                         */
/* ------------------------------------------------------------------ */

export const SPECIALTIES: string[] = [
  "Anesthesiology", "Cardiology", "Cardiothoracic surgery", "Critical care medicine",
  "Dentistry", "Dermatology", "Emergency medicine", "Endocrinology", "ENT",
  "Family medicine", "Gastroenterology", "General medicine", "General surgery",
  "Geriatrics", "Hematology", "Hepatology", "Infectious diseases", "IVF and fertility",
  "Nephrology", "Neonatology", "Neurology", "Neurosurgery", "Nuclear medicine",
  "Nutrition and dietetics", "Obstetrics and gynecology", "Oncology", "Ophthalmology",
  "Orthopedics", "Palliative care", "Pathology", "Pediatrics", "Physiotherapy",
  "Plastic surgery", "Psychiatry", "Psychology", "Pulmonology", "Radiation oncology",
  "Radiology", "Rheumatology", "Sports medicine", "Urology", "Vascular surgery",
];

/* ------------------------------------------------------------------ */
/* Modules                                                             */
/* ------------------------------------------------------------------ */

export interface Module {
  id: string;
  label: string;
  description: string;
}

export interface ModuleGroup {
  id: string;
  label: string;
  modules: Module[];
}

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    id: "access",
    label: "Patient access",
    modules: [
      { id: "mpi", label: "Registration and patient index", description: "One MRN per patient across every facility" },
      { id: "scheduling", label: "Appointments and scheduling", description: "Doctor, room and modality calendars" },
      { id: "queue", label: "Queue and token display", description: "Check-in, waiting room screens and SMS calls" },
      { id: "portal", label: "Patient portal and app", description: "Booking, results, bills and messages" },
      { id: "referrals", label: "Referral management", description: "Inbound and outbound referrals with status" },
    ],
  },
  {
    id: "clinical",
    label: "Clinical care",
    modules: [
      { id: "ehr", label: "Electronic health record", description: "Notes, problems, allergies, vitals and history" },
      { id: "cpoe", label: "Order entry (CPOE)", description: "Lab, imaging, medication and procedure orders" },
      { id: "cds", label: "Clinical decision support", description: "Drug interactions, allergy and dose alerts" },
      { id: "nursing", label: "Nursing and eMAR", description: "Assessments, care tasks and medication rounds" },
      { id: "adt", label: "Admissions and beds", description: "ADT, transfers, bed board and housekeeping" },
      { id: "theatre", label: "Operating theatre", description: "OT scheduling, checklists and anesthesia record" },
      { id: "triage", label: "Emergency and triage", description: "ESI or Manchester triage and ED tracking board" },
      { id: "careplans", label: "Care plans", description: "Goals, interventions and multidisciplinary review" },
      { id: "discharge", label: "Discharge summaries", description: "Structured summaries shared with the patient" },
    ],
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    modules: [
      { id: "lis", label: "Laboratory (LIS)", description: "Worklists, analyzer interfaces and validation" },
      { id: "samples", label: "Sample tracking", description: "Barcodes, chain of custody and rejections" },
      { id: "ris", label: "Radiology (RIS and PACS link)", description: "Modality worklists and DICOM viewer" },
      { id: "reporting", label: "Result reporting", description: "Templates, sign-off and critical-value alerts" },
    ],
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    modules: [
      { id: "dispensing", label: "Dispensing", description: "Outpatient, inpatient and unit-dose dispensing" },
      { id: "inventory", label: "Pharmacy inventory", description: "Batches, expiry, reorder levels and transfers" },
      { id: "formulary", label: "Formulary", description: "Approved drugs, substitutions and pricing" },
      { id: "erx", label: "e-Prescription", description: "Send and receive electronic prescriptions" },
      { id: "controlled", label: "Controlled substances", description: "Narcotics register and dual sign-off" },
    ],
  },
  {
    id: "rcm",
    label: "Revenue cycle",
    modules: [
      { id: "billing", label: "Billing and invoicing", description: "Charge capture, packages and cash desk" },
      { id: "eligibility", label: "Eligibility and pre-authorization", description: "Real-time payer checks before care" },
      { id: "claims", label: "Claims", description: "Scrubbing, submission and remittance posting" },
      { id: "ar", label: "Accounts receivable", description: "Aging, follow-up worklists and collections" },
      { id: "denials", label: "Denial management", description: "Root causes, appeals and resubmission" },
      { id: "contracts", label: "Payer contracts and pricing", description: "Tariffs, discounts and price lists per payer" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    modules: [
      { id: "hr", label: "Staff and rostering", description: "Credentials, privileges and duty rosters" },
      { id: "materials", label: "Materials and assets", description: "Purchasing, stores and biomedical assets" },
      { id: "analytics", label: "Analytics and reports", description: "Operational, clinical and financial dashboards" },
      { id: "quality", label: "Quality and incidents", description: "Incident reporting, audits and KPIs" },
    ],
  },
];

export const ALL_MODULES: Module[] = MODULE_GROUPS.flatMap((g) => g.modules);

export function moduleById(id: string) {
  return ALL_MODULES.find((m) => m.id === id);
}

export function recommendedModules(types: FacilityTypeId[], isNetwork: boolean): string[] {
  const set = new Set<string>();
  for (const t of types) facilityType(t)?.modules.forEach((m) => set.add(m));
  if (isNetwork) NETWORK_PROFILE.modules.forEach((m) => set.add(m));
  if (set.size === 0) ["mpi", "billing"].forEach((m) => set.add(m));
  return ALL_MODULES.map((m) => m.id).filter((id) => set.has(id));
}

export function recommendedCareSettings(types: FacilityTypeId[]): string[] {
  const set = new Set<string>();
  for (const t of types) facilityType(t)?.careSettings.forEach((c) => set.add(c));
  return CARE_SETTINGS.map((c) => c.id).filter((id) => set.has(id));
}

/* ------------------------------------------------------------------ */
/* Standards and compliance                                            */
/* ------------------------------------------------------------------ */

export interface StandardGroup {
  id: string;
  label: string;
  description: string;
  items: { id: string; label: string }[];
}

export const STANDARD_GROUPS: StandardGroup[] = [
  {
    id: "privacy",
    label: "Privacy and security",
    description: "How patient data is protected and audited",
    items: [
      { id: "hipaa", label: "HIPAA" },
      { id: "gdpr", label: "GDPR" },
      { id: "iso27001", label: "ISO 27001" },
      { id: "soc2", label: "SOC 2 Type II" },
      { id: "hitrust", label: "HITRUST" },
    ],
  },
  {
    id: "interop",
    label: "Interoperability",
    description: "How systems exchange data",
    items: [
      { id: "hl7v2", label: "HL7 v2" },
      { id: "fhir", label: "FHIR R4" },
      { id: "dicom", label: "DICOM" },
      { id: "ihe", label: "IHE profiles" },
      { id: "x12", label: "X12 EDI (837/835)" },
    ],
  },
  {
    id: "coding",
    label: "Clinical coding",
    description: "Vocabularies used in the chart and on claims",
    items: [
      { id: "icd10", label: "ICD-10" },
      { id: "icd11", label: "ICD-11" },
      { id: "cpt", label: "CPT" },
      { id: "snomed", label: "SNOMED CT" },
      { id: "loinc", label: "LOINC" },
      { id: "rxnorm", label: "RxNorm" },
    ],
  },
  {
    id: "accreditation",
    label: "Accreditation readiness",
    description: "Evidence and reports for surveyors",
    items: [
      { id: "jci", label: "JCI" },
      { id: "nabh", label: "NABH" },
      { id: "cap", label: "CAP" },
      { id: "himss", label: "HIMSS EMRAM" },
    ],
  },
];

export const EMRAM_TARGETS = [
  { value: "none", label: "Not tracking" },
  { value: "5", label: "Stage 5" },
  { value: "6", label: "Stage 6" },
  { value: "7", label: "Stage 7" },
] as const;

/* ------------------------------------------------------------------ */
/* Health authority, payer and device integrations                     */
/* ------------------------------------------------------------------ */

export interface Integration {
  id: string;
  label: string;
  /** ISO country codes this applies to; empty = available everywhere */
  countries: string[];
}

export const INTEGRATIONS: Integration[] = [
  { id: "nphies", label: "NPHIES insurance platform", countries: ["SA"] },
  { id: "wasfaty", label: "Wasfaty e-prescription", countries: ["SA"] },
  { id: "eclaimlink", label: "DHA eClaimLink", countries: ["AE"] },
  { id: "shafafiya", label: "DOH Shafafiya", countries: ["AE"] },
  { id: "nabidh", label: "NABIDH health exchange", countries: ["AE"] },
  { id: "malaffi", label: "Malaffi health exchange", countries: ["AE"] },
  { id: "abdm", label: "ABDM and ABHA", countries: ["IN"] },
  { id: "spine", label: "NHS Spine and PDS", countries: ["GB"] },
  { id: "eps", label: "NHS Electronic Prescription Service", countries: ["GB"] },
  { id: "surescripts", label: "Surescripts e-prescribing", countries: ["US"] },
  { id: "clearinghouse", label: "X12 claims clearinghouse", countries: ["US"] },
  { id: "mhr", label: "My Health Record", countries: ["AU"] },
  { id: "pacs", label: "Third-party PACS", countries: [] },
  { id: "analyzers", label: "Lab analyzers (ASTM and HL7)", countries: [] },
  { id: "payments", label: "Card and online payments", countries: [] },
  { id: "messaging", label: "SMS and WhatsApp reminders", countries: [] },
  { id: "sso", label: "Single sign-on (SAML, OIDC)", countries: [] },
  { id: "accounting", label: "Accounting and ERP export", countries: [] },
];

/* ------------------------------------------------------------------ */
/* Countries, regions and admin roles                                  */
/* ------------------------------------------------------------------ */

export interface Country {
  code: string;
  name: string;
  dial: string;
  currency: string;
  timezone: string;
  region: string;
}

export const COUNTRIES: Country[] = [
  { code: "AU", name: "Australia", dial: "+61", currency: "AUD", timezone: "Australia/Sydney", region: "au" },
  { code: "BH", name: "Bahrain", dial: "+973", currency: "BHD", timezone: "Asia/Bahrain", region: "me-uae" },
  { code: "CA", name: "Canada", dial: "+1", currency: "CAD", timezone: "America/Toronto", region: "us-east" },
  { code: "EG", name: "Egypt", dial: "+20", currency: "EGP", timezone: "Africa/Cairo", region: "eu" },
  { code: "DE", name: "Germany", dial: "+49", currency: "EUR", timezone: "Europe/Berlin", region: "eu" },
  { code: "IN", name: "India", dial: "+91", currency: "INR", timezone: "Asia/Kolkata", region: "in" },
  { code: "ID", name: "Indonesia", dial: "+62", currency: "IDR", timezone: "Asia/Jakarta", region: "ap-sg" },
  { code: "KE", name: "Kenya", dial: "+254", currency: "KES", timezone: "Africa/Nairobi", region: "eu" },
  { code: "KW", name: "Kuwait", dial: "+965", currency: "KWD", timezone: "Asia/Kuwait", region: "me-uae" },
  { code: "MY", name: "Malaysia", dial: "+60", currency: "MYR", timezone: "Asia/Kuala_Lumpur", region: "ap-sg" },
  { code: "NG", name: "Nigeria", dial: "+234", currency: "NGN", timezone: "Africa/Lagos", region: "eu" },
  { code: "OM", name: "Oman", dial: "+968", currency: "OMR", timezone: "Asia/Muscat", region: "me-uae" },
  { code: "PH", name: "Philippines", dial: "+63", currency: "PHP", timezone: "Asia/Manila", region: "ap-sg" },
  { code: "QA", name: "Qatar", dial: "+974", currency: "QAR", timezone: "Asia/Qatar", region: "me-uae" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", currency: "SAR", timezone: "Asia/Riyadh", region: "me-ksa" },
  { code: "SG", name: "Singapore", dial: "+65", currency: "SGD", timezone: "Asia/Singapore", region: "ap-sg" },
  { code: "ZA", name: "South Africa", dial: "+27", currency: "ZAR", timezone: "Africa/Johannesburg", region: "eu" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", currency: "AED", timezone: "Asia/Dubai", region: "me-uae" },
  { code: "GB", name: "United Kingdom", dial: "+44", currency: "GBP", timezone: "Europe/London", region: "uk" },
  { code: "US", name: "United States", dial: "+1", currency: "USD", timezone: "America/New_York", region: "us-east" },
];

export function country(code: string) {
  return COUNTRIES.find((c) => c.code === code);
}

const EXTRA_TIMEZONES = [
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "Australia/Perth",
  "Europe/Paris",
];

export const TIMEZONES: string[] = Array.from(
  new Set([...COUNTRIES.map((c) => c.timezone), ...EXTRA_TIMEZONES]),
).sort();

export const CURRENCIES: string[] = Array.from(new Set(COUNTRIES.map((c) => c.currency))).sort();

export const DATA_REGIONS = [
  { id: "us-east", label: "United States (Virginia)" },
  { id: "eu", label: "European Union (Frankfurt)" },
  { id: "uk", label: "United Kingdom (London)" },
  { id: "me-uae", label: "United Arab Emirates (Dubai)" },
  { id: "me-ksa", label: "Saudi Arabia (Riyadh)" },
  { id: "in", label: "India (Mumbai)" },
  { id: "ap-sg", label: "Singapore" },
  { id: "au", label: "Australia (Sydney)" },
] as const;

export function regionLabel(id: string) {
  return DATA_REGIONS.find((r) => r.id === id)?.label ?? id;
}

export const ADMIN_ROLES = [
  "Chief executive or managing director",
  "CIO or head of IT",
  "Medical director",
  "Operations manager",
  "Finance or revenue cycle head",
  "Pharmacy manager",
  "Laboratory or imaging manager",
  "Practice owner",
  "Other",
];
