import { vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import type { ReferenceHost } from "@pepbits/reference-host";
import type { Bootstrap } from "./lib/api-types";
import { toDateInput } from "./lib/utils";

export interface Recorded { method: string; path: string; url: URL; headers: Headers; body?: unknown; signal?: AbortSignal | null }
export type Reply = { status?: number; body?: unknown } | undefined;
export type Handler = (request: Recorded) => Reply | Promise<Reply>;

/**
 * A fake host transport for tests only: `request` records every call and answers from the handler (no network). It mimics the
 * real host transport: JSON in, JSON out, a non-2xx status rejects with `status` and the parsed body as `details`. Paths are
 * exactly what the module sends (`/bootstrap`, `/patients?q=`): the host adds /api and the namespace. The runtime never
 * contains these fixtures.
 */
export function makeHost(handler: Handler, options: { scope?: Partial<ReferenceHost["scope"]>; preferences?: Partial<ReferenceHost["preferences"]>; preferenceHost?: Partial<NonNullable<ReferenceHost["preferenceHost"]>>; path?: string } = {}) {
  const calls: Recorded[] = [];
  const request = vi.fn(async (path: string, init: RequestInit = {}) => {
    const url = new URL(path, "https://host.test");
    const call: Recorded = { method: init.method ?? "GET", path, url, headers: new Headers(init.headers), body: typeof init.body === "string" ? JSON.parse(init.body) : undefined, signal: init.signal };
    calls.push(call);
    if (init.signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const result = (await handler(call)) ?? { status: 404, body: { error: { code: "NOT_FOUND", message: `unhandled ${call.method} ${path}` } } };
    const status = result.status ?? 200;
    if (status < 200 || status >= 300) throw Object.assign(new Error("Request failed"), { status, details: result.body });
    return result.body ?? null;
  });
  const navigate = vi.fn();
  const onPreferenceChange = vi.fn();
  const preferences = { ...DEFAULT_PREFERENCES, ...options.preferences };
  const host: ReferenceHost = {
    scope: { tenantId: "tenant", applicationId: "nexora", branchId: "hq", moduleId: "reference-medband", userId: "user-1", roles: ["registrar"], ...options.scope },
    preferences,
    preferenceHost: { preferences, onPreferenceChange, ...options.preferenceHost },
    request: request as unknown as ReferenceHost["request"],
    navigate,
    path: options.path,
  };
  return { host, calls, request, navigate, onPreferenceChange };
}

export const json = (body: unknown, status = 200) => ({ status, body });

const now = new Date();
const today = (h: number) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0); return d.toISOString(); };
const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return toDateInput(d); };

/** Fictional bootstrap payload for tests. Distinct names let tests tell the active scope's data from another's. */
export const bootstrap = (tag = "A", over: Partial<Bootstrap> = {}): Bootstrap => ({
  master: {
    payers: [{ id: "pay-1", name: `Payer ${tag} Insurance`, short: `Pay${tag}`, tpaIds: ["tpa-1"], tpaRequired: true }],
    tpas: [{ id: "tpa-1", name: `Tpa ${tag}` }],
    networks: [{ id: "net-1", payerId: "pay-1", name: `Network ${tag}`, tier: "Gold" }],
    plans: [{ id: "plan-1", networkId: "net-1", name: `Plan ${tag}`, copayPct: 10, opLimit: 5000, ipCovered: true, teleCovered: false }],
    departments: [
      { id: "dep-gen", name: `General ${tag}`, followUpDays: 7, freeFollowUps: 2, consults: true },
      { id: "dep-er", name: `Emergency ${tag}`, followUpDays: 0, freeFollowUps: 0, consults: true },
    ],
    practitioners: [{ id: "doc-1", name: `Dr ${tag} Tester`, departmentId: "dep-gen", title: "Consultant", tele: true }],
    wards: [{ id: "ward-1", name: `Ward ${tag}`, category: "General", beds: ["G1", "G2"] }],
    services: ["Consultation"],
    packages: [],
    complaints: [{ code: "R50", label: "Fever", category: "General" }],
    counters: [
      { id: `ctr-${tag}-1`, name: `Desk ${tag} One`, location: "Ground floor", encounterTypes: ["OP", "FOLLOW_UP"] },
      { id: `ctr-${tag}-2`, name: `Desk ${tag} Two`, location: "Emergency", encounterTypes: ["EMERGENCY"] },
    ],
  },
  data: {
    patients: [
      { id: "pat-1", mrn: `MRN-${tag}-001`, firstName: "Asha", lastName: `Tester${tag}`, dob: "1990-05-04", gender: "Female", phone: "0500000001", allergies: "Penicillin", coverages: [{ id: "cov-1", priority: "Primary", payerId: "pay-1", tpaId: "tpa-1", networkId: "net-1", planId: "plan-1", policyNumber: "POL-1", memberId: "MEM-1", validFrom: day(-100), validTo: day(200), relationship: "Self" }], createdAt: today(8) },
      { id: "pat-2", mrn: `MRN-${tag}-002`, firstName: "Ben", lastName: `Sample${tag}`, dob: "1985-01-01", gender: "Male", phone: "0500000002", coverages: [], createdAt: today(9) },
    ],
    episodes: [{ id: "ep-1", code: "EP-1", patientId: "pat-1", title: `Cough episode ${tag}`, kind: "Acute illness", status: "Active", departmentId: "dep-gen", startDate: today(8) }],
    cases: [{ id: "case-1", code: "CS-1", patientId: "pat-1", episodeId: "ep-1", title: `Cough case ${tag}`, complaints: [{ code: "R50", label: "Fever" }], departmentId: "dep-gen", status: "Open", openedAt: today(8), medicoLegal: false }],
    encounters: [{ id: "enc-1", code: "ENC-1", patientId: "pat-1", episodeId: "ep-1", caseId: "case-1", type: "OP", startType: "WALK_IN", status: "Arrived", priority: "Routine", start: today(10), departmentId: "dep-gen", practitionerId: "doc-1", chiefComplaint: "Fever", billingMode: "Insurance", coverageIds: ["cov-1"], createdAt: today(10) }],
    admissionRequests: [{ id: "adm-1", code: "AR-1", patientId: "pat-1", caseId: "case-1", episodeId: "ep-1", requestedById: "doc-1", admittingDepartmentId: "dep-gen", admittingPractitionerId: "doc-1", urgency: "Urgent", plannedDate: today(12), expectedStayDays: 3, bedCategory: "General", isolation: "None", reason: "Observation", specialNeeds: [], billingMode: "Self pay", authStatus: "Not required", estimatedCost: 12345, depositCollected: false, status: "Pending", createdAt: today(9), updatedAt: today(9) }],
  },
  currentUser: { id: "u-1", name: `Registrar ${tag}` },
  hostManagedIdentity: true,
  demo: true,
  ...over,
});

/** Answers GET /bootstrap with the fixture; everything else is up to the test. */
export const sessionHandler = (tag = "A", over: Partial<Bootstrap> = {}): Handler => (r) => {
  if (r.url.pathname === "/bootstrap") return json(bootstrap(tag, over));
};
export const chain = (...handlers: Handler[]): Handler => async (r) => { for (const h of handlers) { const out = await h(r); if (out) return out; } };
