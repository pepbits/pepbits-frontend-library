export type SectionId =
  | 'mrn'
  | 'personal'
  | 'contact'
  | 'address'
  | 'identity'
  | 'insurance'
  | 'clinical'
  | 'registration'
  | 'consent';

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'segmented'
  | 'switch'
  | 'textarea'
  | 'readonly'
  | 'signature';

export type Primitive = string | number | boolean | null;
export type FieldValue = string | number | boolean | string[] | null | undefined;
export type FormValues = Record<string, FieldValue>;
export type FieldErrors = Record<string, string>;

export type ConditionOp = 'eq' | 'neq' | 'in' | 'notIn' | 'filled' | 'empty' | 'true' | 'false';

export interface Condition {
  field: string;
  op: ConditionOp;
  value?: Primitive | Primitive[];
}

export interface FieldDef {
  id: string;
  section: SectionId;
  label: string;
  type: FieldType;
  /** Sub-heading inside a section, used to group related fields. */
  group?: string;
  /** Lookup category served by the API (`/api/lookups`). */
  lookup?: string;
  /** Filter lookup options by the value of another field (matches option.parent). */
  lookupParent?: string;
  required?: boolean;
  /** Required only when every condition is met (and the field is visible). */
  requiredWhen?: Condition[];
  /** Shown only when every condition is met. Hidden values are discarded on save. */
  visibleWhen?: Condition[];
  requiredMessage?: string;
  placeholder?: string;
  help?: string;
  span?: 1 | 2 | 'full';
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: { regex: string; message: string; flags?: string };
  date?: { rule: 'past' | 'future'; message?: string; min?: string };
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal';
  autoComplete?: string;
  prefix?: string;
  uppercase?: boolean;
  /** Values that must never be shown in audit trails in full. */
  sensitive?: boolean;
}

export interface SectionDef {
  id: SectionId;
  index: number;
  title: string;
  short: string;
  description: string;
}

export interface LookupOption {
  code: string;
  label: string;
  parent?: string | null;
  hint?: string | null;
}

export type Lookups = Record<string, LookupOption[]>;

export type SectionState = 'untouched' | 'in-progress' | 'complete' | 'error';

export interface SectionProgress {
  state: SectionState;
  requiredTotal: number;
  requiredDone: number;
  errorCount: number;
  filled: number;
  optional: boolean;
}

export const LAYOUT_KINDS = ['scroll', 'tabs', 'wizard', 'stepper', 'accordion'] as const;
export type LayoutKind = (typeof LAYOUT_KINDS)[number];

export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];

export const VALIDATE_MODES = ['change', 'blur', 'submit'] as const;
export type ValidateMode = (typeof VALIDATE_MODES)[number];

export interface LayoutSettings {
  layout: LayoutKind;
  density: Density;
  columns: 2 | 3 | 4;
  showSummary: boolean;
  validateOn: ValidateMode;
  autosaveDraft: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SettingsHistoryEntry {
  id: number;
  changedAt: string;
  changedBy: string;
  value: LayoutSettings;
}

export type PatientStatus = 'active' | 'inactive';

export interface PatientRecord {
  id: number;
  mrn: string;
  orgNumber: string;
  branchId: number;
  branchName: string;
  status: PatientStatus;
  displayName: string;
  completion: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  data: FormValues;
}

export interface PatientListItem {
  id: number;
  mrn: string;
  orgNumber: string;
  branchCode: string;
  status: PatientStatus;
  displayName: string;
  localName: string | null;
  sex: string | null;
  ageLabel: string | null;
  mobile: string | null;
  payerType: string | null;
  allergyStatus: string | null;
  bloodGroup: string | null;
  completion: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PatientStats {
  active: number;
  inactive: number;
  today: number;
  week: number;
  incomplete: number;
}

export interface FieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface AuditEntry {
  id: number;
  action: 'created' | 'updated' | 'deactivated' | 'reactivated';
  actor: string;
  at: string;
  changes: FieldChange[];
}

export interface DuplicateCandidate {
  id: number;
  mrn: string;
  displayName: string;
  ageLabel: string | null;
  sex: string | null;
  mobile: string | null;
  score: number;
  reasons: string[];
}

export interface SessionInfo {
  user: { id: number; name: string; email: string; role: string; initials: string };
  organization: { id: number; code: string; name: string };
  branches: { id: number; code: string; name: string; city: string | null }[];
  defaultBranchId: number;
  tenant: string;
}

export interface MrnPreview {
  branchId: number;
  next: string;
  rule: string;
}
