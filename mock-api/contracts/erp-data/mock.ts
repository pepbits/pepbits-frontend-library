import type { DataColumn, ModuleKey, WorklistConfig } from "../erp-config/types.ts";

const firstNames = ["Aisha", "Omar", "Maya", "Daniel", "Fatima", "Arjun", "Sara", "Ibrahim", "Leena", "Noah", "Riya", "Zayed", "Noura", "Vikram", "Hana", "Adil"];
const lastNames = ["Rahman", "Thomas", "Khan", "George", "Nair", "Ahmed", "Mathew", "Joseph", "Hassan", "Menon", "Fernandes", "Ali", "Kapoor", "Saeed"];
const companies = ["Atlas Horizon LLC", "Bluecrest Retail", "Crescent Foods", "Delta Medical Trading", "Emirates North Services", "Falcon Industrial", "Gulfstone Holdings", "Helix Digital", "Ion Logistics", "Jade Hospitality", "Keystone Projects", "Luma Distribution", "Meridian Clinics", "Nova Build", "Orion Mobility", "Palmline Group"];
const branches = ["Abu Dhabi HQ", "Dubai Center", "Sharjah Hub", "Kochi Delivery"];
const statuses = ["Active", "Active", "Active", "Pending", "On Hold", "Inactive"];
const priorities = ["Normal", "Normal", "High", "Low", "Critical"];
const owners = ["Maya Thomas", "Ibrahim Noor", "Leena George", "Omar Khan", "Sara Ahmed"];

function pad(value: number, size = 5) { return String(value).padStart(size, "0"); }
function dateFor(index: number) { return `2026-${String(((index + 5) % 9) + 1).padStart(2, "0")}-${String(((index * 3) % 27) + 1).padStart(2, "0")}`; }
function nameFor(index: number) { return `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`; }

/* Patients. Deliberately shaped like real PHI -- a name, an MRN, a date of
   birth, a diagnosis -- because the point of this module is to exercise what
   happens around data that must NOT leave the building, and rows of "Record 1"
   would prove nothing. Every value is invented; no real person is described. */
const givenNames = ["Aisha", "Omar", "Leena", "Yousef", "Mariam", "Hassan", "Fatima", "Khalid", "Noor", "Rashid", "Sara", "Tariq"];
const familyNames = ["Al Mansouri", "Rahman", "George", "Khan", "Haddad", "Nasser", "Sultan", "Farouk", "Bishara", "Idris"];
const conditions = ["Type 2 diabetes", "Hypertension", "Asthma", "Post-operative review", "Ischaemic heart disease", "Chronic kidney disease", "Pneumonia", "Fracture — left radius"];

export const patientRows = Array.from({ length: 84 }, (_, i) => ({
  id: `MRN-${pad(90210 + i * 7)}`,
  name: `${givenNames[i % givenNames.length]} ${familyNames[(i * 3) % familyNames.length]}`,
  dob: `19${String(55 + (i % 45)).padStart(2, "0")}-${pad((i % 12) + 1).slice(-2)}-${pad((i % 27) + 1).slice(-2)}`,
  gender: ["Female", "Male"][i % 2],
  ward: ["4A Medical", "4B Surgical", "2C Maternity", "ICU", "Day Case", "Outpatient"][i % 6],
  clinician: `Dr ${familyNames[(i * 5) % familyNames.length]}`,
  primaryDiagnosis: conditions[i % conditions.length],
  payer: ["Daman", "AXA Gulf", "Self-pay", "Thiqa", "MetLife"][i % 5],
  admitted: `2026-0${(i % 9) + 1}-${pad((i % 27) + 1).slice(-2)}`,
  lengthOfStay: (i % 14) + 1,
  status: ["Admitted", "Discharged", "Pre-admission", "Outpatient", "Under review"][i % 5],
  acuity: ["Routine", "Urgent", "Critical", "Routine"][i % 4],
}));

/* Outpatient consultations. Shares the patient vocabulary deliberately -- ward
   is absent because a consultation is not an admission, and `outcome` carries
   what an admission record would express as `status`. Invented throughout. */
const specialties = ["General Medicine", "Cardiology", "Orthopaedics", "Paediatrics", "Endocrinology", "Dermatology", "ENT", "Obstetrics"];
const complaints = ["Chest discomfort on exertion", "Persistent cough, 3 weeks", "Lower back pain", "Routine diabetic review", "Recurrent headache", "Skin rash, forearm", "Reduced hearing, left ear", "Ante-natal review"];
const outcomes = ["Follow-up in 4 weeks", "Discharged to GP", "Referred for imaging", "Admitted", "Referred to specialist", "Medication adjusted"];

export const consultationRows = Array.from({ length: 72 }, (_, i) => ({
  id: `CON-${pad(48100 + i * 3)}`,
  patient: `MRN-${pad(90210 + (i % 84) * 7)}`,
  consultedOn: `2026-09-${pad((i % 28) + 1).slice(-2)}`,
  specialty: specialties[i % specialties.length],
  clinician: `Dr ${familyNames[(i * 7) % familyNames.length]}`,
  chiefComplaint: complaints[i % complaints.length],
  primaryDiagnosis: conditions[(i * 5) % conditions.length],
  acuity: ["Routine", "Urgent", "Routine", "Routine"][i % 4],
  outcome: outcomes[i % outcomes.length],
  followUp: i % 3 === 0 ? `2026-10-${pad((i % 27) + 1).slice(-2)}` : "",
  payer: ["Daman", "AXA Gulf", "Self-pay", "Thiqa", "MetLife"][i % 5],
  status: ["Completed", "In progress", "Awaiting notes", "Completed", "Cancelled"][i % 5],
}));

/* Formulary. Ordinary stock data -- no patient anywhere in it, which is why the
   pharmacy inventory pages keep the general use cases while dispensing does not. */
