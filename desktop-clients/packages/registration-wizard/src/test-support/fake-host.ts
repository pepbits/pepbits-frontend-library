/*
 * Fictional, synthetic fixtures for this package's tests only. Not exported from
 * the package entry and not suitable as host data.
 */
import { vi } from "vitest";
import type { CountryOption, CurrencyOption, Offer, Option, RegistrationData, RegistrationHost } from "../types";

const o = (code: string, name = code): Option => ({ code, name });

export const FACILITY_TYPES: Option[] = [
  { code: "HOSPITAL", name: "Hospital", description: "Inpatient care" },
  { code: "CLINIC", name: "Clinic", description: "Outpatient care" },
  { code: "PHARMACY", name: "Pharmacy" },
];
export const CARE_SETTINGS: Option[] = [o("OPD", "Outpatient"), o("IPD", "Inpatient"), o("ER", "Emergency")];
export const SPECIALTIES: Option[] = [o("CARD", "Cardiology"), o("DERM", "Dermatology")];
export const ROLES: Option[] = [o("CEO", "Chief executive"), o("IT_ADMIN", "IT administrator")];
export const COUNTRIES: CountryOption[] = [
  { code: "AE", name: "Testland East", callingCode: "+971" },
  { code: "US", name: "Testland West", callingCode: "+1" },
  { code: "SG", name: "Testland Isle" },
];
const STATES: Record<string, Option[]> = { AE: [o("DU", "Dune")], US: [o("CA", "Cove")], SG: [] };
const DISTRICTS: Record<string, Option[]> = { "AE:DU": [], "US:CA": [o("SF", "Bayside")] };
const TIME_ZONES: Record<string, Option[]> = {
  AE: [o("Asia/Dubai", "Gulf time")],
  US: [o("America/New_York", "Eastern"), o("America/Los_Angeles", "Pacific")],
  SG: [o("Asia/Singapore", "Isle time")],
};
const CURRENCIES: Record<string, CurrencyOption[]> = {
  AE: [{ code: "USD", name: "Dollar" }, { code: "AED", name: "Dirham", primary: true }],
  US: [{ code: "USD", name: "Dollar", primary: true }],
  SG: [{ code: "SGD", name: "Isle dollar", primary: true }],
};
export const OFFERS: Record<string, Offer[]> = {
  AE: [
    { id: "ae-basic", name: "Basic", priceLabel: "100 per month", termsVersion: "T-1", termsText: "Basic plan terms.", documents: [] },
    {
      id: "ae-licensed",
      name: "Licensed",
      priceLabel: "200 per month",
      termsVersion: "T-2",
      termsText: "Licensed plan terms.",
      documents: ["OPERATING_LICENCE", "TRADE_LICENCE"],
    },
  ],
  US: [{ id: "us-basic", name: "US Basic", priceLabel: "90 per month", termsVersion: "U-1", termsText: "US terms.", documents: [] }],
  SG: [],
};

export function fakeHost(overrides: Partial<RegistrationHost> = {}): RegistrationHost & {
  requestCode: ReturnType<typeof vi.fn>;
  verifyCode: ReturnType<typeof vi.fn>;
  uploadDocument: ReturnType<typeof vi.fn>;
  submit: ReturnType<typeof vi.fn>;
} {
  return {
    brand: { name: "Example Health", supportEmail: "help@example.test", homeHref: "/" },
    workspaceDomain: "care.example.test",
    lists: {
      facilityTypes: vi.fn(async () => FACILITY_TYPES),
      careSettings: vi.fn(async () => CARE_SETTINGS),
      specialties: vi.fn(async () => SPECIALTIES),
      administratorRoles: vi.fn(async () => ROLES),
      countries: vi.fn(async () => COUNTRIES),
      states: vi.fn(async (c: string) => STATES[c] ?? []),
      districts: vi.fn(async (c: string, s: string) => DISTRICTS[`${c}:${s}`] ?? []),
      timeZones: vi.fn(async (c: string) => TIME_ZONES[c] ?? []),
      currencies: vi.fn(async (c: string) => CURRENCIES[c] ?? []),
      offers: vi.fn(async (c: string) => OFFERS[c] ?? []),
    },
    agreements: {
      baa: { version: "BAA-3", href: "https://example.test/baa", label: "business associate agreement" },
      dpa: { version: "DPA-5", href: "https://example.test/dpa", label: "data processing agreement" },
    },
    requestCode: vi.fn(async () => {}),
    verifyCode: vi.fn(async () => {}),
    uploadDocument: vi.fn(async () => {}),
    submit: vi.fn(async () => ({ reference: "REG-0001", message: "We will review your licence." })),
    ...overrides,
  } as never;
}

/** A complete, valid single-hospital registration in country AE. */
export function completeData(patch: Partial<RegistrationData> = {}): RegistrationData {
  return {
    structure: "SINGLE",
    facilityTypes: ["HOSPITAL"],
    profile: {
      legalName: "Example Care LLC",
      displayName: "Example Care",
      licenceNumber: "LIC-1",
      taxId: "",
      country: "AE",
      state: "DU",
      district: "",
      city: "Dune City",
      address: "1 Example Street",
      postalCode: "",
      phone: "",
      website: "",
      timeZone: "Asia/Dubai",
      currency: "AED",
      beds: "120",
    },
    facilities: [],
    careSettings: ["OPD"],
    specialties: [],
    workspace: { slug: "example-care", offerId: "ae-basic" },
    administrator: { fullName: "Alex Example", role: "CEO", email: "Alex@Example.test", mobile: "50 123 4567" },
    agreements: {
      terms: true,
      baa: true,
      dpa: true,
      productUpdates: false,
      termsVersion: "",
      baaVersion: "",
      dpaVersion: "",
    },
    ...patch,
  };
}
