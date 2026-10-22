import type {
  AuditEntry,
  DuplicateCandidate,
  FieldErrors,
  FormValues,
  LayoutSettings,
  Lookups,
  MrnPreview,
  Paged,
  PatientListItem,
  PatientRecord,
  PatientStats,
  PatientStatus,
  SessionInfo,
  SettingsHistoryEntry,
} from '@allyvora/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: { errors?: FieldErrors; current?: PatientRecord; [k: string]: unknown } = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection and try again.');
  }
  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    const message =
      typeof body.message === 'string'
        ? body.message
        : res.status >= 500
          ? 'The server ran into a problem. Try again in a moment.'
          : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body);
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

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    sp.set(k, v === true ? '1' : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  health: () => request<{ status: string }>('/health'),
  session: () => request<SessionInfo>('/session'),
  lookups: () => request<Lookups>('/lookups'),
  mrnPreview: (branchId: number) => request<MrnPreview>(`/branches/${branchId}/mrn-preview`),
  pincode: (pin: string) => request<{ pincode: string; city: string; district: string; state: string }>(`/pincodes/${pin}`),
  patients: {
    list: (q: PatientQuery) => request<Paged<PatientListItem>>(`/patients${qs(q)}`),
    stats: () => request<PatientStats>('/patients/stats'),
    get: (id: number) => request<PatientRecord>(`/patients/${id}`),
    audit: (id: number) => request<AuditEntry[]>(`/patients/${id}/audit`),
    create: (values: FormValues) => request<PatientRecord>('/patients', { method: 'POST', body: json({ values }) }),
    update: (id: number, values: FormValues, version: number) =>
      request<PatientRecord>(`/patients/${id}`, { method: 'PUT', body: json({ values, version }) }),
    setStatus: (id: number, status: PatientStatus) =>
      request<PatientRecord>(`/patients/${id}/status`, { method: 'PATCH', body: json({ status }) }),
    duplicates: (q: { givenName?: string; familyName?: string; dateOfBirth?: string; mobile?: string; excludeId?: number }) =>
      request<DuplicateCandidate[]>('/patients/duplicates', { method: 'POST', body: json(q) }),
  },
  settings: {
    layout: () => request<LayoutSettings>('/settings/layout'),
    saveLayout: (s: LayoutSettings) => request<LayoutSettings>('/settings/layout', { method: 'PUT', body: json(s) }),
    history: () => request<SettingsHistoryEntry[]>('/settings/layout/history'),
  },
};
