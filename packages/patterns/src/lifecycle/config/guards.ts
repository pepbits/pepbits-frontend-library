/**
 * Runtime guards for lifecycle wire responses. A response that does not match
 * contract v1 is rejected with its JSON path rather than rendered partially:
 * an administrator must not approve or activate something the screen misread.
 * Additional unknown properties are carried through unchanged, so saving a record read from a
 * newer server never strips additive fields; unknown enum values are rejected, matching the server.
 */
import {
  LIFECYCLE_CAPTURE_MODES, LIFECYCLE_SOURCE_OPERATIONS, LIFECYCLE_TRANSFORMS, LIFECYCLE_DIMENSION_TYPES, LIFECYCLE_OPERATORS, LIFECYCLE_OUTCOMES, LIFECYCLE_SEVERITIES,
  LIFECYCLE_STATUSES, LIFECYCLE_TARGET_KINDS,
  type LifecycleActivation, type LifecycleApplicability, type LifecycleBinding, type LifecycleCandidate,
  type LifecycleConstraint, type LifecycleIssue, type LifecycleMetadata, type LifecycleReleaseDefinition,
  type LifecycleReleaseVersion, type LifecycleResolveResult, type LifecycleResolveResults, type LifecycleSlot,
  type LifecycleTarget, type LifecycleValidationReport, type LifecycleVersionDetail, type LifecycleVersionPage,
  type LifecycleVersionSummary, type LifecycleFieldMapping, type LifecycleSource, type LifecycleSourceCapabilities,
  type LifecycleSourceField, type LifecycleSourceMapping, type LifecycleSourcePage, type LifecycleSourceProvenance,
  type LifecycleSourceSummary, type LifecycleTableCapture,
} from './contract.ts';
import type { LifecycleHostCapability, LifecycleHostInfo, LifecycleMetadataResult } from './api.ts';

export class LifecycleContractError extends Error {
  readonly path: string;
  constructor(path: string, expected: string) {
    super(`Lifecycle response does not match contract v1 at ${path}: expected ${expected}`);
    this.name = 'LifecycleContractError';
    this.path = path;
  }
}

type Reader<T> = (value: unknown, path: string) => T;
type Shape<T> = { [K in keyof T]-?: Reader<T[K]> };

const fail = (path: string, expected: string): never => { throw new LifecycleContractError(path, expected); };
const str: Reader<string> = (v, p) => (typeof v === 'string' ? v : fail(p, 'string'));
const int: Reader<number> = (v, p) => (typeof v === 'number' && Number.isInteger(v) ? v : fail(p, 'integer'));
const bool: Reader<boolean> = (v, p) => (typeof v === 'boolean' ? v : fail(p, 'boolean'));
const nullable = <T>(read: Reader<T>): Reader<T | null> => (v, p) => (v === null || v === undefined ? null : read(v, p));
const optional = <T>(read: Reader<T>): Reader<T | undefined> => (v, p) => (v === undefined ? undefined : read(v, p));
const list = <T>(read: Reader<T>): Reader<T[]> => (v, p) =>
  Array.isArray(v) ? v.map((item, i) => read(item, `${p}[${i}]`)) : fail(p, 'array');
/** String → string object. Null/absent is the backend's empty map (it normalises null to `{}`). */
const stringMap: Reader<Record<string, string>> = (v, p) => {
  if (v === null || v === undefined) return {};
  if (typeof v !== 'object' || Array.isArray(v)) return fail(p, 'object');
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = str(x, `${p}.${k}`);
  return out;
};
const oneOf = <T extends string>(values: readonly T[]): Reader<T> => (v, p) =>
  (values as readonly unknown[]).includes(v) ? (v as T) : fail(p, values.join('|'));
function object<T>(shape: Shape<T>): Reader<T> {
  return (v, p) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return fail(p, 'object');
    const source = v as Record<string, unknown>, out = { ...source } as T & Record<string, unknown>;
    for (const key of Object.keys(shape) as (keyof T & string)[]) {
      const value = shape[key](source[key], `${p}.${key}`);
      if (value === undefined) delete out[key]; else out[key] = value;
    }
    return out as T;
  };
}

