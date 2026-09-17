/** Clinical Library contracts: serializable, independent of any shell or HTTP transport. */
export const CLINICAL_TEMPLATE_PAGES = [
  {id:"dcp-designer",title:"designer.title"},
  {id:"emergency-registration", title:"care.text202"},
  {id:"inpatient-admission", title:"care.text385"},
  {id:"consultation-entry-design", title:"care.text449"},
  {id:"consultation-entry-v2", title:"care.text450"},

  { id: "allyvora-patient-query", title: "template.clinical.query" },
  { id: "allyvora-patient-record", title: "template.clinical.record" },
  { id: "allyvora-patient-360", title: "template.clinical.overview" },
  { id: "billing-clinic", title: "template.clinic.title" },
  { id: "clinical-triage", title: "template.triage.title" },
  { id: "clinical-consultation", title: "template.consultation.title" },
  { id: "op-consultation", title: "template.op.title" },
  { id: "comprehensive-consultation", title: "template.comprehensive.title" },
  { id: "op-registration", title: "registration.title" },
] as const;
export type PatientValue = string | boolean;
export interface PatientField {
  id: string;
  label: string;
  type: "text" | "email" | "date" | "time" | "select" | "textarea" | "checkbox";
  required?: boolean;
  span?: number;
  hidden?: boolean;
  allowCustom?: boolean;
  control?: "toggle" | "primary";
  visibleWhen?: { field: string; value: PatientValue };
  options?: Array<{ value: string; label: string }>;
}
export interface PatientSection {
  cardTitle?: string;
  groups?: Array<{ title: string; fields: string[] }>;
  id: string;
  title: string;
  subtitle: string;
  fields: PatientField[];
  collections: string[];
}
export interface PatientCollection {
  addRequires?: string;
  addLabel?: string;
  id: string;
  title: string;
  fields: PatientField[];
}
export interface PatientActivity {
  id: string;
  at: string;
  messageKey: string;
  detail?: string;
  actor: string;
}
export interface PatientRecord {
  id: string;
  mrn: string;
  internalCode: string;
  version: number;
  values: Record<string, PatientValue>;
  collections: Record<string, Array<Record<string, string>>>;
  activity: PatientActivity[];
}
export interface PatientSummary {
  editable?: boolean;
  country?: string;
  identifier?: string;
  matchedIn?: string[];
  possibleDuplicate?: boolean;
  id: string;
  mrn: string;
  internalCode: string;
  name: string;
  birthDate: string;
  gender: string;
  mobile: string;
  email: string;
  nationality: string;
  status: string;
  registeredAt: string;
  version: number;
}
export interface PatientFilters {
  identityType?: string;
  country?: string;
  mobileCode?: string;
  q?: string;
  mrn?: string;
  firstName?: string;
  lastName?: string;
  identity?: string;
  mobile?: string;
  gender?: string;
  nationality?: string;
  birthDate?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: "asc" | "desc";
}
export interface PatientSearchResult {
  /** Present for bounded cursor results without a global count. */
  hasMore?: boolean;
  rows: PatientSummary[];
  total: number;
  page: number;
  pageSize: number;
}
export interface PatientCareRow {
  id: string;
  kind:
    | "encounter"
    | "appointment"
    | "episode"
    | "order"
    | "billing"
    | "pharmacy"
    | "team"
    | "location"
    | "clinical";
  date: string;
  title: string;
  detail: string;
  status: string;
  provider?: string;
  amount?: number;
}
export interface PatientOverview {
  patient: PatientRecord;
  rows: PatientCareRow[];
  loadedAt: string;
}
export interface PatientMetadata {
  queryCapabilities?: {presets?: boolean; export?: boolean; care?: boolean; overview?: boolean; sort?: boolean};
  searchHint?: string;
  searchOptions?: Record<string, Array<{ value: string; label: string }>>;
  sections: PatientSection[];
  collections: PatientCollection[];
  providers: Array<{ value: string; label: string }>;
  canWrite: boolean;
  schemaVersion: number;
}
export interface PatientSavedSearch {
  id: string;
  name: string;
  filters: PatientFilters;
}
export interface PatientSave {
  record: PatientRecord;
  expectedVersion: number;
  operationId: string;
}
export interface PatientCareRequest {
  patientId: string;
  kind: "appointment" | "encounter";
  date: string;
  time: string;
  provider: string;
  notes: string;
  operationId: string;
}

export interface PatientEligibility {
  status: "eligible" | "expired" | "unknown";
  checkedAt: string;
  reference: string;
}
