import { describe, expect, it } from "vitest";
import { qualityNavigation, qualityPaths, qualityRoutes, resolveQualityRoute } from "./routes";

describe("quality routes", () => {
  it("resolves every static source page and both dynamic detail pages", () => {
    const statics: Record<string, string> = { "/": "dashboard", "/indicators": "indicators", "/tat": "tat", "/events": "events", "/verification": "verification", "/validation": "validation", "/reports": "reports", "/reports/designer": "designer", "/schedules": "schedules", "/submissions": "submissions", "/authorities": "authorities", "/users": "users", "/audit": "audit" };
    for (const [path, kind] of Object.entries(statics)) expect(resolveQualityRoute(path)).toEqual({ kind });
    expect(resolveQualityRoute("/indicators/7")).toEqual({ kind: "indicator", id: "7" });
    expect(resolveQualityRoute("/reports/3")).toEqual({ kind: "report", id: "3" });
    expect(qualityRoutes).toHaveLength(15);
  });

  it("lets the literal designer route win over the dynamic report id", () => {
    expect(resolveQualityRoute("/reports/designer")).toEqual({ kind: "designer" });
    expect(resolveQualityRoute("/reports/designer?id=4")).toEqual({ kind: "designer" });
  });

  it("ignores the query string and decodes ids once", () => {
    expect(resolveQualityRoute("/audit?user=3")).toEqual({ kind: "audit" });
    expect(resolveQualityRoute("/indicators/a%20b?x=1")).toEqual({ kind: "indicator", id: "a b" });
  });

  it.each(["/indicators/7/extra", "/unknown", "//evil/indicators/7", "/indicators/..", "/indicators/%2e%2e", "/indicators/%E0%A4%A", "/indicators/a%2Fb", "indicators/7", "/login"])("does not match %s", (path) => {
    expect(resolveQualityRoute(path)).toBeNull();
  });

  it("exposes the twelve source sidebar items in source groups and order, with permission hints", () => {
    expect(qualityNavigation.map((n) => n.path)).toEqual(["/", "/indicators", "/tat", "/events", "/verification", "/validation", "/reports", "/schedules", "/submissions", "/authorities", "/users", "/audit"]);
    expect([...new Set(qualityNavigation.map((n) => n.group))]).toEqual(["Overview", "Performance", "Assurance", "Reporting", "Administration"]);
    expect(qualityNavigation.find((n) => n.path === "/users")?.permission).toBe("users.manage");
    expect(qualityNavigation.find((n) => n.path === "/audit")?.permission).toBe("audit.view");
    for (const item of qualityNavigation) expect(resolveQualityRoute(item.path)).not.toBeNull();
  });

  it("builds encoded paths that resolve back to the same page", () => {
    expect(qualityPaths.indicator(7)).toBe("/indicators/7");
    expect(qualityPaths.designer(4)).toBe("/reports/designer?id=4");
    expect(qualityPaths.submissions(9)).toBe("/submissions?open=9");
    expect(qualityPaths.audit(3)).toBe("/audit?user=3");
    expect(resolveQualityRoute(qualityPaths.report("a b/1"))).toBeNull();
    expect(resolveQualityRoute(qualityPaths.report(12))).toEqual({ kind: "report", id: "12" });
  });
});
