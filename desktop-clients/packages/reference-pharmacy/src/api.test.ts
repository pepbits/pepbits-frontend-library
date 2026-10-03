import { describe, expect, it, vi } from "vitest";
import { ApiError, createPharmacyClient, DataStore, IDEMPOTENCY_HEADER, toApiError } from "./lib/api";

const failure = (status: number, body: unknown) => Object.assign(new Error("transport"), { status, details: body });

function client(handler: (path: string, init: RequestInit) => unknown | Promise<unknown>) {
  const request = vi.fn(async (path: string, init: RequestInit = {}) => handler(path, init));
  return { request, api: createPharmacyClient({ request: request as never }) };
}
const headerOf = (init: RequestInit, name: string) => new Headers(init.headers).get(name);

describe("host transport adapter", () => {
  it("sends module-relative paths only, with an Idempotency-Key on every POST and PATCH but not on reads", async () => {
    const { api, request } = client(() => ({}));
    await api.get("/prescriptions?stage=intake");
    await api.post("/sales", { items: [] });
    await api.patch("/payers/p1", { workflow: "post_dispense" });
    const [read, create, update] = request.mock.calls.map(([path, init]) => ({ path, init: init as RequestInit }));
    expect(request.mock.calls.every(([path]) => !String(path).startsWith("/api") && !String(path).startsWith("http"))).toBe(true);
    expect(read.init.method).toBe("GET");
    expect(headerOf(read.init, IDEMPOTENCY_HEADER)).toBeNull();
    expect(headerOf(create.init, IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    expect(headerOf(update.init, IDEMPOTENCY_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    expect(headerOf(create.init, IDEMPOTENCY_HEADER)).not.toBe(headerOf(update.init, IDEMPOTENCY_HEADER));
    expect(JSON.parse(String(update.init.body))).toEqual({ workflow: "post_dispense" });
  });

  it("a mutation without a body still posts an empty object, as the source did", async () => {
    const { api, request } = client(() => ({}));
    await api.post("/prescriptions/simulate-erx");
    expect(request.mock.calls[0][1]).toMatchObject({ method: "POST", body: "{}" });
  });

  it("reuses the operation key an explicit retry passes, and mints a new one otherwise", async () => {
    const { api, request } = client(() => ({}));
    await api.post("/claims/submit", { ids: ["c1"] }, { operationKey: "op-1" });
    await api.post("/claims/submit", { ids: ["c1"] }, { operationKey: "op-1" });
    await api.post("/claims/submit", { ids: ["c1"] });
    const keys = request.mock.calls.map(([, init]) => headerOf(init as RequestInit, IDEMPOTENCY_HEADER));
    expect(keys[0]).toBe("op-1");
    expect(keys[1]).toBe("op-1");
    expect(keys[2]).not.toBe("op-1");
  });

  it("retries a lost-success mutation under the same key even when the caller passes a fresh one, then clears it", async () => {
    let lose = true;
    const { api, request } = client(() => { if (lose) throw failure(503, null); return { ok: true }; });
    const body = { ids: ["c1"] };
    await expect(api.post("/claims/submit", body, { operationKey: "ui-1" })).rejects.toMatchObject({ status: 503 });
    lose = false;
    await api.post("/claims/submit", body, { operationKey: "ui-2" });
    await api.post("/claims/submit", body, { operationKey: "ui-3" });
    const keys = request.mock.calls.map(([, init]) => headerOf(init as RequestInit, IDEMPOTENCY_HEADER));
    expect(keys).toEqual(["ui-1", "ui-1", "ui-3"]);
  });

  it("scopes the retained key to method, path and payload, and drops it on a definitive answer", async () => {
    let mode: "network" | "invalid" | "ok" = "network";
    const { api, request } = client(() => {
      if (mode === "network") throw new Error("offline");
      if (mode === "invalid") throw failure(422, { error: { code: "invalid", message: "Bad." } });
      return {};
    });
    await expect(api.post("/sales", { qty: 1 }, { operationKey: "a" })).rejects.toMatchObject({ status: 0 });
    mode = "invalid";
    await expect(api.post("/sales", { qty: 2 }, { operationKey: "b" })).rejects.toMatchObject({ status: 422 });
    await expect(api.post("/sales", { qty: 1 }, { operationKey: "c" })).rejects.toMatchObject({ status: 422 });
    mode = "ok";
    await api.post("/sales", { qty: 1 }, { operationKey: "d" });
    await api.patch("/sales", { qty: 1 }, { operationKey: "e" });
    const keys = request.mock.calls.map(([, init]) => headerOf(init as RequestInit, IDEMPOTENCY_HEADER));
    // changed body -> its own key; the definitive 422 on the retry cleared "a", so the next identical call is fresh; other method -> fresh
    expect(keys).toEqual(["a", "b", "a", "d", "e"]);
  });

  it("keeps the source's nested error shape: ApiError.status, .code, .message and .details", async () => {
    const { api } = client(() => { throw failure(409, { error: { code: "stock_changed", message: "Stock changed while you were working.", details: { product: "p1" } } }); });
    const error = await api.post("/prescriptions/1/dispensings", {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "stock_changed", message: "Stock changed while you were working.", details: { product: "p1" } });
  });

  it("describes transport failures without inventing a localhost hint", () => {
    expect(toApiError(new Error("offline"))).toMatchObject({ status: 0, code: "network", message: "Can't reach the Pharmacy-1 service." });
    expect(toApiError(failure(500, null))).toMatchObject({ status: 500, code: "error", message: "The server could not complete the request." });
    expect(toApiError(failure(422, { error: "validation" }))).toMatchObject({ status: 422, message: "validation" });
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
    const unsubscribe = store.subscribe("/dashboard", () => {});
    void store.revalidate("/dashboard");
    unsubscribe();
    expect(signal?.aborted).toBe(true);
    late.resolve({ stale: true });
    await late.promise;
    expect(store.snapshot("/dashboard").data).toBeUndefined();
  });

  it("keeps only the newest response when a refresh overlaps an older read", async () => {
    const first = deferred<unknown>(), second = deferred<unknown>();
    const queue = [first, second];
    const { api } = client(() => queue.shift()!.promise);
    const store = new DataStore(api);
    store.subscribe("/orders", () => {});
    const a = store.revalidate("/orders");
    const b = store.revalidate("/orders", true);
    second.resolve({ n: 2 });
    first.resolve({ n: 1 });
    await Promise.all([a, b]);
    expect(store.snapshot("/orders").data).toEqual({ n: 2 });
  });

  it("dedupes fresh reads, refetches mounted keys after a mutation and never shares data between stores", async () => {
    const calls: string[] = [];
    const { api } = client((path) => { calls.push(path); return { path }; });
    const one = new DataStore(api), two = new DataStore(api);
    one.subscribe("/meta", () => {});
    await one.revalidate("/meta");
    await one.revalidate("/meta");
    expect(calls).toEqual(["/meta"]);
    await one.refreshAll();
    expect(calls).toEqual(["/meta", "/meta"]);
    expect(two.snapshot("/meta").data).toBeUndefined();
    one.dispose();
    expect(one.snapshot("/meta").data).toBeUndefined();
  });

  it("shows the error and keeps showing it until the next success", async () => {
    let fail = true;
    const { api } = client(() => { if (fail) throw failure(403, { error: { code: "forbidden", message: "No access." } }); return { ok: true }; });
    const store = new DataStore(api);
    store.subscribe("/payers", () => {});
    await store.revalidate("/payers");
    expect(store.snapshot("/payers").error).toMatchObject({ status: 403, code: "forbidden" });
    fail = false;
    await store.revalidate("/payers", true);
    expect(store.snapshot("/payers")).toMatchObject({ data: { ok: true }, error: undefined });
  });
});
