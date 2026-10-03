import { describe, expect, it, vi } from "vitest";
import { ApiError, DataStore, IDEMPOTENCY_HEADER, SCOPE_HEADER, createRcmClient, toApiError } from "./lib/api";

const ok = (body: unknown = { ok: true }) => vi.fn(async (_p: string, _i?: RequestInit) => body);
const fail = (status: number, details?: unknown) => Object.assign(new Error("failed"), { status, details });

describe("RCM client", () => {
  it("sends module-relative paths with JSON bodies, never an /api prefix, actor header or token", async () => {
    const request = ok();
    const client = createRcmClient({ request: request as never });
    await client.post("/records/invoices/7/actions/issue", { rowVersion: 4, input: {}, reason: "" });
    const [path, init] = request.mock.calls[0];
    expect(path).toBe("/records/invoices/7/actions/issue");
    expect(path.startsWith("/api")).toBe(false);
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.has("x-actor-id")).toBe(false);
    expect(headers.has("Authorization")).toBe(false);
    expect(JSON.parse(String(init?.body))).toEqual({ rowVersion: 4, input: {}, reason: "" });
  });

  it("sends the source scope filter as x-rcm-scope when given and omits it otherwise; reads carry no idempotency key", async () => {
    const request = ok();
    const client = createRcmClient({ request: request as never });
    await client.get("/dashboard/home", { scope: "ALL:AED" });
    await client.get("/meta");
    const [a, b] = request.mock.calls.map((c) => new Headers(c[1]?.headers));
    expect(a.get(SCOPE_HEADER)).toBe("ALL:AED");
    expect(b.has(SCOPE_HEADER)).toBe(false);
    expect(a.has(IDEMPOTENCY_HEADER)).toBe(false);
  });

  it("gives every write an idempotency key and replays the same key when the outcome of an identical write was lost", async () => {
    const seen: string[] = [];
    let attempt = 0;
    const request = vi.fn(async (_p: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get(IDEMPOTENCY_HEADER) ?? "");
      if (++attempt === 1) throw fail(503);
      if (attempt === 2) throw Object.assign(new Error("net"), {});
      return { id: 1 };
    });
    const client = createRcmClient({ request: request as never });
    await expect(client.post("/records/invoices", { values: { a: 1 } })).rejects.toMatchObject({ status: 503 });
    await expect(client.post("/records/invoices", { values: { a: 1 } })).rejects.toMatchObject({ code: "OFFLINE" });
    await client.post("/records/invoices", { values: { a: 1 } });
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBeTruthy();
    await client.post("/records/invoices", { values: { a: 1 } });
    expect(seen[3]).not.toBe(seen[0]);
  });

  it("uses a new key for a different payload, a different scope filter, or after a definite failure", async () => {
    const seen: string[] = [];
    let n = 0;
    const request = vi.fn(async (_p: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get(IDEMPOTENCY_HEADER) ?? "");
      if (++n === 1) throw fail(503);
      if (n === 4) throw fail(422, { error: { code: "VALIDATION", message: "no" } });
      return {};
    });
    const client = createRcmClient({ request: request as never });
    await client.post("/records/invoices", { values: { a: 1 } }).catch(() => {});
    await client.post("/records/invoices", { values: { a: 2 } });
    await client.post("/records/invoices", { values: { a: 1 } }, { scope: "ALL:AED" });
    await client.post("/records/invoices", { values: { a: 3 } }).catch(() => {});
    await client.post("/records/invoices", { values: { a: 3 } });
    expect(new Set(seen.slice(0, 3)).size).toBe(3);
    expect(seen[4]).not.toBe(seen[3]);
  });

  it("keeps the key after an abort so the retry is the same operation", async () => {
    const seen: string[] = [];
    let n = 0;
    const request = vi.fn(async (_p: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get(IDEMPOTENCY_HEADER) ?? "");
      if (++n === 1) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
      return {};
    });
    const client = createRcmClient({ request: request as never });
    await expect(client.put("/records/invoices/7", { rowVersion: 1 })).rejects.toMatchObject({ name: "AbortError" });
    await client.put("/records/invoices/7", { rowVersion: 1 });
    expect(seen[0]).toBe(seen[1]);
  });

  it("maps the source error shape, and a missing status to OFFLINE", () => {
    const e = toApiError(fail(409, { error: { code: "STALE_VERSION", message: "Changed by someone else.", fieldErrors: { amount: "Too high" } } }));
    expect(e).toBeInstanceOf(ApiError);
    expect([e.status, e.code, e.message, e.fieldErrors]).toEqual([409, "STALE_VERSION", "Changed by someone else.", { amount: "Too high" }]);
    expect(toApiError(new Error("x")).code).toBe("OFFLINE");
    expect(toApiError(fail(500)).message).toMatch(/server could not complete/);
  });
});

describe("RCM data store", () => {
  it("keys reads by scope filter and path, dedupes concurrent reads, and discards a superseded answer", async () => {
    const calls: { path: string; scope?: string }[] = [];
    const resolvers: ((v: unknown) => void)[] = [];
    const client = { get: vi.fn((path: string, o?: { scope?: string }) => { calls.push({ path, scope: o?.scope }); return new Promise((r) => { resolvers.push(r); }); }) } as never;
    const store = new DataStore(client);
    const sar = DataStore.key("ALL:SAR", "/dashboard/home");
    const aed = DataStore.key("ALL:AED", "/dashboard/home");
    const unsub = store.subscribe(sar, () => {});
    void store.revalidate(sar); void store.revalidate(sar);
    void store.revalidate(aed);
    expect(calls).toEqual([{ path: "/dashboard/home", scope: "ALL:SAR" }, { path: "/dashboard/home", scope: "ALL:AED" }]);
    void store.revalidate(sar, true);
    resolvers[0]({ stale: true }); resolvers[2]({ fresh: true });
    await Promise.resolve(); await Promise.resolve();
    expect(store.snapshot(sar).data).toEqual({ fresh: true });
    expect(store.snapshot(aed).data).toBeUndefined();
    unsub();
  });

  it("aborts a read nobody listens to any more, and disposes everything", () => {
    const signals: AbortSignal[] = [];
    const client = { get: vi.fn((_p: string, o?: { signal?: AbortSignal }) => { signals.push(o!.signal!); return new Promise(() => {}); }) } as never;
    const store = new DataStore(client);
    const key = DataStore.key("ALL:SAR", "/pending");
    const unsub = store.subscribe(key, () => {});
    void store.revalidate(key);
    unsub();
    expect(signals[0].aborted).toBe(true);
    const other = DataStore.key(null, "/meta");
    store.subscribe(other, () => {});
    void store.revalidate(other);
    store.dispose();
    expect(signals[1].aborted).toBe(true);
    expect(store.snapshot(other).data).toBeUndefined();
  });

  it("refreshAll refetches mounted scoped reads and leaves identity (/meta) alone", async () => {
    const paths: string[] = [];
    const client = { get: vi.fn(async (p: string) => { paths.push(p); return {}; }) } as never;
    const store = new DataStore(client);
    for (const key of [DataStore.key(null, "/meta"), DataStore.key("ALL:SAR", "/pending"), DataStore.key("ALL:SAR", "/records/invoices")]) { store.subscribe(key, () => {}); await store.revalidate(key); }
    paths.length = 0;
    await store.refreshAll();
    expect(paths.sort()).toEqual(["/pending", "/records/invoices"]);
  });
});
