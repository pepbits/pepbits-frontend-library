import {test,expect} from "vitest";
import {resolveAi,gatesForPage} from "../config";
const CASES = [
  // --- deny wins, and the gate that decided ------------------------------
  { name: "no gate speaks",
    states: {}, expect: { allowed: false, decidedBy: "useCase" } },
  { name: "build gate off",
    states: { build: { allowed: false } }, expect: { allowed: false, decidedBy: "build" } },
  { name: "tenant off beats page on and user on",
    states: { build: { allowed: true, useCases: ["a"] }, tenant: { allowed: false },
              page: { allowed: true, useCases: ["a"] }, user: { allowed: true } },
    expect: { allowed: false, decidedBy: "tenant" } },
  { name: "user gate off",
    states: { page: { useCases: ["a"] }, user: { allowed: false } },
    expect: { allowed: false, decidedBy: "user" } },
  { name: "everything allows",
    states: { page: { useCases: ["a"] } },
    expect: { allowed: true, decidedBy: "user", useCases: ["a"] } },

  // --- the set is an intersection ----------------------------------------
  { name: "page [a,b] narrowed by user [a]",
    states: { page: { useCases: ["a", "b"] }, user: { useCases: ["a"] } },
    expect: { allowed: true, useCases: ["a"] } },
  { name: "useCase gate narrows the page's set",
    states: { page: { useCases: ["a", "b"] }, useCase: { useCases: ["b"] } },
    expect: { allowed: true, useCases: ["b"] } },
  { name: "requested id outside the set",
    states: { page: { useCases: ["a"] } }, requested: "z",
    expect: { allowed: false, decidedBy: "useCase" } },

  // --- narrowing gates must never widen ----------------------------------
  { name: "ESCALATION: user names b, page did not",
    states: { page: { useCases: ["a"] }, user: { useCases: ["a", "b"] } },
    expect: { allowed: true, useCases: ["a"] } },
  { name: "ESCALATION: user is the ONLY gate to name a set",
    states: { user: { useCases: ["a"] } },
    expect: { allowed: false, decidedBy: "useCase" } },
  { name: "ESCALATION: user re-adds what useCase removed",
    states: { page: { useCases: ["a", "b"] }, useCase: { useCases: ["a"] }, user: { useCases: ["a", "b"] } },
    expect: { allowed: true, useCases: ["a"] } },
  { name: "role is no longer a gate: an unknown key is ignored",
    states: { page: { useCases: ["a"] }, role: { allowed: false } },
    expect: { allowed: true, useCases: ["a"] } },

  // --- an emptied set is a denial, not a pass ----------------------------
  { name: "page names an empty set",
    states: { page: { useCases: [] } },
    expect: { allowed: false, decidedBy: "useCase" } },
];

const BUILD = { enabled: true, useCases: ["a", "b"] };
const POLICY = {
  tenantId: "T1",
  global: { platform: { allowed: true }, tenant: { allowed: true }, application: { allowed: true } },
  modules: { operations: { allowed: true }, resources: { allowed: false } },
  pages: { "locked-page": { allowed: false } },
  useCases: { b: { allowed: false } },
};

const POLICY_CASES = [
  { name: "pilot page, module allowed",
    policy: POLICY, page: { pageId: "p", module: "operations", build: BUILD }, user: true,
    expect: { allowed: true, useCases: ["a"] } },          // b is off tenant-wide
  { name: "module gate denies a page that HAS a build block",
    policy: POLICY, page: { pageId: "p", module: "resources", build: BUILD }, user: true,
    expect: { allowed: false, decidedBy: "module" } },
  { name: "page gate denies",
    policy: POLICY, page: { pageId: "locked-page", module: "operations", build: BUILD }, user: true,
    expect: { allowed: false, decidedBy: "page" } },
  /* The case that was missing. `{ enabled: false }` is the only way a page can
     refuse the assistant now that absence means yes, and gate 1 tested presence
     rather than the flag -- so the loudest possible no read as a yes. */
  { name: "explicit { enabled: false } denies at gate 1, even with use cases named",
    policy: POLICY, page: { pageId: "p", module: "operations", build: { enabled: false, useCases: ["worklist.summarise-selection"] } }, user: true,
    expect: { allowed: false, decidedBy: "build" } },
  { name: "no build block: gate 1 denies before any policy is consulted",
    policy: POLICY, page: { pageId: "p", module: "operations" }, user: true,
    expect: { allowed: false, decidedBy: "build" } },
  { name: "user preference off",
    policy: POLICY, page: { pageId: "p", module: "operations", build: BUILD }, user: false,
    expect: { allowed: false, decidedBy: "user" } },
  { name: "policy not fetched: renders build set, server still enforces",
    policy: null, page: { pageId: "p", module: "operations", build: BUILD }, user: true,
    expect: { allowed: true, useCases: ["a", "b"] } },     // see the note below
];

for(const entry of CASES) test(entry.name,()=>expect(resolveAi(entry.states,entry.requested)).toMatchObject(entry.expect));
for(const entry of POLICY_CASES) test(entry.name,()=>expect(resolveAi(gatesForPage(entry.policy,entry.page,entry.user))).toMatchObject(entry.expect));
