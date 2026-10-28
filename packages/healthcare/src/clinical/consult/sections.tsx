"use client";
import React, {type ReactNode} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {SECTIONS, type SectionId, type SectionState} from "../models/consult-note";
import type {ConsultSectionProps} from "../models/consult-workflow";
import {ConsultSection} from "../layout/ConsultSection";
import type {ReviewTask} from "../types";

/** Assembly-only extension; all note sections still receive the frozen ConsultSectionProps. */
export interface ConsultWorkspaceSectionContext extends ConsultSectionProps {
  acknowledgeReviews: (tasks: ReviewTask[]) => Promise<void>;
  verifyAllergy: (id: string, verification: "confirmed" | "refuted") => Promise<void>;
  onRecordVitals: () => void;
  onBusyChange: (busy: boolean) => void;
}
export interface ConsultWorkspaceSection {
  id: SectionId; title: string;
  render: (context: ConsultWorkspaceSectionContext) => ReactNode;
  state?: (context: ConsultSectionProps) => SectionState;
  required?: boolean;
}
function Placeholder() {
  const {t} = useLocalization();
  return <p>{t("This section is unavailable until its consultation module is connected.")}</p>;
}
/** No WP2–WP4 imports until final assembly. A placeholder never claims completion. */
export const defaultConsultSections: readonly ConsultWorkspaceSection[] = SECTIONS.map(section => ({
  id: section.id, title: section.label, render: context => <ConsultSection id={context.id!} title={section.label}><Placeholder/></ConsultSection>,
}));
