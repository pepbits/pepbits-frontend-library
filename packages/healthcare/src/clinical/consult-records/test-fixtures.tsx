import React, {useState} from "react";
import {act} from "@testing-library/react";
import {vi} from "vitest";
import type {ConsultationDataPort} from "../context/consult-contracts";
import {ConsultHostProvider, type ConsultHost} from "../context/consult-host";
import {ClinicalProvider} from "../context/clinical-context";
import type {ClinicalDataPort} from "../context/port";
import type {Allergy, ConsultationDetail, ReviewTask} from "../types";
import {emptyNote} from "../models/consult-note";
import {FALLBACK_PARAMETERS, type AllergyMasterData, type PainScale, type PainMaps} from "../models/consult-records";
import {encounterDetail, fakePort} from "../test/fixtures";
import {renderClinical} from "../test/host";

export const allergy: Allergy = {id: "A1", substance: "Test medicine", category: "medication", clinicalStatus: "active", verification: "unconfirmed", version: 7, reactions: ["rash"]};
export const masters: AllergyMasterData = {categories: [{code: "medication", display: "Medicine"}, {code: "food", display: "Food"}], allergens: [], ingredients: [], crossReactivity: [], reactions: [{code: "rash", display: "Rash"}, {code: "anaphylaxis", display: "Anaphylaxis", serious: true}, {code: "unknown", display: "Reaction not known", exclusive: true}], routes: [{code: "oral", display: "Oral"}], informants: [{code: "patient", display: "Patient"}], fixed: {type: [{code: "unknown", display: "Unknown"}, {code: "allergy", display: "Allergy"}], severity: [{code: "severe", display: "Severe"}], criticality: [{code: "low", display: "Low"}, {code: "high", display: "High"}], clinicalStatus: [], verification: [], resolution: [{code: "challenge", display: "Supervised challenge"}]}};
export const nrs: PainScale = {id: "nrs", name: "Numeric rating scale", use: "Self report", min: 0, max: 10, choices: Array.from({length: 11}, (_, i) => i), items: [], bands: {none: 0, mild: 3, moderate: 6}};
export const maps: PainMaps = {primary: "adult", applicable: ["adult"], sex: "female", ageGroup: "adult", department: "General", maps: [{id: "adult", title: "Adult body", kind: "body", sex: ["female"], ageGroup: "adult", departments: [], views: [{id: "front", label: "Front", aspect: "ANTERIOR", viewBox: "0 0 100 100", markers: [], regions: [{id: "knee-r", part: "KNEE", side: "RIGHT", aspect: "ANTERIOR", d: "M0 0h50v100H0Z", label: "Right knee"}, {id: "knee-l", part: "KNEE", side: "LEFT", aspect: "ANTERIOR", d: "M50 0h50v100H50Z", label: "Left knee"}]}]}]};
export function consultation(): ConsultationDetail {
  const d = encounterDetail({status: "in-consult"});
  return {...d, patient: {...d.patient, givenName: "Test", familyName: "Patient", nationality: "AE", preferredLanguage: "en", identifiers: [], version: 1}, problems: [], medications: [], observations: {latest: {}, history: []}, note: null, orders: [], reviews: [], scores: []};
}
export function review(id: string, abnormal = false, requiredAction: ReviewTask["requiredAction"] = "acknowledge"): ReviewTask {
  return {id, abnormal, requiredAction, kind: "observation", title: `Finding ${id}`, detail: "Synthetic finding", recordType: "observation", recordId: id, recordVersion: 1, patientId: "P1", encounterId: "E1", assigneeRole: "doctor", priority: abnormal ? "urgent" : "routine", status: "open", authorId: "N1", createdAt: "2026-10-28T08:00:00Z", dueAt: "2026-10-28T09:00:00Z"};
}
export function findingsPort(overrides: Partial<ConsultationDataPort> = {}): ClinicalDataPort & {consult: ConsultationDataPort} {
  const base = fakePort();
  const consult = {
    calculateScore: base.calculateScore, searchCatalog: base.searchCatalog,
    loadAllergyMasters: vi.fn(async () => structuredClone(masters)),
    addAllergy: vi.fn(async () => ({assessment: {state: "has-entries" as const}, entries: [allergy]})),
    addAllergies: vi.fn(async () => ({assessment: {state: "has-entries" as const}, entries: [allergy]})),
    updateAllergy: vi.fn(async () => ({assessment: {state: "has-entries" as const}, entries: [allergy]})),
    verifyAllergy: vi.fn(async () => ({assessment: {state: "has-entries" as const}, entries: [allergy]})),
    reviewAllergies: vi.fn(async () => ({assessment: {state: "nka" as const}, entries: []})),
    loadVitalParameters: vi.fn(async () => ({items: FALLBACK_PARAMETERS, correctionGraceSeconds: 0, maxBackdateHours: 24})),
    recordVitals: vi.fn(async () => ({news2: await base.calculateScore("news2", {})})),
    correctObservation: vi.fn(async () => {}), withdrawObservation: vi.fn(async () => {}),
    listNursingEntries: vi.fn(async () => []), requestClarification: vi.fn(async () => {}), acknowledgeReviews: vi.fn(async () => {}),
    reviewScreening: vi.fn(async () => {}), updateReproductiveStatus: vi.fn(async () => {}),
    loadCodesets: vi.fn(async () => ({"body-part": [{code: "KNEE", display: "Knee", body: {hasSide: true}}], "body-side": [{code: "LEFT", display: "Left"}, {code: "RIGHT", display: "Right"}]})),
    loadPainMaps: vi.fn(async () => maps), listPainScales: vi.fn(async () => [nrs]),
    loadPainHistory: vi.fn(async () => ({assessments: [], analgesia: [], reassessments: [], suggested: {scale: "nrs", reason: "Self report"}})),
    recordPain: vi.fn(async () => ({})), ...overrides,
  } satisfies Partial<ConsultationDataPort>;
  // Only the WP2 port surface is implemented in this synthetic fake; unrelated methods are never exercised.
  return {...base, consult: consult as ConsultationDataPort};
}
export const clinician = {id: "D1", role: "doctor", permissions: ["note.write", "vitals.write", "allergy.verify"]};
export const host: ConsultHost = {onNavigate: vi.fn(), renderLink: (destination, props) => <button onClick={() => host.onNavigate(destination)}>{props.children}</button>};
export function sectionProps(detail = consultation()) {return {detail, draft: emptyNote(), onChange: vi.fn(), readOnly: false, onRecordsChanged: vi.fn()};}
export function FindingsHost({port, children}: {port: ClinicalDataPort; children: React.ReactNode}) {
  return <ClinicalProvider port={port} actor={clinician}><ConsultHostProvider value={host}>{children}</ConsultHostProvider></ClinicalProvider>;
}
export function renderFindings(ui: React.ReactElement, port = findingsPort(), notify = vi.fn()) {
  let update!: React.Dispatch<React.SetStateAction<React.ReactElement>>;
  function Content() {
    const [content, setContent] = useState(<FindingsHost port={port}>{ui}</FindingsHost>);
    update = setContent;
    return content;
  }
  const view = renderClinical(<Content/>, {port, actor: clinician, notify});
  return {...view, rerender: (next: React.ReactElement) => act(() => update(next)), port, notify};
}
