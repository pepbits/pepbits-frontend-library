import { vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import type { ReferenceHost } from "@pepbits/reference-host";
import type { TeleconsultSettings } from "./shared/contract";
import type { Appointment, AppointmentView, Encounter, Patient, Staff } from "./shared/types";

export interface Recorded { method: string; path: string; url: URL; headers: Headers; body?: unknown; signal?: AbortSignal | null }
export type Handler = (request: Recorded) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }> | undefined;

/** A host whose authenticated fetch records every request and answers from the handler. No network involved. */
export function makeHost(handler: Handler, options: { scope?: Partial<ReferenceHost["scope"]>; preferences?: Partial<ReferenceHost["preferences"]>; path?: string } = {}) {
  const calls: Recorded[] = [];
  const fetch = vi.fn(async (path: string, init: RequestInit = {}) => {
    const url = new URL(path, "https://host.test");
    const call: Recorded = { method: init.method ?? "GET", path, url, headers: new Headers(init.headers), body: typeof init.body === "string" ? JSON.parse(init.body) : undefined, signal: init.signal };
    calls.push(call);
    if (init.signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const result = (await handler(call)) ?? { status: 404, body: { error: `unhandled ${call.method} ${path}` } };
    return new Response(JSON.stringify(result.body ?? null), { status: result.status ?? 200, headers: { "Content-Type": "application/json" } });
  });
  const host: ReferenceHost = {
    scope: { tenantId: "tenant", applicationId: "nexora", branchId: "hq", moduleId: "reference-teleconsult", userId: "user-1", roles: ["teleconsult-doctor"], ...options.scope },
    preferences: { ...DEFAULT_PREFERENCES, ...options.preferences },
    fetch,
    request: vi.fn(),
    navigate: vi.fn(),
    path: options.path,
  };
  return { host, calls, fetch };
}

export const staff = (over: Partial<Staff> = {}): Staff => ({ id: "d1", name: "Dr. Meera Iyer", role: "doctor", title: "MD", specialty: "General medicine", languages: ["English"], rating: 4.9, yearsExperience: 12, bio: "", color: "#0F8B8D", ...over });
export const nurse = (): Staff => staff({ id: "n1", name: "Nina Park", role: "nurse", specialty: "Triage" });

export const patient = (over: Partial<Patient> = {}): Patient => ({
  id: "p8", mrn: "TC-100248", firstName: "Sarah", lastName: "O'Connor", dob: "1990-04-02", sex: "female", phone: "+1 555 0100", email: "", language: "English", address: "", bloodGroup: "O+",
  insurance: { payer: "Self-pay", memberId: "" }, emergencyContact: { name: "", phone: "", relation: "" }, allergies: [], noKnownAllergies: true, medications: [], problems: [], devices: [{ name: "Patient phone", kind: "phone", connected: true }],
  smoking: "never", createdAt: "2026-09-01T00:00:00.000Z", ...over,
});

export const appointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: "a1", patientId: "p8", clinicianId: "d1", start: "2026-10-01T09:00:00.000Z", durationMin: 15, mode: "video", reason: "Burning urination", priority: "routine", status: "in-call", createdBy: "patient",
  startedAt: "2026-10-01T09:01:00.000Z", preVisit: { completed: true, symptoms: ["Burning urination"], duration: "3 days", severity: 4, notes: "", shareDeviceData: true, recordingConsent: true, deviceCheck: { camera: true, mic: true, network: "good" } }, ...over,
});

export const appointmentView = (over: Partial<AppointmentView> = {}): AppointmentView => ({ ...appointment(), patient: patient(), clinician: staff(), ...over } as AppointmentView);

export const encounter = (over: Partial<Encounter> = {}): Encounter => ({
  id: "e1", appointmentId: "a1", patientId: "p8", status: "draft", version: 3,
  triage: { chiefComplaint: "Burning urination", onset: "3 days", painScore: 2, redFlags: [], screening: {}, nurseNote: "" },
  vitals: [], soap: { subjective: "", objective: "", assessment: "", plan: "" }, diagnoses: [], prescriptions: [], orders: [], scores: [], allergiesReviewed: false,
  recording: { consent: true, active: false, seconds: 0 }, transcript: [], followUp: null, patientInstructions: "", sickNoteDays: 0, updatedAt: "2026-10-01T09:00:00.000Z", ...over,
});

export const json = (body: unknown, status = 200) => ({ status, body });

/** Effective branch settings as GET /api/session returns them (fictional values mirroring the shipped demo policy). */
export const settings = (over: Partial<TeleconsultSettings> = {}): TeleconsultSettings => ({
  modes: ["video", "audio", "chat"],
  scheduling: { utcOffsetMinutes: 0, slotIntervalMin: 15, opening: "08:00", closing: "18:00", breaks: [{ start: "13:00", end: "14:00" }], defaultDurationMin: 15, minDurationMin: 5, maxDurationMin: 60, pastGraceMin: 5, horizonDays: 90 },
  recording: { allowed: true, consentRequired: true },
  simulation: { vitals: true, transcript: true, scribe: true, arrive: true, transcriptIntervalMs: 2600 },
  allowPatientBooking: true,
  allowAdminPatientRegistration: true,
  ...over,
});