const drugNames = ["Metformin", "Amoxicillin", "Atorvastatin", "Salbutamol", "Omeprazole", "Amlodipine", "Paracetamol", "Insulin glargine", "Enoxaparin", "Ceftriaxone", "Morphine sulfate", "Levothyroxine"];
const forms = ["Tablet", "Capsule", "Injection", "Inhaler", "Oral solution", "Infusion"];

export const drugRows = Array.from({ length: 96 }, (_, i) => ({
  id: `DRG-${pad(31200 + i * 4)}`,
  name: `${drugNames[i % drugNames.length]} ${[250, 500, 5, 10, 20, 100][i % 6]}mg`,
  form: forms[i % forms.length],
  atc: `${"ABCDEFGHJLMNPRSV"[i % 16]}${pad(i % 99).slice(-2)}`,
  formulary: i % 7 === 0 ? "Non-formulary" : "Formulary",
  controlled: i % 11 === 0 ? "Schedule 2" : i % 13 === 0 ? "Schedule 3" : "—",
  onHand: (i * 37) % 1400,
  reorderLevel: 120 + (i % 5) * 40,
  unitCost: Number((1.2 + (i % 40) * 0.85).toFixed(2)),
  supplier: ["Gulf Pharma", "Medline MENA", "Julphar", "NovaMed"][i % 4],
  nextExpiry: `2027-${pad((i % 12) + 1).slice(-2)}-${pad((i % 27) + 1).slice(-2)}`,
  status: (i * 37) % 1400 === 0 ? "Stock-out" : (i * 37) % 1400 < 120 + (i % 5) * 40 ? "Below reorder" : "In stock",
}));

/* Prescriptions. PHI: a patient, a drug and a dose together are exactly the
   triple that must not reach a general-purpose provider. */
export const prescriptionRows = Array.from({ length: 78 }, (_, i) => ({
  id: `RX-${pad(72400 + i * 5)}`,
  patient: `MRN-${pad(90210 + (i % 84) * 7)}`,
  drug: `${drugNames[(i * 3) % drugNames.length]} ${[250, 500, 5, 10, 20, 100][i % 6]}mg`,
  dose: ["1 tab BD", "1 tab OD", "2 tabs TDS", "10 units nocte", "1 puff PRN", "1 g IV BD"][i % 6],
  route: ["Oral", "Oral", "Subcutaneous", "Inhaled", "Intravenous", "Topical"][i % 6],
  duration: `${[3, 5, 7, 14, 28][i % 5]} days`,
  prescriber: `Dr ${familyNames[(i * 5) % familyNames.length]}`,
  ward: ["4A Medical", "4B Surgical", "2C Maternity", "ICU", "Outpatient"][i % 5],
  prescribedOn: `2026-09-${pad((i % 28) + 1).slice(-2)}`,
  priority: ["Routine", "Urgent", "Stat", "Routine"][i % 4],
  status: ["Awaiting dispense", "Dispensed", "Partially dispensed", "On hold", "Cancelled"][i % 5],
}));

export const customerRows = Array.from({ length: 96 }, (_, i) => ({
  id: `CUS-${pad(2401 + i)}`,
  name: companies[i % companies.length] + (i > 15 ? ` ${Math.floor(i / 16) + 1}` : ""),
  type: ["Corporate", "Retail", "Government", "Distributor"][i % 4],
  segment: ["Enterprise", "Mid-market", "SMB", "Strategic"][i % 4],
  city: ["Abu Dhabi", "Dubai", "Sharjah", "Al Ain", "Ajman"][i % 5],
  contact: nameFor(i),
  creditLimit: 25000 + ((i * 17000) % 475000),
  outstanding: 4800 + ((i * 7913) % 186000),
  lastInvoice: dateFor(i),
  owner: owners[i % owners.length],
  status: statuses[i % statuses.length],
  risk: ["Low", "Low", "Medium", "High"][i % 4],
}));

export const employeeRows = Array.from({ length: 114 }, (_, i) => ({
  id: `EMP-${pad(1001 + i)}`,
  name: nameFor(i),
  department: ["Finance", "Human Resources", "Sales", "Supply Chain", "Technology", "Operations"][i % 6],
  position: ["Senior Analyst", "Manager", "Executive", "Specialist", "Coordinator", "Director"][i % 6],
  branch: branches[i % branches.length],
  joinDate: dateFor(i + 2),
  manager: owners[(i + 2) % owners.length],
  leaveBalance: 4 + ((i * 3) % 28),
  performance: 72 + ((i * 7) % 27),
  status: statuses[i % statuses.length],
}));

