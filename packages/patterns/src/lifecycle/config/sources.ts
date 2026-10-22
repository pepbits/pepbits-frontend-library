/**
 * Pure source-mapping helpers (source contract v1). Options offered to an editor come only from the host's
 * source registry and the open definition; local checks give immediate feedback and never replace the
 * server's validation, which remains authoritative (issue codes below mirror contract §5).
 */
import type {
  LifecycleCaptureMode, LifecycleFieldMapping, LifecycleReleaseDefinition, LifecycleSource, LifecycleSourceCapabilities,
  LifecycleSourceField, LifecycleSourceMapping, LifecycleSourceOperation, LifecycleSourceRef, LifecycleTableCapture,
  LifecycleTransform,
} from './contract.ts';
import { lifecycleKeyValid } from './model.ts';

/** EventPulse catalogue field-name grammar used for payload destinations. */
export const LIFECYCLE_PAYLOAD_TARGET_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
/** Columns never mapped: tenancy is carried by the event envelope. Hosts may list more in `deniedFields`. */
export const LIFECYCLE_DENIED_SOURCE_FIELDS = ['tenant_id'] as const;
export const lifecycleDeniedFields = (capabilities?: LifecycleSourceCapabilities | null): readonly string[] =>
  capabilities?.deniedFields ?? LIFECYCLE_DENIED_SOURCE_FIELDS;
/**
 * Destinations the server refuses (`RESERVED_FIELD`): envelope identity names and object prototype members.
 * The prototype member names of the running engine are added so consumers can never be confused either.
 */
export const LIFECYCLE_RESERVED_PAYLOAD_TARGETS: readonly string[] = [...new Set([
  'constructor', 'prototype', '__proto__', 'tenantId', 'tenant_id', 'eventId', 'applicationId', 'eventType', 'schemaVersion',
  'entityType', 'entityId', 'entityVersion', 'occurredAt', 'provenance', 'format', 'hasOwnProperty', 'toString', 'valueOf',
  ...Object.getOwnPropertyNames(Object.prototype),
])];
const RESERVED_TARGETS = new Set(LIFECYCLE_RESERVED_PAYLOAD_TARGETS);
export const lifecyclePayloadTargetReserved = (target: string) => RESERVED_TARGETS.has(target);

/** Registry value types whose text may be trimmed, case-folded or mapped. */
const TEXT_TYPES = ['text', 'country', 'decision'];
const DATE_TYPES = ['instant', 'date'];

/** The only way the UI creates a source reference: from a registry entry and its current pin. */
export const lifecycleSourceRef = (source: LifecycleSource): LifecycleSourceRef => ({
  application: source.application, source: source.code, release: source.provenance.release,
  revision: source.provenance.revision, fingerprint: source.provenance.fingerprint,
});
/** True when the mapping is pinned to exactly the registry's current release, revision and fingerprint. */
export const lifecycleSourcePinCurrent = (ref: LifecycleSourceRef, source: LifecycleSource) =>
  ref.application === source.application && ref.source === source.code && ref.release === source.provenance.release
  && ref.revision === source.provenance.revision && ref.fingerprint === source.provenance.fingerprint;

export const lifecycleSourceCaptureModes = (source: LifecycleSource, capabilities: LifecycleSourceCapabilities): LifecycleCaptureMode[] =>
  source.captureModes.filter(m => capabilities.captureModes.includes(m));
/** SERVICE: operations the host declares its business code captures. TABLE: active governed trigger captures. */
export function lifecycleSourceOperations(source: LifecycleSource, capture: LifecycleCaptureMode, capabilities: LifecycleSourceCapabilities): LifecycleSourceOperation[] {
  const offered = capture === 'SERVICE' ? source.serviceOperations : source.tableCaptures.map(c => c.operation);
  return [...new Set(offered)].filter(o => capabilities.operations.includes(o));
}
export const lifecycleTableCapture = (source: LifecycleSource, operation: LifecycleSourceOperation): LifecycleTableCapture | null =>
  source.tableCaptures.find(c => c.operation === operation) ?? null;

