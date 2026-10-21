import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Host-supplied lists                                                 */
/* ------------------------------------------------------------------ */

/** One entry of a host-supplied list. `code` is stored in data; `name` is only displayed. */
export interface Option {
  code: string;
  name: string;
  description?: string;
}

export interface CountryOption extends Option {
  /** Shown before phone numbers, e.g. "+971". Display only; never stored in data. */
  callingCode?: string;
}

export interface CurrencyOption extends Option {
  /** The currency pre-selected for the country. */
  primary?: boolean;
}

/** A commercial offer (plan) available in a country. */
export interface Offer {
  id: string;
  name: string;
  /** Already formatted by the host, e.g. "USD 120 per facility per month". */
  priceLabel: string;
  termsVersion: string;
  /** Plain text terms shown in an expandable panel on the review step. */
  termsText: string;
  /** Document type codes the organisation must upload before submitting. Empty when none. */
  documents: string[];
}

export interface Agreement {
  version: string;
  href: string;
  label: string;
}

export interface Receipt {
  reference: string;
  /** Next-steps text shown on the success screen. */
  message?: string;
}

export interface RegistrationLists {
  facilityTypes(): Promise<Option[]>;
  careSettings(): Promise<Option[]>;
  specialties(): Promise<Option[]>;
  administratorRoles(): Promise<Option[]>;
  countries(): Promise<CountryOption[]>;
  states(country: string): Promise<Option[]>;
  districts(country: string, state: string): Promise<Option[]>;
  timeZones(country: string): Promise<Option[]>;
  currencies(country: string): Promise<CurrencyOption[]>;
  offers(country: string): Promise<Offer[]>;
}

export type LogoTone = "light" | "dark";

export interface RegistrationBrand {
  name: string;
  /**
   * Logo node, or a function receiving the surface tone ("light" on the dark brand
   * rail, "dark" on the paper header). Falls back to the brand name as text.
   */
  logo?: ReactNode | ((tone: LogoTone) => ReactNode);
  supportEmail?: string;
  /** Plain link target for the logo, "Save and exit" and "Back to home". Omitted links are hidden. */
  homeHref?: string;
}

/**
 * Everything environment-specific the wizard needs. The package holds no catalogues,
 * no mock data and no transport: every list and every action comes from here.
 *
 * Errors thrown by any function may be an `Error` or a plain object carrying
 * `message`, an optional `code` and an optional `field` (dotted path such as
 * `profile.timeZone` or `form.slug`); see {@link RegistrationHostError}.
 */
export interface RegistrationHost {
  brand: RegistrationBrand;
  /** Domain the workspace address is shown under, e.g. "health.example.org". */
  workspaceDomain: string;
  lists: RegistrationLists;
  agreements: { baa: Agreement; dpa: Agreement };
  /** Optional mapping used to pre-select care settings. Without it nothing is pre-selected. */
  recommendedCareSettings?(facilityTypes: string[]): string[];
  /** Human label for a document type code. Defaults to a readable form of the code. */
  documentTypeLabel?(type: string): string;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  uploadDocument(type: string, file: File): Promise<void>;
  submit(data: RegistrationData): Promise<Receipt>;
  /** localStorage key for the form-field draft. Default `pepbits.registration.draft.v1`. */
  draftKey?: string;
}

/** Shape the wizard understands for errors thrown by the host. */
export interface RegistrationHostError {
  message: string;
  code?: string;
  field?: string;
}

/* ------------------------------------------------------------------ */
/* Form data                                                           */
/* ------------------------------------------------------------------ */

export type Structure = "SINGLE" | "NETWORK";

export interface OrganisationProfile {
  legalName: string;
  /** Optional. */
  displayName: string;
  licenceNumber: string;
  /** Optional. */
  taxId: string;
  /** Country code from `lists.countries()`. */
  country: string;
  /** State/province code; empty when the host returns no states for the country. */
  state: string;
  /** District code; empty when the host returns no districts for the state. */
  district: string;
  city: string;
  address: string;
  /** Optional. */
  postalCode: string;
  /** Optional. National number without the calling code: digits, spaces, ( ) and - only. */
  phone: string;
  /** Optional. Host name such as "example.org", without a scheme. */
  website: string;
  /** Time zone code from `lists.timeZones(country)`. */
  timeZone: string;
  /** Currency code from `lists.currencies(country)`. */
  currency: string;
  /** Licensed beds as decimal digits; required only for a single hospital, otherwise empty. */
  beds: string;
}

export interface FacilityEntry {
  /** Client-side row identity only. */
  id: string;
  name: string;
  /** Facility type code. */
  type: string;
  city: string;
  /** Decimal digits; required when `type` is HOSPITAL, otherwise empty. */
  beds: string;
}

export interface WorkspaceSetup {
  slug: string;
  /** Offer id from `lists.offers(country)`. */
  offerId: string;
}

export interface AdministratorDetails {
  /** First and last name. */
  fullName: string;
  /** Role code from `lists.administratorRoles()`. */
  role: string;
  email: string;
  mobile: string;
}

export interface AgreementAcceptance {
  terms: boolean;
  baa: boolean;
  dpa: boolean;
  /** Optional marketing consent. */
  productUpdates: boolean;
  /** Versions accepted; filled from the selected offer and host agreements at submit time. */
  termsVersion: string;
  baaVersion: string;
  dpaVersion: string;
}

export interface RegistrationData {
  structure: Structure | "";
  /** Facility type codes, at least one. */
  facilityTypes: string[];
  profile: OrganisationProfile;
  /** NETWORK only: 2 to 50 rows. Always empty in a SINGLE submission. */
  facilities: FacilityEntry[];
  /** Optional care setting codes. */
  careSettings: string[];
  /** Optional specialty codes. */
  specialties: string[];
  workspace: WorkspaceSetup;
  administrator: AdministratorDetails;
  agreements: AgreementAcceptance;
}

export interface RegistrationPrefill {
  structure?: Structure;
  facilityTypes?: string[];
}
