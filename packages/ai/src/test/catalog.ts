import type {AiUseCase} from "../config";
import type {DataClassification} from "@pepbits/page-engines/types";
export const USE_CASES: AiUseCase[] = [
  {
    id: "worklist.summarise-selection",
    label: "Summarise selection",
    description: "Summarises the records you have selected, using only the columns currently visible.",
    reads: [{ source: "worklist-selection", fields: ["id", "name", "status", "owner", "outstanding", "lastInvoice"] }],
    promptId: "worklist.summarise.v1",
    category: "general",
  },
  {
    id: "record.explain",
    label: "Explain this record",
    description: "Explains the fields on the open record and what its current status means.",
    reads: [{ source: "page-record", fields: ["id", "name", "type", "segment", "status", "risk", "creditLimit", "outstanding"] }],
    promptId: "record.explain.v1",
    category: "general",
  },
  {
    id: "form.draft-note",
    label: "Draft a note",
    description: "Drafts an internal note from the values you have entered. Nothing is saved — the draft lands in the form for you to edit.",
    reads: [{ source: "form-values", fields: ["customer", "reference", "terms", "jurisdiction"], optional: true }],
    promptId: "form.draft-note.v1",
    category: "general",
  },
  {
    id: "dashboard.explain-metrics",
    label: "Explain these figures",
    description: "Reads the headline figures on this dashboard — their values, movement and footnotes — and explains what they say together.",
    reads: [{ source: "page-metrics", fields: ["label", "value", "delta", "note"] }],
    promptId: "dashboard.explain-metrics.v1",
    category: "general",
  },
  {
    id: "report.summarise",
    label: "Summarise this report",
    description: "Reads the rows currently in the report — actual against previous and budget — and summarises where the movement is.",
    
    reads: [{ source: "page-metrics", fields: ["dimension", "current", "previous", "budget", "variance", "contribution"] }],
    promptId: "report.summarise.v1",
    category: "general",
  },
  {
    id: "inbox.summarise-unread",
    label: "Summarise my unread",
    description: "Reads the unread items in this list — their subject, preview and age — and tells you what is waiting and what looks urgent.",
    
    reads: [{ source: "inbox-unread", fields: ["title", "preview", "time", "kind", "role"], optional: true }],
    promptId: "inbox.summarise-unread.v1",
    category: "general",
  },
  
  {
    id: "restricted.summarise",
    label: "Summarise this encounter",
    description: "Summarises the clinical picture of this record — ward, diagnosis, length of stay and status. The subject's name is never sent.",
    reads: [{ source: "page-record", fields: ["dob", "ward", "operatorName", "primaryDiagnosis", "admitted", "lengthOfStay", "status", "acuity"], optional: true }],
    promptId: "restricted.summarise.v1",
    category: "clinical",
  },
  {
    id: "restricted.gaps",
    label: "Find documentation gaps",
    description: "Names what a record of this kind would normally carry and is missing here. Suggests only — it never writes to the record.",
    reads: [{ source: "page-record", fields: ["ward", "operatorName", "primaryDiagnosis", "admitted", "lengthOfStay", "status", "acuity", "payer"], optional: true }],
    promptId: "restricted.gaps.v1",
    category: "clinical",
  },
  {
    id: "restricted.selection",
    label: "Summarise selected records",
    description: "Summarises the clinical records you have selected as a group — where the load is, and which look urgent. No names are sent.",
    reads: [{ source: "worklist-selection", fields: ["ward", "primaryDiagnosis", "status", "acuity", "lengthOfStay"] }],
    promptId: "restricted.selection.v1",
    category: "clinical",
  },
  {
    id: "restricted.codes",
    label: "Suggest diagnosis codes",
    description: "Proposes codes from this service's catalogue for the documented problem. It selects from a supplied list and cannot invent a code; nothing is applied until you accept it.",
    
    reads: [{ source: "page-record", fields: ["problem", "specialty", "complaint", "findings", "candidateCodes"], optional: true }],
    promptId: "restricted.codes.v1",
    category: "clinical",
  },
  {
    id: "restricted.options",
    label: "Suggest orders",
    description: "Proposes orders from this service's orderable catalogue for the documented problem. Selection only, never invention, and nothing is placed until you accept it.",
    reads: [{ source: "page-record", fields: ["problem", "specialty", "complaint", "findings", "candidateOrders"], optional: true }],
    promptId: "restricted.options.v1",
    category: "clinical",
  },
];


