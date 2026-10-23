export type FieldType =
  | "text" | "textarea" | "number" | "decimal" | "money" | "percent" | "date"
  | "boolean" | "select" | "multiselect" | "tags" | "ref" | "lines";
export type Tone = "info" | "progress" | "attention" | "success" | "danger" | "muted";
export type Option = { value: string; label: string; group?: string };

export interface FieldDef {
  key: string; label: string; type: FieldType; required?: boolean; options?: Option[]; source?: string; help?: string;
  list?: boolean; readonly?: boolean; min?: number; max?: number; span?: 1 | 2; upper?: boolean; columns?: FieldDef[];
  placeholder?: string; maxItems?: number;
}
export interface ActionDef {
  key: string; label: string; from: string[]; to: string; tone: "primary" | "approve" | "danger" | "attention" | "quiet";
  independent?: boolean; reason?: "required" | "optional"; inputs?: FieldDef[]; hint?: string;
}
export interface KpiDef { label: string; metric: "count" | "amount" | "balance"; statuses?: string[]; overdue?: boolean; today?: boolean; tone?: Tone }
export interface StatusDef { key: string; label: string; tone: Tone }
export interface ResourceDef {
  key: string; label: string; singular: string; category: string; icon: string; summary: string;
  layout: "queue" | "board" | "ledger" | "monitor"; prefix: string; create: boolean; editable: string[]; initial: string;
  statuses: StatusDef[]; path: string[]; board?: string[]; fields: FieldDef[]; actions: ActionDef[]; kpis: KpiDef[];
  titleField?: string; document?: boolean; amountLabel?: string; balanceLabel?: string; dueLabel?: string;
}
export interface PageDef { key: string; label: string; icon: string; href: string; kind: "dashboard" | "resource"; summary: string }
export interface CategoryDef { key: string; label: string; short: string; icon: string; summary: string; pages: PageDef[] }
export interface User { id: number; name: string; title: string; email: string; initials: string; tone: string; homeBranch: string | null }
export interface Branch { value: string; label: string; short: string; currency: string }

/**
 * `GET /meta`. The registry (categories, resources, branches) is the source's own; `currentUser` and `hostManagedIdentity` are added
 * by the host-integrated backend. `users` is the directory that history, approval and audit rows refer to, not a list to switch between.
 */
export interface Meta {
  tenant: { name: string; environment: string; sourceBaseline: string; timezone: string };
  branches: Branch[]; categories: CategoryDef[]; resources: ResourceDef[]; users: User[];
  currentUser?: User; hostManagedIdentity?: boolean; demo?: boolean;
}

export interface TimelineEvent { id: number; at: string; actorId: number; action: string; from: string | null; to: string | null; summary: string; reason: string | null }
export interface RecordDto {
  id: number; ref: string; status: string; title: string; currency: string;
  patient: { id: number; name: string; mrn: string } | null; branch: string | null;
  amount: number; balance: number; dueDate: string | null; assignee: number | null; priority: string | null;
  values: Record<string, any>; labels: Record<string, string>; rowVersion: number;
  createdBy: number; createdAt: string; updatedBy: number; updatedAt: string; statusBy: number; statusAt: string; reason: string | null;
  timeline?: TimelineEvent[];
}
export interface Kpi { label: string; metric: "count" | "amount" | "balance"; tone: Tone | null; value: number; count: number; statuses: string[] | null; overdue: boolean }
export interface ListResult { rows: RecordDto[]; total: number; page: number; pageSize: number; counts: Record<string, number>; kpis: Kpi[] }
export interface OptionItem { value: string; label: string; hint?: string }

export interface ApprovalItem {
  resource: string; resourceLabel: string; category: string; icon: string; id: number; ref: string; title: string; status: string; statusLabel: string;
  patient: string | null; amount: number; currency: string; requestedBy: number; requestedAt: string; createdBy: number; rowVersion: number; reason: string | null;
  actions: { key: string; label: string; tone: ActionDef["tone"]; reason: "required" | "optional" | null; inputs: FieldDef[] | null }[];
  canDecide: boolean;
}

export interface Home {
  cashToday: { value: number; count: number }; trend: { date: string; value: number }[];
  outstanding: number; deniedValue: number; deniedCount: number; exchangeFailures: number; approvals: number;
  queues: { label: string; href: string; icon: string; count: number; value: number | null; category: string }[];
  drawers: { id: number; ref: string; cashier: string; status: string; branch: string; expected: number; currency: string }[];
}
export interface Aging {
  buckets: string[]; totals: number[]; total: number; daysInAr: number; over90Share: number;
  parties: { party: string; kind: string; buckets: number[]; total: number; invoices: number }[];
  oldest: { id: number; ref: string; age: number; balance: number; currency: string; party: string; patient: string | null }[];
}
export interface Reports {
  series: { month: string; billed: number; collected: number }[];
  kpis: { billed: number; collected: number; collectionRate: number; denialRate: number; daysInAr: number; outstanding: number };
  denials: { reason: string; count: number; value: number }[];
  methods: { method: string; value: number }[];
  payers: { payer: string; value: number }[];
}
