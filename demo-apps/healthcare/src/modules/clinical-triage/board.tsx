"use client";
import React from "react";
import {Badge, Button} from '@pepbits/ui';
import {CardGrid, DescriptionList} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {validateTriage, type TriageValues, type TriageConfiguration} from '../../domain/clinical-triage';
import type { DocumentFieldsProps } from "../clinical-document/editor";
import {
  TriageIntake,
  TriageVitals,
  TriageHandoff,
  TriageSection,
} from "./fields";

/** Focused triage pane and live summary share the API-loaded document values. */
export function TriageBoard({
  section,
  ...p
}: DocumentFieldsProps<TriageValues, TriageConfiguration> & {
  section: string;
}) {
  const { t } = useLocalization();
  const missing = Object.keys(validateTriage(p.values, p.config, true)).length;
  const choice = (
    options: Array<{ value: string; label: string }>,
    value: string,
  ) =>
    t(
      options.find((o) => o.value === value)?.label ??
        "template.op.notRecorded",
    );
  return (
    <CardGrid
      columns={2}
      style={{ gridTemplateColumns: "minmax(0,2.6fr) minmax(14rem,.9fr)" }}
      data-triage-board
    >
      <div className="min-w-0">
        {section === "intake" ? (
          <TriageIntake {...p} />
        ) : section === "vitals" ? (
          <TriageVitals {...p} />
        ) : (
          <TriageHandoff {...p} />
        )}
      </div>
      <TriageSection title="template.triage.snapshot">
        <Badge tone={missing ? "warning" : "success"}>
          {t("template.triage.remaining", {
            count: p.format?.number(missing) ?? missing,
          })}
        </Badge>
        <DescriptionList
          items={[
            {
              id: "priority",
              label: "template.triage.priority",
              value: choice(p.config.priorities, p.values.priority),
            },
            {
              id: "destination",
              label: "template.triage.destination",
              value: choice(p.config.destinations, p.values.destination),
            },
            {
              id: "complaint",
              label: "template.triage.complaint",
              value: p.values.complaint || t("template.op.notRecorded"),
            },
            {
              id: "allergies",
              label: "template.triage.allergies",
              value: p.values.allergies || t("template.op.notRecorded"),
            },
          ]}
        />
        {["intake", "vitals", "handoff"].map((id) => (
          <Button key={id} className="w-full" onClick={() => p.navigate?.(id)}>
            {t("template.triage." + (id === "handoff" ? "handoffSection" : id))}
          </Button>
        ))}
      </TriageSection>
    </CardGrid>
  );
}
