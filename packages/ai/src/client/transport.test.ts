import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AiContext, AiUseCase } from "@pepbits/ai/config";

const authedFetch = vi.hoisted(() => vi.fn());
import {createAiTransport} from "./transport";
import {classificationFor} from "../test/catalog";

const dispatchAi = createAiTransport(authedFetch, classificationFor);

/**
 * Dispatch is the last thing that runs in this browser. Two things are being
 * pinned: exactly what the body carries -- a promptId and nothing resembling a
 * prompt or a key -- and that a mock answer can never be mistaken for a real
 * one.
 */

const useCase: AiUseCase = {
  id: "record.explain",
  label: "Explain this record",
  description: "",
  reads: [{ source: "page-record", fields: ["id"] }],
  promptId: "record.explain.v1",
  category: "general",
};

const context: AiContext = {
  useCaseId: useCase.id,
  pageId: "items-a",
  capturedAt: "2026-09-06T00:00:00.000Z",
  fields: [
    { key: "id", label: "Id", value: "C-100", source: "This record" },
    { key: "email", label: "Email", value: "a••••@example.invalid", source: "This record", redacted: true },
  ],
};

/* A real Response, not a stub: its body can genuinely only be consumed once,
   which is the property the "read the body once" test is there to catch. */
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sentBody = () => JSON.parse(authedFetch.mock.calls[0]![1].body as string);

beforeEach(() => authedFetch.mockReset());

