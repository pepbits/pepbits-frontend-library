"use client";
import React from "react";
import {CardGrid} from '@pepbits/components';
import {validateConsultation, type ConsultationValues, type ConsultationConfiguration} from '../../domain/clinical-consultation';
import {
  ClinicalDocumentWorkspace,
  type ClinicalDocumentWorkspaceProps,
} from "../clinical-document/workspace";
import type { ClinicalDocumentDefinition } from "../clinical-document/editor";
import {
  ConsultationSection,
  consultationSections,
  fieldSections,
} from "./fields";
export const consultationDefinition: ClinicalDocumentDefinition<
  ConsultationValues,
  ConsultationConfiguration
> = {
  prefix: "template.consultation.",
  sections: consultationSections,
  validate: validateConsultation,
  sectionFor: (field) =>
    fieldSections[field as keyof ConsultationValues] ?? "history",
  fresh: (values) => values,
  render: (props, section, flat) =>
    flat ? (
      <CardGrid columns={3}>
        {consultationSections.map((s) => (
          <ConsultationSection key={s.id} {...props} section={s.id} />
        ))}
      </CardGrid>
    ) : (
      <ConsultationSection {...props} section={section} />
    ),
  confirmation: (values, config, t) => (
    <>
      {t(
        config.clinicians.find((c) => c.value === values.clinician)?.label ??
          "",
      )}{" "}
      • {values.diagnosis}
    </>
  ),
};
export type ClinicalConsultationWorkspaceProps = Omit<
  ClinicalDocumentWorkspaceProps<ConsultationValues, ConsultationConfiguration>,
  "definition" | "pageId"
>;
export function ClinicalConsultationWorkspace(
  props: ClinicalConsultationWorkspaceProps,
) {
  return (
    <ClinicalDocumentWorkspace
      {...props}
      pageId="clinical-consultation"
      definition={consultationDefinition}
    />
  );
}
