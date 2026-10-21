import type {
  Agreement,
  FacilityEntry,
  Offer,
  RegistrationData,
  RegistrationHostError,
  Structure,
} from "./types";

/** Facility type code that makes licensed beds required. */
export const HOSPITAL_CODE = "HOSPITAL";
export const MIN_NETWORK_FACILITIES = 2;
export const MAX_NETWORK_FACILITIES = 50;
export const MAX_BEDS = 100000;
export const MAX_PHONE_LENGTH = 30;
export const DEFAULT_DRAFT_KEY = "pepbits.registration.draft.v1";

export const SLUG_RE = /^[a-z][a-z0-9-]{1,46}[a-z0-9]$/;
export const SLUG_MAX_LENGTH = 48;
export const RESERVED_SLUGS: readonly string[] = ["admin", "platform", "www", "api", "auth", "registration", "mail"];
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBSITE_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const PHONE_CHARS_RE = /^[0-9 ()-]+$/;
const FREE_MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"];

export const emptyRegistration: RegistrationData = Object.freeze({
  structure: "",
  facilityTypes: [],
  profile: {
    legalName: "",
    displayName: "",
    licenceNumber: "",
    taxId: "",
    country: "",
    state: "",
    district: "",
    city: "",
    address: "",
    postalCode: "",
    phone: "",
    website: "",
    timeZone: "",
    currency: "",
    beds: "",
  },
  facilities: [],
  careSettings: [],
  specialties: [],
  workspace: { slug: "", offerId: "" },
  administrator: { fullName: "", role: "", email: "", mobile: "" },
  agreements: {
    terms: false,
    baa: false,
    dpa: false,
    productUpdates: false,
    termsVersion: "",
    baaVersion: "",
    dpaVersion: "",
  },
}) as RegistrationData;

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

export type StepId = "organisation" | "details" | "facilities" | "scope" | "workspace" | "review";

export interface StepMeta {
  id: StepId;
  title: string;
  caption: string;
  intro: string;
}

export const STEPS: readonly StepMeta[] = [
  {
    id: "organisation",
    title: "Organisation type",
    caption: "What you run and how it is set up",
    intro: "Tell us what kind of care you provide. We use this to tailor the later steps.",
  },
  {
    id: "details",
    title: "Organisation details",
    caption: "Legal identity, licence and location",
    intro:
      "Enter the details exactly as they appear on your operating licence. They are checked before your workspace goes live.",
  },
  {
    id: "facilities",
    title: "Facilities",
    caption: "Entities in your group",
    intro: "Add each hospital, clinic, pharmacy, laboratory or imaging centre in your group.",
  },
  {
    id: "scope",
    title: "Clinical scope",
    caption: "Care settings and specialties",
    intro: "Choose where and how you deliver care. Both are optional and can be changed later.",
  },
  {
    id: "workspace",
    title: "Workspace and administrator",
    caption: "Your address, plan and first admin",
    intro: "Choose the address your staff will sign in at, your plan and the first administrator.",
  },
  {
    id: "review",
    title: "Review and submit",
    caption: "Check details and accept agreements",
    intro: "Check everything below. Select Edit on any section to change it.",
  },
];

export function visibleSteps(d: Pick<RegistrationData, "structure">): StepMeta[] {
  return STEPS.filter((s) => s.id !== "facilities" || d.structure === "NETWORK");
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type Errors = Record<string, string>;

/**
 * Host list state the rules depend on. A list given as an array is enforced
 * (the value must be one of its codes). For `states` and `districts`, an empty
 * array means the host has no entries for that level, so the field is optional.
 * An omitted list is unknown: the field is only required to be non-empty.
 */
export interface ValidationContext {
  facilityTypes?: string[];
  states?: string[];
  districts?: string[];
  timeZones?: string[];
  currencies?: string[];
  offers?: string[];
  administratorRoles?: string[];
  /** Calling code of the selected country; counts toward the 30 character phone limit. */
  callingCode?: string;
}

function digitCount(s: string) {
  return s.replace(/\D/g, "").length;
}

function bedsError(beds: string): string | null {
  const v = beds.trim();
  if (!v) return "Enter the number of licensed beds";
  if (!/^\d+$/.test(v)) return "Use whole numbers only";
  const n = Number(v);
  if (n < 1 || n > MAX_BEDS) return `Enter between 1 and ${MAX_BEDS.toLocaleString()} beds`;
  return null;
}

export function needsBeds(d: Pick<RegistrationData, "structure" | "facilityTypes">): boolean {
  return d.structure === "SINGLE" && d.facilityTypes.includes(HOSPITAL_CODE);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug);
}

