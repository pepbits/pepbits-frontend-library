/** Pure consultation contracts extracted from the frozen AllyVora source; no transport or React. */


export interface Clinic {
    code: string;
    name: string;
    department: string;
    departmentCode: string;
    specialty: string;
    location?: string;
    durationMinutes?: number;
    sessions: Session[];
}

export interface Session {
    day: string;
    start: string;
    end: string;
    clinicianIds: string[];
}

export interface Services {
    specialties: string[];
    departments: Department[];
    clinics: Clinic[];
    wards: Ward[];
}

/** GET /api/services (mirrors Codesets.services): the configured specialties, departments and clinics. */
export interface Department {
    code: string;
    name: string;
    services: string[];
    specialties: string[];
}

export interface Ward {
    code: string;
    name: string;
    kind: string;
    sex: string;
    location?: string;
    departments: string[];
    departmentCodes: string[];
}

export interface FacilityChoice {
    code: string;
    name: string;
    type: string;
    emergency: boolean;
}

export type Clinician = {
    id: string;
    name: string;
    role: string;
};

export interface IssuedCertificate {
    id: string;
    number: string;
    from: string;
    to: string;
    days: number;
    portal: {
        status: string;
        reference?: string | null;
        error?: string | null;
    };
}
export const departmentsFor = (s: Services | null, service: string) => (s?.departments ?? []).filter((d) => d.services.includes(service));

export interface EducationTemplate { id: string; title: string; languages: string[]; version: number }
export interface CertificateList { portalConfigured: boolean; certificates: IssuedCertificate[] }
export interface ReferralPharmacy { name: string; connected: boolean }

/** Transport/session operations remain host-only; these projections retain the source payload fields. */
export interface TeleSession {
  mode: "in-person" | "video" | "phone"; state: "scheduled" | "waiting" | "in-progress" | "ended" | null;
  patientCheckedIn?: boolean; consentAt?: string | null; videoUrl?: string | null; mobile?: string | null;
}
export type Role = "doctor" | "resident" | "nurse" | "student-nurse" | "reception" | "pharmacist" | "lab" | "pathologist" | "radiologist" | "technologist" | "billing" | "admin" | "requester";
export interface Me {
  demo?: boolean; id: string; name: string; role: Role; licence: string; requiresCosign: boolean; permissions: string[];
  idleMinutes: number; facility: string; features?: string[];
}
export interface IdentityType {
  code: string; label: string; country: string; normalise: "digits" | "upper-alnum" | "trim"; pattern: string; display: string;
  checkDigit: "none" | "luhn" | "verhoeff" | "mod11-nhs"; mask: {showFirst: number; showLast: number}; storeFull: boolean;
  unique: boolean; issuingCountry: "fixed" | "ask"; expiry: "none" | "optional" | "required"; fhir: {type: string; system: string};
  redact: string; reader: boolean; enabled?: boolean; custom?: boolean; note?: string; sample?: string;
}
export interface IdentityPolicy {
  version: number; types: IdentityType[]; primary: string; standardRegistration: {requireOneOf: string[]}; claims: {nationalIdTypes: string[]};
}
