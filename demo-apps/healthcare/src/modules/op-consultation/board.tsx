"use client";
import React, { useState, useRef } from "react";
import {Card, CardContent, CardHeader, CardTitle, CardGrid, Tabs, Modal} from '@pepbits/components';
import {Button, Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {
  CheckCircle2,
  ClipboardList,
  Stethoscope,
  FileCheck2,
} from "@pepbits/icons";
import type {ConsultationValues, ConsultationConfiguration} from '../../domain/clinical-consultation';
import type { DocumentFieldsProps } from "../clinical-document/editor";
import { ConsultationSection } from "../clinical-consultation/fields";
import { detailPanels } from "../clinical-consultation/sections";
export const opPanels = Object.entries(detailPanels).flatMap(
  ([group, panels]) => panels.map((panel) => ({ ...panel, group })),
);
export const opSections = opPanels.map((panel) => ({
  id: panel.id,
  label: "template.consultation.panel." + panel.id,
}));
export const requiredFields = [
  "clinician",
  "visitType",
  "complaint",
  "examination",
  "diagnosis",
  "treatment",
  "followUp",
  "allergyReview",
] as const;
type Props = DocumentFieldsProps<ConsultationValues, ConsultationConfiguration>;
function displayValue(
  field: keyof ConsultationValues,
  props: Props,
  t: (key: string) => string,
) {
  const value = props.values[field] ?? "";
  if (field === "measuredAt" && value)
    return props.format?.dateTime(value) ?? value;
  if (value && props.config.vitals.some((v) => v.id === field))
    return props.format?.number(Number(value)) ?? value;
  if (field === "clinician")
    return t(
      props.config.clinicians.find((o) => o.value === value)?.label ?? value,
    );
  if (field === "visitType")
    return t(
      props.config.visitTypes.find((o) => o.value === value)?.label ?? value,
    );
  if (field === "allergyReview")
    return value ? t("template.consultation." + value) : "";
  return value;
}
function fieldLabel(
  field: keyof ConsultationValues,
  props: Props,
  t: (key: string) => string,
) {
  const vital = props.config.vitals.find((v) => v.id === field);
  return vital
    ? t(vital.label) + " (" + vital.unit + ")"
    : field === "measuredAt"
      ? t("template.triage.measuredAt")
      : t(
          "template.consultation." +
            (field === "history" ? "historyNotes" : field),
        );
}
export function OPConsultationBoard({
  section,
  flat,
  ...props
}: Props & { section: string; flat: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const { t } = useLocalization(),
    [review, setReview] = useState(false);
  const active = opPanels.find((p) => p.id === section) ?? opPanels[0];
  const ready = requiredFields.filter((field) =>
    props.values[field]?.trim(),
  ).length;
  return (
    <>
      <div ref={root}>
        <CardGrid
          columns={flat ? 3 : 2}
          style={{
            gridTemplateColumns: flat
              ? "minmax(12rem,.85fr) minmax(0,2fr) minmax(16rem,1.05fr)"
              : "minmax(0,2fr) minmax(16rem,1fr)",
          }}
          data-op-board
        >
          {flat ? (
            <Card>
              <CardHeader style={{ minHeight: 0, paddingBlock: ".5rem" }}>
                <CardTitle
                  title="template.op.navigator"
                  action={<Stethoscope className="size-4" />}
                />
              </CardHeader>
              <CardContent style={{ padding: ".5rem" }}>
                <Tabs
                  orientation="vertical"
                  className="[&>button]:h-6 [&>button]:px-2"
                  items={opPanels.map((panel) => ({
                    id: panel.id,
                    label: "template.consultation.panel." + panel.id,
                    icon: panel.fields.some((f) => props.values[f]?.trim()) ? (
                      <CheckCircle2 className="size-3 text-[var(--primary)]" />
                    ) : undefined,
                  }))}
                  value={active!.id}
                  onChange={(id) => props.navigate?.(id)}
                />
              </CardContent>
            </Card>
          ) : null}
          <ConsultationSection
            {...props}
            section={active!.group}
            panelId={active!.id}
          />
          <Card>
            <CardHeader style={{ minHeight: 0, paddingBlock: ".5rem" }}>
              <CardTitle
                title="template.op.summary"
                action={<ClipboardList className="size-4" />}
              />
              <Badge
                tone={ready === requiredFields.length ? "success" : "neutral"}
              >
                {ready}/{requiredFields.length}
              </Badge>
            </CardHeader>
            <CardContent
              className="space-y-2"
              style={{ paddingBlock: ".5rem" }}
            >
              <p className="text-xs text-[var(--text-muted)]">
                {t("template.op.readiness")}
              </p>
              <CardGrid columns={2} gap={4}>
                {requiredFields.map((field) => (
                  <Button
                    key={field}
                    className="justify-start text-xs"
                    size="xs"
                    onClick={() => {
                      const panel = opPanels.find((p) =>
                        p.fields.includes(field),
                      );
                      props.navigate?.(panel?.id ?? "visit");
                      requestAnimationFrame(() =>
                        root.current
                          ?.querySelector<HTMLElement>('[name="' + field + '"]')
                          ?.focus(),
                      );
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        props.values[field]?.trim()
                          ? "text-[var(--primary)]"
                          : "text-[var(--text-muted)]"
                      }
                    >
                      {props.values[field]?.trim() ? "✓" : "○"}
                    </span>
                    <span className="truncate">
                      {fieldLabel(field, props, t)}
                    </span>
                  </Button>
                ))}
              </CardGrid>
              {(["diagnosis", "treatment"] as const).map((field) => (
                <div
                  key={field}
                  className="border-t border-[var(--border)] pt-1"
                >
                  <p className="text-xs font-semibold">
                    {fieldLabel(field, props, t)}
                  </p>
                  <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-[var(--text-muted)]">
                    {props.values[field] || t("template.op.notRecorded")}
                  </p>
                </div>
              ))}
              <Button className="w-full" onClick={() => setReview(true)}>
                <FileCheck2 className="size-4" />
                {t("template.op.review")}
              </Button>
            </CardContent>
          </Card>
        </CardGrid>
      </div>
      <Modal
        open={review}
        onClose={() => setReview(false)}
        title={t("template.op.review")}
        subtitle={t("template.op.reviewHint")}
        size="xl"
      >
        <CardGrid columns={2}>
          {opPanels.map((panel) => (
            <Card key={panel.id}>
              <CardHeader>
                <CardTitle title={"template.consultation.panel." + panel.id} />
              </CardHeader>
              <CardContent className="space-y-2">
                {panel.fields.filter((field) => props.values[field]?.trim())
                  .length ? (
                  panel.fields
                    .filter((field) => props.values[field]?.trim())
                    .map((field) => (
                      <div key={field}>
                        <p className="text-xs font-semibold">
                          {fieldLabel(field, props, t)}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {displayValue(field, props, t)}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">
                    {t("template.op.notRecorded")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </CardGrid>
      </Modal>
    </>
  );
}