export interface LifecycleSourceSlot { lifecycle: string; stage: string; event: string }
export const lifecycleSourceSlotId = (s: LifecycleSourceSlot) => `${s.lifecycle}/${s.stage}/${s.event}`;
/**
 * Declared lifecycle stage/event pairs a mapping may target. A TABLE mapping may only name the row-change
 * event its active trigger capture emits (same event type and schema version).
 */
export function lifecycleSourceSlots(definition: LifecycleReleaseDefinition, capture: LifecycleCaptureMode, table: LifecycleTableCapture | null): LifecycleSourceSlot[] {
  const slots: LifecycleSourceSlot[] = [];
  for (const l of definition.lifecycles) for (const m of l.stageEvents) {
    if (!l.stages.includes(m.stage)) continue;
    if (capture === 'TABLE') {
      const event = definition.events.find(e => e.key === m.event);
      if (!table || !event || event.eventType !== table.eventType || event.schemaVersion !== table.schemaVersion) continue;
    }
    slots.push({ lifecycle: l.key, stage: m.stage, event: m.event });
  }
  return slots;
}

/**
 * Fields that may be mapped for this capture (contract v1.2 §3a). Denied fields never. SERVICE: selectable fields.
 * TABLE: table-capturable columns in the active capture's payload; disclosure then follows the governed trigger.
 */
export function lifecycleSourceFields(source: LifecycleSource, capture: LifecycleCaptureMode, table: LifecycleTableCapture | null,
  capabilities?: LifecycleSourceCapabilities | null): LifecycleSourceField[] {
  const denied = lifecycleDeniedFields(capabilities);
  return source.fields.filter(f => !denied.includes(f.name)
    && (capture === 'SERVICE' ? f.selectable : f.tableCapturable && !!table?.payloadFields.includes(f.name)));
}
/** Denied columns a TABLE capture supplies itself (for example `tenant_id`); shown, never mapped. */
export const lifecycleTableSuppliedFields = (table: LifecycleTableCapture | null, capabilities?: LifecycleSourceCapabilities | null) =>
  table ? lifecycleDeniedFields(capabilities).filter(name => table.payloadFields.includes(name)) : [];
/**
 * Allowlisted transforms for a field. SERVICE: a value that may not be disclosed can only be mapped as PRESENT.
 * TABLE: only a same-name COPY of what the governed trigger already captures.
 */
export function lifecycleTransformsFor(field: LifecycleSourceField, capabilities: LifecycleSourceCapabilities, capture: LifecycleCaptureMode = 'SERVICE'): LifecycleTransform[] {
  const allowed: LifecycleTransform[] = capture === 'TABLE' ? ['COPY'] : !field.disclosable ? ['PRESENT']
    : TEXT_TYPES.includes(field.type) ? ['COPY', 'TRIM', 'LOWERCASE', 'UPPERCASE', 'PRESENT', 'MAP']
      : DATE_TYPES.includes(field.type) ? ['COPY', 'PRESENT', 'DATE'] : ['COPY', 'PRESENT'];
  return allowed.filter(t => capabilities.transforms.includes(t));
}
/** Value type a transform produces, for payload previews (never a value). */
export function lifecyclePayloadType(field: LifecycleSourceField | undefined, transform: LifecycleTransform): string {
  if (transform === 'PRESENT') return 'bool';
  if (transform === 'DATE') return 'date';
  if (transform === 'COPY') return field?.type ?? 'unknown';
  return 'text';
}

