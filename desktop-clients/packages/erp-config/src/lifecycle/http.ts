/**
 * Reference HTTP adapter for contract §5 routes. The host supplies the transport
 * (normally its BFF fetch, which adds session cookies/CSRF and derives the tenant);
 * this module never chooses an origin or stores credentials. Every response body
 * passes the contract guards before the UI sees it.
 */
import {
  parseLifecycleActivation, parseLifecycleHostMetadata, parseLifecycleResolveResult, parseLifecycleResolveResults,
  parseLifecycleValidationReport, parseLifecycleVersionDetail, parseLifecycleVersionPage,
} from './guards.ts';
import { LifecycleRequestError, lifecycleErrorFrom, lifecycleFailure, type LifecycleApi, type LifecycleMutation } from './api.ts';

export interface LifecycleHttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  headers?: { get(name: string): string | null };
}
interface LifecycleHttpBase {
  /** Prefix for every route, e.g. `/bff/healthcare/lifecycle`. Default `/lifecycle`. */
  basePath?: string;
  /**
   * Header carrying the create/save change reason (e.g. `X-Change-Reason`) for hosts whose
   * command receipts require one. Not sent when unset or when the mutation has no reason.
   */
  reasonHeader?: string;
  /**
   * How the reason header value is written. `raw` (default) sends the reason verbatim, so only
   * ISO-8859-1 text without control characters can be carried. `percent-utf8` sends the ASCII form
   * `UTF-8''` + percent-encoded UTF-8 (RFC 8187 style), so any script can be carried; the host
   * decodes the prefix and applies the same decoded bounds (see `lifecycleReasonHeaderValue`).
   */
  reasonEncoding?: LifecycleReasonEncoding;
  /**
   * Path (relative to basePath) of an event-type resolution route. The wire contract defines
   * the request but no route, so it is only enabled when the host names one.
   */
  resolveEventPath?: string;
}
export type LifecycleHttpOptions = LifecycleHttpBase & (
  /** Fetch-like transport returning a Response. */
  | { request: (path: string, init: RequestInit) => Promise<LifecycleHttpResponse>; send?: never }
  /**
   * Transport that decodes JSON itself and throws on failure (for example a host `request<T>()`
   * throwing `ApiError {status, body}`); thrown errors are mapped with `lifecycleErrorFrom`.
   */
  | { send: (path: string, init: RequestInit) => Promise<unknown>; request?: never }
);

export type LifecycleReasonEncoding = 'raw' | 'percent-utf8';
/** Decoded change reasons are limited to 1000 UTF-16 characters (and 1500 UTF-8 bytes when percent-encoded). */
export const LIFECYCLE_REASON_MAX = 1000;
export const LIFECYCLE_REASON_MAX_UTF8_BYTES = 1500;
/** Prefix marking a percent-encoded UTF-8 reason header value. */
export const LIFECYCLE_REASON_UTF8_PREFIX = "UTF-8''";
/** C0, DEL and C1 controls (the same set as Java `Character.isISOControl`). */
const control = (c: number) => c < 0x20 || (c >= 0x7f && c < 0xa0);
/** Raw header values must be ISO-8859-1 without control characters and at most 1000 characters. */
export function lifecycleReasonTransmittable(reason: string) {
  return reason.length <= LIFECYCLE_REASON_MAX && [...reason].every(ch => { const c = ch.codePointAt(0)!; return c <= 0xff && !control(c); });
}
/**
 * Header value for a trimmed change reason, or the failure code explaining why it cannot be sent.
 * `percent-utf8`: `UTF-8''` + `encodeURIComponent(reason)` (pure ASCII, at most 4507 characters);
 * the decoded reason must be well-formed Unicode without controls, <= 1000 characters and <= 1500 UTF-8 bytes.
 */
export function lifecycleReasonHeaderValue(reason: string, encoding: LifecycleReasonEncoding = 'raw'):
  { ok: true; value: string } | { ok: false; code: 'REASON_NOT_TRANSMITTABLE' | 'REASON_TOO_LONG' | 'REASON_INVALID_CHARACTERS' } {
  if (encoding === 'raw') return lifecycleReasonTransmittable(reason) ? { ok: true, value: reason } : { ok: false, code: 'REASON_NOT_TRANSMITTABLE' };
  let encoded: string;
  try { encoded = encodeURIComponent(reason); } catch { return { ok: false, code: 'REASON_INVALID_CHARACTERS' }; } // lone surrogate
  if ([...reason].some(ch => control(ch.codePointAt(0)!))) return { ok: false, code: 'REASON_INVALID_CHARACTERS' };
  if (reason.length > LIFECYCLE_REASON_MAX || new TextEncoder().encode(reason).length > LIFECYCLE_REASON_MAX_UTF8_BYTES) return { ok: false, code: 'REASON_TOO_LONG' };
  return { ok: true, value: LIFECYCLE_REASON_UTF8_PREFIX + encoded };
}

