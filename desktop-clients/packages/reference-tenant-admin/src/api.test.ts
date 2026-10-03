import { describe, expect, it, vi } from "vitest";
import { ApiError, createTenantAdminClient, DataStore, IDEMPOTENCY_HEADER, toApiError } from "./lib/api";

const failure = (status: number, body: unknown) => Object.assign(new Error("transport"), { status, details: body });

function client(handler: (path: string, init: RequestInit) => unknown | Promise<unknown>) {
  const request = vi.fn(async (path: string, init: RequestInit = {}) => handler(path, init));
  return { request, api: createTenantAdminClient({ request: request as never }) };
}
const headerOf = (init: RequestInit, name: string) => new Headers(init.headers).get(name);
const keysOf = (request: ReturnType<typeof client>["request"]) => request.mock.calls.map(([, init]) => headerOf(init as RequestInit, IDEMPOTENCY_HEADER));

describe("host transport adapter", () => {
  it("sends module-relative paths only, with no actor header, and an Idempotency-Key on every write but not on reads", async () => {
    const { api, request } = client(() => ({}));
    await api.get("/resources/items?status=ALL");
    await api.post("/resources/items", { name: "A" });
    await api.put("/resources/items/7", { name: "B", rowVersion: 1 });
    await api.delete("/resources/items/7?rowVersion=2");
    const [read, create, update, discard] = request.mock.calls.map(([path, init]) => ({ path, init: init as RequestInit }));
    expect(request.mock.calls.every(([path]) => !String(path).startsWith("/api") && !String(path).startsWith("http"))).toBe(true);
    expect(request.mock.calls.every(([, init]) => !new Headers((init as RequestInit).headers).has("x-actor-id"))).toBe(true);
    expect([read.init.method, create.init.method, update.init.method, discard.init.method]).toEqual(["GET", "POST", "PUT", "DELETE"]);
    expect(headerOf(read.init, IDEMPOTENCY_HEADER)).toBeNull();
    for (const w of [create, update, discard]) expect(headerOf(w.init, IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(keysOf(request).filter(Boolean)).size).toBe(3);
    expect(discard.init.body).toBeUndefined();
    expect(JSON.parse(String(update.init.body))).toEqual({ name: "B", rowVersion: 1 });
  });

  it("a write without a body posts an empty object, as the source did", async () => {
    const { api, request } = client(() => ({}));
    await api.post("/resources/items/7/activate");
    expect(request.mock.calls[0][1]).toMatchObject({ method: "POST", body: "{}" });
  });

  it("retries a lost-success write under the same key even when the caller passes a fresh one, then clears it", async () => {
    let lose = true;
    const { api, request } = client(() => { if (lose) throw failure(503, null); return { ok: true }; });
    const body = { rowVersion: 3, reason: "x" };
    await expect(api.post("/resources/items/7/approve", body, { operationKey: "ui-1" })).rejects.toMatchObject({ status: 503 });
    lose = false;
    await api.post("/resources/items/7/approve", body, { operationKey: "ui-2" });
    await api.post("/resources/items/7/approve", body, { operationKey: "ui-3" });
    expect(keysOf(request)).toEqual(["ui-1", "ui-1", "ui-3"]);
  });

  it("scopes the retained key to method, path and payload, and drops it on a definitive answer", async () => {
    let mode: "network" | "invalid" | "ok" = "network";
    const { api, request } = client(() => {
      if (mode === "network") throw new Error("offline");
      if (mode === "invalid") throw failure(422, { error: { code: "VALIDATION", message: "Bad.", fieldErrors: { name: "Required" } } });
      return {};
    });
    await expect(api.post("/resources/items", { name: "A" }, { operationKey: "a" })).rejects.toMatchObject({ status: 0, code: "OFFLINE" });
    mode = "invalid";
    await expect(api.post("/resources/items", { name: "B" }, { operationKey: "b" })).rejects.toMatchObject({ status: 422 });
    await expect(api.post("/resources/items", { name: "A" }, { operationKey: "c" })).rejects.toMatchObject({ status: 422 });
    mode = "ok";
    await api.post("/resources/items", { name: "A" }, { operationKey: "d" });
    await api.put("/resources/items", { name: "A" }, { operationKey: "e" });
    expect(keysOf(request)).toEqual(["a", "b", "a", "d", "e"]);
  });

  it("keeps an aborted write's key for the retry", async () => {
    let abort = true;
    const { api, request } = client(() => { if (abort) throw Object.assign(new Error("Aborted"), { name: "AbortError" }); return {}; });
    await expect(api.post("/resources/items", { name: "A" }, { operationKey: "k1" })).rejects.toMatchObject({ name: "AbortError" });
    abort = false;
    await api.post("/resources/items", { name: "A" }, { operationKey: "k2" });
    expect(keysOf(request)).toEqual(["k1", "k1"]);
  });

  it("keeps the source's error shape: status, stable code, message and field errors", async () => {
    const { api } = client(() => { throw failure(409, { error: { code: "STALE_VERSION", message: "Someone changed this record.", fieldErrors: { rowVersion: "Old" } } }); });
    const error = await api.put("/resources/items/7", { rowVersion: 1 }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "STALE_VERSION", message: "Someone changed this record.", fieldErrors: { rowVersion: "Old" } });
  });

  it("describes transport failures with the source codes and no localhost hint", () => {
    expect(toApiError(new Error("offline"))).toMatchObject({ status: 0, code: "OFFLINE", message: "The Tenant Admin service can't be reached." });
    expect(toApiError(failure(500, null))).toMatchObject({ status: 500, code: "ERROR", message: "The server could not complete the request." });
    expect(toApiError(failure(404, { error: { code: "NOT_FOUND", message: "No such endpoint." } }))).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(toApiError(failure(422, { error: "text" })).fieldErrors).toBeUndefined();
  });

  it("passes an abort through untouched so callers can ignore it", async () => {
    const { api } = client(() => { throw Object.assign(new Error("Aborted"), { name: "AbortError" }); });
    await expect(api.get("/meta", { signal: new AbortController().signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("scope-keyed data store", () => {
  const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };

  it("aborts an in-flight read when nobody listens any more and discards its late answer", async () => {
    const late = deferred<unknown>();
    let signal: AbortSignal | undefined;
    const { api } = client((_p, init) => { signal = init.signal as AbortSignal; return late.promise; });
    const store = new DataStore(api);
    const unsubscribe = store.subscribe("/overview", () => {});
    void store.revalidate("/overview");
    unsubscribe();
    expect(signal?.aborted).toBe(true);
    late.resolve({ stale: true });
    await late.promise;
    expect(store.snapshot("/overview").data).toBeUndefined();
  });

  it("aborts every request and forgets every entry on dispose (scope change or unmount)", async () => {
    const signals: AbortSignal[] = [];
    const { api } = client((_p, init) => { signals.push(init.signal as AbortSignal); return new Promise(() => {}); });
    const store = new DataStore(api);
    store.subscribe("/meta", () => {}); store.subscribe("/pending", () => {});
    void store.revalidate("/meta"); void store.revalidate("/pending");
    store.dispose();
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.aborted)).toBe(true);
    expect(store.snapshot("/meta").data).toBeUndefined();
  });

  it("keeps only the newest response when a refresh overlaps an older read", async () => {
    const first = deferred<unknown>(), second = deferred<unknown>();
    const queue = [first, second];
    const { api } = client(() => queue.shift()!.promise);
    const store = new DataStore(api);
    store.subscribe("/approvals", () => {});
    const a = store.revalidate("/approvals");
    const b = store.revalidate("/approvals", true);
    second.resolve({ n: 2 });
    first.resolve({ n: 1 });
    await Promise.all([a, b]);
    expect(store.snapshot("/approvals").data).toEqual({ n: 2 });
  });

  it("dedupes fresh reads, refetches mounted keys after a mutation and never shares data between stores (option lists included)", async () => {
    const calls: string[] = [];
    const { api } = client((path) => { calls.push(path); return { path }; });
    const one = new DataStore(api), two = new DataStore(api);
    one.subscribe("/resources/items/options", () => {});
    await one.revalidate("/resources/items/options");
    await one.revalidate("/resources/items/options");
    expect(calls).toEqual(["/resources/items/options"]);
    await one.refreshAll();
    expect(calls).toHaveLength(2);
    expect(two.snapshot("/resources/items/options").data).toBeUndefined();
    one.dispose();
    expect(one.snapshot("/resources/items/options").data).toBeUndefined();
  });

  it("marks unmounted keys stale on refreshAll so the next use refetches them", async () => {
    const calls: string[] = [];
    const { api } = client((path) => { calls.push(path); return {}; });
    const store = new DataStore(api);
    await store.revalidate("/resources/tax-rules/options");
    await store.refreshAll();
    expect(calls).toHaveLength(1);
    await store.revalidate("/resources/tax-rules/options");
    expect(calls).toHaveLength(2);
  });

  it("shows the error and keeps showing it until the next success", async () => {
    let fail = true;
    const { api } = client(() => { if (fail) throw failure(403, { error: { code: "FORBIDDEN", message: "No access." } }); return { ok: true }; });
    const store = new DataStore(api);
    store.subscribe("/pending", () => {});
    await store.revalidate("/pending");
    expect(store.snapshot("/pending").error).toMatchObject({ status: 403, code: "FORBIDDEN" });
    fail = false;
    await store.revalidate("/pending", true);
    expect(store.snapshot("/pending")).toMatchObject({ data: { ok: true }, error: undefined });
  });
});