/** New mapping pinned to the registry entry, targeting the first valid slot and supported operation. */
export function emptyLifecycleSourceMapping(definition: LifecycleReleaseDefinition, source: LifecycleSource,
  capabilities: LifecycleSourceCapabilities, key: string): LifecycleSourceMapping {
  const modes = lifecycleSourceCaptureModes(source, capabilities);
  const capture = modes.find(m => lifecycleSourceOperations(source, m, capabilities).length) ?? modes[0] ?? 'SERVICE';
  const operation = lifecycleSourceOperations(source, capture, capabilities)[0] ?? 'CREATED';
  const slot = lifecycleSourceSlots(definition, capture, lifecycleTableCapture(source, operation))[0];
  return {
    key, source: lifecycleSourceRef(source), capture, operation,
    lifecycle: slot?.lifecycle ?? '', stage: slot?.stage ?? '', event: slot?.event ?? '',
    watch: [], fields: [], applicability: { include: [], exclude: [] },
  };
}
/** Re-pin to the registry's current release. Field names are kept; checks then report any that no longer qualify. */
export const repinLifecycleSourceMapping = (mapping: LifecycleSourceMapping, source: LifecycleSource): LifecycleSourceMapping =>
  ({ ...mapping, source: lifecycleSourceRef(source) });
export const emptyLifecycleFieldMapping = (field: LifecycleSourceField, capabilities: LifecycleSourceCapabilities, target: string,
  capture: LifecycleCaptureMode = 'SERVICE'): LifecycleFieldMapping =>
  capture === 'TABLE' ? { target: field.name, source: field.name, transform: 'COPY', values: {} }
    : { target, source: field.name, transform: lifecycleTransformsFor(field, capabilities)[0] ?? 'PRESENT', values: {} };
