import {vi} from "vitest";
import type {ClinicalDataPort} from "../context/port";
import type {EncounterDetail, QueueRow, ScoreResult} from "../types";
import type {EsiPreview} from "../triage/model";

/** Fictional patient and visit; no real person. */
export function encounterDetail(overrides: Partial<EncounterDetail["encounter"]> = {}): EncounterDetail {
  return {
    encounter: {id: "E1", patientId: "P1", class: "OP", status: "registered", department: "General medicine", arrivedAt: "2026-10-27T08:00:00Z", reason: "Cough", version: 3, waitingMinutes: 25, ...overrides},
    patient: {id: "P1", mrn: "MRN-0001", name: "Test Patient", age: 40, sex: "male", birthDate: "1986-01-01", restricted: false},
    allergies: {assessment: {state: "not-assessed"}, entries: []},
    observations: {latest: {}},
  };
}

export function queueRow(id: string, status: string, overrides: Partial<QueueRow> = {}): QueueRow {
  return {id, patientId: "P" + id, class: "OP", status, department: "General medicine", arrivedAt: "2026-10-27T08:00:00Z", version: 1, waitingMinutes: 10,
    clinicalVisible: true, patient: {id: "P" + id, mrn: "MRN-" + id, name: "Patient " + id, restricted: false, age: 50, sex: "female"},
    allergyState: "nka", allergyCount: 0, news2: null, openReviews: 0, ...overrides};
}

const NEWS: ScoreResult = {status: "complete", total: 0, band: "Low", severity: "low", interpretation: "Continue routine monitoring.", components: [{key: "rr", label: "Respiration rate", points: 0}], missing: []};

/** A test stand-in for the server's ESI preview (A, B, C and the adult danger zone); not the AllyVora algorithm itself. */
export function fakeEsi(v: Record<string, unknown>): EsiPreview {
  if (!("lifeSaving" in v)) return {level: null, steps: ["Answer A"], dangerZone: false};
  if (v.lifeSaving) return {level: 1, steps: ["A: yes"], dangerZone: false};
  if (!["highRisk", "confusedLethargic", "severePain"].every(k => k in v)) return {level: null, steps: ["A: no", "Answer B"], dangerZone: false};
  if (v.highRisk || v.confusedLethargic || v.severePain) return {level: 2, steps: ["A: no", "B: yes"], dangerZone: false};
  if (!("resources" in v)) return {level: null, steps: ["A: no", "B: no", "Answer C"], dangerZone: false};
  if (v.resources !== 2) return {level: v.resources === 0 ? 5 : 4, steps: ["A: no", "B: no", `C: ${v.resources}`], dangerZone: false};
  const danger = Number(v.hr ?? 0) > 100 || Number(v.rr ?? 0) > 20 || Number(v.spo2 ?? 100) < 92;
  return {level: danger ? 2 : 3, steps: ["A: no", "B: no", "C: two or more", danger ? "D: danger zone" : "D: outside the danger zone"], dangerZone: danger};
}

export function fakePort(overrides: Partial<ClinicalDataPort> = {}): ClinicalDataPort {
  return {
    listEncounters: vi.fn(async () => []),
    loadEncounter: vi.fn(async () => encounterDetail()),
    setEncounterStatus: vi.fn(async () => {}),
    saveIntake: vi.fn(async () => ({news2: NEWS, esi: null})),
    searchCatalog: vi.fn(async () => []),
    calculateScore: vi.fn(async () => NEWS),
    previewEsi: vi.fn(async (inputs: Record<string, unknown>) => fakeEsi(inputs)),
    addAllergy: vi.fn(async () => ({assessment: {state: "has-entries" as const}, entries: []})),
    ...overrides,
  };
}
