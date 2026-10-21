import { facilityType, type FacilityTypeId } from "./catalog";
import { evaluatePassword } from "./password";
import { SLUG_RE } from "./workspaces";

export type Structure = "single" | "network";
export type MfaMethod = "authenticator" | "sms" | "email";

export interface OrgDetails {
  legalName: string;
  displayName: string;
  licenseNumber: string;
  taxId: string;
  country: string;
  city: string;
  address: string;
  postalCode: string;
  phone: string;
  website: string;
  timezone: string;
  currency: string;
  beds: string;
}

export interface FacilityEntry {
  id: string;
  name: string;
  type: FacilityTypeId | "";
  city: string;
  beds: string;
}

export interface WorkspaceSetup {
  slug: string;
  region: string;
  adminName: string;
  adminRole: string;
  adminEmail: string;
  adminPhone: string;
  password: string;
  mfa: MfaMethod;
}

export interface Consents {
  terms: boolean;
  baa: boolean;
  dpa: boolean;
  updates: boolean;
}

export interface RegistrationData {
  structure: Structure | "";
  facilityTypes: FacilityTypeId[];
  org: OrgDetails;
  facilities: FacilityEntry[];
  careSettings: string[];
  specialties: string[];
  modules: string[];
  standards: string[];
  integrations: string[];
  emramTarget: string;
  workspace: WorkspaceSetup;
  consents: Consents;
}

export const initialData: RegistrationData = {
  structure: "",
  facilityTypes: [],
  org: {
    legalName: "",
    displayName: "",
    licenseNumber: "",
    taxId: "",
    country: "",
    city: "",
    address: "",
    postalCode: "",
    phone: "",
    website: "",
    timezone: "",
    currency: "",
    beds: "",
  },
  facilities: [],
  careSettings: [],
  specialties: [],
  modules: [],
  standards: ["hipaa", "hl7v2", "fhir", "icd10"],
  integrations: [],
  emramTarget: "none",
  workspace: {
    slug: "",
    region: "",
    adminName: "",
    adminRole: "",
    adminEmail: "",
    adminPhone: "",
    password: "",
    mfa: "authenticator",
  },
  consents: { terms: false, baa: false, dpa: false, updates: false },
};

/** Merge a stored draft over defaults so older drafts never crash the form. */
export function hydrateDraft(raw: Partial<RegistrationData> | undefined): RegistrationData {
  if (!raw) return initialData;
  return {
    ...initialData,
    ...raw,
    org: { ...initialData.org, ...(raw.org ?? {}) },
    workspace: { ...initialData.workspace, ...(raw.workspace ?? {}), password: "" },
    consents: { ...initialData.consents, ...(raw.consents ?? {}) },
    facilities: Array.isArray(raw.facilities) ? raw.facilities : [],
  };
}

export type StepId = "organization" | "details" | "facilities" | "scope" | "modules" | "workspace" | "review";

export interface StepMeta {
  id: StepId;
  title: string;
  caption: string;
  intro: string;
}

export const STEPS: StepMeta[] = [
  {
    id: "organization",
    title: "Organization type",
    caption: "What you run and how it is set up",
    intro: "Tell us what kind of care you provide. We use this to suggest the right setup in later steps.",
  },
  {
    id: "details",
    title: "Organization details",
    caption: "Legal identity, license and location",
    intro: "Enter the details exactly as they appear on your operating license. Our compliance team checks them before your workspace goes live.",
  },
  {
    id: "facilities",
    title: "Facilities",
    caption: "Entities in your group",
    intro: "Add each hospital, clinic, pharmacy, lab or imaging center in your group. Each one gets its own departments, stock and billing, under one patient index.",
  },
  {
    id: "scope",
    title: "Clinical scope",
    caption: "Care settings and specialties",
    intro: "Choose where and how you deliver care. This sets up departments, clinical templates and order sets.",
  },
  {
    id: "modules",
    title: "Modules and standards",
    caption: "What to switch on",
    intro: "We have suggested modules for your organization type. Adjust anything now; you can add more later from workspace settings.",
  },
  {
    id: "workspace",
    title: "Workspace and administrator",
    caption: "Your address and first admin",
    intro: "Choose the address your staff will sign in at and create the first administrator account.",
  },
  {
    id: "review",
    title: "Review and submit",
    caption: "Check details and accept agreements",
    intro: "Check everything below. Select Edit on any section to change it.",
  },
];

export function visibleSteps(d: RegistrationData): StepMeta[] {
  return STEPS.filter((s) => s.id !== "facilities" || d.structure === "network");
}

export type Errors = Record<string, string>;

const CARE_PROVIDERS: FacilityTypeId[] = ["hospital", "clinic", "homecare", "telehealth"];

