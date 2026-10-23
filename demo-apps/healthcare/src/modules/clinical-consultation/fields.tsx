"use client";
import React, { useEffect, useState } from "react";
import {Card, CardHeader, CardTitle, CardContent, CardGrid, Tabs} from '@pepbits/components';
import {Input, Textarea, Select, DateTimeInput} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {ConsultationValues, ConsultationConfiguration} from '../../domain/clinical-consultation';
import type { DocumentFieldsProps } from "../clinical-document/editor";
type Props = DocumentFieldsProps<ConsultationValues, ConsultationConfiguration>;
import { consultationSections, detailPanels } from "./sections";
export { consultationSections, fieldSections } from "./sections";
const required = new Set([
  "clinician",
  "visitType",
  "complaint",
  "examination",
  "diagnosis",
  "treatment",
  "followUp",
  "allergyReview",
]);
function NoteField({
  field,
  multiline = true,
  ...props
}: Props & { field: keyof ConsultationValues; multiline?: boolean }) {
  const common = {
    name: field,
    label:
      "template.consultation." + (field === "history" ? "historyNotes" : field),
    value: props.values[field] ?? "",
    disabled: props.disabled,
    error: props.errors[field],
    required: required.has(field),
    maxLength: 2000,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      props.change(field, e.target.value),
  };
  return multiline ? (
    <Textarea
      {...common}
      rows={2}
      style={{
        height: "calc(3.25rem * var(--fs-scale))",
        minHeight: "calc(3.25rem * var(--fs-scale))",
      }}
    />
  ) : (
    <Input {...common} />
  );
}
export function ConsultationSection({
  section,
  panelId,
  ...props
}: Props & { section: string; panelId?: string }) {
  const { t } = useLocalization();
  const panels = detailPanels[section] ?? detailPanels.history;
  const [active, setActive] = useState(panels![0]!.id);
  const current = panels!.find((p) => p.id === (panelId ?? active)) ?? panels![0];
  useEffect(() => {
    const errorField = Object.keys(props.errors)[0];
    const invalid = panels!.find((panel) =>
      panel.fields.includes(errorField as keyof ConsultationValues),
    );
    if (invalid) setActive(invalid.id);
  }, [props.errors, panels]);
  const choice = (
    field: "clinician" | "visitType" | "allergyReview",
    options: Array<{ value: string; label: string }>,
  ) => (
    <Select
      name={field}
      label={"template.consultation." + field}
      required
      value={props.values[field]}
      options={options}
      disabled={props.disabled}
      error={props.errors[field]}
      onChange={(e) => props.change(field, e.target.value)}
    />
  );
  return (
    <Card>
      <CardHeader style={{ minHeight: 0, paddingBlock: ".5rem" }}>
        <CardTitle
          title={
            panelId
              ? "template.consultation.panel." + panelId
              : (consultationSections.find((s) => s.id === section)?.label ??
                "")
          }
        />
      </CardHeader>
      <CardContent className="space-y-3" style={{ paddingBlock: ".5rem" }}>
        {!panelId && (
          <Tabs
            className="flex-wrap [&>button]:px-2"
            items={panels!.map((panel) => ({
              id: panel.id,
              label: "template.consultation.panel." + panel.id,
              badge:
                panel.fields.filter((field) =>
                  Boolean(props.values[field]?.trim()),
                ).length || undefined,
            }))}
            value={current!.id}
            onChange={setActive}
          />
        )}
        <div data-consultation-panel={current!.id} className="space-y-3">
          {current!.id === "visit" ? (
            <>
              <CardGrid columns={2}>
                {choice("clinician", props.config.clinicians)}
                {choice("visitType", props.config.visitTypes)}
              </CardGrid>
              <NoteField {...props} field="complaint" />
              <NoteField {...props} field="history" />
            </>
          ) : current!.id === "assessment" ? (
            <>
              <NoteField {...props} field="examination" />
              <NoteField {...props} field="diagnosis" />
              {choice("allergyReview", [
                { value: "reviewed", label: "template.consultation.reviewed" },
                {
                  value: "unavailable",
                  label: "template.consultation.unavailable",
                },
              ])}
            </>
          ) : current!.id === "plan" ? (
            <>
              <NoteField {...props} field="treatment" />
              <NoteField {...props} field="investigations" multiline={false} />
              <CardGrid columns={2}>
                <NoteField {...props} field="followUp" multiline={false} />
                <NoteField {...props} field="safetyAdvice" multiline={false} />
              </CardGrid>
            </>
          ) : current!.id === "vitals" ? (
            <>
              <DateTimeInput
                label="template.triage.measuredAt"
                name="measuredAt"
                value={localDate(props.values.measuredAt ?? "")}
                disabled={props.disabled}
                error={props.errors.measuredAt}
                onChange={(e) =>
                  props.change(
                    "measuredAt",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  )
                }
              />
              <CardGrid columns={4}>
                {props.config.vitals.map((field) => (
                  <Input
                    key={field.id}
                    name={field.id}
                    label={t(field.label) + " (" + field.unit + ")"}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={field.max}
                    step={field.step}
                    value={props.values[field.id] ?? ""}
                    disabled={props.disabled}
                    error={props.errors[field.id]}
                    onChange={(e) => props.change(field.id, e.target.value)}
                  />
                ))}
              </CardGrid>
              <p className="text-xs text-[var(--text-muted)]">
                {t("template.consultation.expanded.vitalsHint")}
              </p>
            </>
          ) : (
            <CardGrid columns={current!.fields.length === 4 ? 2 : 1}>
              {current!.fields.map((field) => (
                <NoteField key={field} {...props} field={field} />
              ))}
            </CardGrid>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
function localDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.valueOf())
    ? new Date(date.valueOf() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
}
