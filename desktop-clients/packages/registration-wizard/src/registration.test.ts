import { describe, expect, it } from "vitest";
import {
  emptyRegistration,
  hydrateDraft,
  resolveFieldPath,
  slugify,
  toSubmission,
  validateStep,
  visibleSteps,
} from "./registration";
import { validateDocumentFile } from "./stages/DocumentsStage";
import { completeData } from "./test-support/fake-host";
import type { FacilityEntry } from "./types";

const AE = {
  states: ["DU"],
  districts: [],
  timeZones: ["Asia/Dubai"],
  currencies: ["AED", "USD"],
  offers: ["ae-basic", "ae-licensed"],
  callingCode: "+971",
};

const row = (i: number, patch: Partial<FacilityEntry> = {}): FacilityEntry => ({
  id: `f${i}`,
  name: `Site ${i}`,
  type: "CLINIC",
  city: "Dune City",
  beds: "",
  ...patch,
});

describe("organisation step", () => {
  it("requires a structure and at least one facility type", () => {
    const e = validateStep("organisation", emptyRegistration);
    expect(Object.keys(e).sort()).toEqual(["facilityTypes", "structure"]);
    expect(validateStep("organisation", completeData())).toEqual({});
  });

  it("rejects facility type codes the host does not offer", () => {
    const e = validateStep("organisation", completeData({ facilityTypes: ["SPACEPORT"] }), { facilityTypes: ["HOSPITAL"] });
    expect(e.facilityTypes).toBeTruthy();
  });
});

describe("details step", () => {
  it("passes a complete single hospital", () => {
    expect(validateStep("details", completeData(), AE)).toEqual({});
  });

  it("requires licensed beds (1-100000) only for a single hospital", () => {
    const base = completeData();
    for (const beds of ["", "0", "100001", "12.5", "abc"]) {
      expect(validateStep("details", { ...base, profile: { ...base.profile, beds } }, AE)["profile.beds"]).toBeTruthy();
    }
    for (const beds of ["1", "100000"]) {
      expect(validateStep("details", { ...base, profile: { ...base.profile, beds } }, AE)["profile.beds"]).toBeUndefined();
    }
    const clinic = { ...base, facilityTypes: ["CLINIC"], profile: { ...base.profile, beds: "" } };
    expect(validateStep("details", clinic, AE)["profile.beds"]).toBeUndefined();
    const network = { ...base, structure: "NETWORK" as const, profile: { ...base.profile, beds: "" } };
    expect(validateStep("details", network, AE)["profile.beds"]).toBeUndefined();
  });

  it("only accepts a time zone and currency offered for the selected country", () => {
    const base = completeData();
    const wrongTz = { ...base, profile: { ...base.profile, timeZone: "America/New_York" } };
    expect(validateStep("details", wrongTz, AE)["profile.timeZone"]).toMatch(/selected country/);
    const noTz = { ...base, profile: { ...base.profile, timeZone: "" } };
    expect(validateStep("details", noTz, AE)["profile.timeZone"]).toBeTruthy();
    const wrongCurrency = { ...base, profile: { ...base.profile, currency: "EUR" } };
    expect(validateStep("details", wrongCurrency, AE)["profile.currency"]).toBeTruthy();
  });

  it("requires state and district only when the host has entries for that level", () => {
    const base = completeData();
    const noState = { ...base, profile: { ...base.profile, state: "" } };
    expect(validateStep("details", noState, AE)["profile.state"]).toBeTruthy();
    expect(validateStep("details", noState, { ...AE, states: [] })["profile.state"]).toBeUndefined();
    expect(validateStep("details", base, { ...AE, districts: ["X1"] })["profile.district"]).toBeTruthy();
    expect(validateStep("details", base, AE)["profile.district"]).toBeUndefined();
  });

  it("keeps phone, postal code, tax ID, display name and website optional but well formed", () => {
    const base = completeData();
    const optional = { ...base, profile: { ...base.profile, displayName: "", taxId: "", postalCode: "", phone: "", website: "" } };
    expect(validateStep("details", optional, AE)).toEqual({});
    const bad = (patch: Partial<typeof base.profile>) => validateStep("details", { ...base, profile: { ...base.profile, ...patch } }, AE);
    expect(bad({ phone: "+971 50" })["profile.phone"]).toBeTruthy();
    expect(bad({ phone: "abc" })["profile.phone"]).toBeTruthy();
    expect(bad({ phone: "(04) 123-4567" })["profile.phone"]).toBeUndefined();
    // 30 characters including the calling code
    expect(bad({ phone: "1".repeat(26) })["profile.phone"]).toBeUndefined();
    expect(bad({ phone: "1".repeat(27) })["profile.phone"]).toBeTruthy();
    expect(bad({ website: "not a site" })["profile.website"]).toBeTruthy();
    expect(bad({ website: "https://example.org/" })["profile.website"]).toBeUndefined();
  });
});

