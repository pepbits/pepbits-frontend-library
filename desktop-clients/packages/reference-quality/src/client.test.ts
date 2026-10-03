import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, IDEMPOTENCY_HEADER, createQualityClient, withQuery } from "./lib/api";

const ok = (body: unknown) => vi.fn(async (_path: string, _init?: RequestInit) => body as never);

afterEach(() => vi.restoreAllMocks());

describe("withQuery", () => {
  it("drops empty values and joins arrays", () => {
    expect(withQuery("/x", { a: 1, b: "", c: null, d: undefined, e: [1, 2], f: [] })).toBe("/x?a=1&e=1%2C2");
    expect(withQuery("/x")).toBe("/x");
  });
});

describe("quality client over the host transport", () => {
  it("sends module-relative paths with no /api prefix and no Authorization or stored token", async () => {
    const request = ok({ rows: [] });
    const { api } = createQualityClient({ request });
    await api("/indicators", { query: { domain: "Laboratory" } });
    const [path, init] = request.mock.calls[0];
    expect(path).toBe("/indicators?domain=Laboratory");
    expect(path.startsWith("/api")).toBe(false);
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(window.localStorage.length).toBe(0);
  });

  it("gives every mutation a fresh Idempotency-Key and no read does", async () => {
    const request = ok({});
    const { api } = createQualityClient({ request });
    await api("/schedules", { body: { name: "A" } });
    await api("/schedules/1", { method: "PUT", body: { name: "B" } });
    await api("/schedules/1", { method: "DELETE" });
    await api("/schedules/1", { method: "PATCH", body: {} });
    await api("/schedules");
    const keys = request.mock.calls.map(([, init]) => new Headers(init?.headers).get(IDEMPOTENCY_HEADER));
    expect(keys.slice(0, 4).every((k) => /^[0-9a-f-]{36}$/.test(k ?? ""))).toBe(true);
    expect(new Set(keys.slice(0, 4)).size).toBe(4);
    expect(keys[4]).toBeNull();
    expect(request.mock.calls[0][1]?.method).toBe("POST");
    expect(new Headers(request.mock.calls[0][1]?.headers).get("Content-Type")).toBe("application/json");
  });

  it("reuses an explicit operationKey so a retry replays the same operation", async () => {
    const request = ok({});
    const { api } = createQualityClient({ request });
    await api("/submissions", { body: { template: 1 }, operationKey: "op-123" });
    await api("/submissions", { body: { template: 1 }, operationKey: "op-123" });
    expect(request.mock.calls.map(([, i]) => new Headers(i?.headers).get(IDEMPOTENCY_HEADER))).toEqual(["op-123", "op-123"]);
  });

  it("maps host failures onto ApiError with the source's code and message", async () => {
    const failure = Object.assign(new Error("validation_failed"), { status: 422, details: { error: "validation_failed", message: "Numerator cannot exceed denominator." } });
    const { api } = createQualityClient({ request: vi.fn(async () => { throw failure; }) as never });
    const error = await api("/results/1", { method: "PUT", body: {} }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "validation_failed", message: "Numerator cannot exceed denominator." });
  });

  it("uses generic messages for 4xx/5xx without a body and reports an unreachable service as status 0", async () => {
    const make = (e: unknown) => createQualityClient({ request: vi.fn(async () => { throw e; }) as never }).api("/x");
    await expect(make(Object.assign(new Error("x"), { status: 503 }))).rejects.toMatchObject({ status: 503, message: "The server could not complete the request." });
    await expect(make(Object.assign(new Error("x"), { status: 404 }))).rejects.toMatchObject({ status: 404, message: "The request could not be completed." });
    await expect(make(new TypeError("fetch failed"))).rejects.toMatchObject({ status: 0, code: "network" });
  });

  it("surfaces a version conflict (409) to the caller so unsaved values stay on screen", async () => {
    const conflict = Object.assign(new Error("conflict"), { status: 409, details: { error: "conflict", message: "This result changed. Reload it." } });
    const { api } = createQualityClient({ request: vi.fn(async () => { throw conflict; }) as never });
    await expect(api("/results/1", { method: "PUT", body: { version: 2 } })).rejects.toMatchObject({ status: 409, message: "This result changed. Reload it." });
  });

  it("downloads exports through the authenticated host fetch with the server file name", async () => {
    const fetch = vi.fn(async () => new Response("a,b\n1,2", { status: 200, headers: { "Content-Disposition": 'attachment; filename="audit.csv"' } }));
    const create = vi.fn(() => "blob:x"); const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { download } = createQualityClient({ request: ok({}), fetch });
    await download("/audit/export.csv", { from: "2026-01-01" });
    expect(fetch).toHaveBeenCalledWith("/audit/export.csv?from=2026-01-01");
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });

  it("fails a download clearly when the host has no fetch or the export is refused", async () => {
    await expect(createQualityClient({ request: ok({}) }).download("/x")).rejects.toMatchObject({ code: "unavailable" });
    const refused = createQualityClient({ request: ok({}), fetch: vi.fn(async () => new Response(JSON.stringify({ error: "forbidden", message: "Not allowed." }), { status: 403 })) });
    await expect(refused.download("/x")).rejects.toMatchObject({ status: 403, message: "Not allowed." });
  });
});