export const DATA_CLASSIFICATIONS: Record<string, DataClassification> = {
  privateReference: "phi",
  privateDescription: "clinical",
  quantity: "operational",
  net: "operational",
  tax: "operational",
  fundedShare: "operational",
  restrictedSubjectShare: "operational",
  
  status: "operational",
  branch: "operational",
  department: "operational",
  owner: "operational",
  priority: "operational",
  from: "operational",
  to: "operational",
  sort: "operational",
  page: "operational",
  pageSize: "operational",

  
  query: "phi",
  tags: "phi",
  recordRef: "phi",
  createdBy: "pii",

  
  subjectName: "phi",
  mrn: "phi",
  dob: "phi",
  emiratesId: "pii",
  phone: "pii",
  email: "pii",
  memberId: "pii",
  insuranceId: "pii",
  diagnosis: "clinical",
  medication: "clinical",
  procedure: "clinical",

  

  
  id: "operational",
  name: "operational",
  customer: "operational",
  type: "operational",
  segment: "operational",
  risk: "operational",
  creditLimit: "operational",
  outstanding: "operational",
  lastInvoice: "operational",
  reference: "operational",
  terms: "operational",
  jurisdiction: "operational",
  payer: "operational",

  
  label: "operational",
  value: "operational",
  delta: "operational",
  note: "operational",
  dimension: "operational",
  current: "operational",
  previous: "operational",
  budget: "operational",
  variance: "operational",
  contribution: "operational",
  title: "operational",
  preview: "operational",
  time: "operational",
  kind: "operational",
  role: "operational",

  
  operatorName: "pii",
  admitted: "phi",

  
  token: "credential",
  ["apiKey"]: "credential",
  secret: "credential",
  password: "credential",

  
  subject: "phi",
  gender: "phi",
  
  consultedOn: "phi",
  prescribedOn: "phi",

  prescriber: "pii",
  manager: "pii",
  contact: "pii",
  city: "pii",
  joinDate: "pii",
  leaveBalance: "pii",
  performance: "pii",

  chiefComplaint: "clinical",
  outcome: "clinical",
  followUp: "clinical",
  drug: "clinical",
  dose: "clinical",
  route: "clinical",
  duration: "clinical",
  form: "clinical",
  atc: "clinical",
  controlled: "clinical",

  
  view: "operational",
  preset: "operational",
  currency: "operational",
  comparison: "operational",
  aggregation: "operational",
  minimum: "operational",

  
  cost: "operational",
  price: "operational",
  margin: "operational",
  unit: "operational",
  stock: "operational",
  reorder: "operational",
  openPO: "operational",
  leadTime: "operational",
  onTime: "operational",
  quality: "operational",
  exposure: "operational",
  warehouse: "operational",
  orderDate: "operational",
  requestedDate: "operational",
  country: "operational",

  
  category: "operational",
  position: "operational",
  formulary: "operational",
  onHand: "operational",
  reorderLevel: "operational",
  
  sheetItemCode: "operational",
  sheetDescription: "operational",
  sheetQuantity: "operational",
  sheetUnitCost: "operational",
  sheetDiscount: "operational",
  sheetTax: "operational",
  sheetNetCost: "operational",
  sheetSupplier: "operational",
  unitCost: "operational",
  supplier: "operational",
  nextExpiry: "operational",
  total: "operational",
  balance: "operational",
  paid: "operational",
  dueDate: "operational",
  invoiceDate: "operational",
  updated: "operational",

  
  ward: "clinical",
  acuity: "clinical",
  lengthOfStay: "clinical",
  specialty: "clinical",
  primaryDiagnosis: "clinical",
  problem: "clinical",
  complaint: "clinical",
  findings: "clinical",
  candidateCodes: "clinical",
  candidateOrders: "clinical",
};


export function classificationFor(key: string): DataClassification {
  return DATA_CLASSIFICATIONS[key] ?? "unclassified";
}

export const getUseCase=(id:string)=>USE_CASES.find(item=>item.id===id);
