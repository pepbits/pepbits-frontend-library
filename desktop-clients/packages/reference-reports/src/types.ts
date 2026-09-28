// Source copy of lumen-reports src/lib/types.ts (domain model). Pure types and constants; no server code.
// Core domain model for the reporting workspace.

export const ACTIONS = ['view', 'print', 'export_csv', 'export_xlsx', 'export_json', 'email', 'schedule', 'api'] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<Action, string> = {
  view: 'View',
  print: 'Print',
  export_csv: 'CSV',
  export_xlsx: 'Excel',
  export_json: 'JSON',
  email: 'Email',
  schedule: 'Schedule',
  api: 'API / BI',
};

export const PERMISSIONS = [
  'admin.users',
  'admin.access',
  'admin.settings',
  'admin.sources',
  'audit.view',
  'reports.build',
  'reports.share',
  'dashboards.edit',
  'data.unmask',
  'schedules.manage_all',
  'api.keys',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'admin.users': 'Manage users',
  'admin.access': 'Manage roles and report access',
  'admin.settings': 'Change system settings',
  'admin.sources': 'View and manage data sources',
  'audit.view': 'View audit log and outbox',
  'reports.build': 'Build custom reports',
  'reports.share': 'Share custom reports with roles',
  'dashboards.edit': 'Create and edit dashboards',
  'data.unmask': 'See sensitive columns unmasked',
  'schedules.manage_all': "Manage everyone's schedules",
  'api.keys': 'Create API keys for BI tools',
};

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  system?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleIds: string[];
  /** Branch IDs the user may see. ['*'] means all branches. */
  branchIds: string[];
  passwordHash: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export type PublicUser = Omit<User, 'passwordHash'> & { permissions: Permission[]; isAdmin: boolean };

export interface Grant {
  roleId: string;
  reportId: string;
  actions: Action[];
}

export type ColumnType = 'string' | 'integer' | 'number' | 'currency' | 'percent' | 'date';
export type Aggregate = 'sum' | 'count' | 'avg' | 'min' | 'max';

export interface DatasetField {
  key: string;
  label: string;
  type: ColumnType;
  sensitive?: boolean;
  /** How the field can be filtered in the builder and viewer. */
  filter?: 'select' | 'text';
  /** Known values for select filters. */
  options?: string[];
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  domain: string;
  sourceId: string;
  dateField: string;
  branchField?: string;
  fields: DatasetField[];
}

export interface ReportColumn {
  /** Output key in result rows. */
  key: string;
  label: string;
  type: ColumnType;
  /** Source dataset field; defaults to key. */
  field?: string;
  aggregate?: Aggregate;
  /** Safe arithmetic expression over other column keys, e.g. "denied / submitted * 100". */
  expression?: string;
  sensitive?: boolean;
}

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'last_12_months'
  | 'last_3_years'
  | 'last_5_years'
  | 'last_10_years'
  | 'custom';

export interface DateRangeValue {
  preset: DatePreset;
  from?: string;
  to?: string;
}

export type FilterValue = string | string[] | DateRangeValue;
export type FilterValues = Record<string, FilterValue | undefined>;

export interface FilterDef {
  key: string;
  label: string;
  type: 'daterange' | 'select' | 'multiselect' | 'text';
  field: string;
  default?: FilterValue;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'donut' | 'none';
  x?: string;
  y?: string[];
}

export interface ReportPolicy {
  /** Largest date range (days) that may be loaded on screen. Beyond this, the report runs in the background. */
  maxOnlineRangeDays: number;
  /** Largest estimated row count allowed on screen. */
  maxOnlineRows: number;
  /** Seconds to cache identical on-screen results. 0 disables. */
  cacheTtlSec: number;
}

export type OutputFormat = 'csv' | 'xlsx' | 'json';

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  datasetId: string;
  columns: ReportColumn[];
  defaultColumns: string[];
  groupBy: string[];
  filters: FilterDef[];
  sort?: SortSpec;
  chart: ChartConfig;
  policy?: Partial<ReportPolicy>;
  tags: string[];
  kind: 'system' | 'custom';
  ownerId?: string;
  visibility: 'private' | 'roles' | 'everyone';
  sharedRoleIds: string[];
  version: number;
  updatedAt: string;
}

export interface SortSpec {
  key: string;
  dir: 'asc' | 'desc';
}