const target = object<LifecycleTarget>({
  kind: oneOf(LIFECYCLE_TARGET_KINDS), code: str, version: int, handler: nullable(str), states: list(str),
});
const constraint = object<LifecycleConstraint>({
  dimension: str, operator: oneOf(LIFECYCLE_OPERATORS), values: list(str), min: nullable(str), max: nullable(str),
});
const applicability = object<LifecycleApplicability>({ include: list(constraint), exclude: list(constraint) });
const binding = object<LifecycleBinding>({
  key: str, lifecycle: str, stage: str, event: nullable(str), purpose: str, priority: int, target, applicability,
});
const fieldMapping = object<LifecycleFieldMapping>({ target: str, source: str, transform: oneOf(LIFECYCLE_TRANSFORMS), values: stringMap });
const sourceMapping = object<LifecycleSourceMapping>({
  key: str,
  source: object({ application: str, source: str, release: str, revision: int, fingerprint: str }),
  capture: oneOf(LIFECYCLE_CAPTURE_MODES), operation: oneOf(LIFECYCLE_SOURCE_OPERATIONS),
  lifecycle: str, stage: str, event: str, watch: list(str), fields: list(fieldMapping), applicability,
});
const definition = object<LifecycleReleaseDefinition>({
  schemaVersion: int, application: str, code: str, version: int, label: str, description: nullable(str),
  dimensions: list(object({ code: str, label: str, type: oneOf(LIFECYCLE_DIMENSION_TYPES) })),
  stages: list(object({ key: str, label: str, description: nullable(str) })),
  events: list(object({ key: str, eventType: str, schemaVersion: int, label: str })),
  lifecycles: list(object({
    key: str, label: str, module: optional(nullable(str)), domain: optional(nullable(str)), subjectTypes: list(str), stages: list(str),
    stageEvents: list(object({ stage: str, event: str })),
  })),
  bindings: list(binding),
  sourceMappings: optional(list(sourceMapping)),
});
const releaseVersion = object<LifecycleReleaseVersion>({
  application: str, code: str, version: int, status: oneOf(LIFECYCLE_STATUSES), revision: int, checksum: str,
  approvedChecksum: nullable(str), definition, editors: list(str), createdBy: str, createdAt: str, updatedBy: str,
  updatedAt: str, approvedBy: nullable(str), approvedAt: nullable(str), approvalComment: nullable(str),
  publishedBy: nullable(str), publishedAt: nullable(str),
});
const summary = object<LifecycleVersionSummary>({
  application: str, code: str, version: int, label: str, status: oneOf(LIFECYCLE_STATUSES), revision: int,
  checksum: str, updatedAt: str, active: bool,
});
const activation = object<LifecycleActivation>({
  application: str, code: str, version: int, checksum: str, revision: int, reason: str, idempotencyKey: str,
  activatedBy: str, activatedAt: str,
});
const issue = object<LifecycleIssue>({ severity: oneOf(LIFECYCLE_SEVERITIES), code: str, path: str, message: str });
const candidate = object<LifecycleCandidate>({
  bindingKey: str, priority: int, outcome: oneOf(LIFECYCLE_OUTCOMES), reasons: list(str), missing: list(str),
});
const slot = object<LifecycleSlot>({
  purpose: str, event: nullable(str), outcome: oneOf(LIFECYCLE_OUTCOMES), bindingKey: nullable(str),
  target: nullable(target), missing: list(str), candidates: list(candidate),
});
const resolveResult = object<LifecycleResolveResult>({
  application: str, code: str, version: int, checksum: str, activationRevision: int, slots: list(slot),
});

const hostCapability = object<LifecycleHostCapability>({
  kind: str, status: str, mode: nullable(str), targets: (v, p) => (v === undefined || v === null ? [] : list(str)(v, p)), message: nullable(str),
});
const hostExecution = object<NonNullable<LifecycleHostInfo['execution']>>({
  triggerExecution: nullable(bool), eventWorkersEnabled: nullable(bool), message: nullable(str),
});
/**
 * Host metadata: either the library Metadata itself, or a host envelope
 * `{available, code, message, application, library, capabilities, execution, …}`.
 * Envelope capability/execution facts are kept so the UI can state what is actually installed.
 */
export function parseLifecycleHostMetadata(value: unknown, path = '$'): LifecycleMetadataResult {
  const body = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : fail(path, 'object');
  if (body.available === false) {
    return { available: false, code: typeof body.code === 'string' && body.code ? body.code : 'LIFECYCLE_UNAVAILABLE', message: typeof body.message === 'string' ? body.message : null };
  }
  if (!('library' in body)) return { ...parseLifecycleMetadata(body, path), available: true, host: null };
  const library = parseLifecycleMetadata(body.library, `${path}.library`);
  const host: LifecycleHostInfo = {
    application: nullable(str)(body.application, `${path}.application`),
    capabilities: body.capabilities === undefined || body.capabilities === null ? [] : list(hostCapability)(body.capabilities, `${path}.capabilities`),
    execution: nullable(hostExecution)(body.execution, `${path}.execution`),
  };
  return { ...library, available: true, host };
}

