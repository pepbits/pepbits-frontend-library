import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceHostProvider } from "@pepbits/reference-host";
import { ApiError } from "../../shared/client";
import type { Encounter } from "../../shared/types";
import { encounter, json, makeHost, type Handler, type Recorded } from "../../test-utils";
import { useEncounterSync } from "./encounter-sync";

const wrapperFor = (host: ReturnType<typeof makeHost>["host"]) => ({ children }: { children: React.ReactNode }) => <ReferenceHostProvider host={host}>{children}</ReferenceHostProvider>;
const puts = (calls: Recorded[]) => calls.filter((c) => c.method === "PUT");
// RTL's waitFor polls with the (faked) setTimeout, so poll by advancing the fake clock inside act().
async function waitFor(check: () => void) {
  let last: unknown;
  for (let i = 0; i < 400; i++) {
    try { check(); return; } catch (error) { last = error; }
    await act(async () => { await vi.advanceTimersByTimeAsync(25); });
  }
  throw last;
}
const settle = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

async function mount(handler: Handler) {
  const harness = makeHost(handler);
  const view = renderHook(() => useEncounterSync("a1"), { wrapper: wrapperFor(harness.host) });
  await waitFor(() => expect(view.result.current.enc).toBeDefined());
  return { ...harness, ...view };
}

