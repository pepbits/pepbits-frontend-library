/**
 * Pure lifecycle administration helpers. Nothing here evaluates applicability or
 * decides validity: the server's validate/resolve endpoints are authoritative.
 * Local checks only give immediate feedback on key formats while typing.
 */
import {
  LIFECYCLE_SCHEMA_VERSION,
  type LifecycleActivation, type LifecycleBinding, type LifecycleConstraint, type LifecycleDimensionType,
  type LifecycleOperator, type LifecycleReleaseDefinition, type LifecycleReleaseVersion, type LifecycleStatus,
  type LifecycleVersionSummary, type LifecycleSourceMapping,
} from './contract.ts';

export const LIFECYCLE_KEY_PATTERNS = {
  /** Release code and lifecycle/dimension/binding/purpose keys. */
  code: /^[a-z][a-z0-9-]{0,63}$/,
  /** Stage and event keys. */
  key: /^[A-Z][A-Z0-9_]{0,63}$/,
  /** Target code, handler and workflow states. */
  target: /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/,
} as const;
export type LifecycleKeyFormat = keyof typeof LIFECYCLE_KEY_PATTERNS;
export const lifecycleKeyValid = (format: LifecycleKeyFormat, value: string) => LIFECYCLE_KEY_PATTERNS[format].test(value);
/** `<application>.` followed by dot-separated lowercase segments. */
export function lifecycleEventTypeValid(application: string, eventType: string) {
  return eventType.startsWith(application + '.') && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(eventType);
}
export const lifecycleEventTypeSuggestion = (application: string, code: string, eventKey: string) =>
  [application, code, eventKey.toLowerCase().replaceAll('_', '-')].filter(Boolean).join('.');

export function emptyLifecycleDefinition(application: string, code: string, label: string): LifecycleReleaseDefinition {
  return {
    schemaVersion: LIFECYCLE_SCHEMA_VERSION, application, code, version: 1, label, description: null,
    dimensions: [], stages: [], events: [], lifecycles: [], bindings: [],
  };
}
/** Copy a stored version as the content of the next draft. The server assigns the real version number. */
export const nextLifecycleDraft = (source: LifecycleReleaseDefinition): LifecycleReleaseDefinition =>
  ({ ...structuredClone(source), version: source.version + 1 });

/** Deterministic JSON (sorted object keys, array order kept) for dirty checks and operation fingerprints. */
export function canonicalLifecycleJson(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map(k => [k, sort((v as Record<string, unknown>)[k])]))
      : v;
  return JSON.stringify(sort(value));
}
/** An absent `sourceMappings` and an empty list are the same content (the server omits both from the checksum). */
const withoutEmptyMappings = (d: LifecycleReleaseDefinition | null) => {
  if (!d || d.sourceMappings?.length) return d;
  const { sourceMappings: _omit, ...rest } = d;
  return rest;
};
export const sameLifecycleDefinition = (a: LifecycleReleaseDefinition | null, b: LifecycleReleaseDefinition | null) =>
  canonicalLifecycleJson(withoutEmptyMappings(a)) === canonicalLifecycleJson(withoutEmptyMappings(b));

/**
 * Stable operation keys: retrying the same operation with the same payload reuses
 * its key so the host's idempotent command replays instead of repeating; any change
 * to the payload issues a fresh key. Keys match `[A-Za-z0-9:_.-]{1,70}`.
 */
export function createLifecycleOperationKeys(random: () => string = () => crypto.randomUUID()) {
  const keys = new Map<string, { fingerprint: string; key: string }>();
  return {
    key(operation: string, payload: unknown): string {
      const fingerprint = canonicalLifecycleJson(payload), current = keys.get(operation);
      if (current?.fingerprint === fingerprint) return current.key;
      const key = `lifecycle:${random()}`;
      keys.set(operation, { fingerprint, key });
      return key;
    },
    /** Forget a completed operation so a deliberate repeat is a new command. */
    complete(operation: string) { keys.delete(operation); },
    clear() { keys.clear(); },
  };
}
export type LifecycleOperationKeys = ReturnType<typeof createLifecycleOperationKeys>;

/** Host-supplied permission hints. They only shape the UI; the server authorises every call. */
export interface LifecyclePermissions {
  read: boolean;
  edit: boolean;
  approve: boolean;
  publish: boolean;
  activate: boolean;
  resolve: boolean;
  /** Source registry reads (source contract v1). Defaults to `read` when a source port is supplied. */
  sources?: boolean;
}
export type LifecycleAction = 'save' | 'approve' | 'publish' | 'activate' | 'createNext';
export interface LifecycleActionState { allowed: boolean; reason: string | null }
/**
 * Governance gating from contract rules. `reason` is a message key explaining a disabled
 * action. Independent approval is only hinted when the host supplies the actor id.
 */
