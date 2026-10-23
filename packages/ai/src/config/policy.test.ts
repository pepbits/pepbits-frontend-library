import { describe, expect, test } from "vitest";
import { gatesForPage, type AiPolicy } from "./policy.ts";
import { resolveAi } from "./gates.ts";

const policy = (over: Partial<AiPolicy> = {}): AiPolicy => ({
  tenantId: "T1", global: {}, modules: {}, pages: {}, useCases: {}, ...over,
});
const page = { pageId: "items-a", module: "operations", build: { enabled: true, useCases: ["record.explain", "form.draft-note"] } };

describe("gate 1 — the build-time block", () => {
  /* A page with no `ai` block never renders the assistant, and no runtime
     configuration can turn it on. It is the one gate an administrator cannot
     reach. */
  test("a page without one is refused", () => {
    expect(resolveAi(gatesForPage(policy(), { pageId: "x", module: "operations" }, true)).allowed).toBe(false);
  });

  /* The bug that shipped once. This tested PRESENCE rather than `enabled`, so
     `{ enabled: false }` — a truthy object — read as permission. */
  test("an explicitly disabled block is refused, not read as present", () => {
    const gates = gatesForPage(policy(), { ...page, build: { enabled: false, useCases: [] } }, true);
    expect(gates.build).toEqual({ allowed: false });
    expect(resolveAi(gates).allowed).toBe(false);
  });

  test("an enabled one offers exactly what it declares", () => {
    expect(gatesForPage(policy(), page, true).build).toEqual({ allowed: true, useCases: page.build.useCases });
  });
});

describe("the collapse to a flat gate map", () => {
  test("a module's state lands on the module gate", () => {
    const gates = gatesForPage(policy({ modules: { operations: { allowed: false } } }), page, true);
    expect(resolveAi(gates).decidedBy).toBe("module");
  });

  test("a page's state lands on the page gate", () => {
    const gates = gatesForPage(policy({ pages: { "items-a": { allowed: false } } }), page, true);
    expect(resolveAi(gates).decidedBy).toBe("page");
  });

  /* Keyed per thing, so one module being off cannot switch off another. */
  test("another module's state does not apply", () => {
    const gates = gatesForPage(policy({ modules: { restricted: { allowed: false } } }), page, true);
    expect(resolveAi(gates).allowed).toBe(true);
  });

  /* An administrator disabling a use case platform-wide must reach every page
     that offers it, not just a list somewhere. */
  test("a use case switched off centrally is removed everywhere", () => {
    const gates = gatesForPage(policy({ useCases: { "record.explain": { allowed: false } } }), page, true);
    expect(resolveAi(gates).useCases).toEqual(["form.draft-note"]);
  });

  test("switching off every use case refuses the page", () => {
    const off = { "record.explain": { allowed: false }, "form.draft-note": { allowed: false } };
    expect(resolveAi(gatesForPage(policy({ useCases: off }), page, true)).allowed).toBe(false);
  });
});

describe("the user's own preference", () => {
  test("switching the assistant off refuses it", () => {
    expect(resolveAi(gatesForPage(policy(), page, false)).allowed).toBe(false);
  });

  /* The escalation the whole design guards against: a preference is a choice
     within what policy permits, never a grant. */
  test("switching it on cannot open a page policy closed", () => {
    const gates = gatesForPage(policy({ pages: { "items-a": { allowed: false } } }), page, true);
    expect(resolveAi(gates).allowed).toBe(false);
  });

  test("and cannot open one the build never offered", () => {
    expect(resolveAi(gatesForPage(policy(), { pageId: "x", module: "operations" }, true)).allowed).toBe(false);
  });
});

describe("no policy at all", () => {
  /* A tenant whose policy has not loaded yet must fall back to the page's own
     block rather than to nothing — otherwise the assistant flickers off on
     every reload. */
  test("falls back to what the page declares", () => {
    const access = resolveAi(gatesForPage(null, page, true));
    expect(access.allowed).toBe(true);
    expect(access.useCases.sort()).toEqual(["form.draft-note", "record.explain"]);
  });

  test("but still refuses a page that declares nothing", () => {
    expect(resolveAi(gatesForPage(null, { pageId: "x", module: "operations" }, true)).allowed).toBe(false);
  });
});
