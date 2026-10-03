import type { Encounter, LiveVitals, Patient, Role, Staff, TranscriptLine, VisitMode } from "./types";

/** Module namespaces served by the shared Teleconsult store. Both variants point at the same data. */
export const TELECONSULT_PROVIDER_NAMESPACE = "/reference-modules/teleconsult-provider";
export const TELECONSULT_PATIENT_NAMESPACE = "/reference-modules/teleconsult-patient";
export const TELECONSULT_PROVIDER_VARIANT = "teleconsult-provider";
export const TELECONSULT_PATIENT_VARIANT = "teleconsult-patient";

/** Request headers the server validates against the authenticated user's grants. */
export const ROLE_HEADER = "X-Teleconsult-Role";
export const PATIENT_HEADER = "X-Teleconsult-Patient";
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

export const VISIT_MODES: readonly VisitMode[] = ["video", "audio", "chat"];

/** Effective branch policy from GET /api/session. The server is the only source; the browser has no defaults. */
export interface TeleconsultSettings {
  /** Visit modes this branch supports; booking offers exactly these. */
  modes: VisitMode[];
  scheduling: {
    slotIntervalMin: number; defaultDurationMin: number; minDurationMin: number; maxDurationMin: number;
    opening?: string; closing?: string; horizonDays?: number; pastGraceMin?: number; utcOffsetMinutes?: number;
    breaks?: { start: string; end: string }[];
  };
  recording: { allowed: boolean; consentRequired: boolean };
  simulation: { vitals: boolean; transcript: boolean; scribe: boolean; arrive: boolean; transcriptIntervalMs?: number };
  /** Whether patients may book for themselves. */
  allowPatientBooking: boolean;
  allowAdminPatientRegistration: boolean;
}

/** GET /api/session for the provider module (`?role=doctor|nurse` requests a granted mode). */
export interface ProviderSession { role: Role; roles: Role[]; user: Staff; staff: Staff[]; canRegister: boolean; settings: TeleconsultSettings }
/** GET /api/session for the patient module (`?patientId=` requests a granted beneficiary). */
export interface PatientSession { patient?: Patient; patients: Patient[]; canRegister: boolean; settings: TeleconsultSettings }

export class SessionContractError extends Error {
  constructor(message: string) { super(message); this.name = "SessionContractError"; }
}

const isRole = (value: unknown): value is Role => value === "doctor" || value === "nurse";
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const positiveInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;

/**
 * Validates the effective settings. Missing or inconsistent settings are a contract error: there is no
 * permissive fallback, because booking choices and enablement must come from the server's policy.
 */
export function parseSettings(raw: unknown): TeleconsultSettings {
  if (!isRecord(raw)) throw new SessionContractError("Teleconsult session has no settings");
  const {modes, scheduling, recording, simulation, allowPatientBooking, allowAdminPatientRegistration} = raw;
  if (!Array.isArray(modes) || !modes.length || !modes.every((m): m is VisitMode => VISIT_MODES.includes(m as VisitMode)) || new Set(modes).size !== modes.length) throw new SessionContractError("Teleconsult settings list no valid visit modes");
  if (!isRecord(scheduling) || !positiveInt(scheduling.slotIntervalMin) || !positiveInt(scheduling.minDurationMin) || !positiveInt(scheduling.defaultDurationMin) || !positiveInt(scheduling.maxDurationMin)) throw new SessionContractError("Teleconsult settings have invalid scheduling durations");
  if (scheduling.minDurationMin > scheduling.defaultDurationMin || scheduling.defaultDurationMin > scheduling.maxDurationMin) throw new SessionContractError("Teleconsult scheduling durations are inconsistent");
  if (!isRecord(recording) || typeof recording.allowed !== "boolean" || typeof recording.consentRequired !== "boolean") throw new SessionContractError("Teleconsult settings have invalid recording policy");
  if (!isRecord(simulation) || !(["vitals", "transcript", "scribe", "arrive"] as const).every((key) => typeof simulation[key] === "boolean")) throw new SessionContractError("Teleconsult settings have invalid simulation flags");
  if (typeof allowPatientBooking !== "boolean") throw new SessionContractError("Teleconsult settings do not say whether patients may book");
  return {
    modes: [...modes], scheduling: {...scheduling} as TeleconsultSettings["scheduling"],
    recording: {allowed: recording.allowed, consentRequired: recording.consentRequired}, simulation: {...simulation} as TeleconsultSettings["simulation"],
    allowPatientBooking, allowAdminPatientRegistration: allowAdminPatientRegistration === true,
  };
}

