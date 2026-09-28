import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import { describe, expect, test } from "vitest";
import { generateSubmissions, materializeLiveSessions, seedSchoolFixture } from "./test-support/fixtures";
import { schoolExportCapability } from "./lib/format";
import { schoolRoleFor, trustedSchoolRoles } from "./lib/session";
import { toCsv } from "./lib/utils";
import { matchSchoolRoute, SCHOOL_ROUTES } from "./routes";

/* The 26 authenticated source pages: src/app/(app)/<route>/page.tsx in the Scholaris reference. */
const SOURCE_PAGES = [
  "admissions", "assignments", "attendance", "calendar", "classes", "dashboard", "exams", "fees", "library", "live/[id]", "live", "marks",
  "messages", "notices", "quizzes/[id]", "quizzes/new", "quizzes", "reports", "settings", "students/new", "students", "subjects",
  "teachers/new", "teachers", "timetable", "whiteboard",
];

describe("routes", () => {
  test("cover exactly the 26 source pages, one route each", () => {
    expect(SCHOOL_ROUTES).toHaveLength(26);
    expect(new Set(SCHOOL_ROUTES.map((r) => r.path)).size).toBe(26);
    expect(SCHOOL_ROUTES.map((r) => r.source).sort()).toEqual(SOURCE_PAGES.map((p) => `app/(app)/${p}/page.tsx`).sort());
    for (const r of SCHOOL_ROUTES) expect(r.path.replace(/:id/, "[id]")).toBe(`/${r.source.slice("app/(app)/".length, -"/page.tsx".length)}`);
  });

  test("static segments win over dynamic ones and parameters are decoded", () => {
    expect(matchSchoolRoute("/quizzes/new")?.route.id).toBe("quiz-builder");
    expect(matchSchoolRoute("/quizzes/qz-7")).toMatchObject({ route: { id: "quiz-player" }, params: { id: "qz-7" } });
    expect(matchSchoolRoute("/live/lv%2F1")?.params).toEqual({ id: "lv/1" });
    expect(matchSchoolRoute("/students/new")?.route.id).toBe("student-registration");
    expect(matchSchoolRoute("/students")?.params).toEqual({});
  });

  test("root is the dashboard, query strings are kept and unknown paths do not match", () => {
    expect(matchSchoolRoute("/")?.route.id).toBe("dashboard");
    expect(matchSchoolRoute("/timetable?role=teacher")?.query.get("role")).toBe("teacher");
    expect(matchSchoolRoute("/quizzes/qz-1/extra")).toBeNull();
    expect(matchSchoolRoute("/nope")).toBeNull();
    expect(matchSchoolRoute("/live/%E0%A4%A")).toBeNull();
  });
});

describe("role trust", () => {
  test("maps only known school roles and explicit aliases", () => {
    expect(schoolRoleFor("school:teacher")).toBe("teacher");
    expect(schoolRoleFor("school-admin")).toBe("admin");
    expect(schoolRoleFor("Parent")).toBe("parent");
    expect(schoolRoleFor("enterprise-admin")).toBe("admin");
    expect(schoolRoleFor("finance-manager")).toBe("accountant");
    expect(schoolRoleFor("operations-analyst")).toBe("teacher");
    for (const r of ["superuser", "administrator", "school:root", "", "admin2", "tenant-admin"]) expect(schoolRoleFor(r)).toBeNull();
  });

  test("orders granted portals by fixed priority, ignoring unknown roles", () => {
    expect(trustedSchoolRoles(["student", "viewer", "school:teacher", "teacher"])).toEqual(["teacher", "student"]);
    expect(trustedSchoolRoles(["viewer"])).toEqual([]);
  });
});

describe("export capability", () => {
  test("CSV preference exports", () => {
    expect(schoolExportCapability({ exportFormat: "csv" })).toEqual({ format: "csv", disabled: false });
  });
  test("an XLSX preference is refused, never silently written as CSV", () => {
    const c = schoolExportCapability({ exportFormat: "xlsx" });
    expect(c.disabled).toBe(true);
    expect(c.reason).toMatch(/CSV only/);
  });
  test("a policy lock to XLSX and a policy that disallows the chosen format both disable", () => {
    expect(schoolExportCapability({ exportFormat: "xlsx" }, { revision: 1, rules: { exportFormat: { value: "xlsx", locked: true } } }).reason).toMatch(/administrator requires XLSX/);
    expect(schoolExportCapability({ exportFormat: "csv" }, { revision: 1, rules: { exportFormat: { value: "xlsx", locked: false, allowedValues: ["xlsx"] } } }).disabled).toBe(true);
  });
  test("default preferences export CSV", () => {
    expect(schoolExportCapability(DEFAULT_PREFERENCES).disabled).toBe(DEFAULT_PREFERENCES.exportFormat !== "csv");
  });
});

describe("CSV", () => {
  test("quotes cells and neutralises formula text but not numbers", () => {
    expect(toCsv([["Name", "Note"], ["=HYPERLINK(1)", "-1500"], [-3, "@x"]])).toBe('"Name","Note"\r\n"\'=HYPERLINK(1)","-1500"\r\n"-3","\'@x"');
    expect(toCsv([['He said "hi"']])).toBe('"He said ""hi"""');
  });
});

describe("fixtures", () => {
  test("seedSchoolFixture is deterministic for a day and never reads the clock", () => {
    const a = seedSchoolFixture({ today: "2026-09-28" });
    const b = seedSchoolFixture({ today: "2026-09-28" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.students).toHaveLength(14 * 24);
    expect(a.students.find((s) => s.id === "s-1192")?.name).toBe("Elena Vasquez");
    expect(a.parentChildren["p-vasquez"]).toEqual(["s-1192", "s-1072"]);
    expect(() => seedSchoolFixture({ today: "28/09/2026" })).toThrow(/YYYY-MM-DD/);
  });

  test("live sessions materialize against the supplied clock and submissions are reproducible", () => {
    const f = seedSchoolFixture({ today: "2026-09-28" });
    const anchor = new Date(2026, 8, 28, 9, 0);
    const first = materializeLiveSessions(f.live, anchor).find((s) => s.id === "lv-1")!;
    expect(first.status).toBe("Live");
    expect(materializeLiveSessions(f.live, anchor, new Date(anchor.getTime() + 3 * 3600e3)).find((s) => s.id === "lv-1")!.status).toBe("Ended");
    expect(generateSubmissions(f, "as-1")).toEqual(generateSubmissions(f, "as-1"));
  });
});
