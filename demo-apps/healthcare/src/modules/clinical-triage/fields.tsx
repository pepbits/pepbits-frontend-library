"use client";
import React from "react";
import {Card, CardHeader, CardTitle, CardContent, CardGrid} from '@pepbits/components';
import {Input, Textarea, Select, DateTimeInput, Segmented} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {TriageValues, TriageConfiguration} from '../../domain/clinical-triage';
export interface TriageFieldsProps {
  values: TriageValues;
  config: TriageConfiguration;
  disabled: boolean;
  errors: Record<string, string>;
  change: <K extends keyof TriageValues>(
    key: K,
    value: TriageValues[K],
  ) => void;
}
export function TriageSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader style={{ minHeight: 0, paddingBlock: ".5rem" }}>
        <CardTitle title={title} />
      </CardHeader>
      <CardContent style={{ paddingBlock: ".5rem" }} className="space-y-3">
        {children}
      </CardContent>
    </Card>
  );
}
function QuickChoice({
  id,
  options,
  value,
  change,
  disabled,
  error,
}: {
  id: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  change: (v: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const { t } = useLocalization();
  return (
    <div data-field={id}>
      <p className="mb-1 text-xs font-semibold">{t("template.triage." + id)}</p>
      <Segmented
        label={"template.triage." + id}
        options={options.map((o) => ({ ...o, disabled }))}
        value={value}
        onChange={(v) => {
          if (!disabled) change(v);
        }}
        className="max-w-full flex-wrap"
      />
      {error ? (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
export function TriageIntake({
  values,
  config,
  change,
  disabled,
  errors,
}: TriageFieldsProps) {
  return (
    <TriageSection title="template.triage.intake">
      <Textarea
        label="template.triage.complaint"
        name="complaint"
        required
        rows={2}
        style={{
          minHeight: "calc(3.5rem * var(--fs-scale))",
          height: "calc(3.5rem * var(--fs-scale))",
        }}
        maxLength={2000}
        value={values.complaint}
        disabled={disabled}
        error={errors.complaint}
        onChange={(e) => change("complaint", e.target.value)}
      />
      <CardGrid columns={2}>
        <QuickChoice
          id="priority"
          value={values.priority}
          options={config.priorities}
          disabled={disabled}
          error={errors.priority}
          change={(v) => change("priority", v)}
        />
        <QuickChoice
          id="allergyStatus"
          value={values.allergyStatus}
          options={["unknown", "noneKnown", "reported"].map((value) => ({
            value,
            label: "template.triage." + value,
          }))}
          disabled={disabled}
          error={errors.allergyStatus}
          change={(v) =>
            change("allergyStatus", v as TriageValues["allergyStatus"])
          }
        />
      </CardGrid>
      <CardGrid columns={2}>
        <Input
          label="template.triage.onset"
          name="onset"
          value={values.onset}
          maxLength={2000}
          disabled={disabled}
          onChange={(e) => change("onset", e.target.value)}
        />
        <Input
          label="template.triage.allergies"
          name="allergies"
          required={values.allergyStatus === "reported"}
          maxLength={2000}
          value={values.allergies}
          disabled={disabled}
          error={errors.allergies}
          onChange={(e) => change("allergies", e.target.value)}
        />
      </CardGrid>
    </TriageSection>
  );
}
const localDate = (value: string) => {
  const d = new Date(value);
  return Number.isFinite(d.valueOf())
    ? new Date(d.valueOf() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
};
export function TriageVitals({
  values,
  config,
  change,
  disabled,
  errors,
}: TriageFieldsProps) {
  const { t } = useLocalization();
  return (
    <TriageSection title="template.triage.vitals">
      <DateTimeInput
        label="template.triage.measuredAt"
        name="measuredAt"
        value={localDate(values.measuredAt)}
        disabled={disabled}
        error={errors.measuredAt}
        onChange={(e) =>
          change(
            "measuredAt",
            e.target.value ? new Date(e.target.value).toISOString() : "",
          )
        }
      />
      <CardGrid columns={4}>
        {config.vitals.map((f) => (
          <Input
            key={f.id}
            label={t(f.label) + " (" + f.unit + ")"}
            name={f.id}
            type="number"
            inputMode="decimal"
            min={0}
            max={f.max}
            step={f.step}
            value={values.vitals[f.id]}
            disabled={disabled}
            error={errors[f.id]}
            onChange={(e) =>
              change("vitals", { ...values.vitals, [f.id]: e.target.value })
            }
          />
        ))}
      </CardGrid>
      <Input
        label="template.triage.missingReason"
        name="missingReason"
        value={values.missingReason}
        maxLength={2000}
        disabled={disabled}
        error={errors.missingReason}
        onChange={(e) => change("missingReason", e.target.value)}
      />
      <p className="text-xs text-[var(--text-muted)]">
        {t("template.triage.noDefaults")}
      </p>
    </TriageSection>
  );
}
export function TriageHandoff({
  vertical = false,
  values,
  config,
  change,
  disabled,
  errors,
}: TriageFieldsProps & { vertical?: boolean }) {
  return (
    <TriageSection title="template.triage.handoffSection">
      <CardGrid columns={vertical ? 1 : 3}>
        <Select
          label="template.triage.destination"
          placeholder=""
          name="destination"
          required
          value={values.destination}
          options={[
            { value: "", label: "template.clinical.select" },
            ...config.destinations,
          ]}
          disabled={disabled}
          error={errors.destination}
          onChange={(e) => change("destination", e.target.value)}
        />
        <Input
          label="template.triage.precautions"
          name="precautions"
          maxLength={2000}
          value={values.precautions}
          disabled={disabled}
          onChange={(e) => change("precautions", e.target.value)}
        />
        <Input
          label="template.triage.handoff"
          name="handoff"
          maxLength={2000}
          value={values.handoff}
          disabled={disabled}
          onChange={(e) => change("handoff", e.target.value)}
        />
      </CardGrid>
    </TriageSection>
  );
}
