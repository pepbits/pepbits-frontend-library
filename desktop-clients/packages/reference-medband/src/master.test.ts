import { describe, expect, it } from "vitest";
import { createMaster } from "./lib/master";
import { bootstrap } from "./test-utils";

describe("scope-bound master data", () => {
  const a = createMaster(bootstrap("A").master);
  const b = createMaster(bootstrap("B").master);

  it("builds an independent registry per bootstrap: a second scope never sees the first scope's masters", () => {
    expect(a.payer("pay-1")?.name).toBe("Payer A Insurance");
    expect(b.payer("pay-1")?.name).toBe("Payer B Insurance");
    expect(a.PAYERS).not.toBe(b.PAYERS);
    expect(a.counter("ctr-A-1")?.name).toBe("Desk A One");
    expect(b.counter("ctr-A-1")).toBeUndefined();
    expect(a.COUNTERS.map((c) => c.id)).toEqual(["ctr-A-1", "ctr-A-2"]);
  });

  it("does not alias the backend payload, and an empty payload gives an empty registry", () => {
    const payload = bootstrap("C").master;
    const m = createMaster(payload);
    payload.payers.push({ id: "late", name: "Late", short: "L", tpaIds: [], tpaRequired: false });
    expect(m.payer("late")).toBeUndefined();
    const empty = createMaster({} as never);
    expect(empty.DEPARTMENTS).toEqual([]);
    expect(empty.counter("x")).toBeUndefined();
  });

  it("keeps the source's lookups and narrowing helpers", () => {
    expect(a.networksFor([]).map((n) => n.id)).toEqual(["net-1"]);
    expect(a.networksFor(["other"])).toEqual([]);
    expect(a.plansFor([], ["pay-1"]).map((p) => p.id)).toEqual(["plan-1"]);
    expect(a.plansFor(["net-1"]).map((p) => p.id)).toEqual(["plan-1"]);
    expect(a.tpasFor(["pay-1"]).map((t) => t.id)).toEqual(["tpa-1"]);
    expect(a.tpasFor([]).length).toBe(1);
    expect(a.practitionersFor("dep-gen").length).toBe(1);
    expect(a.practitionersFor("dep-er")).toEqual([]);
    expect(a.wardsForCategory("General").map((w) => w.id)).toEqual(["ward-1"]);
    expect(a.wardsForCategory("ICU")).toEqual([]);
    expect(a.department(undefined)).toBeUndefined();
    expect(a.complaint("R50")?.label).toBe("Fever");
  });
});
