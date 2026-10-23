"use client";
import React, { useCallback } from "react";
import {validateComprehensive, type ComprehensiveValues, type ComprehensiveConfiguration} from '../../domain/comprehensive-consultation';
import {type PatientRecord} from '../../domain/clinical-templates';
import {type Formatters} from '@pepbits/i18n';
import type {ClinicalTriageAdapter} from '../../adapters/clinical-triage';
import {
  ClinicalDocumentWorkspace,
  type ClinicalDocumentWorkspaceProps,
} from "../clinical-document/workspace";
import type { ClinicalDocumentDefinition } from "../clinical-document/editor";
import { OPPatientContext } from "../op-consultation/patient-context";
import {
  ComprehensiveBoard,
  comprehensiveSections,
  sectionForComprehensive,
} from "./board";
import { key } from "./shared";
const definition: ClinicalDocumentDefinition<
  ComprehensiveValues,
  ComprehensiveConfiguration
> = {
  prefix: key(""),
  inlineActions: true,
  recordLayout: true,
  afterChange: (v, key) => (key === "attested" ? v : { ...v, attested: false }),
  sections: comprehensiveSections,
  validate: validateComprehensive,
  sectionFor: sectionForComprehensive,
  fresh: (v) => v,
  render: (p, section, flat) => (
    <ComprehensiveBoard
      key={p.record?.id}
      {...p}
      section={section}
      flat={flat}
    />
  ),
  confirmation: (v, c, t) => (
    <>
      {t(c.clinicians.find((o) => o.value === v.clinician)?.label ?? "")} ·{" "}
      {v.diagnosis}
    </>
  ),
};
export type ComprehensiveConsultationWorkspaceProps = Omit<
  ClinicalDocumentWorkspaceProps<
    ComprehensiveValues,
    ComprehensiveConfiguration
  >,
  "definition" | "pageId"
> & { triage: ClinicalTriageAdapter };
export function ComprehensiveConsultationWorkspace({
  triage,
  ...props
}: ComprehensiveConsultationWorkspaceProps) {
  const renderPatient = useCallback(
    (patient: PatientRecord, format: Formatters) => (
      <OPPatientContext patient={patient} format={format} triage={triage} />
    ),
    [triage],
  );
  return (
    <ClinicalDocumentWorkspace
      {...props}
      pageId="comprehensive-consultation"
      definition={definition}
      renderPatient={renderPatient}
    />
  );
}
