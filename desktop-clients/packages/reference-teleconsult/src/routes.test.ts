import { describe, expect, it } from "vitest";
import { providerNavigation, providerPaths, providerRoutes, resolveProviderRoute } from "./provider/routes";
import { patientNavigation, patientPaths, patientRoutes, resolvePatientRoute } from "./patient/routes";

describe("provider routes", () => {
  it("resolves the four static pages and the dynamic consultation", () => {
    expect(resolveProviderRoute("/")).toEqual({ kind: "today" });
    expect(resolveProviderRoute("/schedule")).toEqual({ kind: "schedule" });
    expect(resolveProviderRoute("/patients")).toEqual({ kind: "patients" });
    expect(resolveProviderRoute("/notes")).toEqual({ kind: "notes" });
    expect(resolveProviderRoute("/consult/a12")).toEqual({ kind: "consult", id: "a12" });
  });
  it("ignores the query string, keeps it out of the id and decodes the id once", () => {
    expect(resolveProviderRoute("/notes?appointment=a1")).toEqual({ kind: "notes" });
    expect(resolveProviderRoute("/consult/a%2F1?x=1")).toBeNull();
    expect(resolveProviderRoute("/consult/a%201")).toEqual({ kind: "consult", id: "a 1" });
  });
  it.each(["/consult", "/consult/", "/consult/a1/extra", "/unknown", "//evil/consult/a1", "/consult/..", "/consult/%2e%2e", "/consult/%E0%A4%A", "consult/a1"])("does not match %s", (path) => {
    expect(resolveProviderRoute(path)).toBeNull();
  });
  it("lists the sidebar pages without the dynamic consultation and builds encoded paths", () => {
    expect(providerNavigation.map((r) => r.path)).toEqual(["/", "/schedule", "/patients", "/notes"]);
    expect(providerRoutes.map((r) => r.path)).toContain("/consult/[id]");
    expect(providerPaths.consult("a 1/2")).toBe("/consult/a%201%2F2");
    expect(providerPaths.notes("a1")).toBe("/notes?appointment=a1");
    expect(providerPaths.notes()).toBe("/notes");
  });
});

describe("patient routes", () => {
  it("resolves the welcome page, the static pages and both dynamic visit routes", () => {
    expect(resolvePatientRoute("/")).toEqual({ kind: "welcome" });
    for (const kind of ["register", "home", "book", "records"] as const) expect(resolvePatientRoute(`/${kind}`)).toEqual({ kind });
    expect(resolvePatientRoute("/visit/a7")).toEqual({ kind: "visit", id: "a7" });
    expect(resolvePatientRoute("/visit/a7/summary")).toEqual({ kind: "summary", id: "a7" });
  });
  it.each(["/visit", "/visit/a7/summary/x", "/visit/a7/other", "/summary", "/provider", "/visit/../home"])("does not match %s", (path) => {
    expect(resolvePatientRoute(path)).toBeNull();
  });
  it("exposes bottom-navigation destinations and typed path builders", () => {
    expect(patientNavigation.map((r) => r.path)).toEqual(["/", "/home", "/book", "/records"]);
    expect(patientRoutes).toHaveLength(7);
    expect(patientPaths.summary("a7")).toBe("/visit/a7/summary");
    expect(patientPaths.visit("a 7")).toBe("/visit/a%207");
  });
});
