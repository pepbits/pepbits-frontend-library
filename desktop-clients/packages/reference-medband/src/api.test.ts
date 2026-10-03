import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, createMedbandClient, IDEMPOTENCY_HEADER, MEDBAND_NAMESPACE, toApiError } from "./lib/api";
import { EMPTY_FILTERS } from "./lib/search";

const failure = (status: number, body: unknown) => Object.assign(new Error("transport"), { status, details: body });
function client(handler: (path: string, init: RequestInit) => unknown | Promise<unknown>) {
  const request = vi.fn(async (path: string, init: RequestInit = {}) => handler(path, init));
  return { request, api: createMedbandClient({ request: request as never }) };
}
const headerOf = (init: RequestInit, name: string) => new Headers(init.headers).get(name);

describe("host transport adapter", () => {
  it("names the backend namespace and sends module-relative paths only", async () => {
    expect(MEDBAND_NAMESPACE).toBe("/reference-modules/medband");
    const { api, request } = client(() => ({}));
    await api.bootstrap();
    await api.master();
    await api.searchPatients({ ...EMPTY_FILTERS, text: " asha ", payerIds: ["p1", "p2"], openEpisode: true });
    await api.registerPatient({ firstName: "A", lastName: "B", dob: "2000-01-01", gender: "Male", phone: "1" });
    await api.updatePatient("pat 1/x", { phone: "2" });
    await api.createEpisode({ patientId: "p", title: "T", kind: "Surgical", departmentId: "d" });
    await api.setEpisodeStatus("e1", "Closed");
    await api.setCaseStatus("c1", "Closed", "dx");
    await api.createEncounter({ counterId: "c", patientId: "p", type: "OP", startType: "WALK_IN", priority: "Routine", start: "2026-01-01T10:00:00Z", departmentId: "d", billingMode: "Self pay" });
    await api.setEncounterStatus("n1", "Arrived", "c");
    await api.createAdmissionRequest({ patientId: "p", requestedById: "d", admittingDepartmentId: "d", admittingPractitionerId: "d", urgency: "Elective", plannedDate: "2026-01-01T10:00:00Z", expectedStayDays: 1, bedCategory: "General", isolation: "None", reason: "r", billingMode: "Self pay" });
    await api.admissionAction("a1", { action: "deposit" });
    await api.audit("patient", "p 1");
    expect(request.mock.calls.map(([path, init]) => `${(init as RequestInit).method} ${path}`)).toEqual([
      "GET /bootstrap", "GET /master",
      "GET /patients?q=asha&payer=p1&payer=p2&openEpisode=1",
      "POST /patients", "PATCH /patients/pat%201%2Fx", "POST /episodes", "PATCH /episodes/e1", "PATCH /cases/c1", "POST /encounters", "PATCH /encounters/n1",
      "POST /admission-requests", "PATCH /admission-requests/a1", "GET /audit/patient/p%201",
    ]);
    expect(request.mock.calls.every(([path]) => !String(path).startsWith("/api") && !String(path).startsWith("http"))).toBe(true);
  });

  it("has no reset call: the demonstration reset is blocked for embedded hosts and not part of the client", () => {
    const { api } = client(() => ({}));
    expect(Object.keys(api).some((k) => /reset/i.test(k))).toBe(false);
  });

  it("sends an Idempotency-Key on every write but not on reads, and never an actor header", async () => {
    const { api, request } = client(() => ({}));
    await api.bootstrap();
    await api.setEpisodeStatus("e1", "Closed");
    await api.setEpisodeStatus("e1", "Active");
    const [read, a, b] = request.mock.calls.map(([, init]) => init as RequestInit);
    expect(headerOf(read, IDEMPOTENCY_HEADER)).toBeNull();
    expect(headerOf(a, IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    expect(headerOf(a, IDEMPOTENCY_HEADER)).not.toBe(headerOf(b, IDEMPOTENCY_HEADER));
    for (const init of [read, a, b]) { expect(headerOf(init, "x-actor-id")).toBeNull(); expect(headerOf(init, "authorization")).toBeNull(); }
    expect(JSON.parse(String(a.body))).toEqual({ status: "Closed" });
  });

  it("retries a write whose outcome was lost under the same key, then clears it", async () => {
    let lose = true;
    const { api, request } = client(() => { if (lose) throw failure(503, null); return { patients: [] }; });
    const body = { firstName: "A", lastName: "B", dob: "2000-01-01", gender: "Male" as const, phone: "1" };
    await expect(api.registerPatient(body, { operationKey: "ui-1" })).rejects.toMatchObject({ status: 503, code: "ERROR" });
    lose = false;
    await api.registerPatient(body, { operationKey: "ui-2" });
    await api.registerPatient(body, { operationKey: "ui-3" });
    expect(request.mock.calls.map(([, init]) => headerOf(init as RequestInit, IDEMPOTENCY_HEADER))).toEqual(["ui-1", "ui-1", "ui-3"]);
  });

  it("does not replay a key after a definitive refusal, and keeps keys apart for different payloads", async () => {
    let mode: "network" | "invalid" | "ok" = "network";
    const { api, request } = client(() => { if (mode === "network") throw new Error("offline"); if (mode === "invalid") throw failure(422, { error: { code: "VALIDATION_FAILED", message: "no" } }); return {}; });
    await expect(api.setEpisodeStatus("e1", "Closed", { operationKey: "k1" })).rejects.toMatchObject({ status: 0, code: "NETWORK" });
    mode = "invalid";
    await expect(api.setEpisodeStatus("e1", "Closed", { operationKey: "k2" })).rejects.toMatchObject({ status: 422 });
    mode = "ok";
    await api.setEpisodeStatus("e1", "Closed", { operationKey: "k3" });
    await api.setEpisodeStatus("e1", "Active", { operationKey: "k4" });
    expect(request.mock.calls.map(([, init]) => headerOf(init as RequestInit, IDEMPOTENCY_HEADER))).toEqual(["k1", "k1", "k3", "k4"]);
  });

  it("an aborted write keeps its key for the retry and rethrows the abort untouched", async () => {
    let abort = true;
    const { api, request } = client(() => { if (abort) throw Object.assign(new Error("x"), { name: "AbortError" }); return {}; });
    await expect(api.setEpisodeStatus("e1", "Closed", { operationKey: "k1" })).rejects.toMatchObject({ name: "AbortError" });
    abort = false;
    await api.setEpisodeStatus("e1", "Closed", { operationKey: "k2" });
    expect(request.mock.calls.map(([, init]) => headerOf(init as RequestInit, IDEMPOTENCY_HEADER))).toEqual(["k1", "k1"]);
  });

  it("passes the abort signal to the host transport", async () => {
    const { api, request } = client(() => ({}));
    const controller = new AbortController();
    await api.bootstrap({ signal: controller.signal });
    expect((request.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal);
  });
});

describe("failure mapping", () => {
  it("keeps the backend's status, stable code, message and field", () => {
    const e = toApiError(failure(422, { error: { code: "VALIDATION_FAILED", message: "dob: use yyyy-mm-dd", field: "dob" } }));
    expect(e).toBeInstanceOf(ApiRequestError);
    expect(e).toMatchObject({ status: 422, code: "VALIDATION_FAILED", message: "dob: use yyyy-mm-dd", field: "dob" });
    expect(toApiError(failure(409, { error: { code: "CONFLICT", message: "That record conflicts with an existing one." } }))).toMatchObject({ status: 409, code: "CONFLICT" });
  });
  it("falls back to fixed catalog messages with the status kept, never an invented code", () => {
    expect(toApiError(failure(500, null))).toMatchObject({ status: 500, code: "ERROR", message: "The server could not complete the request." });
    expect(toApiError(failure(404, { error: "gone" }))).toMatchObject({ status: 404, message: "gone" });
    expect(toApiError(failure(400, {}))).toMatchObject({ status: 400, message: "The request could not be completed." });
  });
  it("reports an unreachable server as status 0 NETWORK", () => {
    expect(toApiError(new Error("offline"))).toMatchObject({ status: 0, code: "NETWORK" });
    const same = new ApiRequestError(1, "X", "m");
    expect(toApiError(same)).toBe(same);
  });
});
