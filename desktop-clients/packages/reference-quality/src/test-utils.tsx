import { vi } from "vitest";
import React from "react";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import { LocalizationProvider, type Localization } from "@pepbits/ops-ui";
import type { ReferenceHost } from "@pepbits/reference-host";
import type { Meta, User } from "./lib/types";

export interface Recorded { method: string; path: string; url: URL; headers: Headers; body?: unknown; signal?: AbortSignal | null }
export type Reply = { status?: number; body?: unknown } | undefined;
export type Handler = (request: Recorded) => Reply | Promise<Reply>;

/**
 * A host whose request/fetch record every call and answer from the handler (no network). `request` mimics the real
 * host transport: JSON in, JSON out, a non-2xx status rejects with `status` and the parsed body as `details`.
 * Paths are exactly what the module sends (`/auth/me`, `/meta`, `/indicators`): the host adds /api and the namespace.
 */
export function makeHost(handler: Handler, options: { scope?: Partial<ReferenceHost["scope"]>; preferences?: Partial<ReferenceHost["preferences"]>; path?: string } = {}) {
  const calls: Recorded[] = [];
  const respond = async (path: string, init: RequestInit = {}) => {
    const url = new URL(path, "https://host.test");
    const call: Recorded = { method: init.method ?? "GET", path, url, headers: new Headers(init.headers), body: typeof init.body === "string" ? JSON.parse(init.body) : undefined, signal: init.signal };
    calls.push(call);
    if (init.signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const result = (await handler(call)) ?? { status: 404, body: { error: "not_found", message: `unhandled ${call.method} ${path}` } };
    return { status: result.status ?? 200, body: result.body ?? null };
  };
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    const { status, body } = await respond(path, init);
    if (status < 200 || status >= 300) throw Object.assign(new Error(typeof (body as { error?: unknown })?.error === "string" ? (body as { error: string }).error : "Request failed"), { status, details: body });
    return body;
  });
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    const { status, body } = await respond(path, init);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": typeof body === "string" ? "text/csv" : "application/json", ...(typeof body === "string" ? { "Content-Disposition": 'attachment; filename="export.csv"' } : {}) } });
  });
  const navigate = vi.fn();
  const host: ReferenceHost = {
    scope: { tenantId: "tenant", applicationId: "nexora", branchId: "hq", moduleId: "reference-quality", userId: "user-1", roles: ["quality-manager"], ...options.scope },
    preferences: { ...DEFAULT_PREFERENCES, ...options.preferences },
    request: request as unknown as ReferenceHost["request"],
    fetch,
    navigate,
    path: options.path,
  };
  return { host, calls, request, fetch, navigate };
}

export const json = (body: unknown, status = 200) => ({ status, body });

export const user = (over: Partial<User> = {}): User => ({ id: 3, name: "Dr. Mariam Haddad", email: "mariam@example.test", role: "quality_manager", title: "Head of Quality", facility_id: null, ...over });

export const meta = (over: Partial<Meta> = {}): Meta => ({
  facilities: [
    { id: 1, code: "ALP", name: "Alpine Hospital", type: "hospital", city: "Abu Dhabi", jurisdiction: "Abu Dhabi" },
    { id: 2, code: "BAY", name: "Bayside Clinic", type: "clinic", city: "Dubai", jurisdiction: "Dubai" },
  ],
  periods: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"],
  latestPeriod: "2026-06",
  roles: [{ id: "quality_manager", label: "Quality manager", description: "Owns indicators and reports" }, { id: "viewer", label: "Viewer", description: "Read only" }],
  domains: ["Patient safety", "Laboratory"],
  programs: ["JAWDA", "Internal"],
  eventDomains: [{ id: "lab", label: "Laboratory", stages: ["ordered", "collected", "resulted"], cancel: "cancelled", source: "LIS" }],
  tatDefinitions: [],
  authorities: [{ id: 1, code: "DOH", name: "Department of Health", channel: "portal_upload", active: 1 }],
  users: [{ id: 3, name: "Dr. Mariam Haddad", role: "quality_manager", status: "active" }],
  ...over,
});

export const PERMISSIONS = ["authorities.manage", "events.ingest", "indicators.manage", "reports.design", "results.edit", "results.verify", "results.approve", "results.submit", "schedules.manage", "submissions.approve", "submissions.manage", "users.manage", "validation.resolve", "validation.rules", "validation.run", "validation.waive", "audit.view"];

/** /auth/me and /meta, shared by every module test. */
export function sessionHandler(over: { permissions?: string[]; user?: Partial<User>; meta?: Partial<Meta> } = {}): Handler {
  return (r) => {
    if (r.url.pathname === "/auth/me") return json({ user: user(over.user), permissions: over.permissions ?? PERMISSIONS });
    if (r.url.pathname === "/meta") return json(meta(over.meta));
    if (r.url.pathname === "/me/tasks") return json({ tasks: [], total: 0 });
  };
}

/** Chains handlers: the first one that answers wins. */
export const chain = (...handlers: Handler[]): Handler => async (r) => { for (const h of handlers) { const out = await h(r); if (out) return out; } };

/** Localization that records every message looked up and optionally translates through a table. */
export function recordingLocalization(table: Record<string, string> = {}) {
  const seen = new Set<string>();
  const value: Localization = {
    language: "en", direction: "ltr",
    t: (message, values) => { seen.add(message); return (table[message] ?? message).replace(/\{(\w+)\}/g, (m, k) => values?.[k] === undefined ? m : String(values[k])); },
    dateTime: (v) => String(v),
  };
  const Wrapper = ({ children }: { children: React.ReactNode }) => <LocalizationProvider value={value}>{children}</LocalizationProvider>;
  return { seen, value, Wrapper };
}