function pick(e: Errors, key: string, list: string[] | undefined, value: string, empty: string, outside: string) {
  if (!value) e[key] = empty;
  else if (list && !list.includes(value)) e[key] = outside;
}

export function validateStep(id: StepId, d: RegistrationData, ctx: ValidationContext = {}): Errors {
  const e: Errors = {};
  switch (id) {
    case "organisation": {
      if (d.structure !== "SINGLE" && d.structure !== "NETWORK") e.structure = "Choose single facility or multi-facility network";
      if (d.facilityTypes.length === 0) e.facilityTypes = "Select at least one type of facility you operate";
      else if (ctx.facilityTypes && d.facilityTypes.some((t) => !ctx.facilityTypes!.includes(t)))
        e.facilityTypes = "Select facility types from the list";
      break;
    }
    case "details": {
      const o = d.profile;
      if (!o.legalName.trim()) e["profile.legalName"] = "Enter your organisation's legal name";
      if (!o.licenceNumber.trim()) e["profile.licenceNumber"] = "Enter the licence number issued by your health authority";
      if (!o.country) e["profile.country"] = "Choose the country you operate in";
      else if (!(ctx.states && ctx.states.length === 0)) {
        // States apply unless the host has none for this country; districts are a level below.
        pick(e, "profile.state", ctx.states, o.state, "Choose a state or province", "Choose a state or province from the list");
        if (o.state && !(ctx.districts && ctx.districts.length === 0))
          pick(e, "profile.district", ctx.districts, o.district, "Choose a district", "Choose a district from the list");
      }
      if (!o.city.trim()) e["profile.city"] = "Enter the city";
      if (!o.address.trim()) e["profile.address"] = "Enter the street address of your main site";
      const phone = o.phone.trim();
      if (phone) {
        if (!PHONE_CHARS_RE.test(phone) || digitCount(phone) === 0)
          e["profile.phone"] = "Use digits, spaces, brackets and hyphens only";
        else if (phoneTooLong(phone, ctx.callingCode))
          e["profile.phone"] = `Use at most ${MAX_PHONE_LENGTH} characters including the country code`;
      }
      if (o.website.trim() && !WEBSITE_RE.test(normalizeWebsite(o.website)))
        e["profile.website"] = "Enter a website like example.org";
      pick(e, "profile.timeZone", ctx.timeZones, o.timeZone, "Choose a time zone", "Choose a time zone for the selected country");
      pick(e, "profile.currency", ctx.currencies, o.currency, "Choose a billing currency", "Choose a currency for the selected country");
      if (needsBeds(d)) {
        const b = bedsError(o.beds);
        if (b) e["profile.beds"] = b;
      }
      break;
    }
    case "facilities": {
      if (d.structure !== "NETWORK") break;
      if (d.facilities.length < MIN_NETWORK_FACILITIES)
        e.facilities = "Add at least two facilities, or go back and choose Single facility";
      else if (d.facilities.length > MAX_NETWORK_FACILITIES)
        e.facilities = `Register at most ${MAX_NETWORK_FACILITIES} facilities here; add the rest after setup`;
      d.facilities.forEach((f, i) => {
        if (!f.name.trim()) e[`facilities.${i}.name`] = "Enter a name";
        if (!f.type) e[`facilities.${i}.type`] = "Choose a type";
        if (!f.city.trim()) e[`facilities.${i}.city`] = "Enter a city";
        if (f.type === HOSPITAL_CODE) {
          const b = bedsError(f.beds);
          if (b) e[`facilities.${i}.beds`] = b === "Enter the number of licensed beds" ? "Enter beds" : b;
        }
      });
      break;
    }
    case "scope":
      // Care settings and specialties are optional.
      break;
    case "workspace": {
      const w = d.workspace;
      const a = d.administrator;
      if (!SLUG_RE.test(w.slug))
        e["workspace.slug"] = "Use 3 to 48 lowercase letters, numbers or hyphens, starting with a letter";
      else if (isReservedSlug(w.slug)) e["workspace.slug"] = "That address is reserved. Choose another one";
      pick(e, "workspace.offerId", ctx.offers, w.offerId, "Choose a plan", "Choose a plan available in your country");
      if (a.fullName.trim().split(/\s+/).filter(Boolean).length < 2)
        e["administrator.fullName"] = "Enter the administrator's first and last name";
      pick(e, "administrator.role", ctx.administratorRoles, a.role, "Choose the administrator's role", "Choose a role from the list");
      if (!EMAIL_RE.test(a.email.trim())) e["administrator.email"] = "Enter a work email like name@hospital.org";
      if (digitCount(a.mobile) < 6 || a.mobile.length > MAX_PHONE_LENGTH || !/^[0-9 ()+-]+$/.test(a.mobile.trim()))
        e["administrator.mobile"] = "Enter a mobile number with at least 6 digits";
      break;
    }
    case "review": {
      if (!d.agreements.terms) e["agreements.terms"] = "Accept the plan terms to continue";
      if (!d.agreements.baa) e["agreements.baa"] = "Accept the business associate agreement to continue";
      if (!d.agreements.dpa) e["agreements.dpa"] = "Accept the data processing agreement to continue";
      break;
    }
  }
  return e;
}

