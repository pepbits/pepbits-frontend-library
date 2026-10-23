"use client";
import { RecordPhoneField } from "./record-phone";
import recordStyles from "./record-layout.module.css";
import React, { useEffect, useState } from "react";
import {Card, CardHeader, CardTitle, CardContent, CardGrid, DescriptionList, LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {Badge, Button, Input, Select, Textarea, Checkbox, DateInput, TimeInput, Toggle, FilePicker} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {PatientRecord, PatientField, PatientMetadata} from '../../domain/clinical-templates';
import type {UserPreferences} from '@pepbits/preferences';
import type {Formatters} from '@pepbits/i18n';
import type {PreferenceHost} from "../preference-choice";
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
export type ClinicalView = "query" | "record" | "overview";
export interface PatientDestination {
  view: ClinicalView;
  patientId?: string;
  mode?: "new" | "edit" | "view";
}
export interface ClinicalPageProps extends PreferenceHost {
  preferenceControls?: React.ReactNode;
  adapter: ClinicalTemplateAdapter;
  metadata: PatientMetadata;
  preferences: UserPreferences;
  format: Formatters;
  onOpen: (target: PatientDestination) => void;
  patientId?: string;
  mode?: "new" | "edit" | "view";
}
export function useClinicalLoad<T>(
  load: () => Promise<T>,
  dependencies: React.DependencyList,
) {
  const [value, setValue] = useState<T | null>(null),
    [error, setError] = useState<unknown>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setValue(null);
    setError(null);
    void load()
      .then((v) => {
        if (current) setValue(v);
      })
      .catch((e) => {
        if (current) setError(e);
      });
    return () => {
      current = false;
    };
  }, [...dependencies, revision]);
  return { value, error, retry: () => setRevision((v) => v + 1), setValue };
}
export function ClinicalLoading({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return error ? (
    <RecoveryNotice failure={failureFromError(error)} onRetry={retry} />
  ) : (
    <LoadingState />
  );
}
export function PatientBanner({
  patient,
  actions,
  format,
}: {
  patient: PatientRecord;
  actions?: React.ReactNode;
  format: Formatters;
}) {
  const { t } = useLocalization();
  const name = [
    patient.values.firstName,
    patient.values.middleName,
    patient.values.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-[var(--primary)]" />
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-xl font-bold text-[var(--primary)]"
            aria-hidden
          >
            {name
              ? name
                  .split(" ")
                  .slice(0, 2)
                  .map((v) => v[0])
                  .join("")
              : "+"}
          </span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                {patient.mrn || t("template.clinical.mrnPending")}
              </Badge>
              <Badge
                tone={
                  patient.values.status === "temporary" ? "warning" : "success"
                }
              >
                {t(`template.clinical.${patient.values.status || "new"}`)}
              </Badge>
            </div>
            <h2 className="text-xl font-bold">
              {name || t("template.clinical.newPatient")}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {[
                patient.values.gender
                  ? t(`template.clinical.${patient.values.gender}`)
                  : "",
                patient.values.birthDate
                  ? format.date(String(patient.values.birthDate))
                  : "",
                patient.values.mobile,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </CardContent>
    </Card>
  );
}
export function PatientFieldControl({
  field,
  value,
  onChange,
  disabled,
  error,
}: {
  field: PatientField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
  disabled?: boolean;
  error?: string;
}) {
  const { t } = useLocalization();
  const common = {
    label: field.label,
    "aria-label": field.label,
    required: field.required,
    disabled,
    error,
  };
  if (field.control === "toggle")
    return (
      <Toggle
        label={field.label}
        checked={value === "yes"}
        disabled={disabled}
        onChange={(v) => onChange(v ? "yes" : "no")}
      />
    );
  if (field.control === "primary")
    return (
      <Button
        variant={value === "yes" ? "primary" : "secondary"}
        disabled={disabled}
        aria-pressed={value === "yes"}
        onClick={() => onChange(value === "yes" ? "no" : "yes")}
      >
        {t(field.label)}
      </Button>
    );
  if (field.type === "checkbox")
    return (
      <Toggle
        label={field.label}
        checked={!!value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  if (field.type === "time")
    return (
      <TimeInput
        {...common}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (field.type === "select")
    return (
      <Select
        {...common}
        value={String(value ?? "")}
        options={[
          { value: "", label: "template.clinical.select" },
          ...(field.options ?? []).filter(option=>option.value!==""),
          ...(field.allowCustom &&
          value &&
          !field.options?.some((o) => o.value === value)
            ? [{ value: String(value), label: String(value) }]
            : []),
        ]}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (field.type === "textarea")
    return (
      <Textarea
        {...common}
        value={String(value ?? "")}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (field.type === "date")
    return (
      <DateInput
        {...common}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <Input
      {...common}
      type={field.type}
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
export function PatientSummaryPanel({
  patient,
  format,
}: {
  patient: PatientRecord;
  format: Formatters;
}) {
  const { t } = useLocalization();
  return (
    <Card>
      <CardHeader>
        <CardTitle title="template.clinical.summary" />
      </CardHeader>
      <CardContent>
        <DescriptionList
          layout="stacked"
          itemClassName="space-y-1 py-1"
          items={["mrn", "mobile", "email", "birthDate", "branch"].map(
            (id) => ({
              id,
              label: `template.clinical.${id}`,
              value:
                id === "mrn"
                  ? patient.mrn || t("template.clinical.mrnPending")
                  : id === "birthDate"
                    ? format.date(String(patient.values[id] ?? ""))
                    : id === "branch" && patient.values[id]
                      ? t(`template.clinical.${patient.values[id]}`)
                      : String(patient.values[id] || "—"),
            }),
          )}
        />
      </CardContent>
    </Card>
  );
}
export function ClinicalSection({
  title,
  count,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLocalization(),
    id = React.useId();
  return (
    <Card>
      <CardHeader>
        <Button
          variant="ghost"
          className="w-full text-start"
          style={{ justifyContent: "space-between" }}
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
        >
          <span className="flex items-center gap-2">
            <span aria-hidden>{open ? "▾" : "▸"}</span>
            <span className="font-bold">{t(title)}</span>
            {count !== undefined ? <Badge>{count}</Badge> : null}
          </span>
          <span className="max-w-[45%] truncate text-xs text-[var(--text-muted)]">
            {summary}
          </span>
        </Button>
      </CardHeader>
      {open ? <CardContent id={id}>{children}</CardContent> : null}
    </Card>
  );
}
export function PatientCollectionEditor({
  id,
  embedded = false,
  subset,
  patient,
  metadata,
  update,
  disabled,
  reading = false,
  errors,
}: {
  id: string;
  embedded?: boolean;
  subset?: { values: string[]; title: string };
  patient: PatientRecord;
  metadata: PatientMetadata;
  update: (record: PatientRecord) => void;
  disabled: boolean;
  reading?: boolean;
  errors: Record<string, string>;
}) {
  const { t } = useLocalization(),
    definition = metadata.collections.find((c) => c.id === id);
  if (!definition) return null;
  const rows = patient.collections[id] ?? [],
    shown = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !subset || subset.values.includes(row.contactType ?? ""));
  if (subset && !reading && !shown.length)
    shown.push({
      index: -1,
      row: Object.fromEntries([
        ["id", `pending-${subset.values[0]}`],
        ...definition.fields.map((f) => [f.id, ""]),
        ["contactType", subset.values[0]],
        ["primary", "yes"],
      ]),
    });
  const change = (next: typeof rows) =>
    update({ ...patient, collections: { ...patient.collections, [id]: next } });
  const fields = (row: Record<string, string>) =>
    definition.fields.filter(
      (f) =>
        !f.hidden &&
        (!f.visibleWhen || row[f.visibleWhen.field] === f.visibleWhen.value) &&
        (!subset ||
          (f.id !== "contactType" &&
            (f.id !== "countryCode" || subset.values[0] !== "email"))),
    );
  const updateRow = (
    index: number,
    row: Record<string, string>,
    key: string,
    value: string,
  ) => {
    const patch = { ...row, [key]: value };
    if (index < 0) {
      change([...rows, patch]);
      return;
    }
    change(
      rows.map((r, i) =>
        i === index
          ? patch
          : key === "primary" &&
              value === "yes" &&
              (id !== "contacts" || r.contactType === row.contactType)
            ? { ...r, primary: "no" }
            : r,
      ),
    );
  };
  const add = () =>
    change([
      ...rows,
      Object.fromEntries([
        ["id", crypto.randomUUID()],
        ...definition.fields.map((f) => [f.id, ""]),
        ...(subset ? [["contactType", subset.values[0]]] : []),
      ]),
    ]);
  const addLabel = subset
    ? subset.values[0] === "email"
      ? "template.clinical.addEmail"
      : "template.clinical.addPhone"
    : (definition.addLabel ?? "template.clinical.add");
  const Wrapper = embedded ? "div" : Card;
  return (
    <Wrapper
      className="space-y-3"
      data-record-collection={subset?.values[0] ?? id}
    >
      <h4 className="border-b border-[var(--border)] pb-2 text-xs font-bold">
        {t(subset?.title ?? definition.title)}
      </h4>
      {!shown.length ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
          {t("template.clinical.noneRecorded")}
        </p>
      ) : (
        shown.map(({ row, index }, position) => (
          <Card key={row.id} className="overflow-hidden bg-[var(--surface-2)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge>{position + 1}</Badge>
                <span className="font-semibold">
                  {row.name ||
                    row.fileName ||
                    row.payer ||
                    row.value ||
                    t(subset?.title ?? definition.title)}
                </span>
              </div>
              {!reading && index >= 0 && (!subset || shown.length > 1) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => change(rows.filter((_, i) => i !== index))}
                >
                  {t("template.remove")}
                </Button>
              ) : null}
            </div>
            <CardContent>
              {reading ? (
                <DescriptionList
                  items={fields(row).map((f) => ({
                    id: f.id,
                    label: f.label,
                    value: f.options
                      ? t(
                          f.options.find((o) => o.value === row[f.id])?.label ??
                            row[f.id] ??
                            "—",
                        )
                      : row[f.id] || "—",
                  }))}
                />
              ) : (
                <div className={recordStyles.fieldGrid}>
                  {fields(row).map((field) => (
                    <div
                      className={recordStyles.field}
                      key={field.id}
                      style={
                        {
                          "--field-span": field.span ?? 4,
                        } as React.CSSProperties
                      }
                    >
                      {subset?.values[0] !== "email" &&
                      subset &&
                      field.id === "value" ? (
                        <RecordPhoneField
                          value={row.value ?? ""}
                          code={row.countryCode ?? ""}
                          options={
                            definition.fields.find(
                              (f) => f.id === "countryCode",
                            )?.options ?? []
                          }
                          disabled={disabled}
                          error={errors[`${id}.${index}.value`]}
                          onValue={(value) =>
                            updateRow(index, row, "value", value)
                          }
                          onCode={(code) =>
                            updateRow(index, row, "countryCode", code)
                          }
                        />
                      ) : (
                        <PatientFieldControl
                          field={
                            subset && field.id === "value"
                              ? {
                                  ...field,
                                  label:
                                    subset.values[0] === "email"
                                      ? "template.clinical.email"
                                      : "template.clinical.phone",
                                  type:
                                    subset.values[0] === "email"
                                      ? "email"
                                      : "text",
                                }
                              : field
                          }
                          value={row[field.id] ?? ""}
                          disabled={disabled}
                          error={errors[`${id}.${index}.${field.id}`]}
                          onChange={(value) =>
                            updateRow(index, row, field.id, String(value))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
      {!reading ? (
        <Button
          className="w-full border-dashed"
          disabled={
            disabled ||
            rows.length >= 30 ||
            !!(
              definition.addRequires &&
              shown.length &&
              !shown.at(-1)!.row[definition.addRequires]
            )
          }
          onClick={add}
        >
          {t(addLabel)}
        </Button>
      ) : null}
      {errors[id] ? <p role="alert">{t(errors[id])}</p> : null}
      {id === "documents" ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--text-muted)]">
              {t("template.clinical.documentNote")}
            </p>
            {!reading ? (
              <FilePicker
                label="template.clinical.upload"
                disabled={disabled || rows.length >= 30}
                onFile={(file) =>
                  change([
                    ...rows,
                    Object.fromEntries([
                      ["id", crypto.randomUUID()],
                      ...definition.fields.map((f) => [f.id, ""]),
                      ["fileName", file.name],
                      ["mimeType", file.type],
                      ["fileSizeBytes", String(file.size)],
                    ]),
                  ])
                }
              />
            ) : null}
          </div>
        </>
      ) : null}
    </Wrapper>
  );
}
