// Reference data registry. The source of truth is the SQLite database; the API
// serves it at /api/v1/master and the client loads it once at startup with
// setMasterData(). The arrays are filled in place so modules that imported them
// keep working, and every screen renders only after the load completes.

import type { BedCategory, EncounterType } from "./types";

export interface Payer {
  id: string;
  name: string;
  short: string;
  tpaIds: string[]; // TPAs this payer works through
  tpaRequired: boolean;
}

export interface Tpa {
  id: string;
  name: string;
}

export interface PlanNetwork {
  id: string;
  payerId: string;
  name: string;
  tier: "Platinum" | "Gold" | "Silver" | "Basic";
}

export interface Plan {
  id: string;
  networkId: string;
  name: string;
  copayPct: number;
  opLimit: number;
  ipCovered: boolean;
  teleCovered: boolean;
}

export interface Department {
  id: string;
  name: string;
  followUpDays: number; // follow-up window after an index consultation
  freeFollowUps: number; // free visits inside that window
  consults: boolean;
}

export interface Practitioner {
  id: string;
  name: string;
  departmentId: string;
  title: string;
  tele: boolean;
}

export interface Ward {
  id: string;
  name: string;
  category: BedCategory;
  beds: string[];
}

export interface HealthPackage {
  id: string;
  name: string;
  items: number;
}

/** A coded presenting complaint. Codes are local and can be mapped to SNOMED CT. */
export interface Complaint {
  code: string;
  label: string;
  category: string;
}

/** A registration desk. Each desk may only open the encounter types it serves. */
export interface Counter {
  id: string;
  name: string;
  location: string;
  encounterTypes: EncounterType[];
}

export interface MasterData {
  payers: Payer[];
  tpas: Tpa[];
  networks: PlanNetwork[];
  plans: Plan[];
  departments: Department[];
  practitioners: Practitioner[];
  wards: Ward[];
  services: string[];
  packages: HealthPackage[];
  complaints: Complaint[];
  counters: Counter[];
}

export const PAYERS: Payer[] = [];
export const TPAS: Tpa[] = [];
export const NETWORKS: PlanNetwork[] = [];
export const PLANS: Plan[] = [];
export const DEPARTMENTS: Department[] = [];
export const PRACTITIONERS: Practitioner[] = [];
export const WARDS: Ward[] = [];
export const SERVICES: string[] = [];
export const PACKAGES: HealthPackage[] = [];
export const COMPLAINTS: Complaint[] = [];
export const COUNTERS: Counter[] = [];

const maps = {
  payer: new Map<string, Payer>(),
  tpa: new Map<string, Tpa>(),
  network: new Map<string, PlanNetwork>(),
  plan: new Map<string, Plan>(),
  dept: new Map<string, Department>(),
  prac: new Map<string, Practitioner>(),
  ward: new Map<string, Ward>(),
  pkg: new Map<string, HealthPackage>(),
  complaint: new Map<string, Complaint>(),
  counter: new Map<string, Counter>(),
};

let loaded = false;
export const masterLoaded = () => loaded;

const fill = <T,>(target: T[], source: T[]) => target.splice(0, target.length, ...source);
const index = <T,>(map: Map<string, T>, list: T[], key: (x: T) => string) => {
  map.clear();
  list.forEach((x) => map.set(key(x), x));
};

export function setMasterData(m: MasterData) {
  fill(PAYERS, m.payers);
  fill(TPAS, m.tpas);
  fill(NETWORKS, m.networks);
  fill(PLANS, m.plans);
  fill(DEPARTMENTS, m.departments);
  fill(PRACTITIONERS, m.practitioners);
  fill(WARDS, m.wards);
  fill(SERVICES, m.services);
  fill(PACKAGES, m.packages);
  fill(COMPLAINTS, m.complaints);
  fill(COUNTERS, m.counters);
  index(maps.payer, PAYERS, (x) => x.id);
  index(maps.tpa, TPAS, (x) => x.id);
  index(maps.network, NETWORKS, (x) => x.id);
  index(maps.plan, PLANS, (x) => x.id);
  index(maps.dept, DEPARTMENTS, (x) => x.id);
  index(maps.prac, PRACTITIONERS, (x) => x.id);
  index(maps.ward, WARDS, (x) => x.id);
  index(maps.pkg, PACKAGES, (x) => x.id);
  index(maps.complaint, COMPLAINTS, (x) => x.code);
  index(maps.counter, COUNTERS, (x) => x.id);
  loaded = true;
}

// ─── Lookups ───
export const payer = (id?: string) => (id ? maps.payer.get(id) : undefined);
export const tpa = (id?: string) => (id ? maps.tpa.get(id) : undefined);
export const network = (id?: string) => (id ? maps.network.get(id) : undefined);
export const plan = (id?: string) => (id ? maps.plan.get(id) : undefined);
export const department = (id?: string) => (id ? maps.dept.get(id) : undefined);
export const practitioner = (id?: string) => (id ? maps.prac.get(id) : undefined);
export const ward = (id?: string) => (id ? maps.ward.get(id) : undefined);
export const healthPackage = (id?: string) => (id ? maps.pkg.get(id) : undefined);
export const complaint = (code?: string) => (code ? maps.complaint.get(code) : undefined);
export const counter = (id?: string) => (id ? maps.counter.get(id) : undefined);

export const networksFor = (payerIds: string[]) =>
  payerIds.length ? NETWORKS.filter((n) => payerIds.includes(n.payerId)) : NETWORKS;

export const plansFor = (networkIds: string[], payerIds: string[] = []) => {
  if (networkIds.length) return PLANS.filter((p) => networkIds.includes(p.networkId));
  const nets = networksFor(payerIds).map((n) => n.id);
  return PLANS.filter((p) => nets.includes(p.networkId));
};

export const tpasFor = (payerIds: string[]) => {
  if (!payerIds.length) return TPAS;
  const ids = new Set(PAYERS.filter((p) => payerIds.includes(p.id)).flatMap((p) => p.tpaIds));
  return TPAS.filter((t) => ids.has(t.id));
};

export const practitionersFor = (departmentId?: string) =>
  departmentId ? PRACTITIONERS.filter((p) => p.departmentId === departmentId) : PRACTITIONERS;

/** Inpatient wards that can take a bed category (day care and ER observation are excluded). */
export const wardsForCategory = (category?: BedCategory) =>
  WARDS.filter((w) => w.category !== "Day care" && w.category !== "Observation" && (!category || w.category === category));
