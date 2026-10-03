import type { AdmissionAction, AdmissionRequestBody, Bootstrap, EncounterRequest, PatientBody } from "./api-types";
import type { MasterData } from "./master";
import type { PatientFilters } from "./search";
import { filtersToParams } from "./search";
import type { CaseStatus, Changes, EncounterStatus, EpisodeKind, EpisodeStatus, Patient } from "./types";

/** Namespace the host transport maps these paths onto (the host adds the /api prefix, credentials and scope headers). */
export const MEDBAND_NAMESPACE = "/reference-modules/medband";
export const IDEMPOTENCY_HEADER = "Idempotency-Key";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Outcomes where the server may have applied the write but the answer never arrived: a retry must replay the same key. */
const AMBIGUOUS_STATUS = new Set([0, 408, 502, 503, 504]);

/** The source's failure type: HTTP status, the backend's stable error code, a message and the form field to fix. */
export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export interface MedbandTransport {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}
export interface CallOptions {
  signal?: AbortSignal;
  /** Key for this attempt. An identical earlier write whose outcome was lost keeps its own key and wins over this one. */
  operationKey?: string;
}

type Failure = Error & { status?: number; details?: { error?: unknown } | null };
export const isAbort = (error: unknown) => (error as { name?: string } | null)?.name === "AbortError";

/** Maps a host transport failure onto the source's `{ error: { code, message, field } }` shape. The backend's code and status are kept. */
export function toApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;
  const e = error as Failure;
  const status = typeof e?.status === "number" ? e.status : 0;
  if (!status) return new ApiRequestError(0, "NETWORK", "Cannot reach the MedBand server. Check the connection and try again.");
  const body = e.details?.error;
  const nested = body && typeof body === "object" ? (body as { code?: unknown; message?: unknown; field?: unknown }) : {};
  const code = typeof nested.code === "string" ? nested.code : "ERROR";
  // The backend's own message wins; otherwise a fixed catalog message (the status and code carry the detail).
  return new ApiRequestError(status, code, typeof nested.message === "string" ? nested.message : typeof body === "string" ? body : status >= 500 ? "The server could not complete the request." : "The request could not be completed.", typeof nested.field === "string" ? nested.field : undefined);
}

export const newOperationKey = () => crypto.randomUUID();
const enc = encodeURIComponent;

/** The source `api` object bound to one host transport. No token store and no /api prefix: the host session authenticates. */
export function createMedbandClient(transport: MedbandTransport) {
  // Owned by this client (one per authenticated scope): method + path + payload -> key of an attempt whose outcome is unknown.
  const pending = new Map<string, string>();

  async function call<T>(method: string, path: string, body?: unknown, opts: CallOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const mutating = MUTATING.has(method);
    const signature = mutating ? JSON.stringify([method, path, payload ?? null]) : "";
    if (mutating) headers[IDEMPOTENCY_HEADER] = pending.get(signature) ?? opts.operationKey ?? newOperationKey();
    try {
      const result = await transport.request<T>(path, { method, headers: Object.keys(headers).length ? headers : undefined, body: payload, signal: opts.signal });
      if (mutating) pending.delete(signature);
      return result;
    } catch (error) {
      if (isAbort(error)) {
        if (mutating) pending.set(signature, headers[IDEMPOTENCY_HEADER]);
        throw error;
      }
      const failure = toApiError(error);
      if (mutating) {
        if (AMBIGUOUS_STATUS.has(failure.status)) pending.set(signature, headers[IDEMPOTENCY_HEADER]);
        else pending.delete(signature);
      }
      throw failure;
    }
  }

  return {
    bootstrap: (o?: CallOptions) => call<Bootstrap>("GET", "/bootstrap", undefined, o),
    master: (o?: CallOptions) => call<{ master: MasterData } | MasterData>("GET", "/master", undefined, o),
    searchPatients: (f: PatientFilters, o?: CallOptions) => call<{ patients: Patient[] }>("GET", `/patients?${filtersToParams(f).toString()}`, undefined, o),
    registerPatient: (body: PatientBody, o?: CallOptions) => call<Changes & { patientId: string }>("POST", "/patients", body, o),
    updatePatient: (id: string, patch: Partial<PatientBody>, o?: CallOptions) => call<Changes>("PATCH", `/patients/${enc(id)}`, patch, o),
    createEpisode: (body: { patientId: string; title: string; kind: EpisodeKind; departmentId: string; practitionerId?: string }, o?: CallOptions) => call<Changes>("POST", "/episodes", body, o),
    setEpisodeStatus: (id: string, status: EpisodeStatus, o?: CallOptions) => call<Changes>("PATCH", `/episodes/${enc(id)}`, { status }, o),
    setCaseStatus: (id: string, status: CaseStatus, provisionalDiagnosis?: string, o?: CallOptions) => call<Changes>("PATCH", `/cases/${enc(id)}`, { status, provisionalDiagnosis }, o),
    createEncounter: (body: EncounterRequest, o?: CallOptions) => call<Changes & { encounterId: string }>("POST", "/encounters", body, o),
    setEncounterStatus: (id: string, status: EncounterStatus, counterId?: string, o?: CallOptions) => call<Changes>("PATCH", `/encounters/${enc(id)}`, { status, counterId }, o),
    createAdmissionRequest: (body: AdmissionRequestBody, o?: CallOptions) => call<Changes & { requestId: string }>("POST", "/admission-requests", body, o),
    admissionAction: (id: string, action: AdmissionAction, o?: CallOptions) => call<Changes>("PATCH", `/admission-requests/${enc(id)}`, action, o),
    audit: (entity: string, id: string, o?: CallOptions) => call<unknown>("GET", `/audit/${enc(entity)}/${enc(id)}`, undefined, o),
  };
}
export type MedbandClient = ReturnType<typeof createMedbandClient>;
