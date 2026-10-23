import { describe, expect, it } from "vitest";
import { medbandNavigation, medbandPaths, medbandRoutes, resolveMedbandRoute } from "./routes";

describe("MedBand routes", () => {
  it("covers the nine source pages and the navigation paths all resolve", () => {
    expect(medbandRoutes.map((r) => r.path)).toEqual(["/", "/patients", "/patients/new", "/patients/[id]", "/encounters", "/encounters/new", "/admissions", "/admissions/new", "/episodes"]);
    for (const item of medbandNavigation) expect(resolveMedbandRoute(item.path), item.path).not.toBeNull();
    expect(resolveMedbandRoute("/")?.kind).toBe("today");
    expect(resolveMedbandRoute("/admissions/new")?.kind).toBe("admission-new");
  });

  it("lets the literal /patients/new win over the dynamic record route, and captures the decoded id otherwise", () => {
    expect(resolveMedbandRoute("/patients/new")).toMatchObject({ kind: "patient-new", params: {} });
    expect(resolveMedbandRoute("/patients/pat-1")).toMatchObject({ kind: "patient", params: { id: "pat-1" } });
    expect(resolveMedbandRoute("/patients/a%20b%2Bc")).toMatchObject({ params: { id: "a b+c" } });
  });

  it("keeps the query string and ignores the hash", () => {
    const match = resolveMedbandRoute("/encounters/new?patientId=pat-1&type=IP&type=OP#top");
    expect(match?.kind).toBe("encounter-new");
    expect(match?.query.get("patientId")).toBe("pat-1");
    expect(match?.query.getAll("type")).toEqual(["IP", "OP"]);
    expect(resolveMedbandRoute("/patients?q=a?b")?.query.get("q")).toBe("a?b");
  });

  it("rejects traversal, encoded separators, control characters, extra depth and non-absolute paths", () => {
    for (const bad of ["/patients/..", "/patients/%2e%2e", "/patients/a%2Fb", "/patients/a%5Cb", "/patients/%00", "/patients/%E0%A4%A", "//evil.test/patients", "patients", "", "/patients/pat-1/extra", "/nope", "/encounters/abc"]) expect(resolveMedbandRoute(bad), bad).toBeNull();
  });

  it("builds deep links with encoded ids and only the parameters given", () => {
    expect(medbandPaths.patient("a b/c")).toBe("/patients/a%20b%2Fc");
    expect(medbandPaths.encounterNew({ patientId: "p1", type: undefined })).toBe("/encounters/new?patientId=p1");
    expect(medbandPaths.encounterNew()).toBe("/encounters/new");
    expect(resolveMedbandRoute(medbandPaths.admissionNew({ patientId: "p1", case: "c1" }))?.query.get("case")).toBe("c1");
  });
});
