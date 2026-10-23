export type FieldType =
  | 'text' | 'code' | 'person' | 'company' | 'email' | 'phone'
  | 'date' | 'time' | 'number' | 'currency' | 'percent'
  | 'status' | 'select' | 'boolean' | 'city' | 'country'
  | 'textarea' | 'ref';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** Hydrated suggestion list (lookupKind 'pool'). */
  pool?: string[];
  ref?: string;
  required?: boolean;
  list?: boolean;
  filter?: boolean;
  group?: string;
  span?: 1 | 2 | 3 | 4;
  readOnly?: boolean;
  primary?: boolean;
  secondary?: boolean;
  /** Value list served by GET /api/lookups: `options` (choice list) or `pool` (suggestions). */
  lookupKind?: 'options' | 'pool';
}

export type TemplateKey =
  | 'grid' | 'dependent' | 'tree' | 'profile' | 'structure' | 'rate'
  | 'document' | 'voucher' | 'request' | 'booking' | 'matrix' | 'checklist'
  | 'case' | 'process' | 'report' | 'ledger' | 'print' | 'dashboard'
  | 'settings' | 'inbox';

export type Section = 'workspace' | 'masters' | 'transactions' | 'reports' | 'setup';

export interface PageDef {
  slug: string;
  section: Section;
  group: string;
  title: string;
  description: string;
  icon: string;
  template: TemplateKey;
  entity: string;
  fields: Field[];
  /** true when the page reads another page's data instead of owning it */
  view?: boolean;
  quickFilter?: string;
  statusFlow?: string[];
  lines?: { fields: Field[]; min?: number; max?: number; label?: string };
  parent?: { key: string; entity: string; label: string };
  matrix?: { kind: 'attendance' | 'hours' | 'marks'; values?: string[]; columns?: string[] };
  checks?: { parameter: string; spec: string }[];
  /** Hydrated from GET /api/lookups. */
  resources?: string[];
  params?: Field[];
  sections?: { title: string; description: string; fields: Field[] }[];
  /** Hydrated from GET /api/lookups. */
  balances?: { label: string; total: number; used: number }[];
  steps?: string[];
  /** Approver names for request pages, hydrated from GET /api/lookups. */
  approvers?: string[];
}

export type Row = Record<string, any> & { id: string };

export interface ListResponse {
  rows: Row[];
  total: number;
  page: number;
  size: number;
  facets: Record<string, number>;
  totals: Record<string, number>;
}

export type Filters = Record<string, unknown>;