describe("facilities step", () => {
  it("only applies to networks", () => {
    expect(visibleSteps({ structure: "SINGLE" }).map((s) => s.id)).not.toContain("facilities");
    expect(visibleSteps({ structure: "NETWORK" }).map((s) => s.id)).toContain("facilities");
  });

  it("requires 2 to 50 facilities", () => {
    const net = (n: number) => completeData({ structure: "NETWORK", facilities: Array.from({ length: n }, (_, i) => row(i)) });
    expect(validateStep("facilities", net(1)).facilities).toBeTruthy();
    expect(validateStep("facilities", net(2))).toEqual({});
    expect(validateStep("facilities", net(50))).toEqual({});
    expect(validateStep("facilities", net(51)).facilities).toBeTruthy();
  });

  it("requires name, type, city, and beds for hospitals", () => {
    const d = completeData({
      structure: "NETWORK",
      facilities: [row(0, { type: "HOSPITAL", beds: "" }), row(1, { name: "", city: "", type: "" })],
    });
    const e = validateStep("facilities", d);
    expect(Object.keys(e).sort()).toEqual(["facilities.0.beds", "facilities.1.city", "facilities.1.name", "facilities.1.type"]);
  });
});

describe("scope step", () => {
  it("makes care settings and specialties optional", () => {
    expect(validateStep("scope", completeData({ careSettings: [], specialties: [] }))).toEqual({});
  });
});

describe("workspace step", () => {
  it("validates the slug format and reserved words", () => {
    const slug = (s: string) => validateStep("workspace", completeData({ workspace: { slug: s, offerId: "ae-basic" } }), AE)["workspace.slug"];
    for (const bad of ["ab", "1abc", "abc-", "Abc", "a_bc", "a".repeat(49), "admin", "platform", "www", "api", "auth", "registration", "mail"])
      expect(slug(bad)).toBeTruthy();
    for (const good of ["abc", "st-marys-2", "a".repeat(48)]) expect(slug(good)).toBeUndefined();
  });

  it("requires a plan offered in the selected country", () => {
    const noPlan = completeData({ workspace: { slug: "example-care", offerId: "" } });
    expect(validateStep("workspace", noPlan, AE)["workspace.offerId"]).toBeTruthy();
    const foreign = completeData({ workspace: { slug: "example-care", offerId: "us-basic" } });
    expect(validateStep("workspace", foreign, AE)["workspace.offerId"]).toBeTruthy();
    expect(validateStep("workspace", completeData(), AE)).toEqual({});
  });

  it("requires administrator first and last name, role, email and a 6-digit mobile", () => {
    const d = completeData({ administrator: { fullName: "Alex", role: "", email: "alex@", mobile: "12345" } });
    expect(Object.keys(validateStep("workspace", d, AE)).sort()).toEqual([
      "administrator.email",
      "administrator.fullName",
      "administrator.mobile",
      "administrator.role",
    ]);
  });

  it("suggests a slug that starts with a letter", () => {
    expect(slugify("St. Mary's & Partners")).toBe("st-marys-and-partners");
    expect(slugify("24/7 Care")).toBe("care");
  });
});

