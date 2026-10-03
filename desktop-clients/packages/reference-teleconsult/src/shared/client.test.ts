import { describe, expect, it, vi } from "vitest";
import { ApiError, assertApiPath, createTeleconsultClient, qs } from "./client";

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const make = (fetch: (path: string, init?: RequestInit) => Promise<Response>, headers?: Record<string, string>) => createTeleconsultClient({ fetch, headers, newKey: (() => { let n = 0; return () => `key-${++n}`; })() });
const keyOf = (fetch: ReturnType<typeof vi.fn>, call: number) => new Headers(fetch.mock.calls[call][1].headers).get("Idempotency-Key");

describe("teleconsult client", () => {
  it("maps GET/POST/PUT/PATCH and sends Idempotency-Key only on mutations", async () => {
    const fetch = vi.fn().mockImplementation(async () => respond({ ok: true }));
    const client = make(fetch);
    await client.get("/api/staff");
    await client.post("/api/appointments", { a: 1 });
    await client.put("/api/encounters/e1", { b: 2 });
    await client.patch("/api/appointments/a1", { c: 3 });
    expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual(["GET", "POST", "PUT", "PATCH"]);
    expect(keyOf(fetch, 0)).toBeNull();
    expect([1, 2, 3].map((i) => keyOf(fetch, i))).toEqual(["key-1", "key-2", "key-3"]);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ a: 1 });
    expect(new Headers(fetch.mock.calls[1][1].headers).get("Content-Type")).toBe("application/json");
  });

  it("adds the routing header the server validates, on every request, and lets it override a caller header", async () => {
    const fetch = vi.fn().mockImplementation(async () => respond([]));
    const client = make(fetch, { "X-Teleconsult-Role": "nurse" });
    await client.get("/api/queue");
    await client.post("/api/appointments/a1/messages", { text: "hi" });
    expect(fetch.mock.calls.every(([, init]) => new Headers(init.headers).get("X-Teleconsult-Role") === "nurse")).toBe(true);
  });

  it("replays an identical mutation that failed with an unknown outcome under the same key", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockRejectedValueOnce(new TypeError("offline")).mockImplementation(async () => respond({ id: "m1" }, 201));
    const client = make(fetch);
    await expect(client.post("/api/appointments/a1/messages", { text: "hello" })).rejects.toMatchObject({ status: 0 });
    await expect(client.post("/api/appointments/a1/messages", { text: "hello" })).rejects.toBeInstanceOf(ApiError);
    await client.post("/api/appointments/a1/messages", { text: "hello" });
    expect([0, 1, 2].map((i) => keyOf(fetch, i))).toEqual(["key-1", "key-1", "key-1"]);
    // Once it succeeded, the same text sent again is a NEW message and must not replay the old key.
    await client.post("/api/appointments/a1/messages", { text: "hello" });
    expect(keyOf(fetch, 3)).toBe("key-2");
  });

  it("does not reuse a key when the body changed or after a definite rejection", async () => {
    const fetch = vi.fn().mockImplementationOnce(async () => respond({ error: "Cannot sign yet", problems: ["Add a primary diagnosis"] }, 422)).mockImplementation(async () => respond({}));
    const client = make(fetch);
    await expect(client.post("/api/encounters/e1/sign", { v: 1 })).rejects.toMatchObject({ status: 422, problems: ["Add a primary diagnosis"] });
    await client.post("/api/encounters/e1/sign", { v: 1 });
    await client.post("/api/encounters/e1/sign", { v: 2 });
    expect([0, 1, 2].map((i) => keyOf(fetch, i))).toEqual(["key-1", "key-2", "key-3"]);
  });

  it("keeps the key across a transient server fault", async () => {
    const fetch = vi.fn().mockImplementationOnce(async () => respond({ error: "Bad gateway" }, 502)).mockImplementation(async () => respond({}));
    const client = make(fetch);
    await expect(client.put("/api/encounters/e1", { x: 1 })).rejects.toMatchObject({ status: 502 });
    await client.put("/api/encounters/e1", { x: 1 });
    expect(keyOf(fetch, 1)).toBe(keyOf(fetch, 0));
  });

  it("surfaces conflicts with the server message and never retries them", async () => {
    const fetch = vi.fn().mockImplementation(async () => respond({ error: "This note is signed and locked" }, 409));
    const client = make(fetch);
    const error = await client.put("/api/encounters/e1", {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "This note is signed and locked", isConflict: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed success bodies instead of returning undefined data", async () => {
    const client = make(vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));
    await expect(client.get("/api/session")).rejects.toThrow("malformed JSON");
  });

  it("passes the abort signal through and does not report an abort as a network failure", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockImplementation(async (_path: string, init: RequestInit) => { if (init.signal?.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" }); return respond({}); });
    const client = make(fetch);
    controller.abort();
    await expect(client.get("/api/queue", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each(["https://evil.test/api/x", "//evil.test/api", "/api/../auth/token", "/api/%2e%2e/auth", "/auth/session", "/api\\x", "/apix"])("refuses a path outside the module API: %s", async (path) => {
    const fetch = vi.fn();
    expect(() => assertApiPath(path)).toThrow("Invalid Teleconsult API path");
    await expect(make(fetch).get(path)).rejects.toThrow("Invalid Teleconsult API path");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("builds query strings without empty values", () => {
    expect(qs({ role: "nurse", q: "", x: undefined, date: "2026-10-01" })).toBe("?role=nurse&date=2026-10-01");
    expect(qs({})).toBe("");
  });
});