export function needsCareSettings(d: RegistrationData) {
  return d.facilityTypes.some((t) => CARE_PROVIDERS.includes(t));
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FREE_MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"];

export function isFreeEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && FREE_MAIL.includes(domain);
}

function digits(s: string) {
  return s.replace(/\D/g, "").length;
}

export interface ValidationContext {
  isSlugTaken: (slug: string) => boolean;
}

export function validateStep(id: StepId, d: RegistrationData, ctx: ValidationContext): Errors {
  const e: Errors = {};
  switch (id) {
    case "organization": {
      if (!d.structure) e.structure = "Choose single facility or multi-facility network";
      if (d.facilityTypes.length === 0) e.facilityTypes = "Select at least one type of facility you operate";
      break;
    }
    case "details": {
      const o = d.org;
      if (!o.legalName.trim()) e["org.legalName"] = "Enter your organization's legal name";
      if (!o.licenseNumber.trim()) e["org.licenseNumber"] = "Enter the license number issued by your health authority";
      if (!o.country) e["org.country"] = "Choose the country you operate in";
      if (!o.city.trim()) e["org.city"] = "Enter the city";
      if (!o.address.trim()) e["org.address"] = "Enter the street address of your main site";
      if (digits(o.phone) < 6) e["org.phone"] = "Enter a phone number with at least 6 digits";
      if (!o.timezone) e["org.timezone"] = "Choose a time zone";
      if (!o.currency) e["org.currency"] = "Choose a billing currency";
      if (o.website.trim() && !/^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(o.website.trim().replace(/^https?:\/\//, "")))
        e["org.website"] = "Enter a website like stmarys.org";
      if (d.facilityTypes.includes("hospital") && d.structure !== "network") {
        const beds = Number(o.beds);
        if (!o.beds || !Number.isFinite(beds) || beds < 1) e["org.beds"] = "Enter the number of licensed beds";
      }
      break;
    }
    case "facilities": {
      if (d.facilities.length < 2) e.facilities = "Add at least two facilities, or go back and choose Single facility";
      d.facilities.forEach((f, i) => {
        if (!f.name.trim()) e[`facilities.${i}.name`] = "Enter a name";
        if (!f.type) e[`facilities.${i}.type`] = "Choose a type";
        if (!f.city.trim()) e[`facilities.${i}.city`] = "Enter a city";
        if (f.type === "hospital" && !(Number(f.beds) > 0)) e[`facilities.${i}.beds`] = "Enter beds";
      });
      break;
    }
    case "scope": {
      if (needsCareSettings(d) && d.careSettings.length === 0)
        e.careSettings = "Select at least one care setting";
      break;
    }
    case "modules": {
      if (d.modules.length === 0) e.modules = "Select at least one module to start with";
      break;
    }
    case "workspace": {
      const w = d.workspace;
      if (!SLUG_RE.test(w.slug)) e["workspace.slug"] = "Use 3 to 32 lowercase letters, numbers or hyphens";
      else if (ctx.isSlugTaken(w.slug)) e["workspace.slug"] = "That address is taken. Try adding your city or a short code";
      if (!w.region) e["workspace.region"] = "Choose where patient data is stored";
      if (w.adminName.trim().split(/\s+/).length < 2) e["workspace.adminName"] = "Enter the administrator's first and last name";
      if (!w.adminRole) e["workspace.adminRole"] = "Choose the administrator's role";
      if (!EMAIL_RE.test(w.adminEmail.trim())) e["workspace.adminEmail"] = "Enter a work email like name@hospital.org";
      if (digits(w.adminPhone) < 6) e["workspace.adminPhone"] = "Enter a mobile number for sign-in alerts";
      const pw = evaluatePassword(w.password, [w.adminEmail.split("@")[0] ?? "", w.slug]);
      if (!pw.acceptable)
        e["workspace.password"] = pw.containsPersonal
          ? "Don't include your name, email or workspace address in the password"
          : "Password needs 12+ characters with upper- and lowercase letters and a number";
      break;
    }
    case "review": {
      if (!d.consents.terms) e["consents.terms"] = "Accept the terms of service to continue";
      if (!d.consents.baa) e["consents.baa"] = "Accept the business associate agreement to continue";
      if (!d.consents.dpa) e["consents.dpa"] = "Accept the data processing agreement to continue";
      break;
    }
  }
  return e;
}

export function describeFacilityMix(facilities: FacilityEntry[]): string {
  const counts = new Map<string, number>();
  facilities.forEach((f) => {
    if (!f.type) return;
    counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([type, n]) => `${n} ${pluralize(facilityType(type)?.noun ?? type, n)}`)
    .join(", ");
}

export function pluralize(noun: string, n: number) {
  if (n === 1) return noun;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
