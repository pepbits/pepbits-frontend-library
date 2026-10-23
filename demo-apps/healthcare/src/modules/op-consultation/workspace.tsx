"use client";
import React, { useCallback } from "react";
import type {PatientRecord} from '../../domain/clinical-templates';
import type {Formatters} from '@pepbits/i18n';
import type {ClinicalTriageAdapter} from '../../adapters/clinical-triage';
import { ClinicalDocumentWorkspace } from "../clinical-document/workspace";
import {
  consultationDefinition,
  type ClinicalConsultationWorkspaceProps,
} from "../clinical-consultation/workspace";
import { OPConsultationBoard, opSections, opPanels } from "./board";
import { OPPatientContext } from "./patient-context";
export const opConsultationDefinition = {
  ...consultationDefinition,
  inlineActions: true,
  sections: opSections,
  sectionFor: (field: string) =>
    opPanels.find((panel) =>
      panel.fields.includes(
        field as keyof import("../../domain/clinical-consultation").ConsultationValues,
      ),
    )?.id ?? "visit",
  render: (
    props: Parameters<typeof consultationDefinition.render>[0],
    section: string,
    flat: boolean,
  ) => <OPConsultationBoard {...props} section={section} flat={flat} />,
};
export interface OPConsultationWorkspaceProps extends ClinicalConsultationWorkspaceProps {
  triage: ClinicalTriageAdapter;
}
export function OPConsultationWorkspace({
  triage,
  ...props
}: OPConsultationWorkspaceProps) {
  const renderPatient = useCallback(
    (patient: PatientRecord, format: Formatters) => (
      <OPPatientContext patient={patient} format={format} triage={triage} />
    ),
    [triage],
  );
  return (
    <ClinicalDocumentWorkspace
      {...props}
      pageId="op-consultation"
      definition={opConsultationDefinition}
      renderPatient={renderPatient}
    />
  );
}
