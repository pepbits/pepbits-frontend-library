import {ApiFailure} from '@pepbits/platform/http';

/** A structured scheduling API failure. `detail` carries server alternatives, for example nearest free times. */
export class CaregridFailure extends ApiFailure {
  constructor(status: number, message: string, public detail?: unknown) {super(status, message);}
}
export interface CaregridRequestInit {method?: string; body?: unknown; signal?: AbortSignal}
export interface CaregridClient {
  readonly baseUrl: string;
  /** Server-Sent Events stream URL; a live notification channel only, never the source of truth. */
  readonly eventsUrl: string;
  request<T>(path: string, init?: CaregridRequestInit): Promise<T>;
}
const invalid = (path: string) => {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f#]/.test(path)) return true;
  try {return path.split('?')[0]!.split('/').some(part => ['.', '..'].includes(decodeURIComponent(part)) || /[\\/]/.test(decodeURIComponent(part)));}
  catch {return true;}
};
/**
 * Configured transport for the unchanged CareGrid scheduling API. The base URL is host
 * configuration (for example `/caregrid-api` or `http://localhost:4000/api`). No bearer
 * token is attached: the scheduling API is unauthenticated demo infrastructure, so UI
 * gating is presentation only and real deployments need server authorization (PREF-08).
 */
export function createCaregridClient(baseUrl: string, fetchImpl: typeof fetch = (input, init) => fetch(input, init)): CaregridClient {
  const base = baseUrl.replace(/\/$/, '');
  return {
    baseUrl: base,
    eventsUrl: base + '/events',
    async request<T>(path: string, init: CaregridRequestInit = {}) {
      if (invalid(path)) throw new Error('Invalid CareGrid API path');
      const hasBody = init.body !== undefined;
      let response: Response;
      try {
        response = await fetchImpl(base + path, {
          method: init.method ?? (hasBody ? 'POST' : 'GET'), cache: 'no-store', signal: init.signal,
          headers: hasBody ? {'Content-Type': 'application/json'} : undefined, body: hasBody ? JSON.stringify(init.body) : undefined,
        });
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') throw error;
        throw Object.assign(new Error('Cannot reach the scheduling server.'), {name: 'NetworkError'});
      }
      const body = await response.json().catch(() => null) as {error?: unknown; detail?: unknown} | null;
      if (!response.ok) throw new CaregridFailure(response.status, typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`, body?.detail);
      if (body === null) throw new CaregridFailure(502, 'The scheduling server returned an invalid response.');
      return body as T;
    },
  };
}
/** Query string from defined, non-empty values, preserving the source API parameter names. */
export const qs = (values: Record<string, unknown>) => {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? '?' + entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&') : '';
};
