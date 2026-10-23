import { describe, expect, it } from "vitest";
import { pharmacyNavigation, pharmacyPaths, pharmacyRoutes, resolvePharmacyRoute } from "./routes";

describe("Pharmacy-1 routes", () => {
  it("resolves the thirteen original static routes and nothing else", () => {
    expect(pharmacyRoutes.map((r) => r.path)).toEqual(["/", "/workbench", "/counter", "/orders", "/sales", "/inventory", "/purchasing", "/authorizations", "/claims", "/remittance", "/patients", "/audit", "/settings"]);
    for (const route of pharmacyRoutes) expect(resolvePharmacyRoute(route.path)?.kind).toBe(route.kind);
    expect(resolvePharmacyRoute("/workbench/extra")).toBeNull();
    expect(resolvePharmacyRoute("/unknown")).toBeNull();
  });

  it("keeps the query the source pages read (open Rx, detail drawers, filters)", () => {
    const hit = resolvePharmacyRoute("/workbench?stage=review&rx=rx%201");
    expect(hit?.kind).toBe("workbench");
    expect(hit?.query.get("rx")).toBe("rx 1");
    expect(hit?.query.get("stage")).toBe("review");
    expect(resolvePharmacyRoute("/orders?new=1")?.query.get("new")).toBe("1");
    expect(resolvePharmacyRoute("/claims?status=rejected#x")?.query.get("status")).toBe("rejected");
  });

  it("refuses traversal, encoded separators and protocol-relative paths", () => {
    for (const bad of ["//evil", "/..", "/%2e%2e", "/claims%2Fx", "/a\\b", "claims", "/%E0%A4%A"]) expect(resolvePharmacyRoute(bad)).toBeNull();
  });

  it("builds deep links that resolve back to the page and parameters they target", () => {
    const links = [pharmacyPaths.workbench({ rx: "RX-1", stage: "fill" }), pharmacyPaths.claims({ claim: "c 1" }), pharmacyPaths.inventory({ tab: "expiry", filter: "expired" }), pharmacyPaths.orders({ new: true })];
    for (const link of links) expect(resolvePharmacyRoute(link)).not.toBeNull();
    expect(resolvePharmacyRoute(pharmacyPaths.claims({ claim: "c 1" }))?.query.get("claim")).toBe("c 1");
    expect(pharmacyPaths.dashboard()).toBe("/");
    expect(pharmacyPaths.sales()).toBe("/sales");
  });

  it("exposes the source sidebar (thirteen destinations; Settings, the source footer entry, in Configuration)", () => {
    expect(pharmacyNavigation).toHaveLength(13);
    expect([...new Set(pharmacyNavigation.map((n) => n.group))]).toEqual(["Operate", "Stock", "Revenue", "Records", "Configuration"]);
    expect(pharmacyNavigation.filter((n) => n.group === "Configuration").map((n) => n.path)).toEqual(["/settings"]);
    expect(pharmacyNavigation.every((n) => pharmacyRoutes.some((r) => r.path === n.path))).toBe(true);
  });
});
