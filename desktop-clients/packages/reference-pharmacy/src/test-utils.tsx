import { vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import type { ReferenceHost } from "@pepbits/reference-host";
import type { Meta } from "./lib/types";

export interface Recorded { method: string; path: string; url: URL; headers: Headers; body?: unknown; signal?: AbortSignal | null }
export type Reply = { status?: number; body?: unknown } | undefined;
export type Handler = (request: Recorded) => Reply | Promise<Reply>;

/**
 * A host whose `request` records every call and answers from the handler (no network). It mimics the real host transport:
 * JSON in, JSON out, a non-2xx status rejects with `status` and the parsed body as `details`. Paths are exactly what the
 * module sends (`/meta`, `/dashboard`): the host adds /api and the namespace.
 */
export function makeHost(handler: Handler, options: { scope?: Partial<ReferenceHost["scope"]>; preferences?: Partial<ReferenceHost["preferences"]>; preferenceHost?: Partial<NonNullable<ReferenceHost["preferenceHost"]>>; path?: string } = {}) {
  const calls: Recorded[] = [];
  const request = vi.fn(async (path: string, init: RequestInit = {}) => {
    const url = new URL(path, "https://host.test");
    const call: Recorded = { method: init.method ?? "GET", path, url, headers: new Headers(init.headers), body: typeof init.body === "string" ? JSON.parse(init.body) : undefined, signal: init.signal };
    calls.push(call);
    if (init.signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const result = (await handler(call)) ?? { status: 404, body: { error: { code: "not_found", message: `unhandled ${call.method} ${path}` } } };
    const status = result.status ?? 200;
    if (status < 200 || status >= 300) throw Object.assign(new Error("Request failed"), { status, details: result.body });
    return result.body ?? null;
  });
  const navigate = vi.fn();
  const onPreferenceChange = vi.fn();
  const preferences = { ...DEFAULT_PREFERENCES, ...options.preferences };
  const host: ReferenceHost = {
    scope: { tenantId: "tenant", applicationId: "nexora", branchId: "hq", moduleId: "reference-pharmacy", userId: "user-1", roles: ["pharmacist"], ...options.scope },
    preferences,
    preferenceHost: { preferences, onPreferenceChange, ...options.preferenceHost },
    request: request as unknown as ReferenceHost["request"],
    navigate,
    path: options.path,
  };
  return { host, calls, request, navigate, onPreferenceChange };
}

export const json = (body: unknown, status = 200) => ({ status, body });

/** Fictional /meta: the signed-in pharmacist plus the actor directory rows the history refers to. */
export const meta = (over: Partial<Meta> = {}): Meta => ({
  settings: { pharmacy_name: "Demo Pharmacy", branch_name: "Main branch", license_no: "LIC-0000", currency: "AED", timezone: "Asia/Dubai", near_expiry_days: "90" },
  users: [{ id: "u_1", name: "Amira Test", role: "pharmacist", initials: "AT" }, { id: "u_2", name: "Omar Test", role: "technician", initials: "OT" }],
  currentUser: { id: "u_1", name: "Amira Test", role: "pharmacist", initials: "AT" },
  payers: [{ id: "p1", name: "Demo Insurer", code: "DEMO", workflow: "pre_adjudication" }],
  doctors: [{ id: "d1", name: "Dr Test", specialty: "GP", facility: "Demo Clinic" }],
  ...over,
});

export const dashboard = () => ({
  queues: { intake: 2, review: 1, fill: 0, check: 0, handover: 1 },
  kpi: { rx_received: 5, rx_handed_over: 3, turnaround_min: 24, sales_today: 1234.5, collected_today: 900, otc_today: 100, orders_open: 2, orders_new: 1, auth_pending: 1, returns_today: 0 },
  rcm: { drafts: { n: 2, v: 300 }, rejected: { n: 1, v: 50 }, outstanding: { n: 4, v: 1200 }, unposted_ra: { n: 1, v: 400 }, denial_rate: 4, collected_30d: 9000 },
  stock: { low: 3, near_expiry: { n: 2, v: 80 }, expired: { n: 0, v: 0 }, quarantined: 1, value: 25000 },
  hours: [{ hour: 8, received: 2, handed_over: 1 }, { hour: 9, received: 3, handed_over: 2 }],
  trend: [{ day: "2026-09-29", rx: 100, otc: 40 }, { day: "2026-09-30", rx: 120, otc: 30 }],
  activity: [], urgent: [],
});

/** /meta and /dashboard: what the module needs to show its first page. */
export const sessionHandler = (over: { meta?: Partial<Meta> } = {}): Handler => (r) => {
  if (r.url.pathname === "/meta") return json(meta(over.meta));
  if (r.url.pathname === "/dashboard") return json(dashboard());
};

/** Chains handlers: the first one that answers wins. */
export const chain = (...handlers: Handler[]): Handler => async (r) => { for (const h of handlers) { const out = await h(r); if (out) return out; } };