export const parseLifecycleReleaseDefinition = (v: unknown, path = '$') => definition(v, path);
export const parseLifecycleVersionPage = (v: unknown, path = '$'): LifecycleVersionPage =>
  object<LifecycleVersionPage>({ items: list(summary), nextCursor: nullable(str) })(v, path);
export const parseLifecycleVersionDetail = (v: unknown, path = '$'): LifecycleVersionDetail =>
  object<LifecycleVersionDetail>({ version: releaseVersion, activation: nullable(activation) })(v, path);
export const parseLifecycleActivation = (v: unknown, path = '$') => activation(v, path);
export const parseLifecycleIssues = (v: unknown, path = '$') => list(issue)(v, path);
export const parseLifecycleValidationReport = (v: unknown, path = '$'): LifecycleValidationReport =>
  object<LifecycleValidationReport>({ valid: bool, activatable: bool, checksum: str, issues: list(issue) })(v, path);
export const parseLifecycleResolveResult = (v: unknown, path = '$') => resolveResult(v, path);
export const parseLifecycleResolveResults = (v: unknown, path = '$'): LifecycleResolveResults =>
  object<LifecycleResolveResults>({ items: list(resolveResult) })(v, path);
export const parseLifecycleMetadata = (v: unknown, path = '$'): LifecycleMetadata =>
  object<LifecycleMetadata>({
    schemaVersion: int, targetKinds: list(oneOf(LIFECYCLE_TARGET_KINDS)),
    supportedTargetKinds: list(oneOf(LIFECYCLE_TARGET_KINDS)), dimensionTypes: list(oneOf(LIFECYCLE_DIMENSION_TYPES)),
    operators: list(oneOf(LIFECYCLE_OPERATORS)), statuses: list(oneOf(LIFECYCLE_STATUSES)),
    outcomes: list(oneOf(LIFECYCLE_OUTCOMES)), reservedDimensions: list(str),
    limits: object({
      stages: int, events: int, lifecycles: int, bindings: int, dimensions: int, constraints: int, values: int, pageSize: int,
    }),
  })(v, path);

const provenance = object<LifecycleSourceProvenance>({ release: str, revision: int, fingerprint: str });
const sourceField = object<LifecycleSourceField>({
  code: str, name: str, type: str, nullable: bool, sensitivity: str, selectable: bool, sensitive: bool, disclosable: bool,
  tableCapturable: bool, required: bool, description: str,
});
const tableCapture = object<LifecycleTableCapture>({
  operation: oneOf(LIFECYCLE_SOURCE_OPERATIONS), eventType: str, schemaVersion: int, configurationId: int, revision: int, payloadFields: list(str),
});
const sourceSummary = object<LifecycleSourceSummary>({
  application: str, code: str, name: str, description: str, provenance, captureModes: list(oneOf(LIFECYCLE_CAPTURE_MODES)), fieldCount: int,
});
/** Registry detail. Unknown capture modes, operations or transforms are rejected like other contract enums. */
export const parseLifecycleSource = (v: unknown, path = '$'): LifecycleSource => object<LifecycleSource>({
  application: str, code: str, name: str, description: str, provenance, captureModes: list(oneOf(LIFECYCLE_CAPTURE_MODES)),
  serviceOperations: list(oneOf(LIFECYCLE_SOURCE_OPERATIONS)), tableEventPrefix: nullable(str), tableCaptures: list(tableCapture),
  fields: list(sourceField),
})(v, path);
export const parseLifecycleSourcePage = (v: unknown, path = '$'): LifecycleSourcePage =>
  object<LifecycleSourcePage>({ items: list(sourceSummary), nextCursor: nullable(str) })(v, path);
export const parseLifecycleSourceCapabilities = (v: unknown, path = '$'): LifecycleSourceCapabilities =>
  object<LifecycleSourceCapabilities>({
    captureModes: list(oneOf(LIFECYCLE_CAPTURE_MODES)), operations: list(oneOf(LIFECYCLE_SOURCE_OPERATIONS)),
    transforms: list(oneOf(LIFECYCLE_TRANSFORMS)), sensitiveClasses: list(str), deniedFields: optional(list(str)), mappingLimit: int, fieldLimit: int, mapValueLimit: int,
  })(v, path);
