/** Shapes of the Tenant Admin API. Identifiers, codes and record data are never translated. */
export type FieldType =
  | "text" | "textarea" | "number" | "decimal" | "money" | "percent" | "date"
  | "boolean" | "select" | "multiselect" | "tags" | "ref" | "refs" | "lines";

export type Option = { value: string; label: string; group?: string };

export interface FieldDef {
  key: string; label: string; type: FieldType; required?: boolean; alwaysRequired?: boolean;
  options?: Option[]; ref?: string; help?: string; section?: string; list?: boolean;
  min?: number; max?: number; maxItems?: number; placeholder?: string; span?: 1 | 2;
  upper?: boolean; columns?: FieldDef[]; tenantOnly?: boolean;
}

export interface ResourceDef {
  key: string; label: string; singular: string; category: string; icon: string; summary: string;
  governance: "versioned" | "simple"; effectiveDated: boolean; codePrefix: string;
  sections?: string[]; fields: FieldDef[];
}

export interface CategoryDef { key: string; label: string; short: string; icon: string; summary: string }
export interface User { id: number; name: string; title: string; email: string; initials: string; tone: string }

export interface Meta {
  tenant: { name: string; environment: string; sourceBaseline?: string; timezone: string };
  legalEntities: Option[];
  branches: (Option & { legalEntity: string; city: string })[];
  currencies: Option[];
  categories: CategoryDef[];
  resources: ResourceDef[];
  /** Trusted directory the history, approval and audit rows refer to. It is not a list of people to act as. */
  users: User[];
  /** The signed-in host user, as the server maps them onto a Tenant Admin user. */
  currentUser?: User;
  /** True when the server resolved the actor from the host session (never from a client header). */
  hostManagedIdentity?: boolean;
  /** True for the fictional demonstration data set. */
  demo?: boolean;
}

export type Status =
  | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "RETIRED" | "SUPERSEDED" | "ACTIVE" | "INACTIVE";

export type RecordData = Record<string, any>;

export interface RecordDto {
  id: number; code: string; name: string; status: Status; rowVersion: number; revision: number;
  parentId: number | null; effectiveFrom: string | null; effectiveUntil: string | null;
  data: RecordData; changeReason: string | null; decisionReason: string | null;
  createdBy: number; createdAt: string; updatedBy: number; updatedAt: string;
  submittedBy: number | null; submittedAt: string | null; decidedBy: number | null; decidedAt: string | null;
  refLabels?: Record<string, string>;
  revisions?: { id: number; revision: number; status: Status; effective_from: string | null; decided_at: string | null }[];
}

export interface ListResult { rows: RecordDto[]; total: number; page: number; pageSize: number; counts: Record<string, number> }

export interface AuditEvent {
  id: number; at: string; actorId: number; resource: string; recordId: number | null;
  recordCode: string | null; action: string; summary: string; reason: string | null;
}

export interface RefOption { id: number; code: string; name: string; status: Status; revision: number }