export function lifecycleActionState(action: LifecycleAction, input: {
  version: LifecycleReleaseVersion | null;
  permissions: LifecyclePermissions;
  dirty: boolean;
  actorId?: string | null;
  activation?: LifecycleActivation | null;
}): LifecycleActionState {
  const { version, permissions, dirty } = input, deny = (reason: string) => ({ allowed: false, reason });
  const status: LifecycleStatus | null = version?.status ?? null;
  switch (action) {
    case 'save':
      if (!permissions.edit) return deny('lifecycle.reason.noEdit');
      if (status === 'PUBLISHED') return deny('lifecycle.reason.immutable');
      if (!dirty) return deny('lifecycle.reason.noChanges');
      return { allowed: true, reason: null };
    case 'approve':
      if (!permissions.approve) return deny('lifecycle.reason.noApprove');
      if (!version || status !== 'DRAFT') return deny('lifecycle.reason.approveDraftOnly');
      if (dirty) return deny('lifecycle.reason.saveFirst');
      if (input.actorId && version.editors.includes(input.actorId)) return deny('lifecycle.reason.independent');
      return { allowed: true, reason: null };
    case 'publish':
      if (!permissions.publish) return deny('lifecycle.reason.noPublish');
      if (!version || status !== 'APPROVED') return deny('lifecycle.reason.publishApprovedOnly');
      if (dirty) return deny('lifecycle.reason.saveFirst');
      if (version.approvedChecksum !== version.checksum) return deny('lifecycle.reason.checksumChanged');
      return { allowed: true, reason: null };
    case 'activate':
      if (!permissions.activate) return deny('lifecycle.reason.noActivate');
      if (!version || status !== 'PUBLISHED') return deny('lifecycle.reason.activatePublishedOnly');
      if (input.activation?.version === version.version && input.activation.checksum === version.checksum)
        return deny('lifecycle.reason.alreadyActive');
      return { allowed: true, reason: null };
    case 'createNext':
      if (!permissions.edit) return deny('lifecycle.reason.noEdit');
      if (!version || status !== 'PUBLISHED') return deny('lifecycle.reason.nextFromPublished');
      return { allowed: true, reason: null };
  }
}

/** Operators the contract permits for a dimension. `organisation` uses IN (self) or WITHIN (path). */
export function lifecycleOperatorsFor(dimension: string, type: LifecycleDimensionType | null): LifecycleOperator[] {
  if (dimension === 'organisation') return ['IN', 'WITHIN'];
  if (type === 'NUMBER' || type === 'DATE') return ['IN', 'RANGE'];
  return ['IN'];
}
export const emptyLifecycleConstraint = (dimension: string, operator: LifecycleOperator = 'IN'): LifecycleConstraint =>
  ({ dimension, operator, values: [], min: null, max: null });

