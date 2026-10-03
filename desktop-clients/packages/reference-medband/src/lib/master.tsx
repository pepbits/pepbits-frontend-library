"use client";
// Reference data registry. The backend serves it with /bootstrap (and /master). The source filled module-level arrays in
// place; here one immutable Master is built per bootstrap and handed down by MasterProvider. Nothing is held at module
// level, so a tenant, branch or user change (a new store inside a new scope key) can never read the previous scope's masters.
import { createContext, useContext, type ReactNode } from "react";
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

export interface Master {
  PAYERS: Payer[]; TPAS: Tpa[]; NETWORKS: PlanNetwork[]; PLANS: Plan[]; DEPARTMENTS: Department[]; PRACTITIONERS: Practitioner[];
  WARDS: Ward[]; SERVICES: string[]; PACKAGES: HealthPackage[]; COMPLAINTS: Complaint[]; COUNTERS: Counter[];
  payer: (id?: string) => Payer | undefined;
  tpa: (id?: string) => Tpa | undefined;
  network: (id?: string) => PlanNetwork | undefined;
  plan: (id?: string) => Plan | undefined;
  department: (id?: string) => Department | undefined;
  practitioner: (id?: string) => Practitioner | undefined;
  ward: (id?: string) => Ward | undefined;
  healthPackage: (id?: string) => HealthPackage | undefined;
  complaint: (code?: string) => Complaint | undefined;
  counter: (id?: string) => Counter | undefined;
  networksFor: (payerIds: string[]) => PlanNetwork[];
  plansFor: (networkIds: string[], payerIds?: string[]) => Plan[];
  tpasFor: (payerIds: string[]) => Tpa[];
  practitionersFor: (departmentId?: string) => Practitioner[];
  /** Inpatient wards that can take a bed category (day care and ER observation are excluded). */
  wardsForCategory: (category?: BedCategory) => Ward[];
}

const indexBy = <T,>(list: T[], key: (x: T) => string) => new Map(list.map((x) => [key(x), x] as const));

/** Builds the lookups for one bootstrap payload. Pure: the same payload always gives an equivalent registry and nothing is shared. */
export function createMaster(m: MasterData): Master {
  const PAYERS = [...(m.payers ?? [])], TPAS = [...(m.tpas ?? [])], NETWORKS = [...(m.networks ?? [])], PLANS = [...(m.plans ?? [])];
  const DEPARTMENTS = [...(m.departments ?? [])], PRACTITIONERS = [...(m.practitioners ?? [])], WARDS = [...(m.wards ?? [])];
  const SERVICES = [...(m.services ?? [])], PACKAGES = [...(m.packages ?? [])], COMPLAINTS = [...(m.complaints ?? [])], COUNTERS = [...(m.counters ?? [])];
  const maps = {
    payer: indexBy(PAYERS, (x) => x.id), tpa: indexBy(TPAS, (x) => x.id), network: indexBy(NETWORKS, (x) => x.id), plan: indexBy(PLANS, (x) => x.id),
    dept: indexBy(DEPARTMENTS, (x) => x.id), prac: indexBy(PRACTITIONERS, (x) => x.id), ward: indexBy(WARDS, (x) => x.id),
    pkg: indexBy(PACKAGES, (x) => x.id), complaint: indexBy(COMPLAINTS, (x) => x.code), counter: indexBy(COUNTERS, (x) => x.id),
  };
  const networksFor = (payerIds: string[]) => (payerIds.length ? NETWORKS.filter((n) => payerIds.includes(n.payerId)) : NETWORKS);
  return {
    PAYERS, TPAS, NETWORKS, PLANS, DEPARTMENTS, PRACTITIONERS, WARDS, SERVICES, PACKAGES, COMPLAINTS, COUNTERS,
    payer: (id) => (id ? maps.payer.get(id) : undefined),
    tpa: (id) => (id ? maps.tpa.get(id) : undefined),
    network: (id) => (id ? maps.network.get(id) : undefined),
    plan: (id) => (id ? maps.plan.get(id) : undefined),
    department: (id) => (id ? maps.dept.get(id) : undefined),
    practitioner: (id) => (id ? maps.prac.get(id) : undefined),
    ward: (id) => (id ? maps.ward.get(id) : undefined),
    healthPackage: (id) => (id ? maps.pkg.get(id) : undefined),
    complaint: (code) => (code ? maps.complaint.get(code) : undefined),
    counter: (id) => (id ? maps.counter.get(id) : undefined),
    networksFor,
    plansFor: (networkIds, payerIds = []) => {
      if (networkIds.length) return PLANS.filter((p) => networkIds.includes(p.networkId));
      const nets = networksFor(payerIds).map((n) => n.id);
      return PLANS.filter((p) => nets.includes(p.networkId));
    },
    tpasFor: (payerIds) => {
      if (!payerIds.length) return TPAS;
      const ids = new Set(PAYERS.filter((p) => payerIds.includes(p.id)).flatMap((p) => p.tpaIds));
      return TPAS.filter((t) => ids.has(t.id));
    },
    practitionersFor: (departmentId) => (departmentId ? PRACTITIONERS.filter((p) => p.departmentId === departmentId) : PRACTITIONERS),
    wardsForCategory: (category) => WARDS.filter((w) => w.category !== "Day care" && w.category !== "Observation" && (!category || w.category === category)),
  };
}

const MasterContext = createContext<Master | null>(null);

/** Supplies the scope's masters. Mount it inside the authenticated-scope boundary, below the bootstrap that produced them. */
export function MasterProvider({ master, children }: { master: Master; children: ReactNode }) {
  return <MasterContext.Provider value={master}>{children}</MasterContext.Provider>;
}

export function useMaster(): Master {
  const master = useContext(MasterContext);
  if (!master) throw new Error("MedBand reference data is read inside MasterProvider, after the bootstrap has loaded");
  return master;
}