export const catalog = () => ({ icd: [], drugs: [], orderables: [], orderSets: [], templates: [], allergens: [], scores: [{ key: "news2", name: "NEWS2", purpose: "Early warning", auto: true, items: [], bands: [] }], symptoms: ["Cough", "Chest pain"], specialties: ["General medicine", "Cardiology"] });
export const liveVitals = () => ({ hr: 72, spo2: 98, sys: 118, dia: 76, rr: 15, temp: 36.7, at: "2026-10-01T09:02:00.000Z", signal: "good" });

export interface ProviderServer { roles: Array<"doctor" | "nurse">; canRegister?: boolean; settings?: Partial<TeleconsultSettings>; encounter?: Partial<Encounter>; appointment?: Partial<AppointmentView>; sign?: () => { status?: number; body?: unknown } }

/** In-memory stand-in for the shared Teleconsult store's provider surface. It validates the requested role like the real server must. */
export function providerHandler(server: ProviderServer): Handler {
  let live = 0;
  return (r) => {
    const path = r.url.pathname;
    if (path === "/api/session") {
      const wanted = r.url.searchParams.get("role") as "doctor" | "nurse" | null;
      if (wanted && !server.roles.includes(wanted)) return json({ error: "Role not granted" }, 403);
      const role = wanted ?? server.roles[0];
      return json({ role, roles: server.roles, user: role === "nurse" ? nurse() : staff(), staff: [staff(), nurse()], canRegister: server.canRegister ?? true, settings: settings(server.settings) });
    }
    if (path === "/api/appointments" && r.method === "POST") return json(appointmentView({ id: "a9", status: "booked" }), 201);
    if (path === "/api/slots") return json([{ start: "2026-10-01T10:00:00.000Z", available: true }, { start: "2026-10-01T10:30:00.000Z", available: true }]);
    if (path === "/api/queue" || path === "/api/appointments") return json([]);
    if (path === "/api/dashboard") return json({ scheduled: 3, waiting: 1, inTriage: 0, ready: 0, inCall: 1, completed: 1, cancelled: 0, avgWaitMin: 4 });
    if (path === "/api/appointments/a1") return json(appointmentView(server.appointment));
    if (path === "/api/appointments/a1/encounter") return json(encounter(server.encounter));
    if (path === "/api/catalog") return json(catalog());
    if (path === "/api/appointments/a1/vitals/current") return json({ ...liveVitals(), hr: 70 + (live++ % 5) });
    if (path === "/api/appointments/a1/transcript/current") return json({ done: true });
    if (path === "/api/appointments/a1/messages") return json([]);
    if (path === "/api/patients/p8/history") return json({ encounters: [] });
    if (path === "/api/patients/p8") return json(patient());
    if (path === "/api/encounters/e1/cds" || path === "/api/encounters/e1/suggest") return json([]);
    if (path === "/api/encounters/e1/sign") return server.sign?.() ?? json(encounter({ status: "signed", version: 4, ...server.encounter }));
    if (path === "/api/staff") return json([staff()]);
    if (path === "/api/patients") return json([patient()]);
  };
}

export interface PatientServer {
  patients: Patient[]; bound?: string; canRegister?: boolean; settings?: Partial<TeleconsultSettings>;
  /** Answers GET /api/booking-advice; defaults to routine General medicine. */
  advice?: (request: Recorded) => { status?: number; body?: unknown };
}

export function patientHandler(server: PatientServer): Handler {
  return (r) => {
    const path = r.url.pathname;
    if (path === "/api/session") {
      const wanted = r.url.searchParams.get("patientId");
      if (wanted && !server.patients.some((p) => p.id === wanted)) return json({ error: "Not allowed to act for that person" }, 403);
      const id = wanted ?? server.bound;
      return json({ patient: server.patients.find((p) => p.id === id), patients: server.patients, canRegister: server.canRegister ?? false, settings: settings(server.settings) });
    }
    if (path === "/api/booking-advice") return server.advice?.(r) ?? json({ specialty: "General medicine", urgent: false, demo: true });
    if (path === "/api/patients" && r.method === "POST") {
      const created = patient({ ...(r.body as Partial<Patient>), id: "p9", mrn: "TC-100249" });
      server.patients.push(created);
      return json(created, 201);
    }
    if (path === "/api/patients/p8/appointments") return json([appointmentView({ status: "booked", queuePosition: undefined })]);
    if (path === "/api/catalog") return json(catalog());
    if (path === "/api/staff") return json([staff(), staff({ id: "d2", name: "Dr. Omar Haddad", specialty: "Cardiology" })]);
    if (path === "/api/patients/p8/history") return json({ encounters: [] });
    if (path === "/api/slots") return json([{ start: "2026-10-01T10:00:00.000Z", available: true }]);
    if (path === "/api/appointments" && r.method === "POST") return json(appointmentView({ id: "a9", status: "booked" }), 201);
    if (path === "/api/appointments/a1") return json(appointmentView({ status: "waiting" }));
    if (path === "/api/appointments/a1/vitals/current") return json(liveVitals());
    if (path === "/api/appointments/a1/messages") return json([]);
  };
}