describe("useEncounterSync", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
  afterEach(() => vi.useRealTimers());

  it("autosaves with the expected version and an Idempotency-Key, and adopts the version the server returns", async () => {
    let serverVersion = 3;
    const view = await mount((r) => {
      if (r.method === "GET") return json(encounter({ version: serverVersion }));
      if (r.method === "PUT") { serverVersion += 1; return json(encounter({ version: serverVersion, updatedAt: "2026-10-01T09:05:00.000Z" })); }
    });
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, subjective: "Burning for 3 days" } })));
    await settle(800);
    await waitFor(() => expect(view.result.current.saveState).toBe("saved"));
    const first = puts(view.calls)[0];
    expect(first.url.pathname).toBe("/api/encounters/e1");
    expect((first.body as Encounter).version).toBe(3);
    expect((first.body as Encounter).soap.subjective).toBe("Burning for 3 days");
    expect(first.headers.get("Idempotency-Key")).toBeTruthy();
    expect(view.result.current.enc?.version).toBe(4);

    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, plan: "Nitrofurantoin" } })));
    await settle(800);
    await waitFor(() => expect(puts(view.calls)).toHaveLength(2));
    expect((puts(view.calls)[1].body as Encounter).version).toBe(4);
    expect(puts(view.calls)[1].headers.get("Idempotency-Key")).not.toBe(first.headers.get("Idempotency-Key"));
  });

  it("does not save when nothing was edited, and merging the server-owned transcript is not an edit", async () => {
    const view = await mount((r) => r.method === "GET" ? json(encounter()) : undefined);
    act(() => view.result.current.mergeTranscript([{ id: "t1", speaker: "patient", text: "It hurts", at: "2026-10-01T09:02:00Z" }]));
    act(() => view.result.current.mergeTranscript([{ id: "t1", speaker: "patient", text: "It hurts", at: "2026-10-01T09:02:00Z" }]));
    await settle(2000);
    expect(view.result.current.enc?.transcript).toHaveLength(1);
    expect(puts(view.calls)).toHaveLength(0);
  });

  it("keeps an edit made while a save is in flight and sends it next with the new version", async () => {
    let release!: () => void;
    let serverVersion = 3;
    const view = await mount((r) => {
      if (r.method === "GET") return json(encounter());
      if (r.method === "PUT") return new Promise((resolve) => { release = () => { serverVersion++; resolve(json(encounter({ version: serverVersion }))); }; });
    });
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, subjective: "one" } })));
    await settle(800);
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, subjective: "one two" } })));
    await act(async () => release());
    expect(view.result.current.saveState).not.toBe("saved");
    await settle(800);
    await act(async () => release());
    await waitFor(() => expect(view.result.current.saveState).toBe("saved"));
    expect(puts(view.calls)).toHaveLength(2);
    expect((puts(view.calls)[1].body as Encounter).version).toBe(4);
    expect((puts(view.calls)[1].body as Encounter).soap.subjective).toBe("one two");
  });

  it("on a version conflict keeps the edited note, stops autosaving and offers explicit choices", async () => {
    const serverDraft = encounter({ version: 5, soap: { subjective: "Edited by someone else", objective: "", assessment: "", plan: "" } });
    let reads = 0;
    const view = await mount((r) => {
      if (r.method === "GET") return json(reads++ === 0 ? encounter({ version: 3 }) : serverDraft);
      if (r.method === "PUT") return json({ error: "Encounter version is out of date" }, 409);
    });
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, plan: "My plan" } })));
    await settle(800);
    await waitFor(() => expect(view.result.current.conflict?.kind).toBe("version"));
    expect(view.result.current.saveState).toBe("conflict");
    expect(view.result.current.enc?.soap.plan).toBe("My plan");
    expect(view.result.current.conflict?.mine.soap.plan).toBe("My plan");
    await settle(5000);
    expect(puts(view.calls)).toHaveLength(1);

    // Keep mine: adopt the server revision number and save over it, on purpose.
    act(() => view.result.current.resolveConflict("keep-mine"));
    expect(view.result.current.conflict).toBeNull();
    await settle(800);
    await waitFor(() => expect(puts(view.calls)).toHaveLength(2));
    expect((puts(view.calls)[1].body as Encounter).version).toBe(5);
    expect((puts(view.calls)[1].body as Encounter).soap.plan).toBe("My plan");
  });

  it("'use latest' replaces the note with the server copy but keeps the discarded draft available", async () => {
    const serverDraft = encounter({ version: 6, soap: { subjective: "Server text", objective: "", assessment: "", plan: "" } });
    let reads = 0;
    const view = await mount((r) => {
      if (r.method === "GET") return json(reads++ === 0 ? encounter({ version: 3 }) : serverDraft);
      if (r.method === "PUT") return json({ error: "stale" }, 409);
    });
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, plan: "Local plan" } })));
    await settle(800);
    await waitFor(() => expect(view.result.current.conflict).not.toBeNull());
    act(() => view.result.current.resolveConflict("use-server"));
    expect(view.result.current.enc?.soap.subjective).toBe("Server text");
    expect(view.result.current.preserved?.soap.plan).toBe("Local plan");
    await settle(3000);
    expect(puts(view.calls)).toHaveLength(1);
  });

  it("never overwrites signed evidence: a draft that loses to a signed note is preserved and the signed copy shown", async () => {
    const signed = encounter({ status: "signed", version: 9, signedBy: "d1", signedAt: "2026-10-01T09:30:00Z", soap: { subjective: "Signed text", objective: "", assessment: "", plan: "Signed plan" } });
    let reads = 0;
    const view = await mount((r) => {
      if (r.method === "GET") return json(reads++ === 0 ? encounter({ version: 3 }) : signed);
      if (r.method === "PUT") return json({ error: "This note is signed and locked" }, 409);
    });
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, plan: "Unsent plan" } })));
    await settle(800);
    await waitFor(() => expect(view.result.current.conflict?.kind).toBe("signed"));
    expect(view.result.current.locked).toBe(true);
    expect(view.result.current.enc?.soap.plan).toBe("Signed plan");
    expect(view.result.current.preserved?.soap.plan).toBe("Unsent plan");
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, plan: "Tampered" } })));
    expect(view.result.current.enc?.soap.plan).toBe("Signed plan");
    await settle(5000);
    expect(puts(view.calls)).toHaveLength(1);
    act(() => view.result.current.dismissConflict());
    expect(view.result.current.preserved).toBeNull();
  });

  it("signs with the expected version, locks the note and sends the recorded duration", async () => {
    const view = await mount((r) => {
      if (r.method === "GET") return json(encounter({ version: 3 }));
      if (r.method === "POST" && r.url.pathname === "/api/encounters/e1/sign") return json(encounter({ status: "signed", version: 4, signedBy: "d1" }));
    });
    let signed: Encounter | undefined;
    await act(async () => { signed = await view.result.current.sign({ signerId: "d1", overrideReason: "Counselled", recordingSeconds: 90 }); });
    const call = view.calls.find((c) => c.method === "POST")!;
    const body = call.body as { encounter: Encounter; signerId: string; overrideReason: string };
    expect(body.encounter.version).toBe(3);
    expect(body.encounter.recording).toMatchObject({ active: false, seconds: 90 });
    expect(body).toMatchObject({ signerId: "d1", overrideReason: "Counselled" });
    expect(call.headers.get("Idempotency-Key")).toBeTruthy();
    expect(signed?.status).toBe("signed");
    expect(view.result.current.locked).toBe(true);
    expect(view.result.current.enc?.version).toBe(4);
  });

  it("replays an identical sign request under the same Idempotency-Key after a lost response", async () => {
    let attempt = 0;
    const view = await mount((r) => {
      if (r.method === "GET") return json(encounter({ version: 3 }));
      if (r.method === "POST") { attempt++; if (attempt === 1) throw new TypeError("connection reset"); return json(encounter({ status: "signed", version: 4 })); }
    });
    await act(async () => { await expect(view.result.current.sign({ signerId: "d1", recordingSeconds: 0 })).rejects.toMatchObject({ status: 0 }); });
    await act(async () => { await view.result.current.sign({ signerId: "d1", recordingSeconds: 0 }); });
    const posts = view.calls.filter((c) => c.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[1].headers.get("Idempotency-Key")).toBe(posts[0].headers.get("Idempotency-Key"));
    expect(posts[1].body).toEqual(posts[0].body);
  });

  it("surfaces sign-off problems without losing the draft or locking it", async () => {
    const view = await mount((r) => {
      if (r.method === "GET") return json(encounter({ version: 3 }));
      if (r.method === "POST") return json({ error: "Cannot sign yet", problems: ["Add a primary diagnosis"] }, 422);
    });
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, plan: "Draft plan" } })));
    let error: unknown;
    await act(async () => { error = await view.result.current.sign({ signerId: "d1", recordingSeconds: 0 }).catch((e) => e); });
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).problems).toEqual(["Add a primary diagnosis"]);
    expect(view.result.current.locked).toBe(false);
    expect(view.result.current.enc?.soap.plan).toBe("Draft plan");
  });

  it("a sign-time conflict surfaces the banner state and preserves the draft", async () => {
    let reads = 0;
    const view = await mount((r) => {
      if (r.method === "GET") return json(reads++ === 0 ? encounter({ version: 3 }) : encounter({ status: "signed", version: 8 }));
      if (r.method === "POST") return json({ error: "Already signed" }, 409);
    });
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, plan: "Draft plan" } })));
    await act(async () => { await view.result.current.sign({ signerId: "d1", recordingSeconds: 0 }).catch(() => undefined); });
    expect(view.result.current.conflict?.kind).toBe("signed");
    expect(view.result.current.preserved?.soap.plan).toBe("Draft plan");
    expect(puts(view.calls)).toHaveLength(0);
  });

  it("retries a failed save while the edit is still unsaved", async () => {
    let attempts = 0;
    const view = await mount((r) => {
      if (r.method === "GET") return json(encounter());
      if (r.method === "PUT") { attempts++; return attempts === 1 ? json({ error: "Bad gateway" }, 502) : json(encounter({ version: 4 })); }
    });
    act(() => view.result.current.update((e) => ({ ...e, soap: { ...e.soap, plan: "x" } })));
    await settle(800);
    await waitFor(() => expect(view.result.current.saveState).toBe("error"));
    await settle(5100);
    await waitFor(() => expect(view.result.current.saveState).toBe("saved"));
    expect(puts(view.calls)).toHaveLength(2);
  });

  it("reports a load failure instead of showing an empty note", async () => {
    const harness = makeHost((r) => r.method === "GET" ? json({ error: "Forbidden for this role" }, 403) : undefined);
    const view = renderHook(() => useEncounterSync("a1"), { wrapper: wrapperFor(harness.host) });
    await waitFor(() => expect(view.result.current.error).toBe("Forbidden for this role"));
    expect(view.result.current.enc).toBeUndefined();
  });
});
