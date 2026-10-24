import type {
  AuditEntry, DuplicateCandidate, FieldErrors, FormValues, LayoutSettings, Lookups, MrnPreview, Paged,
  PatientListItem, PatientRecord, PatientStats, PatientStatus, SessionInfo, SettingsHistoryEntry,
} from '@allyvora/shared';

/**
 * HTTP adapter for the unchanged AllyVora Express API.
 *
 * The base URL is host configuration (for example the same-origin `/allyvora-api` proxy, or the API's
 * own `/api` origin). Components receive the typed client from the module context and never build URLs.
 * Error bodies keep the backend contract: `{message}`, plus `errors` for 422 field problems and the
 * current record for 409 conflicts.
 */
export class AllyVoraFailure extends Error {
  constructor(public status: number, message: string, public body: {errors?: FieldErrors; current?: PatientRecord; [key: string]: unknown} = {}) {
    super(message);
  }
}
export type AllyVoraTransport = (path: string, init?: RequestInit) => Promise<Response>;

export function createAllyVoraTransport(baseUrl: string, fetcher: typeof fetch = (...args) => fetch(...args)): AllyVoraTransport {
  const base = baseUrl.replace(/\/+$/, '');
  return (path, init = {}) => {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid AllyVora API path');
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    return fetcher(base + path, {...init, headers, cache: 'no-store'});
  };
}

export const NETWORK_MESSAGE = 'Can’t reach the server. Check your connection and try again.';

async function call<T>(transport: AllyVoraTransport, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {response = await transport(path, init);}
  catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new AllyVoraFailure(0, NETWORK_MESSAGE);
  }
  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {body = JSON.parse(text);} catch {body = {message: text.slice(0, 200)};}
  }
  if (!response.ok) {
    const message = typeof body.message === 'string' ? body.message
      : response.status >= 500 ? 'The server ran into a problem. Try again in a moment.' : `Request failed (${response.status})`;
    throw new AllyVoraFailure(response.status, message, body as AllyVoraFailure['body']);
  }
  return body as T;
}

export interface PatientQuery {
  q?: string;
  status?: 'active' | 'inactive' | 'all';
  sex?: string;
  payer?: string;
  branchId?: number;
  created?: 'today' | 'week';
  incomplete?: boolean;
  sort?: 'updated' | 'created' | 'name' | 'mrn' | 'completion';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
export interface DuplicateQuery {givenName?: string; familyName?: string; dateOfBirth?: string; mobile?: string; excludeId?: number}
export interface PincodeResult {pincode: string; city: string; district: string; state: string}

export function queryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, value === true ? '1' : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const json = (body: unknown) => JSON.stringify(body);

export function createAllyVoraClient(transport: AllyVoraTransport) {
  const get = <T,>(path: string, init?: RequestInit) => call<T>(transport, path, init);
  return {
    health: () => get<{status: string; time: string}>('/health'),
    session: () => get<SessionInfo>('/session'),
    lookups: () => get<Lookups>('/lookups'),
    mrnPreview: (branchId: number) => get<MrnPreview>(`/branches/${encodeURIComponent(branchId)}/mrn-preview`),
    pincode: (pin: string) => get<PincodeResult>(`/pincodes/${encodeURIComponent(pin)}`),
    patients: {
      list: (query: PatientQuery, signal?: AbortSignal) => get<Paged<PatientListItem>>(`/patients${queryString(query)}`, {signal}),
      stats: () => get<PatientStats>('/patients/stats'),
      get: (id: number) => get<PatientRecord>(`/patients/${encodeURIComponent(id)}`),
      audit: (id: number) => get<AuditEntry[]>(`/patients/${encodeURIComponent(id)}/audit`),
      create: (values: FormValues) => get<PatientRecord>('/patients', {method: 'POST', body: json({values})}),
      update: (id: number, values: FormValues, version: number) => get<PatientRecord>(`/patients/${encodeURIComponent(id)}`, {method: 'PUT', body: json({values, version})}),
      setStatus: (id: number, status: PatientStatus) => get<PatientRecord>(`/patients/${encodeURIComponent(id)}/status`, {method: 'PATCH', body: json({status})}),
      duplicates: (query: DuplicateQuery) => get<DuplicateCandidate[]>('/patients/duplicates', {method: 'POST', body: json(query)}),
    },
    settings: {
      layout: () => get<LayoutSettings>('/settings/layout'),
      saveLayout: (settings: LayoutSettings) => get<LayoutSettings>('/settings/layout', {method: 'PUT', body: json(settings)}),
      history: () => get<SettingsHistoryEntry[]>('/settings/layout/history'),
    },
  };
}
export type AllyVoraClient = ReturnType<typeof createAllyVoraClient>;

/** Configured base URL: the documented env var, defaulting to the app's same-origin proxy route. */
export function configuredAllyVoraBase(): string {
  return process.env.NEXT_PUBLIC_ALLYVORA_API_URL || '/allyvora-api';
}
