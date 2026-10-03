import { IDEMPOTENCY_HEADER } from "./contract";

/** Structured API failure. `problems` carries sign-off validation lists; `body` the raw payload. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public problems: string[] = [], public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
  /** Version/duplicate/signed-lock conflict: the caller's edit was NOT applied and must be preserved. */
  get isConflict() { return this.status === 409; }
}

export interface RequestOptions { signal?: AbortSignal; idempotencyKey?: string }
export interface TeleconsultClientOptions {
  /** Authenticated host fetch. Receives `/api/...`; the host transport adds namespace, scope and credentials. */
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Routing headers (role or beneficiary). The server must validate them against the authenticated user. */
  headers?: Record<string, string>;
  newKey?: () => string;
}
export interface TeleconsultClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  /** Raw authenticated fetch for callers that need a Response (never used with tokens in URLs). */
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

const MUTATING = new Set(["POST", "PUT", "PATCH"]);
const MAX_PENDING_KEYS = 64;
const defaultKey = () => globalThis.crypto?.randomUUID?.() ?? `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Path guard: only the module's own `/api` surface, no traversal or absolute URLs. */
export function assertApiPath(path: string) {
  const pathname = path.split(/[?#]/)[0];
  let invalid = !(pathname === "/api" || pathname.startsWith("/api/")) || path.startsWith("//") || /[\\\u0000-\u001f]/.test(pathname);
  try { invalid ||= pathname.split("/").some(part => part === "." || part === ".." || ["..", "."].includes(decodeURIComponent(part))); }
  catch { invalid = true; }
  if (invalid) throw new ApiError("Invalid Teleconsult API path", 0);
}

/** An outcome we cannot know, or a transient server fault: the retry must replay the same key. */
const retryable = (error: unknown) => {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status >= 500 || error.status === 408 || error.status === 429;
};

/**
 * Transport for both Teleconsult variants. One instance per mounted module/role/beneficiary: it holds no
 * module-global state, token or cache. Mutations always carry an Idempotency-Key; an identical mutation
 * (same method, path and body) that failed with an unknown outcome reuses its key so the server replays
 * rather than duplicates the booking, message or signature.
 */
export function createTeleconsultClient(options: TeleconsultClientOptions): TeleconsultClient {
  const pending = new Map<string, string>();
  const newKey = options.newKey ?? defaultKey;
  const send = (path: string, init: RequestInit = {}) => {
    assertApiPath(path);
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value);
    return options.fetch(path, {...init, headers});
  };

  async function parse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let body: unknown = null;
    if (text) { try { body = JSON.parse(text); } catch { body = undefined; } }
    if (!response.ok) {
      const record = (body ?? {}) as {error?: unknown; message?: unknown; problems?: unknown};
      const message = typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : response.statusText || `Request failed (${response.status})`;
      throw new ApiError(message, response.status, Array.isArray(record.problems) ? record.problems.map(String) : [], body);
    }
    if (body === undefined) throw new ApiError("The API returned malformed JSON", response.status);
    return body as T;
  }

  async function call<T>(method: string, path: string, body: unknown, {signal, idempotencyKey}: RequestOptions = {}): Promise<T> {
    const headers = new Headers();
    const mutating = MUTATING.has(method);
    let signature = "";
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (mutating) {
      signature = `${method} ${path} ${JSON.stringify(body ?? null)}`;
      const key = idempotencyKey ?? pending.get(signature) ?? newKey();
      pending.set(signature, key);
      if (pending.size > MAX_PENDING_KEYS) pending.delete(pending.keys().next().value as string);
      headers.set(IDEMPOTENCY_HEADER, key);
    }
    try {
      let response: Response;
      try { response = await send(path, {method, headers, signal, cache: "no-store", body: body === undefined ? undefined : JSON.stringify(body)}); }
      catch (error) {
        if ((error as {name?: string}).name === "AbortError" || error instanceof ApiError) throw error;
        throw new ApiError("Can't reach the Teleconsult API. Check your connection and try again.", 0);
      }
      const result = await parse<T>(response);
      if (mutating) pending.delete(signature);
      return result;
    } catch (error) {
      if (mutating && !retryable(error)) pending.delete(signature);
      throw error;
    }
  }

  return {
    get: (path, opts) => call("GET", path, undefined, opts),
    post: (path, body, opts) => call("POST", path, body ?? {}, opts),
    put: (path, body, opts) => call("PUT", path, body, opts),
    patch: (path, body, opts) => call("PATCH", path, body, opts),
    fetch: send,
  };
}

export const qs = (params: Record<string, unknown> = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};
