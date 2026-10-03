"use client";
import { createContext, useContext } from "react";
import { localId } from "../../lib/format";
import type {
  AiSuggestion,
  AppointmentView,
  Catalog,
  CdsAlert,
  Drug,
  Encounter,
  LiveVitals,
  OrderKind,
  Patient,
  Prescription,
  Role,
  Staff,
  Vitals,
} from "../../../shared/types";

export type TabKey = "triage" | "notes" | "diagnoses" | "orders" | "rx" | "scores" | "allergies" | "review";

export interface ConsultActions {
  addDiagnosis: (code: string) => void;
  addOrder: (code: string, priority?: "routine" | "urgent" | "stat") => void;
  addDrug: (drugId: string) => void;
  applyOrderSet: (id: string) => void;
  openScore: (key: string) => void;
  addVitals: (v: Omit<Vitals, "id" | "recordedAt">) => void;
  captureLive: () => void;
  reloadPatient: () => Promise<void>;
}

export interface ConsultCtx {
  enc: Encounter;
  update: (fn: (e: Encounter) => Encounter) => void;
  appt: AppointmentView;
  patient: Patient;
  catalog: Catalog;
  role: Role;
  user?: Staff;
  live?: LiveVitals;
  alerts: CdsAlert[];
  suggestions: AiSuggestion[];
  dismissSuggestion: (id: string) => void;
  actions: ConsultActions;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  scoreKey: string;
  setScoreKey: (k: string) => void;
  locked: boolean;
}

export const ConsultContext = createContext<ConsultCtx | null>(null);

export function useConsult() {
  const c = useContext(ConsultContext);
  if (!c) throw new Error("useConsult outside ConsultContext");
  return c;
}

export const RANGES = {
  hr: { low: 50, high: 110 },
  spo2: { low: 94, high: 101 },
  sys: { low: 100, high: 160 },
  rr: { low: 10, high: 22 },
  temp: { low: 35.5, high: 38 },
};

export const outOfRange = (k: keyof typeof RANGES, v?: number) =>
  v !== undefined && (v < RANGES[k].low || v > RANGES[k].high);

export const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: "triage", label: "Triage", short: "Triage" },
  { key: "notes", label: "Notes", short: "Notes" },
  { key: "diagnoses", label: "Diagnoses", short: "Dx" },
  { key: "orders", label: "Orders", short: "Orders" },
  { key: "rx", label: "Prescriptions", short: "Rx" },
  { key: "scores", label: "Scores", short: "Scores" },
  { key: "allergies", label: "Allergies", short: "Allergy" },
  { key: "review", label: "Review & sign", short: "Sign" },
];

// Nurses can initiate these under protocol; they show as "needs co-sign" for the doctor.
export const NURSE_ORDER_KINDS: OrderKind[] = ["nursing", "lab", "procedure"];

export function rxFromDrug(d: Drug): Prescription {
  return {
    id: localId(),
    drugId: d.id,
    name: d.name,
    strength: d.strength,
    form: d.form,
    dose: d.defaultDose,
    route: d.route,
    frequency: d.defaultFrequency,
    durationDays: d.defaultDays,
    quantity: autoQuantity(d, d.defaultDays),
    refills: 0,
    instructions: "",
    prn: /as needed/i.test(d.defaultFrequency),
  };
}

export const autoQuantity = (d: Drug, days: number) => (d.unitsPerDose > 0 ? Math.ceil(d.unitsPerDose * d.dosesPerDay * days) : 1);

export const BAND_CLS = {
  low: "bg-vital-50 text-vital-600 border-vital-500/30",
  moderate: "bg-caution-50 text-caution-600 border-caution-500/30",
  high: "bg-alarm-50 text-alarm-600 border-alarm-500/30",
} as const;