async function failure(response: LifecycleHttpResponse): Promise<LifecycleRequestError> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch { /* non-JSON gateway body: classified by status only */ }
  const header = response.headers?.get('x-correlation-id') ?? response.headers?.get('x-request-id') ?? undefined;
  return lifecycleFailure(response.status, typeof body.code === 'string' && body.code ? body.code : `HTTP_${response.status}`, body, header);
}

export function createLifecycleHttpApi(options: LifecycleHttpOptions): LifecycleApi {
  const base = (options.basePath ?? '/lifecycle').replace(/\/+$/, '');
  const seg = encodeURIComponent;
  const version = (code: string, v: number) => `/releases/${seg(code)}/versions/${v}`;
  async function call(method: string, path: string, body?: unknown, mutation?: LifecycleMutation, revision?: number): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (mutation) {
      headers['Idempotency-Key'] = mutation.operationKey;
      const reason = mutation.reason?.trim();
      if (options.reasonHeader && reason) {
        const header = lifecycleReasonHeaderValue(reason, options.reasonEncoding);
        if (!header.ok) throw new LifecycleRequestError({ status: 400, code: header.code });
        headers[options.reasonHeader] = header.value;
      }
    }
    if (revision !== undefined) headers['If-Match'] = `"${revision}"`;
    const init: RequestInit = {
      method, headers, credentials: 'same-origin', cache: 'no-store',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    if (options.send) {
      try { return await options.send(base + path, init); } catch (error) { throw lifecycleErrorFrom(error); }
    }
    const response = await options.request(base + path, init);
    if (!response.ok) throw await failure(response);
    return response.json();
  }
  const api: LifecycleApi = {
    async metadata() { return parseLifecycleHostMetadata(await call('GET', '/metadata')); },
    async list(query) {
      const params = new URLSearchParams();
      if (query.code) params.set('code', query.code);
      if (query.status) params.set('status', query.status);
      if (query.cursor) params.set('cursor', query.cursor);
      if (query.limit) params.set('limit', String(query.limit));
      const qs = params.toString();
      return parseLifecycleVersionPage(await call('GET', `/releases${qs ? `?${qs}` : ''}`));
    },
    async detail(code, v) { return parseLifecycleVersionDetail(await call('GET', version(code, v))); },
    async createDraft(request, mutation) { return parseLifecycleVersionDetail(await call('POST', '/drafts', request, mutation)); },
    async saveDraft(request, mutation) {
      return parseLifecycleVersionDetail(await call('PUT', version(request.code, request.version), request, mutation, request.expectedRevision));
    },
    async approve(request, mutation) {
      return parseLifecycleVersionDetail(await call('POST', `${version(request.code, request.version)}/approve`, request, mutation, request.expectedRevision));
    },
    async publish(request, mutation) {
      return parseLifecycleVersionDetail(await call('POST', `${version(request.code, request.version)}/publish`, request, mutation, request.expectedRevision));
    },
    async activation(code) {
      try {
        return parseLifecycleActivation(await call('GET', `/releases/${seg(code)}/activation`));
      } catch (error) {
        if (error instanceof LifecycleRequestError && error.code === 'NOT_ACTIVE') return null;
        throw error;
      }
    },
    async activate(request, mutation) {
      return parseLifecycleActivation(await call('POST', `/releases/${seg(request.code)}/activation`, request, mutation, request.expectedRevision));
    },
    async validate(definition) { return parseLifecycleValidationReport(await call('POST', '/validate', definition)); },
    async validateVersion(code, v) { return parseLifecycleValidationReport(await call('GET', `${version(code, v)}/validation`)); },
    async resolve(request) { return parseLifecycleResolveResult(await call('POST', '/resolve', request)); },
  };
  if (options.resolveEventPath) {
    const path = '/' + options.resolveEventPath.replace(/^\/+/, '');
    api.resolveEvent = async request => parseLifecycleResolveResults(await call('POST', path, request));
  }
  return api;
}