type Keyed = 'stages' | 'events' | 'lifecycles' | 'dimensions';
/** Rename a key and every reference to it so an edit never leaves dangling references behind. */
export function renameLifecycleKey(definition: LifecycleReleaseDefinition, kind: Keyed, from: string, to: string): LifecycleReleaseDefinition {
  const d = structuredClone(definition), swap = (v: string) => (v === from ? to : v);
  const constraints = <T extends { applicability: LifecycleBinding['applicability'] }>(b: T, fn: (c: LifecycleConstraint) => LifecycleConstraint): T =>
    ({ ...b, applicability: { include: b.applicability.include.map(fn), exclude: b.applicability.exclude.map(fn) } });
  /** Source mappings follow the same references; the property is only touched when present. */
  const mappings = (fn: (m: LifecycleSourceMapping) => LifecycleSourceMapping) => { if (d.sourceMappings) d.sourceMappings = d.sourceMappings.map(fn); };
  if (kind === 'stages') {
    d.stages = d.stages.map(s => (s.key === from ? { ...s, key: to } : s));
    d.lifecycles = d.lifecycles.map(l => ({ ...l, stages: l.stages.map(swap), stageEvents: l.stageEvents.map(m => ({ ...m, stage: swap(m.stage) })) }));
    d.bindings = d.bindings.map(b => ({ ...b, stage: swap(b.stage) }));
    mappings(m => ({ ...m, stage: swap(m.stage) }));
  } else if (kind === 'events') {
    d.events = d.events.map(e => (e.key === from ? { ...e, key: to } : e));
    d.lifecycles = d.lifecycles.map(l => ({ ...l, stageEvents: l.stageEvents.map(m => ({ ...m, event: swap(m.event) })) }));
    d.bindings = d.bindings.map(b => ({ ...b, event: b.event === null ? null : swap(b.event) }));
    mappings(m => ({ ...m, event: swap(m.event) }));
  } else if (kind === 'lifecycles') {
    d.lifecycles = d.lifecycles.map(l => (l.key === from ? { ...l, key: to } : l));
    d.bindings = d.bindings.map(b => ({ ...b, lifecycle: swap(b.lifecycle) }));
    mappings(m => ({ ...m, lifecycle: swap(m.lifecycle) }));
  } else {
    d.dimensions = d.dimensions.map(x => (x.code === from ? { ...x, code: to } : x));
    d.bindings = d.bindings.map(b => constraints(b, c => ({ ...c, dimension: swap(c.dimension) })));
    mappings(m => constraints(m, c => ({ ...c, dimension: swap(c.dimension) })));
  }
  return d;
}
/** Bindings (and lifecycle mappings) that still reference a key; removal is blocked while any exist. */
export function lifecycleReferences(definition: LifecycleReleaseDefinition, kind: Keyed, key: string): string[] {
  const refs: string[] = [];
  definition.bindings.forEach(b => {
    const uses = kind === 'stages' ? b.stage === key : kind === 'events' ? b.event === key : kind === 'lifecycles' ? b.lifecycle === key
      : [...b.applicability.include, ...b.applicability.exclude].some(c => c.dimension === key);
    if (uses) refs.push(`bindings:${b.key}`);
  });
  (definition.sourceMappings ?? []).forEach(m => {
    const uses = kind === 'stages' ? m.stage === key : kind === 'events' ? m.event === key : kind === 'lifecycles' ? m.lifecycle === key
      : [...m.applicability.include, ...m.applicability.exclude].some(c => c.dimension === key);
    if (uses) refs.push(`sourceMappings:${m.key}`);
  });
  if (kind === 'stages' || kind === 'events') definition.lifecycles.forEach(l => {
    if (kind === 'stages' ? l.stages.includes(key) : l.stageEvents.some(m => m.event === key)) refs.push(`lifecycles:${l.key}`);
  });
  return refs;
}
/** Events explicitly mapped to a stage in a lifecycle. Bindings may only use these. */
export const lifecycleMappedEvents = (definition: LifecycleReleaseDefinition, lifecycle: string, stage: string) =>
  definition.lifecycles.find(l => l.key === lifecycle)?.stageEvents.filter(m => m.stage === stage).map(m => m.event) ?? [];

export interface LifecycleDifference {
  section: 'definition' | Keyed | 'bindings' | 'sourceMappings';
  key: string;
  kind: 'added' | 'removed' | 'changed';
  fields: string[];
  before: unknown;
  after: unknown;
}
/** Structural comparison by stable key, so reordering alone is reported as a change of order, not add/remove. */
export function diffLifecycleDefinitions(before: LifecycleReleaseDefinition, after: LifecycleReleaseDefinition): LifecycleDifference[] {
  const out: LifecycleDifference[] = [];
  const header = (d: LifecycleReleaseDefinition) => ({ label: d.label, description: d.description, schemaVersion: d.schemaVersion });
  const compare = (section: LifecycleDifference['section'], key: string, a: unknown, b: unknown) => {
    if (a === undefined && b === undefined) return;
    if (a === undefined) out.push({ section, key, kind: 'added', fields: [], before: a, after: b });
    else if (b === undefined) out.push({ section, key, kind: 'removed', fields: [], before: a, after: b });
    else {
      const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
      const fields = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(f => canonicalLifecycleJson(x[f]) !== canonicalLifecycleJson(y[f]));
      if (fields.length) out.push({ section, key, kind: 'changed', fields, before: a, after: b });
    }
  };
  compare('definition', 'definition', header(before), header(after));
  const sections: [Exclude<LifecycleDifference['section'], 'definition'>, (item: never) => string][] = [
    ['dimensions', (d: { code: string }) => d.code], ['stages', (s: { key: string }) => s.key], ['events', (e: { key: string }) => e.key],
    ['lifecycles', (l: { key: string }) => l.key], ['bindings', (b: { key: string }) => b.key],
    ['sourceMappings', (m: { key: string }) => m.key],
  ];
  for (const [section, id] of sections) {
    const index = (items: unknown[]) => new Map(items.map((item, order) => [id(item as never), { ...(item as object), order }]));
    const a = index(before[section] ?? []), b = index(after[section] ?? []);
    for (const key of new Set([...a.keys(), ...b.keys()])) compare(section, key, a.get(key), b.get(key));
  }
  return out;
}