/** Whole-minute lengths a visit can be booked for: the clinic's default plus every slot-interval multiple inside its limits. */
export function bookableDurations(scheduling: TeleconsultSettings["scheduling"]): number[] {
  const {slotIntervalMin, minDurationMin, defaultDurationMin, maxDurationMin} = scheduling;
  const options = new Set([defaultDurationMin]);
  for (let d = Math.ceil(minDurationMin / slotIntervalMin) * slotIntervalMin; d <= maxDurationMin; d += slotIntervalMin) options.add(d);
  return [...options].sort((a, b) => a - b);
}

/** Rejects malformed session payloads instead of rendering a workspace with an unknown identity. */
export function parseProviderSession(raw: unknown): ProviderSession {
  if (!isRecord(raw)) throw new SessionContractError("Teleconsult provider session is not an object");
  const {role, roles, user, staff, canRegister, settings} = raw;
  if (!isRole(role)) throw new SessionContractError("Teleconsult provider session has no valid role");
  if (!Array.isArray(roles) || !roles.length || !roles.every(isRole)) throw new SessionContractError("Teleconsult provider session has no granted roles");
  if (!roles.includes(role)) throw new SessionContractError("Teleconsult provider session role is not among the granted roles");
  if (!isRecord(user) || typeof user.id !== "string") throw new SessionContractError("Teleconsult provider session has no staff user");
  if (!Array.isArray(staff)) throw new SessionContractError("Teleconsult provider session has no staff list");
  return {role, roles: [...new Set(roles)], user: user as unknown as Staff, staff: staff as Staff[], canRegister: canRegister === true, settings: parseSettings(settings)};
}

export function parsePatientSession(raw: unknown): PatientSession {
  if (!isRecord(raw)) throw new SessionContractError("Teleconsult patient session is not an object");
  const {patient, patients, canRegister, settings} = raw;
  if (!Array.isArray(patients)) throw new SessionContractError("Teleconsult patient session has no patient list");
  if (patient !== undefined && patient !== null && (!isRecord(patient) || typeof patient.id !== "string")) throw new SessionContractError("Teleconsult patient session has an invalid patient");
  return {patient: (patient ?? undefined) as Patient | undefined, patients: patients as Patient[], canRegister: canRegister === true, settings: parseSettings(settings)};
}

/** GET /api/booking-advice answer. The server owns the specialty and urgency rules; `demo` marks it as demonstration advice. */
export interface BookingAdvice { specialty: string; urgent: boolean; demo: true }

export function parseBookingAdvice(raw: unknown): BookingAdvice {
  if (!isRecord(raw) || typeof raw.specialty !== "string" || !raw.specialty || typeof raw.urgent !== "boolean") throw new SessionContractError("Teleconsult booking advice is malformed");
  return {specialty: raw.specialty, urgent: raw.urgent, demo: true};
}

/** A transcript frame as the live endpoints deliver it: a line, or `{done:true}` when the script has ended. */
export type TranscriptFrame = TranscriptLine | { done: true };

/**
 * Live endpoints return one frame per request. Tolerate the equivalent batched shapes (array,
 * `{frames}`/`{lines}`/`{line}` wrappers, null for "nothing new") so a server can batch without a client change.
 */
export function normalizeFrames<T>(body: unknown): T[] {
  if (body === null || body === undefined) return [];
  if (Array.isArray(body)) return body as T[];
  if (isRecord(body)) {
    for (const key of ["frames", "lines"]) if (Array.isArray(body[key])) return body[key] as T[];
    for (const key of ["frame", "line"]) if (isRecord(body[key])) return [body[key] as T];
    if (Object.keys(body).length === 0) return [];
    return [body as T];
  }
  return [];
}

export const isTranscriptDone = (frame: TranscriptFrame): frame is { done: true } => "done" in frame && frame.done === true;
export const isLiveVitals = (frame: unknown): frame is LiveVitals => isRecord(frame) && typeof frame.hr === "number" && typeof frame.spo2 === "number";
export const isTranscriptLine = (frame: unknown): frame is TranscriptLine => isRecord(frame) && typeof frame.id === "string" && typeof frame.text === "string";

/** Current server revision of an encounter; legacy responses without a version count as 0. */
export const encounterVersion = (encounter: Pick<Encounter, "version"> | undefined) => encounter?.version ?? 0;
