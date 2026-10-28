import {vi} from "vitest";
import type {ConsultationDataPort} from "../context/consult-contracts";
import type {ConsultationDetail} from "../types";
import {emptyNote} from "../models/consult-note";
import {encounterDetail, fakePort} from "../test/fixtures";

/** Synthetic consultation. No real patient, transport, or host service. */
export function consultationDetail(): ConsultationDetail {
  const intake = encounterDetail();
  return {...intake, patient: {...intake.patient, givenName: "Test", familyName: "Patient", nationality: "", preferredLanguage: "en", identifiers: [], version: 1},
    observations: {latest: {}, history: []}, allergies: {assessment: {state: "nka"}, entries: []},
    problems: [], medications: [], orders: [], reviews: [], scores: [],
    note: {id: "N1", version: 4, status: "draft", content: emptyNote(), updatedAt: "2026-10-28T10:00:00Z"}};
}
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
export function consultationPort(overrides: Partial<ConsultationDataPort> = {}) {
  let detail = consultationDetail();
  const methods = {
    loadConsultation: vi.fn(async () => structuredClone(detail)),
    saveConsultNote: vi.fn(async (_id, content, baseVersion) => {
      detail.note = {...detail.note!, version: baseVersion + 1, content: structuredClone(content), updatedAt: "2026-10-28T10:01:00Z"};
      return {version: baseVersion + 1, updatedAt: detail.note.updatedAt};
    }),
    signConsultNote: vi.fn(async () => {detail.note!.status = "final"; return {orders: [], followUpTask: null, priorAuthRequests: 0};}),
    acknowledgeReviews: vi.fn(async () => {}), verifyAllergy: vi.fn(async () => detail.allergies),
    loadCareTeam: vi.fn(async () => ({encounterId: "E1", class: "OP", responsible: null, team: [], history: [], pending: null, handovers: [], can: {handover: false, reassign: false, addMember: false, respond: false, cancel: false}, staff: [], roles: []})),
    listEndOutcomes: vi.fn(async () => [{code: "cancelled", label: "Cancelled"}]),
    listAssessments: vi.fn(async () => []),
    loadCareProgrammes: vi.fn(async () => ({programmes: [], visit: null, evaluatedAt: "2026-10-28T10:00:00Z"})),
    ...overrides,
  } satisfies Partial<ConsultationDataPort>;
  // Fail loudly if a test exercises an operation it has not arranged.
  const consult = new Proxy(methods, {get(target, key) {
    if (key in target) return Reflect.get(target, key);
    return () => {throw new Error(`Unarranged consultation operation: ${String(key)}`);};
  }}) as ConsultationDataPort;
  return {consult, port: fakePort({consult}), getDetail: () => detail};
}
