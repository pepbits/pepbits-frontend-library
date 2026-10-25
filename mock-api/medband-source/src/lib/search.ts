import type { EncounterType, Gender, Patient } from "./types";
import { fullName, normalize } from "./utils";

export interface PatientFilters {
  // Patient section
  text: string; // name, MRN, phone, national ID, member ID, policy number
  dob: string;
  gender: Gender | "";
  city: string;
  // Insurance section — evaluated per coverage
  payerIds: string[];
  tpaIds: string[];
  networkIds: string[];
  planIds: string[];
  memberOrPolicy: string;
  coverageStatus: "any" | "active" | "expired";
  coverageKind: "any" | "insured" | "self-pay";
  // Care section
  encounterTypes: EncounterType[];
  departmentId: string;
  openEpisode: boolean;
}

export const EMPTY_FILTERS: PatientFilters = {
  text: "", dob: "", gender: "", city: "",
  payerIds: [], tpaIds: [], networkIds: [], planIds: [], memberOrPolicy: "",
  coverageStatus: "any", coverageKind: "any",
  encounterTypes: [], departmentId: "", openEpisode: false,
};

export function quickMatch(p: Patient, q: string) {
  const n = normalize(q);
  if (!n) return true;
  return [fullName(p), p.mrn, p.phone, p.nationalId ?? "", p.email ?? "", ...p.coverages.flatMap((c) => [c.memberId, c.policyNumber])]
    .some((v) => normalize(v).includes(n));
}

export function countActiveFilters(f: PatientFilters) {
  let n = 0;
  if (f.dob) n++;
  if (f.gender) n++;
  if (f.city) n++;
  n += f.payerIds.length + f.tpaIds.length + f.networkIds.length + f.planIds.length + f.encounterTypes.length;
  if (f.memberOrPolicy) n++;
  if (f.coverageStatus !== "any") n++;
  if (f.coverageKind !== "any") n++;
  if (f.departmentId) n++;
  if (f.openEpisode) n++;
  return n;
}

// ─── Query string encoding for GET /api/v1/patients ───
// Repeated keys carry lists, e.g. ?payer=pay-meridian&payer=pay-helix

export function filtersToParams(f: PatientFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.text.trim()) p.set("q", f.text.trim());
  if (f.dob) p.set("dob", f.dob);
  if (f.gender) p.set("gender", f.gender);
  if (f.city) p.set("city", f.city);
  f.payerIds.forEach((v) => p.append("payer", v));
  f.tpaIds.forEach((v) => p.append("tpa", v));
  f.networkIds.forEach((v) => p.append("network", v));
  f.planIds.forEach((v) => p.append("plan", v));
  if (f.memberOrPolicy) p.set("member", f.memberOrPolicy);
  if (f.coverageStatus !== "any") p.set("coverageStatus", f.coverageStatus);
  if (f.coverageKind !== "any") p.set("coverageKind", f.coverageKind);
  f.encounterTypes.forEach((v) => p.append("type", v));
  if (f.departmentId) p.set("department", f.departmentId);
  if (f.openEpisode) p.set("openEpisode", "1");
  return p;
}

export function paramsToFilters(p: URLSearchParams): PatientFilters {
  const pick = <T extends string>(v: string | null, allowed: readonly T[], fallback: T) => (allowed.includes(v as T) ? (v as T) : fallback);
  return {
    text: p.get("q") ?? "",
    dob: p.get("dob") ?? "",
    gender: pick(p.get("gender"), ["Male", "Female", "Other", "Unknown"] as const, "" as never) || "",
    city: p.get("city") ?? "",
    payerIds: p.getAll("payer"),
    tpaIds: p.getAll("tpa"),
    networkIds: p.getAll("network"),
    planIds: p.getAll("plan"),
    memberOrPolicy: p.get("member") ?? "",
    coverageStatus: pick(p.get("coverageStatus"), ["any", "active", "expired"] as const, "any"),
    coverageKind: pick(p.get("coverageKind"), ["any", "insured", "self-pay"] as const, "any"),
    encounterTypes: p.getAll("type") as PatientFilters["encounterTypes"],
    departmentId: p.get("department") ?? "",
    openEpisode: p.get("openEpisode") === "1",
  };
}
