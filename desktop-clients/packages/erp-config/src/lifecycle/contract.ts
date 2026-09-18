/**
 * Shared lifecycle wire contract v1 (backend `com.pepbits.lifecycle.api.Lifecycle`).
 * Property names are the wire names. Nullable fields are `T | null`, never optional,
 * because the backend always serialises them. Lists are never null in responses.
 */
export const LIFECYCLE_SCHEMA_VERSION = 1;
export const LIFECYCLE_DIMENSION_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE'] as const;
export const LIFECYCLE_TARGET_KINDS = ['FORM', 'WORKFLOW', 'ASSESSMENT', 'NOTIFICATION', 'INTEGRATION', 'RULE', 'ACTION'] as const;
export const LIFECYCLE_OPERATORS = ['IN', 'WITHIN', 'RANGE'] as const;
export const LIFECYCLE_STATUSES = ['DRAFT', 'APPROVED', 'PUBLISHED'] as const;
export const LIFECYCLE_OUTCOMES = ['MATCH', 'NO_MATCH', 'UNKNOWN'] as const;
export const LIFECYCLE_SEVERITIES = ['ERROR', 'WARNING'] as const;
/** Source capture (source contract v1, backend `Lifecycle.CaptureMode`/`SourceOperation`/`Transform`). */
export const LIFECYCLE_CAPTURE_MODES = ['SERVICE', 'TABLE'] as const;
export const LIFECYCLE_SOURCE_OPERATIONS = ['CREATED', 'UPDATED', 'RETIRED', 'DELETED'] as const;
export const LIFECYCLE_TRANSFORMS = ['COPY', 'TRIM', 'LOWERCASE', 'UPPERCASE', 'PRESENT', 'DATE', 'MAP'] as const;
/** Reserved dimension codes evaluated from host-verified context, not definition dimensions. */
export const LIFECYCLE_RESERVED_DIMENSIONS = ['organisation', 'subject-type'] as const;

export type LifecycleDimensionType = (typeof LIFECYCLE_DIMENSION_TYPES)[number];
export type LifecycleTargetKind = (typeof LIFECYCLE_TARGET_KINDS)[number];
export type LifecycleOperator = (typeof LIFECYCLE_OPERATORS)[number];
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
export type LifecycleOutcome = (typeof LIFECYCLE_OUTCOMES)[number];
export type LifecycleSeverity = (typeof LIFECYCLE_SEVERITIES)[number];
export type LifecycleCaptureMode = (typeof LIFECYCLE_CAPTURE_MODES)[number];
export type LifecycleSourceOperation = (typeof LIFECYCLE_SOURCE_OPERATIONS)[number];
export type LifecycleTransform = (typeof LIFECYCLE_TRANSFORMS)[number];

export interface LifecycleDimension { code: string; label: string; type: LifecycleDimensionType }
export interface LifecycleStage { key: string; label: string; description: string | null }
export interface LifecycleEvent { key: string; eventType: string; schemaVersion: number; label: string }
export interface LifecycleStageEvent { stage: string; event: string }
export interface LifecycleGraph {
  key: string;
  label: string;
  /** Optional catalogue taxonomy when the server supplies it; never invented by the UI. */
  module?: string | null;
  domain?: string | null;
  subjectTypes: string[];
  stages: string[];
  stageEvents: LifecycleStageEvent[];
}
export interface LifecycleConstraint {
  dimension: string;
  operator: LifecycleOperator;
  values: string[];
  min: string | null;
  max: string | null;
}
export interface LifecycleApplicability { include: LifecycleConstraint[]; exclude: LifecycleConstraint[] }
export interface LifecycleTarget {
  kind: LifecycleTargetKind;
  code: string;
  version: number;
  handler: string | null;
  /** Only WORKFLOW targets may list workflow states. */
  states: string[];
}
export interface LifecycleBinding {
  key: string;
  lifecycle: string;
  stage: string;
  /** null = stage-level binding; otherwise the event must be mapped to the stage. */
  event: string | null;
  purpose: string;
  priority: number;
  target: LifecycleTarget;
  applicability: LifecycleApplicability;
}
/**
 * Exact pinned source provenance: application-owned source (source metadata table code), imported source
 * release, the tenant's pin revision and the release fingerprint. Built only from a registry `LifecycleSource`.
 */
