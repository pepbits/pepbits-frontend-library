import { describe, expect, test } from "vitest";
import { GATES, NARROWING_ONLY, resolveAi, type Gate, type GateState } from "./gates.ts";

const allow = (useCases?: string[]): GateState => ({ allowed: true, ...(useCases ? { useCases } : {}) });
const deny: GateState = { allowed: false };
const everything = (useCases: string[]) =>
  Object.fromEntries(GATES.map((gate) => [gate, NARROWING_ONLY.has(gate) ? allow() : allow(useCases)])) as Partial<Record<Gate, GateState>>;

describe("deny wins", () => {
  /* The whole control plane in one property. Eight gates, and any one of them
     saying no ends it — which is why each is tested individually rather than
     as "some gate can deny". */
  test.each(GATES)("a denial at %s ends it, whatever the others say", (gate) => {
    const states = { ...everything(["record.explain"]), [gate]: deny };
    const access = resolveAi(states, "record.explain");
    expect(access.allowed).toBe(false);
    expect(access.decidedBy).toBe(gate);
    expect(access.useCases).toEqual([]);
  });

  /* Which gate refused is what an administrator needs — "not available" sends
     them through eight config screens looking for the one that said no. */
  test("the refusal names the level that decided", () => {
    expect(resolveAi({ ...everything(["x"]), module: deny }, "x").reason).toMatch(/module/);
  });

  test("the FIRST denial decides, not the last", () => {
    const access = resolveAi({ ...everything(["x"]), tenant: deny, page: deny }, "x");
    expect(access.decidedBy).toBe("tenant");
  });
});

describe("use cases narrow and never widen", () => {
  test("the intersection of every gate that names a set", () => {
    const access = resolveAi({
      build: allow(["a", "b", "c"]),
      module: allow(["b", "c"]),
      page: allow(["c", "d"]),
    });
    expect(access.useCases).toEqual(["c"]);
  });

  /* A gate cannot introduce a use case an earlier one did not offer. Otherwise
     "enable it for this page" becomes a way to grant something the tenant's
     licence never included. */
  test("a later gate cannot add one nobody offered", () => {
    expect(resolveAi({ build: allow(["a"]), page: allow(["a", "b"]) }).useCases).toEqual(["a"]);
  });

  test("an empty intersection is a refusal, not an empty allow", () => {
    const access = resolveAi({ build: allow(["a"]), module: allow(["b"]) });
    expect(access.allowed).toBe(false);
    expect(access.decidedBy).toBe("useCase");
  });

  test("a gate that names nothing constrains nothing", () => {
    expect(resolveAi({ build: allow(["a", "b"]), tenant: allow() }).useCases).toEqual(["a", "b"]);
  });
});

describe("narrowing-only gates", () => {
  /* The escalation this exists to prevent, and it is reached by leaving the
     other gates silent rather than by widening one. If `user` were allowed to
     be the first to name a set, a preference would be DEFINING what is
     permitted rather than choosing within it. */
  test.each([...NARROWING_ONLY])("%s alone establishes nothing", (gate) => {
    const access = resolveAi({ [gate]: allow(["record.explain"]) });
    expect(access.allowed).toBe(false);
    expect(access.useCases).toEqual([]);
  });

  test("but it still narrows a set someone else established", () => {
    expect(resolveAi({ build: allow(["a", "b"]), user: allow(["a"]) }).useCases).toEqual(["a"]);
  });

  test("every narrowing-only gate is a real gate", () => {
    for (const gate of NARROWING_ONLY) expect(GATES).toContain(gate);
  });
});

describe("asking for one use case", () => {
  test("granted when it survived every gate", () => {
    expect(resolveAi(everything(["a", "b"]), "a").allowed).toBe(true);
  });

  /* Asking for something the gates did not grant must be refused by NAME, or a
     caller learns it can request anything as long as something is allowed. */
  test("refused, by name, when it did not", () => {
    const access = resolveAi(everything(["a"]), "b");
    expect(access.allowed).toBe(false);
    expect(access.reason).toMatch(/"b"/);
  });

  test("asking for nothing in particular grants what survived", () => {
    const access = resolveAi(everything(["a", "b"]));
    expect(access.allowed).toBe(true);
    expect(access.useCases.sort()).toEqual(["a", "b"]);
  });
});

describe("nothing configured", () => {
  /* Safe by default. An unconfigured workspace granting the assistant would be
     the worst possible default for a control plane over PHI. */
  test("an empty policy allows nothing", () => {
    const access = resolveAi({});
    expect(access.allowed).toBe(false);
    expect(access.useCases).toEqual([]);
  });

  test("and so does one that allows without naming anything", () => {
    expect(resolveAi({ build: allow(), tenant: allow() }).allowed).toBe(false);
  });
});
