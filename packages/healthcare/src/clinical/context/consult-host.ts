"use client";
import {createContext, createElement, useContext, type ReactNode} from "react";
import {useClinicalPort} from "./clinical-context";
import type {ClinicalPatientLite, ConsultationDetail} from "../types";
import type {MedicationOrder} from "../models/consult-orders";
import type {ConsultSectionProps} from "../models/consult-workflow";

/** Semantic destinations only: route resolution, authentication and browser windows belong to the host. */
export type ConsultDestination =
  | {kind: "patient-chart"; patientId: string}
  | {kind: "emergency-disposition"; encounterId: string}
  | {kind: "consultation-list"}
  | {kind: "emergency-list"}
  | {kind: "consultation"; encounterId: string}
  | {kind: "inpatient"; encounterId: string; tab?: "medications" | "overview"}
  | {kind: "assessment"; assessmentId: string}
  | {kind: "certificate"; certificateId: string}
  | {kind: "admission"; admissionId: string}
  | {kind: "planned-admissions"}
  | {kind: "bed-board"}
  | {kind: "mar"; encounterId: string}
  | {kind: "mar-queue"}
  | {kind: "pharmacy-verification"; orderId: string};
export interface ConsultNavigateOptions { replace?: boolean; newTab?: boolean }
export interface ConsultLinkProps extends ConsultNavigateOptions {
  children: ReactNode; className?: string; "aria-label"?: string;
}
export type ConsultTab = "consult" | "administer";
export interface ConsultSlotProps {
  detail: ConsultationDetail; readOnly: boolean;
  onRecordsChanged: () => void | Promise<void>;
  /** Report pending writes and unsaved domain forms, including retryable requests. */
  onBusyChange: (busy: boolean) => void;
}
export interface ConsultHost {
  onNavigate: (destination: ConsultDestination, options?: ConsultNavigateOptions) => void;
  /** Render a real host link, preserving keyboard, modified-click and new-tab behavior. */
  renderLink: (destination: ConsultDestination, props: ConsultLinkProps) => ReactNode;
  onPatientOpened?: (patient: ClinicalPatientLite | null) => void;
  /** Host reads its route/query once; the workspace never reads window.location. */
  initialTab?: ConsultTab;
  /** Host document-dirty registration must cover SPA navigation as well as browser unload. */
  onDirtyChange?: (dirty: boolean) => void;
  renderAdministration?: (props: ConsultSlotProps) => ReactNode;
  /** The slot coordinates synchronous popup opening and host telehealth/session services. */
  renderTelehealth?: (props: ConsultSlotProps) => ReactNode;
  renderSubstitution?: (props: ConsultSlotProps & {order: MedicationOrder}) => ReactNode;
  renderMedicationHistory?: (props: ConsultSectionProps) => ReactNode;
  renderInvestigationHistory?: (props: ConsultSectionProps & {kind: "lab" | "imaging" | "procedure"}) => ReactNode;
  renderScreening?: (props: ConsultSectionProps) => ReactNode;
  /** Sticky offset is supplied by the containing shell; use this in section scroll margins. */
  stickyOffset?: string;
}
const ConsultHostContext = createContext<ConsultHost | null>(null);
export function ConsultHostProvider({value, children}: {value: ConsultHost; children: ReactNode}) {
  return createElement(ConsultHostContext.Provider, {value}, children);
}
export function useConsultHost(): ConsultHost {
  const host = useContext(ConsultHostContext);
  if (!host) throw new Error("Consultation components need a <ConsultHostProvider> with navigation and host slots.");
  return host;
}
export function useConsultPort() {
  const {consult} = useClinicalPort();
  if (!consult) throw new Error("Consultation components need ClinicalProvider.port.consult (a ConsultationDataPort). Intake-only ports cannot open a consultation.");
  return consult;
}
