/**
 * Host port consumed by the lifecycle administration UI. Any implementation works;
 * `createLifecycleHttpApi` is the reference adapter over contract §5 routes.
 * Tenant and application scope come from the host's verified session, never from here.
 */
import type {
  LifecycleActivateRequest, LifecycleActivation, LifecycleCreateDraftRequest, LifecycleEventResolveRequest,
  LifecycleIssue, LifecycleListQuery, LifecycleMetadata, LifecycleReleaseDefinition, LifecycleResolveRequest,
  LifecycleResolveResult, LifecycleResolveResults, LifecycleSaveDraftRequest, LifecycleTransitionRequest,
  LifecycleValidationReport, LifecycleVersionDetail, LifecycleVersionPage, LifecycleSource, LifecycleSourceCapabilities,
  LifecycleSourceListQuery, LifecycleSourcePage,
} from './contract.ts';
import { parseLifecycleIssues } from './guards.ts';

/**
 * Identity of one mutation. The same key is reused when the same payload is retried.
 * `reason` is the change reason for create/save (hosts may require it); approve/publish/activate
 * carry their comment/reason in the request body.
 */
export interface LifecycleMutation { operationKey: string; reason?: string }
/** A host that has not enabled lifecycle administration (or its schema) answers explicitly. */
export interface LifecycleUnavailable { available: false; code: string; message: string | null }
/** Host-reported installation facts (optional envelope fields). Text is host-authored and not localised. */
export interface LifecycleHostCapability { kind: string; status: string; mode: string | null; targets: string[]; message: string | null }
export interface LifecycleHostInfo {
  application: string | null;
  capabilities: LifecycleHostCapability[];
  execution: { triggerExecution: boolean | null; eventWorkersEnabled: boolean | null; message: string | null } | null;
}
export type LifecycleMetadataResult = (LifecycleMetadata & { available: true; host: LifecycleHostInfo | null }) | LifecycleUnavailable;

export interface LifecycleApi {
  metadata(): Promise<LifecycleMetadataResult>;
  list(query: LifecycleListQuery): Promise<LifecycleVersionPage>;
  detail(code: string, version: number): Promise<LifecycleVersionDetail>;
  createDraft(request: LifecycleCreateDraftRequest, mutation: LifecycleMutation): Promise<LifecycleVersionDetail>;
  saveDraft(request: LifecycleSaveDraftRequest, mutation: LifecycleMutation): Promise<LifecycleVersionDetail>;
  approve(request: LifecycleTransitionRequest, mutation: LifecycleMutation): Promise<LifecycleVersionDetail>;
  publish(request: LifecycleTransitionRequest, mutation: LifecycleMutation): Promise<LifecycleVersionDetail>;
  /** Current activation for a code, or null when nothing is active (server NOT_ACTIVE). */
  activation(code: string): Promise<LifecycleActivation | null>;
  activate(request: LifecycleActivateRequest, mutation: LifecycleMutation): Promise<LifecycleActivation>;
  /** Read-only validation of unsaved editor content. */
  validate(definition: LifecycleReleaseDefinition): Promise<LifecycleValidationReport>;
  validateVersion(code: string, version: number): Promise<LifecycleValidationReport>;
  /** Read-only preview; never executes a handler. */
  resolve(request: LifecycleResolveRequest): Promise<LifecycleResolveResult>;
  /** Optional: hosts that expose event-type resolution. The UI hides the option otherwise. */
  resolveEvent?(request: LifecycleEventResolveRequest): Promise<LifecycleResolveResults>;
}

export type LifecycleSourceCapabilitiesResult = (LifecycleSourceCapabilities & { available: true }) | LifecycleUnavailable;
/**
 * Optional host port for the application source registry (source contract v1 §6). Read-only: every
 * source, field and capture fact comes from the host's pinned source metadata; the browser never names a
 * table, column or SQL. Mapping edits are saved through the normal `LifecycleApi` draft commands.
 */
export interface LifecycleSourceApi {
  capabilities(): Promise<LifecycleSourceCapabilitiesResult>;
  /** Bounded, cursor-paged summaries of the active pinned release (limit 1..100; 0 = server default). */
  list(query: LifecycleSourceListQuery): Promise<LifecycleSourcePage>;
  source(code: string): Promise<LifecycleSource>;
}

/**
 * Failure raised by an adapter. `status` feeds the shared recovery classification;
 * `code` is the library code without the `LIFECYCLE_` prefix (host codes are kept verbatim).
 */
export class LifecycleRequestError extends Error {
  readonly status: number | undefined;
  readonly code: string;
  readonly issues: LifecycleIssue[];
  readonly reference: string | undefined;
  constructor(input: { status?: number; code: string; message?: string; issues?: LifecycleIssue[]; reference?: string }) {
    super(input.message || input.code);
    this.name = 'LifecycleRequestError';
    this.status = input.status;
    this.code = input.code.replace(/^LIFECYCLE_(?!NOT_ENABLED$|SCHEMA_NOT_READY$|UNAVAILABLE$)/, '');
    this.issues = input.issues ?? [];
    this.reference = input.reference;
  }
}
/**
 * Converts an error thrown by a host transport that decodes JSON itself (for example an ApiError
 * with `status` and parsed `body`) into a LifecycleRequestError. Other errors are returned unchanged.
 */
export function lifecycleErrorFrom(error: unknown): unknown {
  if (error instanceof LifecycleRequestError || typeof error !== 'object' || error === null) return error;
  const e = error as { status?: unknown; code?: unknown; message?: unknown; body?: unknown };
  if (typeof e.status !== 'number') return error;
  const body = typeof e.body === 'object' && e.body !== null ? (e.body as Record<string, unknown>) : {};
  const code = typeof body.code === 'string' && body.code ? body.code : typeof e.code === 'string' && e.code ? e.code : `HTTP_${e.status}`;
  return lifecycleFailure(e.status, code, body);
}
/** Builds the typed failure from a decoded error body `{code, message, issues|details, reference|correlationId}`. */
export function lifecycleFailure(status: number, code: string, body: Record<string, unknown>, headerReference?: string): LifecycleRequestError {
  let issues: LifecycleIssue[] = [];
  for (const candidate of [body.issues, body.details]) {
    if (candidate === undefined) continue;
    try { issues = parseLifecycleIssues(candidate); break; } catch { /* not lifecycle issues */ }
  }
  const reference = [body.reference, body.correlationId, headerReference].find((v): v is string => typeof v === 'string' && /^[A-Za-z0-9-]{1,80}$/.test(v));
  return new LifecycleRequestError({ status, code, message: typeof body.message === 'string' ? body.message : undefined, issues, reference });
}

/** Host readiness codes that mean "not enabled here", as opposed to a transient outage. */
export const LIFECYCLE_UNAVAILABLE_CODES = ['LIFECYCLE_NOT_ENABLED', 'LIFECYCLE_SCHEMA_NOT_READY'] as const;
export const isLifecycleUnavailable = (error: unknown) =>
  error instanceof LifecycleRequestError && (LIFECYCLE_UNAVAILABLE_CODES as readonly string[]).includes(error.code);
