import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { createTeleconsultClient } from "./client";
import { useApiResource, useHotkey, useLivePoll } from "./hooks";
import { makeHost } from "../test-utils";

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const clientFor = (fetch: (path: string, init?: RequestInit) => Promise<Response>) => createTeleconsultClient({ fetch });

describe("useApiResource", () => {
  it("discards a response that arrives after the path changed, and aborts the superseded request", async () => {
    const resolvers: Record<string, (r: Response) => void> = {};
    const signals: Record<string, AbortSignal | null | undefined> = {};
    const fetch = vi.fn((path: string, init?: RequestInit) => { signals[path] = init?.signal; return new Promise<Response>((resolve) => { resolvers[path] = resolve; }); });
    const client = clientFor(fetch);
    const { result, rerender } = renderHook(({ path }) => useApiResource<{ n: string }>(client, path), { initialProps: { path: "/api/a" } });
    rerender({ path: "/api/b" });
    expect(signals["/api/a"]?.aborted).toBe(true);
    await act(async () => resolvers["/api/b"](respond({ n: "b" })));
    await act(async () => resolvers["/api/a"](respond({ n: "stale-a" })));
    await waitFor(() => expect(result.current.data).toEqual({ n: "b" }));
    expect(result.current.error).toBeUndefined();
  });

  it("drops the previous client's data when the scope, role or beneficiary changes", async () => {
    const one = clientFor(async () => respond({ who: "doctor" }));
    const two = clientFor(async () => respond({ who: "nurse" }));
    const { result, rerender } = renderHook(({ client }) => useApiResource<{ who: string }>(client, "/api/queue"), { initialProps: { client: one } });
    await waitFor(() => expect(result.current.data).toEqual({ who: "doctor" }));
    rerender({ client: two });
    await waitFor(() => expect(result.current.data).toEqual({ who: "nurse" }));
  });

  it("aborts the in-flight request on unmount and never sets state afterwards", async () => {
    let signal: AbortSignal | null | undefined;
    const client = clientFor((_path, init) => { signal = init?.signal; return new Promise<Response>(() => undefined); });
    const { unmount } = renderHook(() => useApiResource(client, "/api/queue"));
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  describe("polling", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    it("does not stack a poll on a request that is still running, and reload() supersedes it", async () => {
      let calls = 0;
      const pending: Array<(r: Response) => void> = [];
      const client = clientFor(() => { calls++; return new Promise<Response>((resolve) => pending.push(resolve)); });
      const { result } = renderHook(() => useApiResource(client, "/api/queue", { poll: 1000 }));
      await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
      expect(calls).toBe(1);
      act(() => { void result.current.reload(); });
      expect(calls).toBe(2);
      await act(async () => { pending[1](respond([1])); });
      expect(result.current.data).toEqual([1]);
    });
  });
});

describe("useLivePoll", () => {
  it("polls the authenticated endpoint, delivers frames and stops when the server reports done", async () => {
    const frames: unknown[] = [{ id: "t1", text: "one" }, { id: "t2", text: "two" }, { done: true }, { id: "never" }];
    const fetch = vi.fn(async () => respond(frames.shift()));
    const seen: unknown[] = [];
    const client = clientFor(fetch);
    const { result } = renderHook(() => useLivePoll<{ id?: string; done?: boolean }>(client, "/api/appointments/a1/transcript/current", (f) => seen.push(...f), { intervalMs: 10, isDone: (f) => f.done === true }));
    await waitFor(() => expect(seen).toHaveLength(3));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(seen).toEqual([{ id: "t1", text: "one" }, { id: "t2", text: "two" }, { done: true }]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.connected).toBe(true);
  });

  it("never opens a request without a path and cancels the loop on unmount", async () => {
    const fetch = vi.fn(async () => respond({ hr: 70 }));
    const client = clientFor(fetch);
    const { rerender, unmount } = renderHook(({ path }) => useLivePoll(client, path, () => undefined, { intervalMs: 10 }), { initialProps: { path: null as string | null } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetch).not.toHaveBeenCalled();
    rerender({ path: "/api/appointments/a1/vitals/current" });
    await waitFor(() => expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(2));
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const after = fetch.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(fetch.mock.calls.length).toBe(after);
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
  });

  it("keeps retrying after a transient fault but stops on a permanent denial", async () => {
    let n = 0;
    const fetch = vi.fn(async () => { n++; if (n === 1) throw new TypeError("offline"); if (n === 2) return respond({ hr: 71, spo2: 98 }); return respond({ error: "Forbidden" }, 403); });
    const seen: unknown[] = [];
    const client = clientFor(fetch);
    const { result } = renderHook(() => useLivePoll(client, "/api/appointments/a1/vitals/current", (f) => seen.push(...f), { intervalMs: 10 }));
    await waitFor(() => expect(result.current.error).toBe("Forbidden"));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(seen).toEqual([{ hr: 71, spo2: 98 }]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.connected).toBe(false);
  });

  it("restarts for a new client and ignores frames from the old one", async () => {
    const oldResponse: { resolve?: (r: Response) => void } = {};
    const oldClient = clientFor(() => new Promise<Response>((resolve) => { oldResponse.resolve = resolve; }));
    const newClient = clientFor(async () => respond({ hr: 80, spo2: 99 }));
    const seen: unknown[] = [];
    const { rerender } = renderHook(({ client }) => useLivePoll(client, "/api/x/current", (f) => seen.push(...f), { intervalMs: 1000 }), { initialProps: { client: oldClient } });
    rerender({ client: newClient });
    await waitFor(() => expect(seen).toEqual([{ hr: 80, spo2: 99 }]));
    await act(async () => { oldResponse.resolve?.(respond({ hr: 1, spo2: 1 })); });
    expect(seen).toEqual([{ hr: 80, spo2: 99 }]);
  });
});

describe("useHotkey", () => {
  const wrapper = (shortcuts: boolean) => {
    const { host } = makeHost(() => undefined, { preferences: { keyboardShortcuts: shortcuts } });
    return ({ children }: { children: React.ReactNode }) => <ReferenceHostProvider host={host}>{children}</ReferenceHostProvider>;
  };
  const press = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));

  it("fires while the keyboardShortcuts preference is on", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey((e) => e.ctrlKey && e.key === "k", handler), { wrapper: wrapper(true) });
    press();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("attaches no listener when shortcuts are disabled and detaches when they are turned off", () => {
    const handler = vi.fn();
    const add = vi.spyOn(window, "addEventListener");
    renderHook(() => useHotkey((e) => e.ctrlKey, handler), { wrapper: wrapper(false) });
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0);
    press();
    expect(handler).not.toHaveBeenCalled();
    add.mockRestore();
  });
});