/** Phone length including the country calling code, used by the wizard for the 30 character limit. */
export function phoneTooLong(phone: string, callingCode = ""): boolean {
  return (callingCode + phone.trim()).length > MAX_PHONE_LENGTH;
}

export function isFreeEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && FREE_MAIL.includes(domain);
}

export function normalizeWebsite(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Workspace address                                                   */
/* ------------------------------------------------------------------ */

/** Accepts "stmarys", "stmarys.<domain>" or a full URL and keeps only slug characters. */
export function normalizeSlug(input: string, domain = ""): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  if (domain && s.endsWith(`.${domain.toLowerCase()}`)) s = s.slice(0, -(domain.length + 1));
  return s.replace(/[^a-z0-9-]/g, "").slice(0, SLUG_MAX_LENGTH);
}

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[^a-z]+/, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  return s;
}

/** Suggested slug: from display or legal name, avoiding reserved words. */
export function suggestSlug(d: RegistrationData): string {
  let s = slugify(d.profile.displayName || d.profile.legalName);
  if (s && isReservedSlug(s)) s = slugify(`${s}-${d.profile.city || "health"}`);
  return s;
}

/* ------------------------------------------------------------------ */
/* Drafts                                                              */
/* ------------------------------------------------------------------ */

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const bool = (v: unknown) => v === true;

/**
 * Rebuild form data from an untrusted stored draft. Only known form fields are
 * copied, so anything else a draft holds (or an older version stored) is dropped.
 */