export interface SavedView {
  id: string;
  reportId: string;
  name: string;
  columns: string[];
  filters: FilterValues;
  sort?: SortSpec;
  scope: 'user' | 'role';
  ownerId: string;
  roleId?: string;
  isDefault: boolean;
  createdAt: string;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface Job {
  id: string;
  userId: string;
  reportId: string;
  reportTitle: string;
  filters: FilterValues;
  columns: string[];
  sort?: SortSpec;
  format: OutputFormat;
  deliver: 'download' | 'email';
  recipients: string[];
  origin: 'screen' | 'schedule' | 'email_in' | 'api';
  scheduleId?: string;
  status: JobStatus;
  progress: number;
  chunksDone: number;
  chunksTotal: number;
  rowCount: number;
  resultBytes?: number;
  outputFile?: string;
  error?: string;
  deliveryNote?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  expiresAt?: string;
  cancelRequested?: boolean;
}

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface Schedule {
  id: string;
  name: string;
  ownerId: string;
  reportId: string;
  viewId?: string;
  columns: string[];
  filters: FilterValues;
  format: OutputFormat;
  recipients: string[];
  frequency: Frequency;
  /** 1 = Monday … 7 = Sunday */
  dayOfWeek: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
  timezone: string;
  endDate?: string;
  active: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  lastStatus?: string;
  createdAt: string;
}

export interface Occurrence {
  id: string;
  scheduleId: string;
  scheduledAt: string;
  status: 'queued' | 'completed' | 'failed' | 'skipped';
  jobId?: string;
  note?: string;
  createdAt: string;
}

export type WidgetKind = 'bar' | 'line' | 'donut' | 'table' | 'kpi';

export interface Widget {
  id: string;
  reportId: string;
  title: string;
  kind: WidgetKind;
  size: 'sm' | 'md' | 'lg';
  /** For KPI widgets: the column total to display. */
  kpiColumn?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  visibility: 'private' | 'roles' | 'everyone';
  sharedRoleIds: string[];
  widgets: Widget[];
  dateRange: DateRangeValue;
  updatedAt: string;
}

export interface Settings {
  orgName: string;
  timezone: string;
  locale: string;
  currency: string;
  maxOnlineRangeDays: number;
  maxOnlineRows: number;
  defaultPageSize: number;
  maxAttachmentMb: number;
  resultRetentionHours: number;
  maxActiveJobsPerUser: number;
  maxConcurrentJobs: number;
  allowedRecipientDomains: string[];
  apiMaxRows: number;
  emailIn: {
    enabled: boolean;
    mailbox: string;
    requireAuthPass: boolean;
    maxPerHour: number;
  };
}

export interface AuditEntry {
  id: string;
  at: string;
  userId?: string;
  userEmail?: string;
  action: string;
  target?: string;
  detail?: string;
}

export interface OutboxMessage {
  id: string;
  at: string;
  to: string[];
  subject: string;
  text: string;
  attachments: { filename: string; bytes: number }[];
  status: 'sent' | 'failed' | 'not_sent';
  error?: string;
  jobId?: string;
}

export interface InboundLog {
  id: string;
  at: string;
  from: string;
  subject: string;
  status: 'accepted' | 'rejected';
  reason: string;
  userId?: string;
  jobId?: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  hash: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface Favorite {
  userId: string;
  reportId: string;
}

export interface StoreData {
  schemaVersion: number;
  roles: Role[];
  users: User[];
  grants: Grant[];
  customReports: ReportDefinition[];
  views: SavedView[];
  jobs: Job[];
  schedules: Schedule[];
  occurrences: Occurrence[];
  dashboards: Dashboard[];
  settings: Settings;
  audit: AuditEntry[];
  outbox: OutboxMessage[];
  inbound: InboundLog[];
  apiKeys: ApiKey[];
  favorites: Favorite[];
}

export interface ResultColumn {
  key: string;
  label: string;
  type: ColumnType;
  masked?: boolean;
}

export type Row = Record<string, string | number | null>;

export interface ChartData {
  type: ChartConfig['type'];
  labels: string[];
  series: { key: string; label: string; values: number[] }[];
}

export interface RunResult {
  columns: ResultColumn[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  totals: Row;
  chart: ChartData | null;
  meta: {
    from: string;
    to: string;
    rangeDays: number;
    executedAt: string;
    durationMs: number;
    cached: boolean;
    maskedColumns: string[];
    scopedBranches: string[] | null;
    freshness: string;
  };
}