/** Map a server issue path such as `bindings[2].target.code` to the editor item it concerns. */
export function lifecycleIssueTarget(definition: LifecycleReleaseDefinition, path: string): { section: string; key: string | null } {
  const match = /^(?:\$\.|definition\.)?(dimensions|stages|events|lifecycles|bindings|sourceMappings)\[(\d+)\]/.exec(path);
  if (!match) return { section: 'overview', key: null };
  const section = match[1] as Keyed | 'bindings' | 'sourceMappings', item = (definition[section] ?? [])[Number(match[2])] as { key?: string; code?: string } | undefined;
  return { section, key: item ? item.key ?? item.code ?? null : null };
}

export interface LifecycleCatalogueGroup { code: string; label: string }
export interface LifecycleClassification { module: LifecycleCatalogueGroup; domain: LifecycleCatalogueGroup }
export type LifecycleCatalogueNodeKind = 'application' | 'module' | 'domain' | 'definition' | 'lifecycle' | 'stage' | 'event';
export interface LifecycleCatalogueNode {
  id: string;
  kind: LifecycleCatalogueNodeKind;
  label: string;
  /** Stable code/key shown alongside the translated label. */
  code: string;
  summary?: LifecycleVersionSummary;
  /** Set on module/domain groups built from the open definition's lifecycles (release code). */
  definition?: string;
  children: LifecycleCatalogueNode[];
}
/**
 * Navigation projection Application → Module → Domain → Definition → Module → Domain → Lifecycle → Stage → Event.
 * Definition-level module/domain come only from the optional host classifier; definitions it does
 * not classify sit directly under the application (no synthetic grouping). Lifecycle-level groups
 * come only from the open (already loaded) definition's optional `module`/`domain` codes, so no extra
 * request is made per summary; lifecycles without them sit directly under their definition.
 */
export function lifecycleCatalogueTree(input: {
  application: LifecycleCatalogueGroup;
  summaries: LifecycleVersionSummary[];
  classify?: (summary: LifecycleVersionSummary) => LifecycleClassification | null | undefined;
  open?: LifecycleReleaseDefinition | null;
}): LifecycleCatalogueNode {
  const latest = new Map<string, LifecycleVersionSummary>();
  for (const s of input.summaries) {
    const current = latest.get(s.code);
    if (!current || s.version > current.version) latest.set(s.code, s);
  }
  const root: LifecycleCatalogueNode = { id: 'application', kind: 'application', label: input.application.label, code: input.application.code, children: [] };
  const child = (parent: LifecycleCatalogueNode, kind: LifecycleCatalogueNodeKind, group: LifecycleCatalogueGroup, definition?: string) => {
    const id = `${parent.id}/${kind}:${group.code}`;
    let node = parent.children.find(c => c.id === id);
    if (!node) parent.children.push(node = { id, kind, label: group.label, code: group.code, ...(definition ? { definition } : {}), children: [] });
    return node;
  };
  for (const summary of [...latest.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    const c = input.classify?.(summary);
    const parent = c ? child(child(root, 'module', c.module), 'domain', c.domain) : root;
    const node: LifecycleCatalogueNode = { id: `definition:${summary.code}`, kind: 'definition', label: summary.label, code: summary.code, summary, children: [] };
    const open = input.open?.code === summary.code ? input.open : null;
    if (open) for (const l of open.lifecycles) {
      let group = node;
      if (l.module) group = child(group, 'module', { code: l.module, label: l.module }, summary.code);
      if (l.domain) group = child(group, 'domain', { code: l.domain, label: l.domain }, summary.code);
      group.children.push({
        id: `lifecycle:${summary.code}:${l.key}`, kind: 'lifecycle', label: l.label, code: l.key,
        children: l.stages.map(stageKey => ({
          id: `stage:${summary.code}:${l.key}:${stageKey}`, kind: 'stage' as const, code: stageKey,
          label: open.stages.find(s => s.key === stageKey)?.label ?? stageKey,
          children: l.stageEvents.filter(m => m.stage === stageKey).map(m => ({
            id: `event:${summary.code}:${l.key}:${stageKey}:${m.event}`, kind: 'event' as const, code: m.event,
            label: open.events.find(e => e.key === m.event)?.label ?? m.event, children: [],
          })),
        })),
      });
    }
    parent.children.push(node);
  }
  return root;
}

/** Short, non-security display form of a checksum. The full value remains available for copying. */
export const shortLifecycleChecksum = (checksum: string) => (checksum.length > 12 ? checksum.slice(0, 12) : checksum);
