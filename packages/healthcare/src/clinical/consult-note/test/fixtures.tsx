import React, {useState, type ComponentType, type ReactElement} from "react";
import {vi} from "vitest";
import {renderClinical} from "../../test/host";
import {encounterDetail, fakePort} from "../../test/fixtures";
import {ConsultHostProvider, type ConsultHost} from "../../context/consult-host";
import type {ConsultationDataPort} from "../../context/consult-contracts";
import type {ClinicalDataPort} from "../../context/port";
import type {ConsultationDetail} from "../../types";
import {emptyNote, type NoteContent} from "../../models/consult-note";
import type {ConsultSectionProps} from "../../models/consult-workflow";
export const actor = {role: "doctor", permissions: ["patient.read", "note.write", "assessment.perform", "vitals.write"]};
export function detail(): ConsultationDetail {
  const intake = encounterDetail();
  return {...intake, patient: {...intake.patient, age: 40, sex: "male", givenName: "Test", familyName: "Patient", birthDate: "1986-01-01", nationality: "Test", preferredLanguage: "en", identifiers: [], version: 1},
    observations: {latest: {}, history: []}, note: null, problems: [], medications: [], orders: [], reviews: [], scores: []};
}
/** Deliberately partial synthetic port: a test fails if it reaches an unexpected workflow. */
export function consultPort(overrides: Partial<ConsultationDataPort> = {}): ConsultationDataPort {
  return {listProcedureHistory: vi.fn().mockResolvedValue([]), listConditions: vi.fn().mockResolvedValue([]), listScoreDefinitions: vi.fn().mockResolvedValue([]), listAssessments: vi.fn().mockResolvedValue([]), listAvailableAssessments: vi.fn().mockResolvedValue([]), listFacilities: vi.fn().mockResolvedValue([]), loadCareProgrammes: vi.fn().mockResolvedValue({programmes: [], visit: null, evaluatedAt: "2026-10-28"}), ...overrides} as unknown as ConsultationDataPort;
}
export function renderOwned(ui: ReactElement, consult = consultPort(), options: {host?: Partial<ConsultHost>; basePort?: Partial<ClinicalDataPort>; permissions?: string[]} = {}) {
  const host: ConsultHost = {onNavigate: vi.fn(), renderLink: (destination, props) => <a href="#host-owned" data-kind={destination.kind}>{props.children}</a>, ...options.host};
  const port = fakePort({...options.basePort, consult});
  return {...renderClinical(<ConsultHostProvider value={host}>{ui}</ConsultHostProvider>, {port, actor: {...actor, permissions: options.permissions ?? actor.permissions}}), port, host};
}
export function Controlled({component: Component, initial = emptyNote(), data = detail(), readOnly = false, changed = () => {}}: {component: ComponentType<ConsultSectionProps>; initial?: NoteContent; data?: ConsultationDetail; readOnly?: boolean; changed?: (note: NoteContent) => void}) {
  const [draft, setDraft] = useState(initial);
  return <Component detail={data} draft={draft} readOnly={readOnly} onChange={update => {const next = structuredClone(draft); update(next); setDraft(next); changed(next);}}/>;
}
export function deferred<T>() {let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => {resolve = res; reject = rej;}); return {promise, resolve, reject};}