export function hydrateDraft(raw: unknown): RegistrationData {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const p = (r.profile ?? {}) as Record<string, unknown>;
  const w = (r.workspace ?? {}) as Record<string, unknown>;
  const a = (r.administrator ?? {}) as Record<string, unknown>;
  const g = (r.agreements ?? {}) as Record<string, unknown>;
  const profile = { ...emptyRegistration.profile };
  for (const k of Object.keys(profile) as Array<keyof typeof profile>) profile[k] = str(p[k]);
  return {
    structure: r.structure === "SINGLE" || r.structure === "NETWORK" ? (r.structure as Structure) : "",
    facilityTypes: strs(r.facilityTypes),
    profile,
    facilities: Array.isArray(r.facilities)
      ? r.facilities
          .filter((f: unknown) => f && typeof f === "object")
          .slice(0, MAX_NETWORK_FACILITIES)
          .map((f: Record<string, unknown>) => ({
            id: str(f.id) || newId(),
            name: str(f.name),
            type: str(f.type),
            city: str(f.city),
            beds: str(f.beds),
          }))
      : [],
    careSettings: strs(r.careSettings),
    specialties: strs(r.specialties),
    workspace: { slug: str(w.slug), offerId: str(w.offerId) },
    administrator: { fullName: str(a.fullName), role: str(a.role), email: str(a.email), mobile: str(a.mobile) },
    agreements: {
      ...emptyRegistration.agreements,
      terms: bool(g.terms),
      baa: bool(g.baa),
      dpa: bool(g.dpa),
      productUpdates: bool(g.productUpdates),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Submission                                                          */
/* ------------------------------------------------------------------ */

const trimAll = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as T;

/**
 * The payload handed to `host.submit`: trimmed, with data that does not apply to
 * the chosen structure removed and the accepted agreement versions recorded.
 */
export function toSubmission(
  d: RegistrationData,
  offer: Pick<Offer, "termsVersion"> | undefined,
  agreements: { baa: Pick<Agreement, "version">; dpa: Pick<Agreement, "version"> },
): RegistrationData {
  const network = d.structure === "NETWORK";
  const profile = trimAll(d.profile);
  profile.website = profile.website ? normalizeWebsite(profile.website) : "";
  if (!needsBeds(d)) profile.beds = "";
  return {
    structure: d.structure,
    facilityTypes: [...d.facilityTypes],
    profile,
    facilities: network
      ? d.facilities.map((f) => {
          const row: FacilityEntry = trimAll(f);
          return { ...row, beds: row.type === HOSPITAL_CODE ? row.beds : "" };
        })
      : [],
    careSettings: [...d.careSettings],
    specialties: [...d.specialties],
    workspace: trimAll(d.workspace),
    administrator: { ...trimAll(d.administrator), email: d.administrator.email.trim().toLowerCase() },
    agreements: {
      terms: d.agreements.terms,
      baa: d.agreements.baa,
      dpa: d.agreements.dpa,
      productUpdates: d.agreements.productUpdates,
      termsVersion: offer?.termsVersion ?? "",
      baaVersion: agreements.baa.version,
      dpaVersion: agreements.dpa.version,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Host errors                                                         */
/* ------------------------------------------------------------------ */

export function readHostError(err: unknown, fallback: string): RegistrationHostError {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const message = typeof o.message === "string" && o.message.trim() ? o.message : fallback;
    return {
      message,
      code: typeof o.code === "string" ? o.code : undefined,
      field: typeof o.field === "string" && o.field ? o.field : undefined,
    };
  }
  if (typeof err === "string" && err.trim()) return { message: err };
  return { message: fallback };
}

const STEP_OF_ROOT: Record<string, StepId> = {
  structure: "organisation",
  facilityTypes: "organisation",
  profile: "details",
  facilities: "facilities",
  careSettings: "scope",
  specialties: "scope",
  workspace: "workspace",
  administrator: "workspace",
  agreements: "review",
};

const ALIASES: Record<string, string> = {
  plan: "workspace.offerId",
  offer: "workspace.offerId",
  slug: "workspace.slug",
  email: "administrator.email",
  mobile: "administrator.mobile",
  terms: "agreements.terms",
  baa: "agreements.baa",
  dpa: "agreements.dpa",
};

function leafKeys(): string[] {
  const keys: string[] = ["structure", "facilityTypes", "facilities", "careSettings", "specialties"];
  for (const group of ["profile", "workspace", "administrator", "agreements"] as const)
    for (const k of Object.keys(emptyRegistration[group])) keys.push(`${group}.${k}`);
  return keys;
}
const LEAVES = leafKeys();

/**
 * Map a host field path (e.g. `profile.timeZone`, `form.slug`, `facilities[1].beds`)
 * to the wizard's error key and the step that shows it. Unknown paths return null.
 */
export function resolveFieldPath(path: string): { key: string; step: StepId } | null {
  const clean = path.replace(/\[(\d+)\]/g, ".$1").replace(/^\.+|\.+$/g, "");
  if (!clean) return null;
  const segments = clean.split(".");
  // Try the path as given, then without leading wrapper segments ("form.", "request.").
  for (let start = 0; start < segments.length; start += 1) {
    const candidate = segments.slice(start).join(".");
    const facility = /^facilities\.(\d+)\.(name|type|city|beds)$/.exec(candidate);
    if (facility) return { key: candidate, step: "facilities" };
    if (LEAVES.includes(candidate)) return { key: candidate, step: STEP_OF_ROOT[candidate.split(".")[0]!]! };
    if (ALIASES[candidate]) {
      const key = ALIASES[candidate]!;
      return { key, step: STEP_OF_ROOT[key.split(".")[0]!]! };
    }
  }
  const last = segments[segments.length - 1]!;
  const matches = LEAVES.filter((k) => k.endsWith(`.${last}`));
  if (matches.length === 1) return { key: matches[0]!, step: STEP_OF_ROOT[matches[0]!.split(".")[0]!]! };
  return null;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function humanizeCode(code: string): string {
  const words = code.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : code;
}