describe("what is sent", () => {
  beforeEach(() => authedFetch.mockResolvedValue(reply(200, { text: "ok" })));

  test("posts JSON to the dispatch endpoint", async () => {
    await dispatchAi(context, useCase);
    const [path, init] = authedFetch.mock.calls[0]!;
    expect(path).toBe("/ai/dispatch");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  /* Spec D6. The browser holds no prompt text and no credential, so neither can
     be read out of it, replayed, or edited by whoever is sitting at it. */
  test("sends the prompt id, and nothing that could be a prompt or a key", async () => {
    await dispatchAi(context, useCase);
    const body = sentBody();
    expect(body.promptId).toBe("record.explain.v1");
    expect(Object.keys(body)).not.toContain("prompt");
    expect(JSON.stringify(body)).not.toMatch(/sk-|Bearer|Authorization/i);
  });

  test("sends stable field keys so the server can enforce classification", async () => {
    await dispatchAi(context, useCase);
    expect(sentBody().fields).toEqual([
      { key: "id", label: "Id", value: "C-100" },
      { key: "email", label: "Email", value: "a••••@example.invalid" },
    ]);
  });

  /* The values in the context are already redacted -- assembly did it -- so the
     body carries the masked form. If this ever shows the original, redaction
     has moved to the wrong side of the panel. */
  test("sends the redacted value, which is the value", async () => {
    await dispatchAi(context, useCase);
    expect(JSON.stringify(sentBody())).not.toContain("aisha");
    expect(JSON.stringify(sentBody())).toContain("a••••@example.invalid");
  });

  test("includes what the user typed, and omits the key when they typed nothing", async () => {
    await dispatchAi({ ...context, userInput: "why overdue?" }, useCase);
    expect(sentBody().userInput).toBe("why overdue?");
    authedFetch.mockClear();
    await dispatchAi(context, useCase);
    expect(Object.keys(sentBody())).not.toContain("userInput");
  });

  test("identifies the use case and the page it was asked from", async () => {
    await dispatchAi(context, useCase);
    expect(sentBody().useCaseId).toBe("record.explain");
    expect(sentBody().pageId).toBe("items-a");
  });
});

describe("what comes back", () => {
  test("a service answer is returned, and says it came from the service", async () => {
    authedFetch.mockResolvedValue(reply(200, { text: "This customer is 41 days overdue." }));
    await expect(dispatchAi(context, useCase)).resolves.toEqual({
      ok: true,
      text: "This customer is 41 days overdue.",
      via: "service",
    });
  });

  test("a failure keeps the service's own message rather than paraphrasing it", async () => {
    authedFetch.mockResolvedValue(reply(429, { error: "Tenant limit reached.", detail: "Resets at 09:00." }));
    const result = await dispatchAi(context, useCase);
    expect(result).toMatchObject({ ok: false, error: "Tenant limit reached.", detail: "Resets at 09:00.", via: "service" });
  });

  test("a failure with no message still says what happened", async () => {
    authedFetch.mockResolvedValue(reply(500, {}));
    const result = await dispatchAi(context, useCase);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("500");
  });

  /* A Response body can only be consumed once. Branching on status first and
     parsing in each arm silently yields null on the second read, which showed
     up as a 429 with no message. */
  test("reads the body once, so the message survives", async () => {
    const response = reply(403, { error: "Not permitted here." });
    authedFetch.mockResolvedValue(response);
    expect((await dispatchAi(context, useCase)).error).toBe("Not permitted here.");
  });

  test("a body that is not JSON does not throw", async () => {
    authedFetch.mockResolvedValue(new Response("<html>gateway</html>", { status: 502 }));
    const result = await dispatchAi(context, useCase);
    expect(result.ok).toBe(false);
    expect(result.via).toBe("service");
  });
});

/**
 * The refusal.
 *
 * Nothing is masked here and nothing is sent: a sensitive field arriving
 * unredacted means assembly was bypassed, and repairing it quietly would hide
 * the defect while leaving the panel showing the user a value the request no
 * longer carries.
 */
describe("the guard", () => {
  const leaking = {
    ...context,
    fields: [...context.fields, { key: "subjectName", label: "Subject Name", value: "Aisha Rahman", source: "This record" }],
  };

  test("refuses to send a context carrying an unredacted identifier", async () => {
    authedFetch.mockResolvedValue(reply(200, { text: "ok" }));
    const result = await dispatchAi(leaking, useCase);
    expect(result.ok).toBe(false);
    expect(authedFetch).not.toHaveBeenCalled();
  });

  test("names what it refused, so it can be found and fixed", async () => {
    authedFetch.mockResolvedValue(reply(200, { text: "ok" }));
    const result = await dispatchAi(leaking, useCase);
    expect(result.error).toContain("subjectName");
  });

  /* Not "service" and not "mock": nothing was contacted, and no answer was
     produced. A refusal that reported itself as either would be a third state
     wearing one of the two the panel already knows how to render. */
  test("says it was blocked here, rather than borrowing another outcome", async () => {
    authedFetch.mockResolvedValue(reply(200, { text: "ok" }));
    expect((await dispatchAi(leaking, useCase)).via).toBe("blocked");
  });

  test("does not repair the value on the way past", async () => {
    authedFetch.mockResolvedValue(reply(200, { text: "ok" }));
    const result = await dispatchAi(leaking, useCase);
    expect(JSON.stringify(result)).not.toContain("••••");
    /* And the caller's context is untouched, so the panel still describes what
       the user was shown. */
    expect(leaking.fields.at(-1)?.value).toBe("Aisha Rahman");
  });

  test("a properly redacted identifier is sent, not refused", async () => {
    authedFetch.mockResolvedValue(reply(200, { text: "ok" }));
    const masked = {
      ...context,
      fields: [...context.fields, { key: "subjectName", label: "Subject Name", value: "••••••••", source: "This record", redacted: true }],
    };
    expect((await dispatchAi(masked, useCase)).ok).toBe(true);
    expect(authedFetch).toHaveBeenCalledTimes(1);
  });

  test("clinical content is sent, because the answer depends on it", async () => {
    authedFetch.mockResolvedValue(reply(200, { text: "ok" }));
    const clinical = {
      ...context,
      fields: [{ key: "primaryDiagnosis", label: "Primary Diagnosis", value: "Community-acquired pneumonia", source: "This record" }],
    };
    expect((await dispatchAi(clinical, useCase)).ok).toBe(true);
    expect(JSON.parse(authedFetch.mock.calls[0]![1].body as string).fields[0].value).toBe("Community-acquired pneumonia");
  });
});

describe("the echo transport", () => {
  /* 409 is the ordinary unconfigured state: no credential exists, so nothing
     could have been sent. That is not a failure to show the user. */
  test("no credential configured falls back to the mock", async () => {
    authedFetch.mockResolvedValue(reply(409, { error: "No credential configured." }));
    const result = await dispatchAi(context, useCase);
    expect(result.ok).toBe(true);
    expect(result.via).toBe("mock");
  });

  test("an unreachable service falls back to the mock", async () => {
    /* A hand-rolled failed thenable rather than Promise.reject. vitest tracks
       what a spy returns and derives a promise from it without a rejection
       handler, so a genuinely rejected mock is reported as an unhandled error
       -- attributed to whichever test happens to be running when it surfaces,
       which is worse than useless. Nothing here ever rejects; dispatch still
       takes its `.catch` branch, which is the behaviour under test. */
    const failed = { catch: (recover: () => null) => Promise.resolve(recover()) };
    authedFetch.mockImplementation(() => failed as unknown as Promise<Response>);
    expect((await dispatchAi(context, useCase)).via).toBe("mock");
  });

  /* Not the echo transport's job: the service WAS reached, so falling back to a
     mock here would tell the user nothing was contacted when something was. */
  test("an accepted request answered with nothing is reported as such", async () => {
    authedFetch.mockResolvedValue(reply(200, {}));
    const result = await dispatchAi(context, useCase);
    expect(result).toMatchObject({ ok: false, via: "service" });
    expect(result.error).not.toContain("200");
    expect(result.error).toMatch(/no text/i);
  });

  /* `via` is what the panel renders its "no provider was contacted" banner
     from. A mock that reported itself as the service would be indistinguishable
     from a real answer, which is the one thing this must never be. */
  test("the mock says nothing left the browser, and lists what would have", async () => {
    authedFetch.mockResolvedValue(reply(409, {}));
    const { text } = await dispatchAi(context, useCase);
    expect(text).toContain("nothing left this browser");
    expect(text).toContain("Id: C-100");
    expect(text).toContain("(redacted)");
    expect(text).toContain("record.explain.v1");
  });

  test("the mock shows the redacted value, not the original", async () => {
    authedFetch.mockResolvedValue(reply(409, {}));
    const { text } = await dispatchAi(context, useCase);
    expect(text).toContain("a••••@example.invalid");
    expect(text).not.toContain("aisha");
  });
});
