"use client";
import React, {type ReactNode} from "react";
import {SECTIONS, type SectionId, type SectionState} from "../models/consult-note";
import type {AssessmentRow, ConsultSectionProps, Programme} from "../models/consult-workflow";
import type {useOrderInfo} from "../orders/OrderInfo";
import type {ReviewTask} from "../types";
import {ReviewSection, AllergySection, PainSection} from "../consult-records";
import {ComplaintSection, HpiSection, RosSection, ExamSection, HistorySection, AssessmentSection} from "../consult-note";
import {ProblemSection} from "../problems";
import {ScoresSection} from "../scores";
import {CareGapsSection} from "../care";
import {OrdersSection, MedicinesSection, ReferralSection, PlanSection, type MedicationSafetyState} from "../consult-orders";

/** Assembly callbacks supplement the frozen controlled section contract. */
export interface ConsultWorkspaceSectionContext extends ConsultSectionProps {
  acknowledgeReviews: (tasks: ReviewTask[]) => Promise<void>;
  verifyAllergy: (id: string, verification: "confirmed" | "refuted") => Promise<void>;
  onRecordVitals: () => void;
  onBusyChange: (busy: boolean) => void;
  orderInfo: ReturnType<typeof useOrderInfo>;
  allergySectionId: string;
  onAssessments: (rows: AssessmentRow[]) => void;
  onProgrammes: (rows: Programme[]) => void;
  onSafetyChange: (state: MedicationSafetyState) => void;
  canCompleteProcedures: boolean;
  canDecideSubstitution: boolean;
  assessmentsReadOnly: boolean;
  renderSignedDischarge: () => ReactNode;
}
export interface ConsultWorkspaceSection {
  id: SectionId; title: string;
  render: (context: ConsultWorkspaceSectionContext) => ReactNode;
  state?: (context: ConsultSectionProps) => SectionState;
  required?: boolean;
}
const renderers: Record<SectionId, ConsultWorkspaceSection["render"]> = {
  review: c => <ReviewSection {...c}/>, allergies: c => <AllergySection {...c}/>,
  problems: c => <ProblemSection {...c}/>, complaint: c => <ComplaintSection {...c}/>,
  hpi: c => <HpiSection {...c}/>, pain: c => <PainSection {...c}/>, ros: c => <RosSection {...c}/>,
  history: c => <HistorySection {...c}/>, exam: c => <ExamSection {...c}/>,
  scores: c => <ScoresSection {...c}/>, assessment: c => <AssessmentSection {...c}/>,
  care: c => <CareGapsSection {...c}/>, orders: c => <OrdersSection {...c}/>,
  rx: c => <MedicinesSection {...c}/>, referral: c => <ReferralSection {...c}/>, plan: c => <PlanSection {...c}/>,
};
/** Source order is clinical workflow order, shared with the navigation spine. */
export const defaultConsultSections: readonly ConsultWorkspaceSection[] = SECTIONS.map(section => ({
  id: section.id, title: section.label, render: renderers[section.id],
  required: ["review", "allergies", "assessment", "orders", "rx", "plan"].includes(section.id),
}));
