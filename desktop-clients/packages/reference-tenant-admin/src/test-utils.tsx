import { vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import type { ReferenceHost } from "@pepbits/reference-host";
import type { Meta, RecordDto, ResourceDef } from "./lib/types";

export interface Recorded { method: string; path: string; url: URL; headers: Headers; body?: unknown; signal?: AbortSignal | null }
export type Reply = { status?: number; body?: unknown } | undefined;
export type Handler = (request: Recorded) => Reply | Promise<Reply>;

/**
 * A host whose `request` records every call and answers from the handler (no network). It mimics the real host transport:
 * JSON in, JSON out, a non-2xx status rejects with `status` and the parsed body as `details`. Paths are exactly what the
 * module sends (`/meta`, `/overview`): the host adds /api and the namespace. This fake transport is a test fixture only.
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
    scope: { tenantId: "tenant", applicationId: "nexora", branchId: "hq", moduleId: "reference-tenant-admin", userId: "user-1", roles: ["tenant-admin"], ...options.scope },
    preferences,
    preferenceHost: { preferences, onPreferenceChange, ...options.preferenceHost },
    request: request as unknown as ReferenceHost["request"],
    navigate,
    path: options.path,
  };
  return { host, calls, request, navigate, onPreferenceChange };
}

export const json = (body: unknown, status = 200) => ({ status, body });

const ITEMS: ResourceDef = {
  key: "items", label: "Items and services", singular: "item", category: "catalogue", icon: "Stethoscope", summary: "Billable items.",
  governance: "versioned", effectiveDated: true, codePrefix: "ITM", sections: ["General", "Pricing"],
  fields: [
    { key: "kind", label: "Kind", type: "select", required: true, section: "General", list: true, options: [{ value: "SERVICE", label: "Service" }, { value: "DRUG", label: "Drug" }] },
    { key: "tags", label: "Tags", type: "tags", section: "General", upper: true },
    { key: "price", label: "List price", type: "money", section: "Pricing", list: true },
  ],
};
const TAX: ResourceDef = {
  key: "tax-rules", label: "Tax rules", singular: "tax rule", category: "catalogue", icon: "Percent", summary: "Tax by category.",
  governance: "simple", effectiveDated: false, codePrefix: "TAX", fields: [{ key: "rate", label: "Rate", type: "percent", required: true, list: true }],
};
const ROUTES: ResourceDef = {
  key: "reimbursement-routes", label: "Reimbursement routes", singular: "reimbursement route", category: "policy", icon: "Route", summary: "Which model prices an item.",
  governance: "versioned", effectiveDated: true, codePrefix: "RTE", fields: [{ key: "priority", label: "Priority", type: "number", list: true }],
};

/** Fictional registry metadata and the signed-in tenant administrator: the host session's user, plus the directory history refers to. */
export const meta = (over: Partial<Meta> = {}): Meta => ({
  tenant: { name: "Meridian Test", environment: "Test", sourceBaseline: "abcdef1234567", timezone: "Asia/Dubai" },
  legalEntities: [{ value: "le1", label: "Meridian LLC" }],
  branches: [{ value: "b1", label: "Main", legalEntity: "le1", city: "Dubai" }],
  currencies: [{ value: "AED", label: "AED" }],
  categories: [
    { key: "catalogue", label: "Catalogue and pricing", short: "Catalogue", icon: "PackageSearch", summary: "Items and tax." },
    { key: "policy", label: "Billing policy and models", short: "Policy", icon: "Scale", summary: "Routes." },
  ],
  resources: [ITEMS, TAX, ROUTES],
  users: [
    { id: 1, name: "Amira Test", title: "Tenant administrator", email: "amira@example.test", initials: "AT", tone: "spruce" },
    { id: 2, name: "Omar Test", title: "Finance approver", email: "omar@example.test", initials: "OT", tone: "cobalt" },
  ],
  currentUser: { id: 1, name: "Amira Test", title: "Tenant administrator", email: "amira@example.test", initials: "AT", tone: "spruce" },
  hostManagedIdentity: true,
  demo: true,
  ...over,
});

export const overview = () => ({
  stages: [
    { key: "access", title: "Access", summary: "Grants and numbering", checks: [{ label: "Billing grants", ok: true, detail: "2 in force", href: "/config/billing-grants" }], done: 1, total: 1, state: "complete" },
    { key: "catalogue", title: "Catalogue", summary: "Items and tax", checks: [{ label: "Items", ok: false, detail: "None approved", href: "/config/items" }], done: 0, total: 1, state: "missing" },
  ],
  billingOpen: false,
  totals: { pending: 1, drafts: 2, effective: 3, records: 6 },
  upcoming: [],
  recent: [],
});

export const record = (over: Partial<RecordDto> = {}): RecordDto => ({
  id: 7, code: "ITM-0007", name: "Consultation", status: "DRAFT", rowVersion: 1, revision: 1, parentId: null, effectiveFrom: "2026-10-01", effectiveUntil: null,
  data: { kind: "SERVICE", price: 120 }, changeReason: null, decisionReason: null, createdBy: 1, createdAt: "2026-09-30T08:00:00Z", updatedBy: 1, updatedAt: "2026-09-30T08:00:00Z",
  submittedBy: null, submittedAt: null, decidedBy: null, decidedAt: null, refLabels: {}, revisions: [{ id: 7, revision: 1, status: "DRAFT", effective_from: "2026-10-01", decided_at: null }], ...over,
});

export const list = (rows: RecordDto[] = [record()]) => ({ rows, total: rows.length, page: 1, pageSize: 25, counts: { DRAFT: rows.length } });

/** /meta, /pending, /overview, /approvals and a list: what the module needs to show its first page. */
export const sessionHandler = (over: { meta?: Partial<Meta> } = {}): Handler => (r) => {
  const p = r.url.pathname;
  if (p === "/meta") return json(meta(over.meta));
  if (p === "/pending") return json({ items: 1 });
  if (p === "/overview") return json(overview());
  if (p === "/approvals") return json([]);
  if (p === "/audit") return json([]);
  if (p === "/resources/items") return json(list());
  if (/^\/resources\/[\w-]+\/options$/.test(p)) return json([]);
};

/** Chains handlers: the first one that answers wins. */
export const chain = (...handlers: Handler[]): Handler => async (r) => { for (const h of handlers) { const out = await h(r); if (out) return out; } };