export interface LifecycleSourceRef { application: string; source: string; release: string; revision: number; fingerprint: string }
/** `target` is an EventPulse catalogue field name; `source` a physical column name. `values` is used by MAP only. */
export interface LifecycleFieldMapping { target: string; source: string; transform: LifecycleTransform; values: Record<string, string> }
/** One source operation mapped to one declared stage/event pair of a lifecycle. */
export interface LifecycleSourceMapping {
  key: string;
  source: LifecycleSourceRef;
  capture: LifecycleCaptureMode;
  operation: LifecycleSourceOperation;
  lifecycle: string;
  stage: string;
  event: string;
  /** UPDATED only: capture when one of these source fields changed; empty = every update. */
  watch: string[];
  fields: LifecycleFieldMapping[];
  applicability: LifecycleApplicability;
}
export interface LifecycleReleaseDefinition {
  schemaVersion: number;
  application: string;
  code: string;
  version: number;
  label: string;
  description: string | null;
  dimensions: LifecycleDimension[];
  stages: LifecycleStage[];
  events: LifecycleEvent[];
  lifecycles: LifecycleGraph[];
  bindings: LifecycleBinding[];
  /**
   * Source mappings (source contract v1). Optional: hosts without source support omit it and the UI never adds
   * the property unless a mapping is authored, so mapping-free definitions keep their original wire shape.
   */
  sourceMappings?: LifecycleSourceMapping[];
}

