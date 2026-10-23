import { describe, expect, it } from "vitest";
import { bookableDurations, encounterVersion, normalizeFrames, parseBookingAdvice, parsePatientSession, parseProviderSession, SessionContractError } from "./contract";
import { nurse, patient, settings, staff } from "../test-utils";

describe("session contracts", () => {
  it("accepts the documented provider session and de-duplicates roles", () => {
    const session = parseProviderSession({ role: "nurse", roles: ["doctor", "nurse", "nurse"], user: nurse(), staff: [staff(), nurse()], canRegister: true, settings: settings() });
    expect(session.role).toBe("nurse");
    expect(session.roles).toEqual(["doctor", "nurse"]);
    expect(session.canRegister).toBe(true);
  });

  it.each([
    ["not an object", null],
    ["no role", { roles: ["doctor"], user: staff(), staff: [], settings: settings() }],
    ["unknown role", { role: "admin", roles: ["admin"], user: staff(), staff: [], settings: settings() }],
    ["empty grants", { role: "doctor", roles: [], user: staff(), staff: [], settings: settings() }],
    ["active role not granted", { role: "doctor", roles: ["nurse"], user: staff(), staff: [], settings: settings() }],
    ["no user", { role: "doctor", roles: ["doctor"], staff: [], settings: settings() }],
    ["no staff list", { role: "doctor", roles: ["doctor"], user: staff(), settings: settings() }],
  ])("rejects a provider session with %s", (_label, raw) => {
    expect(() => parseProviderSession(raw)).toThrow(SessionContractError);
  });

  it("treats a missing canRegister as not allowed", () => {
    expect(parseProviderSession({ role: "doctor", roles: ["doctor"], user: staff(), staff: [], settings: settings() }).canRegister).toBe(false);
    expect(parsePatientSession({ patients: [], settings: settings() }).canRegister).toBe(false);
  });

  it("accepts a patient session with and without a bound patient", () => {
    expect(parsePatientSession({ patient: patient(), patients: [patient()], canRegister: false, settings: settings() }).patient?.id).toBe("p8");
    expect(parsePatientSession({ patients: [patient(), patient({ id: "p1" })], canRegister: true, settings: settings() }).patient).toBeUndefined();
    expect(() => parsePatientSession({ patients: "p8", settings: settings() })).toThrow(SessionContractError);
    expect(() => parsePatientSession({ patient: { name: "x" }, patients: [], settings: settings() })).toThrow(SessionContractError);
  });
});

describe("effective settings", () => {
  const provider = (over: unknown) => ({ role: "doctor", roles: ["doctor"], user: staff(), staff: [], settings: over });

  it("keeps the server's modes, scheduling, recording, simulation and booking flags through both session parsers", () => {
    const given = settings({ modes: ["video", "audio"], allowPatientBooking: false, scheduling: { ...settings().scheduling, slotIntervalMin: 30, defaultDurationMin: 30 } });
    const doctor = parseProviderSession(provider(given));
    expect(doctor.settings.modes).toEqual(["video", "audio"]);
    expect(doctor.settings.allowPatientBooking).toBe(false);
    expect(doctor.settings.scheduling).toMatchObject({ slotIntervalMin: 30, defaultDurationMin: 30, minDurationMin: 5, maxDurationMin: 60 });
    expect(doctor.settings.recording).toEqual({ allowed: true, consentRequired: true });
    expect(doctor.settings.simulation).toMatchObject({ scribe: true, arrive: true });
    expect(parsePatientSession({ patients: [], settings: given }).settings.modes).toEqual(["video", "audio"]);
  });

  it.each([
    ["missing", undefined],
    ["not an object", "video"],
    ["no modes", { ...settings(), modes: [] }],
    ["an unknown mode", { ...settings(), modes: ["video", "telepathy"] }],
    ["a repeated mode", { ...settings(), modes: ["video", "video"] }],
    ["no scheduling", { ...settings(), scheduling: undefined }],
    ["a zero slot interval", { ...settings(), scheduling: { ...settings().scheduling, slotIntervalMin: 0 } }],
    ["a default shorter than the minimum", { ...settings(), scheduling: { ...settings().scheduling, defaultDurationMin: 3 } }],
    ["a maximum shorter than the default", { ...settings(), scheduling: { ...settings().scheduling, maxDurationMin: 10 } }],
    ["no recording policy", { ...settings(), recording: undefined }],
    ["no simulation flags", { ...settings(), simulation: { vitals: true } }],
    ["no patient-booking flag", { ...settings(), allowPatientBooking: undefined }],
  ])("has no permissive fallback when settings are %s", (_label, bad) => {
    expect(() => parseProviderSession(provider(bad))).toThrow(SessionContractError);
    expect(() => parsePatientSession({ patients: [], settings: bad })).toThrow(SessionContractError);
  });

  it("derives bookable lengths from the clinic's limits: its default plus every slot-interval multiple inside them", () => {
    expect(bookableDurations(settings().scheduling)).toEqual([15, 30, 45, 60]);
    expect(bookableDurations({ ...settings().scheduling, slotIntervalMin: 30, defaultDurationMin: 30, minDurationMin: 30, maxDurationMin: 90 })).toEqual([30, 60, 90]);
    expect(bookableDurations({ ...settings().scheduling, slotIntervalMin: 20, defaultDurationMin: 15, minDurationMin: 10, maxDurationMin: 45 })).toEqual([15, 20, 40]);
  });
});

describe("booking advice", () => {
  it("accepts the server's answer and rejects anything that is not a specialty and an urgency", () => {
    expect(parseBookingAdvice({ specialty: "Cardiology", urgent: true, demo: true, extra: 1 })).toEqual({ specialty: "Cardiology", urgent: true, demo: true });
    for (const bad of [null, {}, { specialty: "", urgent: false }, { specialty: "Cardiology" }, { specialty: 3, urgent: false }, { specialty: "Cardiology", urgent: "yes" }]) expect(() => parseBookingAdvice(bad)).toThrow(SessionContractError);
  });
});

describe("live frames", () => {
  it("normalizes one frame per request and equivalent batched shapes", () => {
    const line = { id: "t1", speaker: "patient", text: "hi", at: "2026-10-01T09:00:00Z" };
    expect(normalizeFrames({ hr: 70, spo2: 98 })).toEqual([{ hr: 70, spo2: 98 }]);
    expect(normalizeFrames([line, line])).toHaveLength(2);
    expect(normalizeFrames({ lines: [line] })).toEqual([line]);
    expect(normalizeFrames({ frames: [line] })).toEqual([line]);
    expect(normalizeFrames({ line })).toEqual([line]);
    expect(normalizeFrames({ done: true })).toEqual([{ done: true }]);
    expect(normalizeFrames(null)).toEqual([]);
    expect(normalizeFrames({})).toEqual([]);
    expect(normalizeFrames("text")).toEqual([]);
  });

  it("reads the encounter revision, defaulting legacy responses to zero", () => {
    expect(encounterVersion({ version: 7 })).toBe(7);
    expect(encounterVersion({})).toBe(0);
    expect(encounterVersion(undefined)).toBe(0);
  });
});