export const userRows = Array.from({ length: 78 }, (_, i) => ({
  id: `USR-${pad(301 + i)}`,
  name: nameFor(i),
  email: `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[(i * 3) % lastNames.length].toLowerCase()}@nexora.example`,
  role: ["Enterprise Admin", "Finance Manager", "HR Partner", "Operations Analyst", "Auditor"][i % 5],
  branch: branches[i % branches.length],
  modules: 2 + (i % 4),
  lastLogin: `2026-09-${String((i % 2) + 1).padStart(2, "0")} ${String(8 + (i % 10)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
  mfa: i % 6 !== 0,
  status: statuses[i % statuses.length],
}));

export const invoiceRows = Array.from({ length: 128 }, (_, i) => {
  const total = 1800 + ((i * 8317) % 185000);
  const paid = i % 5 === 0 ? 0 : i % 4 === 0 ? Math.floor(total * .45) : total;
  return {
    id: `INV-26-${pad(5101 + i, 6)}`,
    customer: companies[i % companies.length],
    invoiceDate: dateFor(i),
    dueDate: dateFor(i + 17),
    branch: branches[i % branches.length],
    currency: "AED",
    subtotal: Math.floor(total / 1.05),
    tax: total - Math.floor(total / 1.05),
    total,
    paid,
    balance: total - paid,
    status: paid === total ? "Paid" : paid > 0 ? "Partially Paid" : i % 7 === 0 ? "Overdue" : "Open",
    owner: owners[i % owners.length],
    priority: priorities[i % priorities.length],
  };
});

export const productRows = Array.from({ length: 106 }, (_, i) => ({
  id: `SKU-${pad(8001 + i)}`,
  name: ["Premium Service Pack", "Industrial Filter", "Smart Sensor", "Safety Kit", "Cloud Subscription", "Office Essentials", "Medical Consumable", "Cold Chain Box"][i % 8] + ` ${String.fromCharCode(65 + (i % 6))}`,
  category: ["Services", "Components", "Electronics", "Safety", "Software", "Office", "Medical", "Logistics"][i % 8],
  unit: ["EA", "BOX", "PACK", "MONTH", "KG"][i % 5],
  cost: 25 + ((i * 43) % 3500),
  price: 45 + ((i * 79) % 6200),
  stock: (i * 37) % 850,
  reorder: 20 + ((i * 11) % 100),
  warehouse: ["WH-AUH-01", "WH-DXB-01", "WH-SHJ-01"][i % 3],
  status: statuses[i % statuses.length],
}));

export const supplierRows = Array.from({ length: 84 }, (_, i) => ({
  id: `SUP-${pad(701 + i)}`,
  name: `${companies[(i + 5) % companies.length]} Supply`,
  category: ["Strategic", "Preferred", "Approved", "Conditional"][i % 4],
  country: ["UAE", "India", "Saudi Arabia", "Germany", "United Kingdom"][i % 5],
  contact: nameFor(i + 4),
  leadTime: 2 + ((i * 3) % 45),
  onTime: 72 + ((i * 7) % 28),
  quality: 78 + ((i * 5) % 22),
  openPO: (i * 5) % 18,
  exposure: 12000 + ((i * 9013) % 440000),
  status: statuses[i % statuses.length],
}));

export const orderRows = Array.from({ length: 118 }, (_, i) => ({
  id: `SO-26-${pad(9201 + i, 6)}`,
  customer: companies[i % companies.length],
  orderDate: dateFor(i),
  requestedDate: dateFor(i + 8),
  value: 2500 + ((i * 10321) % 240000),
  margin: 12 + ((i * 3) % 31),
  owner: owners[i % owners.length],
  branch: branches[i % branches.length],
  priority: priorities[i % priorities.length],
  status: ["Confirmed", "Processing", "Pending Approval", "Fulfilled", "On Hold"][i % 5],
}));

const commonColumns: DataColumn[] = [
  { key: "id", label: "Record ID", sortable: true, defaultVisible: true },
  { key: "name", label: "Name", sortable: true, defaultVisible: true },
  { key: "category", label: "Category", sortable: true, defaultVisible: true },
  { key: "branch", label: "Branch", sortable: true, defaultVisible: true },
  { key: "owner", label: "Owner", sortable: true, defaultVisible: true },
  { key: "updated", label: "Updated", type: "date", sortable: true, defaultVisible: true },
  { key: "priority", label: "Priority", type: "status", sortable: true, defaultVisible: false },
  { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
];

function genericRows(entity: string, title: string) {
  return Array.from({ length: 88 }, (_, i) => ({
    id: `${entity.slice(0, 3).toUpperCase()}-${pad(1001 + i)}`,
    name: `${title.replace(/ (Master|Worklist|Entry|Review|Setup)$/i, "")} ${pad(i + 1, 3)}`,
    category: ["Primary", "Secondary", "Internal", "External"][i % 4],
    branch: branches[i % branches.length],
    owner: owners[i % owners.length],
    updated: dateFor(i + 1),
    priority: priorities[i % priorities.length],
    status: statuses[i % statuses.length],
  }));
}

function baseFilters() {
  return [
    { key: "query", label: "Keyword / record ID", type: "text" as const },
    { key: "status", label: "Status", type: "select" as const, options: ["All", "Active", "Pending", "On Hold", "Inactive", "Open", "Paid", "Overdue"] },
    { key: "branch", label: "Branch", type: "select" as const, options: ["All", ...branches] },
  ];
}

function advancedFilters() {
  return [
    { key: "owner", label: "Owner", type: "select" as const, options: ["All", ...owners] },
    { key: "from", label: "From date", type: "date" as const },
    { key: "to", label: "To date", type: "date" as const },
    { key: "priority", label: "Priority", type: "select" as const, options: ["All", "Low", "Normal", "High", "Critical"] },
    { key: "tags", label: "Tags / attributes", type: "text" as const },
    { key: "createdBy", label: "Created by", type: "text" as const },
  ];
}

export function getWorklistConfig(pageId: string, title: string, entity = "record"): WorklistConfig {
  const common = {
    id: pageId,
    entity,
    title,
    description: `Configurable ${title.toLowerCase()} with saved filters, column layouts, table/card views and contextual record actions.`,
    basicFilters: baseFilters(),
    advancedFilters: advancedFilters(),
  };

  if (entity === "drug") return {
    ...common,
    rows: drugRows,
    primaryKey: "id",
    displayKey: "name",
    columns: [
      { key: "id", label: "Item code", sortable: true, defaultVisible: true },
      { key: "name", label: "Drug", sortable: true, defaultVisible: true },
      { key: "form", label: "Form", sortable: true, defaultVisible: true },
      { key: "atc", label: "ATC", sortable: true, defaultVisible: false },
      { key: "formulary", label: "Formulary", type: "status", sortable: true, defaultVisible: true },
      { key: "controlled", label: "Controlled", sortable: true, defaultVisible: false },
      { key: "onHand", label: "On hand", sortable: true, defaultVisible: true },
      { key: "reorderLevel", label: "Reorder level", sortable: true, defaultVisible: false },
      { key: "unitCost", label: "Unit cost", type: "money", sortable: true, defaultVisible: true },
      { key: "supplier", label: "Supplier", sortable: true, defaultVisible: false },
      { key: "nextExpiry", label: "Next expiry", type: "date", sortable: true, defaultVisible: true },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity === "prescription") return {
    ...common,
    rows: prescriptionRows,
    primaryKey: "id",
    displayKey: "drug",
    columns: [
      { key: "id", label: "Prescription", sortable: true, defaultVisible: true },
      { key: "patient", label: "MRN", sortable: true, defaultVisible: true },
      { key: "drug", label: "Drug", sortable: true, defaultVisible: true },
      { key: "dose", label: "Dose", sortable: true, defaultVisible: true },
      { key: "route", label: "Route", sortable: true, defaultVisible: false },
      { key: "duration", label: "Duration", sortable: true, defaultVisible: false },
      { key: "prescriber", label: "Prescriber", sortable: true, defaultVisible: true },
      { key: "ward", label: "Ward", sortable: true, defaultVisible: true },
      { key: "prescribedOn", label: "Prescribed", type: "date", sortable: true, defaultVisible: false },
      { key: "priority", label: "Priority", type: "status", sortable: true, defaultVisible: false },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity === "consultation") return {
    ...common,
    rows: consultationRows,
    primaryKey: "id",
    displayKey: "chiefComplaint",
    columns: [
      { key: "id", label: "Consultation", sortable: true, defaultVisible: true },
      { key: "patient", label: "MRN", sortable: true, defaultVisible: true },
      { key: "consultedOn", label: "Seen on", type: "date", sortable: true, defaultVisible: true },
      { key: "specialty", label: "Specialty", sortable: true, defaultVisible: true },
      { key: "clinician", label: "Clinician", sortable: true, defaultVisible: true },
      { key: "chiefComplaint", label: "Presenting complaint", sortable: true, defaultVisible: true },
      { key: "primaryDiagnosis", label: "Diagnosis", sortable: true, defaultVisible: false },
      { key: "outcome", label: "Outcome", sortable: true, defaultVisible: true },
      { key: "followUp", label: "Follow-up", type: "date", sortable: true, defaultVisible: false },
      { key: "payer", label: "Payer", sortable: true, defaultVisible: false },
      { key: "acuity", label: "Acuity", type: "status", sortable: true, defaultVisible: false },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity === "patient") return {
    ...common,
    rows: patientRows,
    primaryKey: "id",
    displayKey: "name",
    columns: [
      { key: "id", label: "MRN", sortable: true, defaultVisible: true },
      { key: "name", label: "Patient", sortable: true, defaultVisible: true },
      { key: "dob", label: "Date of birth", type: "date", sortable: true, defaultVisible: true },
      { key: "gender", label: "Gender", sortable: true, defaultVisible: false },
      { key: "ward", label: "Ward", sortable: true, defaultVisible: true },
      { key: "clinician", label: "Responsible clinician", sortable: true, defaultVisible: true },
      { key: "primaryDiagnosis", label: "Primary diagnosis", sortable: true, defaultVisible: false },
      { key: "payer", label: "Payer", sortable: true, defaultVisible: true },
      { key: "admitted", label: "Admitted", type: "date", sortable: true, defaultVisible: false },
      { key: "lengthOfStay", label: "LOS (days)", sortable: true, defaultVisible: true },
      { key: "acuity", label: "Acuity", type: "status", sortable: true, defaultVisible: false },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity === "customer") return {
    ...common,
    rows: customerRows,
    primaryKey: "id",
    displayKey: "name",
    columns: [
      { key: "id", label: "Customer ID", sortable: true, defaultVisible: true },
      { key: "name", label: "Customer", sortable: true, defaultVisible: true },
      { key: "type", label: "Type", sortable: true, defaultVisible: true },
      { key: "segment", label: "Segment", sortable: true, defaultVisible: true },
      { key: "city", label: "City", sortable: true, defaultVisible: false },
      { key: "contact", label: "Primary contact", sortable: true, defaultVisible: false },
      /* Editable in the table. A credit limit is the kind of small correction a
         form is too much for — twenty of them across twenty customers is twenty
         forms otherwise. Nothing else here opts in: an id is not a typo to fix
         in place, and a status has a workflow behind it. */
      { key: "creditLimit", label: "Credit limit", type: "money", sortable: true, defaultVisible: true, editable: true },
      { key: "outstanding", label: "Outstanding", type: "money", sortable: true, defaultVisible: true },
      { key: "lastInvoice", label: "Last invoice", type: "date", sortable: true, defaultVisible: false },
      { key: "owner", label: "Owner", sortable: true, defaultVisible: true },
      { key: "risk", label: "Risk", type: "status", sortable: true, defaultVisible: false },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity === "invoice") return {
    ...common,
    rows: invoiceRows,
    primaryKey: "id",
    displayKey: "customer",
    columns: [
      { key: "id", label: "Invoice no.", sortable: true, defaultVisible: true },
      { key: "customer", label: "Customer", sortable: true, defaultVisible: true },
      { key: "invoiceDate", label: "Invoice date", type: "date", sortable: true, defaultVisible: true },
      { key: "dueDate", label: "Due date", type: "date", sortable: true, defaultVisible: false },
      { key: "branch", label: "Branch", sortable: true, defaultVisible: false },
      { key: "total", label: "Invoice total", type: "money", sortable: true, defaultVisible: true },
      { key: "paid", label: "Paid", type: "money", sortable: true, defaultVisible: false },
      { key: "balance", label: "Balance", type: "money", sortable: true, defaultVisible: true },
      { key: "owner", label: "Owner", sortable: true, defaultVisible: false },
      { key: "priority", label: "Priority", type: "status", sortable: true, defaultVisible: false },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity.includes("employee") || pageId.includes("employee") || pageId.includes("attendance") || pageId.includes("approval")) return {
    ...common,
    entity: "employee",
    rows: employeeRows,
    primaryKey: "id",
    displayKey: "name",
    columns: [
      { key: "id", label: "Employee ID", sortable: true, defaultVisible: true },
      { key: "name", label: "Employee", sortable: true, defaultVisible: true },
      { key: "department", label: "Department", sortable: true, defaultVisible: true },
      { key: "position", label: "Position", sortable: true, defaultVisible: true },
      { key: "branch", label: "Branch", sortable: true, defaultVisible: false },
      { key: "joinDate", label: "Joined", type: "date", sortable: true, defaultVisible: false },
      { key: "manager", label: "Manager", sortable: true, defaultVisible: true },
      { key: "leaveBalance", label: "Leave balance", type: "number", sortable: true, defaultVisible: false },
      { key: "performance", label: "Performance", type: "percent", sortable: true, defaultVisible: true },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity === "user" || pageId.includes("user")) return {
    ...common,
    entity: "user",
    rows: userRows,
    primaryKey: "id",
    displayKey: "name",
    columns: [
      { key: "id", label: "User ID", sortable: true, defaultVisible: true },
      { key: "name", label: "User", sortable: true, defaultVisible: true },
      { key: "email", label: "Email", sortable: true, defaultVisible: true },
      { key: "role", label: "Primary role", sortable: true, defaultVisible: true },
      { key: "branch", label: "Default branch", sortable: true, defaultVisible: false },
      { key: "modules", label: "Modules", type: "number", sortable: true, defaultVisible: false },
      { key: "lastLogin", label: "Last sign-in", sortable: true, defaultVisible: true },
      { key: "mfa", label: "MFA", type: "status", sortable: true, defaultVisible: false },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity.includes("product") || entity.includes("item") || pageId.includes("stock") || pageId.includes("inventory")) return {
    ...common,
    entity: "product",
    rows: productRows,
    primaryKey: "id",
    displayKey: "name",
    columns: [
      { key: "id", label: "Item code", sortable: true, defaultVisible: true },
      { key: "name", label: "Item", sortable: true, defaultVisible: true },
      { key: "category", label: "Category", sortable: true, defaultVisible: true },
      { key: "unit", label: "UOM", sortable: true, defaultVisible: false },
      { key: "cost", label: "Cost", type: "money", sortable: true, defaultVisible: false },
      { key: "price", label: "Price", type: "money", sortable: true, defaultVisible: true },
      { key: "stock", label: "Available", type: "number", sortable: true, defaultVisible: true },
      { key: "reorder", label: "Reorder level", type: "number", sortable: true, defaultVisible: false },
      { key: "warehouse", label: "Warehouse", sortable: true, defaultVisible: true },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (entity.includes("supplier") || pageId.includes("supplier") || pageId.includes("procurement")) return {
    ...common,
    entity: "supplier",
    rows: supplierRows,
    primaryKey: "id",
    displayKey: "name",
    columns: [
      { key: "id", label: "Supplier ID", sortable: true, defaultVisible: true },
      { key: "name", label: "Supplier", sortable: true, defaultVisible: true },
      { key: "category", label: "Class", sortable: true, defaultVisible: true },
      { key: "country", label: "Country", sortable: true, defaultVisible: false },
      { key: "contact", label: "Contact", sortable: true, defaultVisible: false },
      { key: "leadTime", label: "Lead time (days)", type: "number", sortable: true, defaultVisible: true },
      { key: "onTime", label: "On-time", type: "percent", sortable: true, defaultVisible: true },
      { key: "quality", label: "Quality", type: "percent", sortable: true, defaultVisible: false },
      { key: "openPO", label: "Open POs", type: "number", sortable: true, defaultVisible: false },
      { key: "exposure", label: "Exposure", type: "money", sortable: true, defaultVisible: true },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  if (pageId.includes("order") || entity.includes("quotation") || entity.includes("sales")) return {
    ...common,
    entity: "order",
    rows: orderRows,
    primaryKey: "id",
    displayKey: "customer",
    columns: [
      { key: "id", label: "Order no.", sortable: true, defaultVisible: true },
      { key: "customer", label: "Customer", sortable: true, defaultVisible: true },
      { key: "orderDate", label: "Order date", type: "date", sortable: true, defaultVisible: true },
      { key: "requestedDate", label: "Required date", type: "date", sortable: true, defaultVisible: false },
      { key: "value", label: "Order value", type: "money", sortable: true, defaultVisible: true },
      { key: "margin", label: "Margin", type: "percent", sortable: true, defaultVisible: true },
      { key: "owner", label: "Owner", sortable: true, defaultVisible: true },
      { key: "branch", label: "Branch", sortable: true, defaultVisible: false },
      { key: "priority", label: "Priority", type: "status", sortable: true, defaultVisible: false },
      { key: "status", label: "Status", type: "status", sortable: true, defaultVisible: true },
    ],
  };

  return {
    ...common,
    rows: genericRows(entity, title),
    primaryKey: "id",
    displayKey: "name",
    columns: commonColumns,
  };
}

export const dashboardData: Record<ModuleKey, {
  kpis: Array<{ label: string; value: string; delta: string; trend: "up" | "down" | "neutral"; note: string }>;
  trend: number[];
  trendLabels: string[];
  breakdown: Array<{ label: string; value: number; total: number }>;
  activity: Array<{ title: string; detail: string; time: string; tone: "success" | "warning" | "info" | "danger" }>;
  queue: Array<{ label: string; count: number; value: string; SLA: string }>;
}> = {
  hr: {
    kpis: [
      { label: "Active workforce", value: "4,286", delta: "+3.8%", trend: "up", note: "158 joined YTD" },
      { label: "Open positions", value: "126", delta: "-8.1%", trend: "down", note: "42 critical roles" },
      { label: "Attendance today", value: "94.7%", delta: "+1.2%", trend: "up", note: "81 exceptions" },
      { label: "People cost / month", value: "AED 28.4M", delta: "+2.6%", trend: "up", note: "Within budget" },
      { label: "Attrition", value: "7.2%", delta: "-0.9%", trend: "down", note: "12-month rolling" },
      { label: "Compliance", value: "97.8%", delta: "+0.4%", trend: "up", note: "26 renewals due" },
    ],
    trend: [312, 334, 329, 358, 371, 389, 401, 396, 422, 438, 451, 463],
    trendLabels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    breakdown: [
      { label: "Operations", value: 1280, total: 1600 }, { label: "Sales", value: 820, total: 1000 }, { label: "Technology", value: 670, total: 900 }, { label: "Finance", value: 420, total: 600 }, { label: "Support", value: 355, total: 500 },
    ],
    activity: [
      { title: "Payroll headcount locked", detail: "September payroll snapshot completed", time: "9 min", tone: "success" },
      { title: "26 licenses nearing expiry", detail: "Professional credentials require review", time: "21 min", tone: "warning" },
      { title: "New organization change", detail: "Supply Chain structure effective 15 Sep", time: "42 min", tone: "info" },
      { title: "Critical attendance anomaly", detail: "Dubai Operations • 14 unresolved", time: "1 hr", tone: "danger" },
    ],
    queue: [
      { label: "Joiner approvals", count: 38, value: "6 overdue", SLA: "4h" }, { label: "Leave approvals", count: 112, value: "18 today", SLA: "8h" }, { label: "Employee changes", count: 49, value: "AED 1.2M impact", SLA: "1d" }, { label: "Compliance review", count: 26, value: "5 critical", SLA: "3d" },
    ],
  },
  finance: {
    kpis: [
      { label: "Revenue MTD", value: "AED 18.74M", delta: "+11.8%", trend: "up", note: "89% of plan" },
      { label: "Cash position", value: "AED 42.16M", delta: "+4.3%", trend: "up", note: "Across 12 accounts" },
      { label: "Receivables", value: "AED 13.85M", delta: "-2.1%", trend: "down", note: "DSO 41 days" },
      { label: "Payables", value: "AED 9.26M", delta: "+1.7%", trend: "up", note: "AED 2.1M due this week" },
      { label: "Gross margin", value: "34.8%", delta: "+2.4%", trend: "up", note: "Target 33.0%" },
      { label: "Unposted journals", value: "84", delta: "12 high risk", trend: "neutral", note: "AED 4.6M value" },
    ],
    trend: [12.4, 13.1, 12.8, 14.2, 15.1, 14.8, 16.2, 16.8, 17.1, 17.9, 18.2, 18.74],
    trendLabels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    breakdown: [
      { label: "UAE Enterprise", value: 7.4, total: 9 }, { label: "Retail", value: 4.8, total: 7 }, { label: "Services", value: 3.9, total: 5 }, { label: "Export", value: 2.6, total: 4 }, { label: "Other", value: 1.1, total: 2 },
    ],
    activity: [
      { title: "Daily bank feed reconciled", detail: "2,486 transactions • 98.6% matched", time: "6 min", tone: "success" },
      { title: "Tax threshold warning", detail: "Jurisdiction AE-DXB approaching threshold", time: "18 min", tone: "warning" },
      { title: "Large journal submitted", detail: "JV-26-018492 • AED 1.84M", time: "35 min", tone: "info" },
      { title: "Customer credit exceeded", detail: "Atlas Horizon LLC • AED 184K over limit", time: "51 min", tone: "danger" },
    ],
    queue: [
      { label: "Invoices to validate", count: 128, value: "AED 3.8M", SLA: "2h" }, { label: "Collections", count: 76, value: "AED 6.2M", SLA: "1d" }, { label: "Journal approvals", count: 84, value: "AED 4.6M", SLA: "4h" }, { label: "Payment batches", count: 19, value: "AED 2.1M", SLA: "Today" },
    ],
  },
  payroll: {
    kpis: [
      { label: "Net payroll", value: "AED 24.18M", delta: "+2.7%", trend: "up", note: "September preview" },
      { label: "Employees processed", value: "4,218", delta: "98.4%", trend: "up", note: "68 pending" },
      { label: "Payroll exceptions", value: "47", delta: "-18.9%", trend: "down", note: "12 blocking" },
      { label: "Overtime", value: "AED 684K", delta: "+6.2%", trend: "up", note: "2.8% of base pay" },
      { label: "Deductions", value: "AED 3.42M", delta: "+1.1%", trend: "neutral", note: "Statutory + voluntary" },
      { label: "Bank files", value: "8 / 12", delta: "4 pending", trend: "neutral", note: "Cutoff 04 Sep" },
    ],
    trend: [20.8, 21.1, 21.4, 21.3, 22.0, 22.4, 22.8, 23.1, 23.0, 23.6, 23.9, 24.18],
    trendLabels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    breakdown: [
      { label: "Base salary", value: 18.6, total: 24.2 }, { label: "Allowances", value: 3.8, total: 6 }, { label: "Overtime", value: .684, total: 1.5 }, { label: "Benefits", value: .72, total: 1.5 }, { label: "Adjustments", value: .38, total: 1 },
    ],
    activity: [
      { title: "Payroll validation passed", detail: "4,171 records clear for approval", time: "11 min", tone: "success" },
      { title: "12 blocking exceptions", detail: "Missing bank details and negative net pay", time: "20 min", tone: "danger" },
      { title: "Retro calculation complete", detail: "188 employee adjustments calculated", time: "44 min", tone: "info" },
      { title: "Bank cutoff approaching", detail: "Four salary files remain pending", time: "1 hr", tone: "warning" },
    ],
    queue: [
      { label: "Input validation", count: 47, value: "12 blocking", SLA: "2h" }, { label: "Manager approval", count: 18, value: "AED 18.2M", SLA: "4h" }, { label: "Bank files", count: 4, value: "1,482 employees", SLA: "1d" }, { label: "Payslip release", count: 12, value: "4,218 slips", SLA: "2d" },
    ],
  },
  sales: {
    kpis: [
      { label: "Pipeline", value: "AED 86.2M", delta: "+14.1%", trend: "up", note: "Weighted AED 41.8M" },
      { label: "Booked revenue", value: "AED 19.6M", delta: "+8.6%", trend: "up", note: "104% of MTD plan" },
      { label: "Win rate", value: "38.4%", delta: "+3.2%", trend: "up", note: "Rolling 90 days" },
      { label: "Open orders", value: "284", delta: "+22", trend: "neutral", note: "AED 31.4M" },
      { label: "Average deal", value: "AED 148K", delta: "+5.9%", trend: "up", note: "Enterprise segment" },
      { label: "At-risk renewals", value: "31", delta: "AED 4.8M", trend: "down", note: "Action required" },
    ],
    trend: [11.8, 12.4, 13.1, 12.8, 14.5, 15.2, 15.9, 16.7, 17.1, 18.2, 18.9, 19.6],
    trendLabels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    breakdown: [
      { label: "Enterprise", value: 32, total: 40 }, { label: "Mid-market", value: 21, total: 30 }, { label: "SMB", value: 14, total: 24 }, { label: "Government", value: 11, total: 18 }, { label: "Channel", value: 8, total: 14 },
    ],
    activity: [
      { title: "Large opportunity advanced", detail: "Nova Build • AED 3.4M • Negotiation", time: "7 min", tone: "success" },
      { title: "Margin exception requested", detail: "Quote QT-26-00384 below threshold", time: "15 min", tone: "warning" },
      { title: "Renewal risk increased", detail: "Helix Digital health score dropped", time: "33 min", tone: "danger" },
      { title: "New lead assignment", detail: "8 high-fit leads routed to UAE Enterprise", time: "47 min", tone: "info" },
    ],
    queue: [
      { label: "Quotes awaiting approval", count: 42, value: "AED 12.8M", SLA: "4h" }, { label: "Orders on hold", count: 28, value: "AED 3.6M", SLA: "8h" }, { label: "Renewal actions", count: 31, value: "AED 4.8M", SLA: "3d" }, { label: "Fulfillment exceptions", count: 17, value: "AED 1.4M", SLA: "1d" },
    ],
  },
  supply: {
    kpis: [
      { label: "Inventory value", value: "AED 38.7M", delta: "+1.8%", trend: "up", note: "Across 9 warehouses" },
      { label: "Open purchase orders", value: "AED 12.4M", delta: "186 POs", trend: "neutral", note: "AED 3.1M overdue" },
      { label: "Service level", value: "96.2%", delta: "+0.7%", trend: "up", note: "Target 95%" },
      { label: "Stockouts", value: "34", delta: "-12", trend: "down", note: "8 customer critical" },
      { label: "Supplier OTIF", value: "91.8%", delta: "+2.1%", trend: "up", note: "Top 50 suppliers" },
      { label: "Slow-moving stock", value: "AED 4.2M", delta: "10.9%", trend: "down", note: "Action plan active" },
    ],
    trend: [87, 89, 88, 90, 91, 90, 92, 93, 92, 94, 95, 96.2],
    trendLabels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    breakdown: [
      { label: "Raw materials", value: 14.2, total: 18 }, { label: "Finished goods", value: 10.8, total: 15 }, { label: "Consumables", value: 6.4, total: 10 }, { label: "In transit", value: 4.1, total: 8 }, { label: "Reserved", value: 3.2, total: 6 },
    ],
    activity: [
      { title: "Inbound shipment received", detail: "GRN-26-01836 • 148 lines • WH-AUH-01", time: "5 min", tone: "success" },
      { title: "Critical stockout risk", detail: "8 items affect confirmed sales orders", time: "16 min", tone: "danger" },
      { title: "Supplier delay detected", detail: "Falcon Industrial • PO-26-004892", time: "31 min", tone: "warning" },
      { title: "Reorder proposal generated", detail: "126 items • AED 1.84M suggested", time: "54 min", tone: "info" },
    ],
    queue: [
      { label: "Requisitions", count: 86, value: "AED 2.7M", SLA: "8h" }, { label: "PO approvals", count: 41, value: "AED 4.2M", SLA: "4h" }, { label: "Receiving exceptions", count: 23, value: "68 lines", SLA: "2h" }, { label: "Reorder proposals", count: 126, value: "AED 1.84M", SLA: "1d" },
    ],
  },
  healthcare: {
    kpis: [
      { label: "Inpatients today", value: "412", delta: "+2.4%", trend: "up", note: "68 admitted in 24h" },
      { label: "Bed occupancy", value: "87.3%", delta: "+3.1%", trend: "up", note: "Above 85% threshold" },
      { label: "Average length of stay", value: "4.2 days", delta: "-0.3", trend: "down", note: "Target 4.5" },
      { label: "Outpatient visits", value: "1,864", delta: "+6.8%", trend: "up", note: "Week to date" },
      { label: "Claim denial rate", value: "6.9%", delta: "-1.2%", trend: "down", note: "182 in appeal" },
      { label: "Pending pre-auth", value: "97", delta: "+14", trend: "up", note: "23 breach SLA today" },
    ],
    trend: [1284, 1310, 1298, 1366, 1402, 1388, 1445, 1478, 1502, 1466, 1531, 1568],
    trendLabels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    breakdown: [
      { label: "Inpatient", value: 412, total: 472 }, { label: "Day case", value: 168, total: 220 },
      { label: "Emergency", value: 96, total: 120 }, { label: "Outpatient clinics", value: 1864, total: 2100 },
    ],
    activity: [
      { title: "Bed capacity warning", detail: "Ward 4B at 96% — 2 beds available", time: "12m", tone: "warning" },
      { title: "Claim batch submitted", detail: "648 claims to Daman • AED 3.9M", time: "48m", tone: "success" },
      { title: "Pre-authorisation denied", detail: "3 requests need clinical documentation", time: "1h", tone: "danger" },
      { title: "Discharge summary overdue", detail: "14 encounters closed without a summary", time: "2h", tone: "warning" },
      { title: "Lab interface healthy", detail: "2,184 results received and matched", time: "3h", tone: "info" },
    ],
    queue: [
      { label: "Awaiting pre-authorisation", count: 97, value: "AED 2.4M", SLA: "24h" },
      { label: "Discharge summaries due", count: 14, value: "—", SLA: "48h" },
      { label: "Claims in denial", count: 182, value: "AED 1.1M", SLA: "30d" },
      { label: "Unsigned clinical notes", count: 63, value: "—", SLA: "72h" },
    ],
  },
  pharmacy: {
    kpis: [
      { label: "Prescriptions today", value: "1,142", delta: "+5.2%", trend: "up", note: "218 awaiting dispense" },
      { label: "Average dispense time", value: "11.4 min", delta: "-1.8", trend: "down", note: "Target 12 min" },
      { label: "Stock-outs", value: "17", delta: "+4", trend: "up", note: "6 on critical formulary" },
      { label: "Expiring in 90 days", value: "AED 284K", delta: "+12.1%", trend: "up", note: "42 batches" },
      { label: "Formulary compliance", value: "94.1%", delta: "+0.7%", trend: "up", note: "68 off-formulary" },
      { label: "Controlled variance", value: "0", delta: "0", trend: "neutral", note: "Reconciled to date" },
    ],
    trend: [842, 878, 861, 924, 968, 951, 1004, 1042, 1088, 1061, 1114, 1142],
    trendLabels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    breakdown: [
      { label: "Outpatient", value: 684, total: 800 }, { label: "Inpatient", value: 312, total: 400 },
      { label: "Day case", value: 96, total: 140 }, { label: "Discharge", value: 50, total: 80 },
    ],
    activity: [
      { title: "Stock-out risk", detail: "Metformin 500mg — 2 days cover at current run rate", time: "18m", tone: "danger" },
      { title: "Controlled register signed", detail: "Evening count reconciled by two pharmacists", time: "52m", tone: "success" },
      { title: "Batch quarantined", detail: "Recall notice — batch AMX-2261 withdrawn", time: "2h", tone: "warning" },
      { title: "Goods receipt posted", detail: "184 lines from Gulf Pharma • AED 412K", time: "3h", tone: "info" },
      { title: "Off-formulary approval", detail: "6 requests pending pharmacy director", time: "5h", tone: "warning" },
    ],
    queue: [
      { label: "Awaiting dispense", count: 218, value: "—", SLA: "30m" },
      { label: "Off-formulary approvals", count: 6, value: "AED 48K", SLA: "24h" },
      { label: "Expiring within 90 days", count: 42, value: "AED 284K", SLA: "90d" },
      { label: "Requisitions to approve", count: 23, value: "AED 1.6M", SLA: "48h" },
    ],
  },
  library: {
    kpis: [
      { label: "Shared components", value: "64", delta: "+8", trend: "up", note: "100% token-aware" },
      { label: "Page patterns", value: "18", delta: "+3", trend: "up", note: "Across 5 ERP modules" },
      { label: "Theme variants", value: "7", delta: "AA contrast", trend: "neutral", note: "Future-token ready" },
      { label: "Form schemas", value: "24", delta: "5 render modes", trend: "up", note: "Single schema source" },
      { label: "Keyboard actions", value: "14", delta: "+4", trend: "up", note: "Discoverable shortcuts" },
      { label: "Accessibility score", value: "96%", delta: "+3%", trend: "up", note: "Prototype audit" },
    ],
    trend: [18, 22, 26, 31, 34, 39, 43, 48, 52, 56, 60, 64],
    trendLabels: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    breakdown: [
      { label: "Inputs", value: 18, total: 20 }, { label: "Data display", value: 14, total: 16 }, { label: "Navigation", value: 10, total: 12 }, { label: "Feedback", value: 9, total: 12 }, { label: "Compositions", value: 13, total: 16 },
    ],
    activity: [
      { title: "DataGrid v2 contract published", detail: "Column persistence and server pagination", time: "8 min", tone: "success" },
      { title: "Theme token warning", detail: "Two custom tokens need contrast review", time: "24 min", tone: "warning" },
      { title: "FormRenderer usage increased", detail: "Now used by 24 entity schemas", time: "39 min", tone: "info" },
      { title: "Deprecated prop detected", detail: "Button legacyTone used in 3 pages", time: "1 hr", tone: "danger" },
    ],
    queue: [
      { label: "Component reviews", count: 12, value: "4 breaking-risk", SLA: "2d" }, { label: "Accessibility fixes", count: 8, value: "2 critical", SLA: "1d" }, { label: "Documentation", count: 17, value: "72% complete", SLA: "5d" }, { label: "Migration tasks", count: 23, value: "v1 → v2", SLA: "Sprint" },
    ],
  },
};