export interface LifecycleReleaseVersion {
  application: string;
  code: string;
  version: number;
  status: LifecycleStatus;
  revision: number;
  checksum: string;
  approvedChecksum: string | null;
  definition: LifecycleReleaseDefinition;
  editors: string[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalComment: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
}
export interface LifecycleVersionSummary {
  application: string;
  code: string;
  version: number;
  label: string;
  status: LifecycleStatus;
  revision: number;
  checksum: string;
  updatedAt: string;
  active: boolean;
}
export interface LifecycleVersionPage { items: LifecycleVersionSummary[]; nextCursor: string | null }
export interface LifecycleActivation {
  application: string;
  code: string;
  version: number;
  checksum: string;
  revision: number;
  reason: string;
  idempotencyKey: string;
  activatedBy: string;
  activatedAt: string;
}
export interface LifecycleVersionDetail { version: LifecycleReleaseVersion; activation: LifecycleActivation | null }

export interface LifecycleListQuery {
  code: string | null;
  status: LifecycleStatus | null;
  cursor: string | null;
  /** 1..100; 0 means the server default (25). */
  limit: number;
}
export interface LifecycleCreateDraftRequest { definition: LifecycleReleaseDefinition }
export interface LifecycleSaveDraftRequest {
  code: string;
  version: number;
  expectedRevision: number;
  definition: LifecycleReleaseDefinition;
}
export interface LifecycleTransitionRequest { code: string; version: number; expectedRevision: number; comment: string | null }
export interface LifecycleActivateRequest {
  code: string;
  version: number;
  /** Current activation revision for the code, 0 when nothing is active. */
  expectedRevision: number;
  reason: string;
  idempotencyKey: string;
}

export interface LifecycleIssue { severity: LifecycleSeverity; code: string; path: string; message: string }
export interface LifecycleValidationReport {
  valid: boolean;
  activatable: boolean;
  checksum: string;
  issues: LifecycleIssue[];
}

export interface LifecycleOrganisationRef { type: string; id: string }
export type LifecycleAttributeValue = string | number | boolean | Array<string | number | boolean>;
export interface LifecycleResolveContext {
  subjectType: string | null;
  subjectId: string | null;
  /** Self first, then ancestors. Hosts must verify the path; the browser value is a preview input only. */
  organisation: LifecycleOrganisationRef[];
  attributes: Record<string, LifecycleAttributeValue>;
}
export interface LifecycleResolveRequest {
  code: string;
  /** null resolves the active version; a number previews that stored version. */
  version: number | null;
  lifecycle: string;
  stage: string;
  event: string | null;
  purpose: string | null;
  context: LifecycleResolveContext;
}
export interface LifecycleCandidate {
  bindingKey: string;
  priority: number;
  outcome: LifecycleOutcome;
  reasons: string[];
  missing: string[];
}
export interface LifecycleSlot {
  purpose: string;
  event: string | null;
  outcome: LifecycleOutcome;
  bindingKey: string | null;
  target: LifecycleTarget | null;
  missing: string[];
  candidates: LifecycleCandidate[];
}
export interface LifecycleResolveResult {
  application: string;
  code: string;
  version: number;
  checksum: string;
  /** 0 for an explicit-version preview. */
  activationRevision: number;
  slots: LifecycleSlot[];
}
export interface LifecycleEventResolveRequest {
  code: string;
  eventType: string;
  schemaVersion: number;
  context: LifecycleResolveContext;
}
export interface LifecycleResolveResults { items: LifecycleResolveResult[] }

export interface LifecycleLimits {
  stages: number;
  events: number;
  lifecycles: number;
  bindings: number;
  dimensions: number;
  constraints: number;
  values: number;
  pageSize: number;
}
export interface LifecycleMetadata {
  schemaVersion: number;
  targetKinds: LifecycleTargetKind[];
  /** Target kinds with a host-registered verifier. Others cannot be activated. */
  supportedTargetKinds: LifecycleTargetKind[];
  dimensionTypes: LifecycleDimensionType[];
  operators: LifecycleOperator[];
  statuses: LifecycleStatus[];
  outcomes: LifecycleOutcome[];
  reservedDimensions: string[];
  limits: LifecycleLimits;
}

/** Library failure codes (`LIFECYCLE_<CODE>` on the server; hosts may send either form). */
export const LIFECYCLE_ERROR_CODES = [
  'INVALID_REQUEST', 'INVALID_DEFINITION', 'NOT_FOUND', 'NOT_ACTIVE', 'CONFLICT', 'IMMUTABLE',
  'INDEPENDENT_APPROVAL_REQUIRED', 'UNSUPPORTED_CAPABILITY', 'FORBIDDEN', 'LIMIT_EXCEEDED',
  'STORAGE_FAILURE', 'INTEGRITY_FAILURE',
] as const;
export type LifecycleErrorCode = (typeof LIFECYCLE_ERROR_CODES)[number];

/* Source registry (backend `LifecycleSources`): schema metadata only, never row values. */
export interface LifecycleSourceProvenance { release: string; revision: number; fingerprint: string }
export interface LifecycleSourceField {
  code: string;
  /** Physical column name; mappings, watch lists and runtime values use this name. */
  name: string;
  type: string;
  nullable: boolean;
  sensitivity: string;
  /** Event-selectable and not denied (tenant_id, SECRET, json/object). */
  selectable: boolean;
  sensitive: boolean;
  /** Value may be copied; otherwise only PRESENT is permitted. */
  disclosable: boolean;
  /** Allowed by the registered table-capture target. */
  tableCapturable: boolean;
  required: boolean;
  description: string;
}
export interface LifecycleTableCapture {
  operation: LifecycleSourceOperation;
  eventType: string;
  schemaVersion: number;
  configurationId: number;
  revision: number;
  payloadFields: string[];
}
export interface LifecycleSource {
  application: string;
  code: string;
  name: string;
  description: string;
  provenance: LifecycleSourceProvenance;
  captureModes: LifecycleCaptureMode[];
  /** Operations whose business code the host declares calls SERVICE capture. */
  serviceOperations: LifecycleSourceOperation[];
  tableEventPrefix: string | null;
  /** Active governed trigger captures only. */
  tableCaptures: LifecycleTableCapture[];
  fields: LifecycleSourceField[];
}
export interface LifecycleSourceSummary {
  application: string;
  code: string;
  name: string;
  description: string;
  provenance: LifecycleSourceProvenance;
  captureModes: LifecycleCaptureMode[];
  fieldCount: number;
}
export interface LifecycleSourcePage { items: LifecycleSourceSummary[]; nextCursor: string | null }
export interface LifecycleSourceCapabilities {
  captureModes: LifecycleCaptureMode[];
  operations: LifecycleSourceOperation[];
  transforms: LifecycleTransform[];
  sensitiveClasses: string[];
  /** Columns never mapped by users (v1.2, e.g. `tenant_id`); absent from older hosts. */
  deniedFields?: string[];
  mappingLimit: number;
  fieldLimit: number;
  mapValueLimit: number;
}
export interface LifecycleSourceListQuery { cursor: string | null; limit: number }
