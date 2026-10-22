import { describe, expect, test } from "vitest";
import { classifyFailure, isRetryable, referenceFor, type FailureKind } from "./error-mapper";

describe("classifyFailure", () => {
  /* One mapping, so twenty screens cannot each decide what a 403 means. The
     roadmap's table, as code. */
  test.each([
    [401, "session-expired"],
    [403, "denied"],
    [404, "not-found"],
    [408, "error"],
    [409, "conflict"],
    [422, "validation"],
    [500, "error"],
    [502, "error"],
    [503, "error"],
  ] as Array<[number, FailureKind]>)("%i is %s", (status, kind) => {
    expect(classifyFailure({ status }).kind).toBe(kind);
  });

  /* A fetch that never reached a server has no status at all, and treating it
     as a 500 tells the user the service is broken when their wifi dropped. */
  test("a network failure is its own thing", () => {
    expect(classifyFailure({ networkError: true }).kind).toBe("error");
    expect(classifyFailure({ networkError: true }).retryable).toBe(true);
    expect(classifyFailure({ networkError: true }).title).toMatch(/connect|network|reach/i);
  });

  test("an unknown status falls back to a generic failure rather than throwing", () => {
    expect(classifyFailure({ status: 418 }).kind).toBe("error");
  });

  /* 4xx and 5xx must not read the same. One is "you cannot do that", the other
     is "we could not do that", and a user can act on only one of them. */
  test("a client refusal is not described as a system failure", () => {
    expect(classifyFailure({ status: 403 }).title).not.toMatch(/wrong|unavailable|failed/i);
    expect(classifyFailure({ status: 503 }).title).toMatch(/unavailable|wrong|try/i);
  });

  /* §4: a denial must not describe what was denied. "You cannot access this
     patient's HIV record" is a disclosure. */
  test("a denial says nothing about what was refused", () => {
    const denial = classifyFailure({ status: 403, detail: "patient 100 HIV panel" });
    expect(`${denial.title} ${denial.description}`).not.toMatch(/patient|HIV|100/i);
  });
});

describe("isRetryable", () => {
  /* Retry is offered where it can work and withheld where it cannot. A retry
     button on a 403 suggests the refusal was a glitch. */
  test.each([[408, true], [503, true], [500, true], [502, true]])("%i may be retried", (status, expected) => {
    expect(isRetryable({ status })).toBe(expected);
  });

  test.each([[403, false], [404, false], [400, false], [409, false], [401, false], [422, false]])("%i may not", (status, expected) => {
    expect(isRetryable({ status })).toBe(expected);
  });

  test("a network failure may always be retried", () => {
    expect(isRetryable({ networkError: true })).toBe(true);
  });
});

describe("referenceFor", () => {
  /* §6: a user gets an id, the backend keeps the detail. What must never reach
     the screen is the thing the id stands in for. */
  test("passes a server-supplied reference through", () => {
    expect(referenceFor({ status: 500, reference: "ERR-C84F21" })).toBe("ERR-C84F21");
  });

  test("invents one when the server gave none, so support has something to trace", () => {
    const reference = referenceFor({ status: 500 });
    expect(reference).toMatch(/^ERR-[0-9A-F]{6}$/);
  });

  test("two failures do not share a reference", () => {
    expect(referenceFor({ status: 500 })).not.toBe(referenceFor({ status: 500 }));
  });
});

describe("what never reaches a user", () => {
  /* §6, as an assertion. A stack trace, a SQL statement or a connection string
     in front of a user is both useless to them and useful to someone else. */
  const internals = [
    "NullPointerException at PatientServiceImpl.java:438",
    "SELECT * FROM patient_main WHERE mrn = 'AV204581'",
    "postgresql://tenant-prod-db.internal:5432/allyvora",
    "at Object.<anonymous> (/srv/app/dist/index.js:112:9)",
  ];

  test.each(internals)("%s is not shown", (detail) => {
    const failure = classifyFailure({ status: 500, detail });
    const shown = `${failure.title} ${failure.description} ${failure.detail ?? ""}`;
    expect(shown).not.toContain(detail);
    for (const smell of ["Exception", "SELECT", "postgresql://", ".java:", "/srv/"]) {
      expect(shown).not.toContain(smell);
    }
  });

  /* But a message the server wrote FOR a user should survive — refusing all
     detail turns every failure into "something went wrong", which the roadmap
     names as the thing to avoid. */
  test("a message meant for a human is kept", () => {
    const failure = classifyFailure({ status: 409, detail: "This invoice was changed by someone else." });
    expect(failure.detail).toBe("This invoice was changed by someone else.");
  });
});