describe("review step", () => {
  it("requires terms, BAA and DPA but not product updates", () => {
    const none = completeData({ agreements: { ...emptyRegistration.agreements } });
    expect(Object.keys(validateStep("review", none)).sort()).toEqual(["agreements.baa", "agreements.dpa", "agreements.terms"]);
    expect(validateStep("review", completeData())).toEqual({});
  });
});

describe("data model", () => {
  it("has no password, MFA, modules, standards, integrations, region or EMRAM fields", () => {
    const json = JSON.stringify(emptyRegistration).toLowerCase();
    for (const word of ["password", "mfa", "modules", "standards", "integrations", "region", "emram"]) expect(json).not.toContain(word);
  });

  it("drops unknown fields from a stored draft", () => {
    const d = hydrateDraft({
      ...completeData(),
      workspace: { slug: "x-y-z", offerId: "", password: "secret", region: "eu" },
      code: "123456",
      modules: ["ehr"],
    });
    const json = JSON.stringify(d);
    expect(json).not.toContain("secret");
    expect(json).not.toContain("123456");
    expect(json).not.toContain("modules");
    expect(d.workspace).toEqual({ slug: "x-y-z", offerId: "" });
  });

  it("maps host field paths to wizard fields and steps", () => {
    expect(resolveFieldPath("profile.timeZone")).toEqual({ key: "profile.timeZone", step: "details" });
    expect(resolveFieldPath("form.slug")).toEqual({ key: "workspace.slug", step: "workspace" });
    expect(resolveFieldPath("facilities[1].beds")).toEqual({ key: "facilities.1.beds", step: "facilities" });
    expect(resolveFieldPath("request.administrator.email")).toEqual({ key: "administrator.email", step: "workspace" });
    expect(resolveFieldPath("somethingElse")).toBeNull();
  });
});

describe("submission payload", () => {
  const agreements = { baa: { version: "BAA-3" }, dpa: { version: "DPA-5" } };

  it("records agreement versions and drops data that does not apply", () => {
    const d = completeData({
      facilities: [row(0)],
      profile: { ...completeData().profile, website: " HTTPS://Example.org/ ", legalName: "  Example Care LLC " },
    });
    const p = toSubmission(d, { termsVersion: "T-1" }, agreements);
    expect(Object.keys(p).sort()).toEqual([
      "administrator",
      "agreements",
      "careSettings",
      "facilities",
      "facilityTypes",
      "profile",
      "specialties",
      "structure",
      "workspace",
    ]);
    expect(p.facilities).toEqual([]);
    expect(p.profile.website).toBe("example.org");
    expect(p.profile.legalName).toBe("Example Care LLC");
    expect(p.administrator.email).toBe("alex@example.test");
    expect(p.agreements).toEqual({
      terms: true,
      baa: true,
      dpa: true,
      productUpdates: false,
      termsVersion: "T-1",
      baaVersion: "BAA-3",
      dpaVersion: "DPA-5",
    });
  });

  it("clears beds outside a single hospital and on non-hospital facilities", () => {
    const d = completeData({
      structure: "NETWORK",
      facilities: [row(0, { type: "HOSPITAL", beds: "40" }), row(1, { type: "CLINIC", beds: "9" })],
    });
    const p = toSubmission(d, { termsVersion: "T-1" }, agreements);
    expect(p.profile.beds).toBe("");
    expect(p.facilities.map((f) => f.beds)).toEqual(["40", ""]);
  });
});

describe("document files", () => {
  it("accepts PDF, PNG and JPEG up to 2 MB only", () => {
    expect(validateDocumentFile({ name: "a.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateDocumentFile({ name: "a.png", type: "image/png", size: 2 * 1024 * 1024 })).toBeNull();
    expect(validateDocumentFile({ name: "a.jpg", type: "image/jpeg", size: 10 })).toBeNull();
    expect(validateDocumentFile({ name: "a.pdf", type: "application/pdf", size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB/);
    expect(validateDocumentFile({ name: "a.docx", type: "application/msword", size: 10 })).toMatch(/PDF, PNG or JPEG/);
    expect(validateDocumentFile({ name: "a.gif", type: "image/gif", size: 10 })).toMatch(/PDF, PNG or JPEG/);
  });
});