/** Suggested camelCase destination for a physical column name; the administrator can change it. */
export function lifecyclePayloadTargetSuggestion(column: string, taken: string[]): string {
  const base = column.replace(/_+([a-z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/^[^A-Za-z]+/, '') || 'field';
  let target = base.slice(0, 64);
  for (let i = 2; taken.includes(target) || lifecyclePayloadTargetReserved(target); i++) target = `${base.slice(0, 60)}${i}`;
  return target;
}

/** MAP source and payload values: 1..256 characters, not blank, no control characters (server rule). */
export const lifecycleMapValueValid = (value: string) =>
  value.trim().length > 0 && value.length <= 256 && ![...value].some(ch => { const c = ch.codePointAt(0)!; return c < 0x20 || (c >= 0x7f && c < 0xa0); });

export interface LifecycleSourceProblem {
  /** Path relative to the mapping, e.g. `fields[1].transform` (server paths prefix `sourceMappings[i].`). */
  path: string;
  /** Contract issue code (contract §5 and the server validator). */
  code: string;
}
/**
 * Immediate local checks for one mapping. `source`/`capabilities` are optional: without the registry only
 * structural checks run. Server validation (and activation verification) remains authoritative.
 */
export function lifecycleSourceMappingProblems(input: {
  definition: LifecycleReleaseDefinition;
  mapping: LifecycleSourceMapping;
  source?: LifecycleSource | null;
  capabilities?: LifecycleSourceCapabilities | null;
}): LifecycleSourceProblem[] {
  const { definition, mapping: m, source, capabilities } = input, out: LifecycleSourceProblem[] = [];
  const add = (path: string, code: string) => out.push({ path, code });
  if (!lifecycleKeyValid('code', m.key)) add('key', 'INVALID_FORMAT');
  else if ((definition.sourceMappings ?? []).filter(x => x.key === m.key).length > 1) add('key', 'DUPLICATE_KEY');
  if (m.source.application !== definition.application) add('source.application', 'NAMESPACE_MISMATCH');
  const lifecycle = definition.lifecycles.find(l => l.key === m.lifecycle);
  if (!m.lifecycle || !m.stage || !m.event) add('event', 'REQUIRED');
  else if (!lifecycle) add('lifecycle', 'UNKNOWN_LIFECYCLE');
  else if (!lifecycle.stages.includes(m.stage)) add('stage', 'STAGE_NOT_IN_LIFECYCLE');
  else if (!lifecycle.stageEvents.some(x => x.stage === m.stage && x.event === m.event)) add('event', 'EVENT_NOT_MAPPED');
  if (m.operation !== 'UPDATED' && m.watch.length) add('watch', 'INVALID_WATCH');
  if (!m.fields.length) add('fields', 'REQUIRED');
  if (capabilities && m.fields.length > capabilities.fieldLimit) add('fields', 'LIMIT_EXCEEDED');
  const targets = new Map<string, number>();
  m.fields.forEach(f => targets.set(f.target, (targets.get(f.target) ?? 0) + 1));
  m.fields.forEach((f, i) => {
    if (!LIFECYCLE_PAYLOAD_TARGET_PATTERN.test(f.target)) add(`fields[${i}].target`, f.target ? 'INVALID_FORMAT' : 'REQUIRED');
    else if (lifecyclePayloadTargetReserved(f.target)) add(`fields[${i}].target`, 'RESERVED_FIELD');
    else if ((targets.get(f.target) ?? 0) > 1) add(`fields[${i}].target`, 'DUPLICATE_KEY');
    if (lifecycleDeniedFields(capabilities).includes(f.source)) add(`fields[${i}].source`, 'DENIED_FIELD');
    const entries = Object.keys(f.values).length;
    if (f.transform === 'MAP' ? entries === 0 : entries > 0) add(`fields[${i}].values`, 'INVALID_TRANSFORM');
    if (f.transform === 'MAP' && entries > (capabilities?.mapValueLimit ?? 64)) add(`fields[${i}].values`, 'LIMIT_EXCEEDED');
    else if (f.transform === 'MAP' && Object.entries(f.values).some(([from, to]) => !lifecycleMapValueValid(from) || !lifecycleMapValueValid(to)))
      add(`fields[${i}].values`, 'INVALID_TRANSFORM');
  });
  if (!source || !capabilities) return out;

  if (source.code !== m.source.source) return out;
  if (!lifecycleSourcePinCurrent(m.source, source)) add('source', 'SOURCE_VERSION_MISMATCH');
  if (!lifecycleSourceCaptureModes(source, capabilities).includes(m.capture) || !lifecycleSourceOperations(source, m.capture, capabilities).includes(m.operation))
    add('operation', 'CAPTURE_NOT_SUPPORTED');
  const table = m.capture === 'TABLE' ? lifecycleTableCapture(source, m.operation) : null;
  if (m.capture === 'TABLE' && m.event && !lifecycleSourceSlots(definition, 'TABLE', table).some(s => s.lifecycle === m.lifecycle && s.stage === m.stage && s.event === m.event))
    add('event', 'TABLE_EVENT_MISMATCH');
  const allowed = lifecycleSourceFields(source, m.capture, table, capabilities);
  const known = (name: string) => source.fields.find(f => f.name === name);
  m.watch.forEach((name, i) => { if (!known(name)?.selectable) add(`watch[${i}]`, 'INVALID_WATCH'); });
  m.fields.forEach((f, i) => {
    const field = known(f.source);
    if (!field) { add(`fields[${i}].source`, 'UNKNOWN_SOURCE_FIELD'); return; }
    if (lifecycleDeniedFields(capabilities).includes(field.name) || (m.capture === 'SERVICE' && !field.selectable)) { add(`fields[${i}].source`, 'FIELD_NOT_SELECTABLE'); return; }
    if (!allowed.includes(field)) { add(`fields[${i}].source`, 'TABLE_FIELD_MISMATCH'); return; }
    if (m.capture === 'TABLE') {
      if (f.transform !== 'COPY') add(`fields[${i}].transform`, 'TABLE_FIELD_MISMATCH');
      else if (f.target !== f.source) add(`fields[${i}].target`, 'TABLE_FIELD_MISMATCH');
      return;
    }
    if (!lifecycleTransformsFor(field, capabilities).includes(f.transform))
      add(`fields[${i}].transform`, !field.disclosable && f.transform !== 'PRESENT' ? 'SENSITIVE_FIELD' : 'INVALID_TRANSFORM');
  });
  return out;
}
