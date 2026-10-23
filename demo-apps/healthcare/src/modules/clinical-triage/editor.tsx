"use client";
import React from "react";
import {validateTriage, type TriageValues, type TriageConfiguration} from '../../domain/clinical-triage';
import {
  ClinicalDocumentEditor,
  type ClinicalDocumentDefinition,
} from "../clinical-document/editor";
import { TriageBoard } from "./board";
export const triageDefinition: ClinicalDocumentDefinition<
  TriageValues,
  TriageConfiguration
> = {
  prefix: "template.triage.",
  inlineActions: true,
  recordLayout: true,
  sections: [
    { id: "intake", label: "template.triage.intake" },
    { id: "vitals", label: "template.triage.vitals" },
    { id: "handoff", label: "template.triage.handoffSection" },
  ],
  validate: validateTriage,
  sectionFor: (field) =>
    ["destination", "precautions", "handoff"].includes(field)
      ? "handoff"
      : [
            "complaint",
            "onset",
            "priority",
            "allergyStatus",
            "allergies",
          ].includes(field)
        ? "intake"
        : "vitals",
  fresh: (values) => ({ ...values, measuredAt: new Date().toISOString() }),
  render: (props, section) => <TriageBoard {...props} section={section} />,
  confirmation: (values, config, t) => (
    <>
      {t(
        config.priorities.find((p) => p.value === values.priority)?.label ?? "",
      )}{" "}
      •{" "}
      {t(
        config.destinations.find((d) => d.value === values.destination)
          ?.label ?? "",
      )}
    </>
  ),
};
export function ClinicalTriageEditor(
  props: Omit<
    React.ComponentProps<
      typeof ClinicalDocumentEditor<TriageValues, TriageConfiguration>
    >,
    "definition"
  >,
) {
  return <ClinicalDocumentEditor {...props} definition={triageDefinition} />;
}
