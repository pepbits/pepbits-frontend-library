"use client";
import React from "react";
import {
  ArrowRight,
  Check,
  Search,
  UserRound,
  CalendarDays,
  Footprints,
  Link2,
  ShieldCheck,
  Wallet,
  Building2,
  Layers,
} from "@pepbits/icons";
import {Button, Badge, Input, Checkbox} from '@pepbits/ui';
import {Card, CardHeader, CardTitle, CardContent, CardGrid, DescriptionList, Table, TableContainer, TableHeader, TableHead, TableRow, TableBody, TableCell} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {RegistrationConfig, RegistrationValues, RegistrationRecord} from '../../domain/op-registration';
import type {PatientSummary, PatientRecord, PatientField} from '../../domain/clinical-templates';
import type {Formatters} from '@pepbits/i18n';
import { PatientFieldControl } from "../clinical-templates/shared";
import styles from "./registration.module.css";
export const rk = (key: string) => "registration." + key;
export const registrationSteps = [
  ["patientStep", "patientHint"],
  ["visit", "visitHint"],
  ["coverageStep", "coverageHint"],
  ["review", "reviewHint"],
  ["care", "careHint"],
] as const;
/** Reusable workflow navigation: the controller owns validation and transition authority. */
export function RegistrationProgress({
  step,
  registered,
  busy,
  onStep,
}: {
  step: number;
  registered: boolean;
  busy: boolean;
  onStep: (step: number) => void;
}) {
  const { t } = useLocalization();
  return (
    <nav className={styles.steps} aria-label={t(rk("title"))}>
      {registrationSteps.map(([title, hint], index) => (
        <Button
          key={title}
          variant="ghost"
          className={styles.step}
          data-done={registered ? index < 4 : index + 1 < step}
          aria-current={step === index + 1 ? "step" : undefined}
          disabled={busy || (registered ? index < 4 : index === 4)}
          onClick={() => onStep(index + 1)}
        >
          <span className={styles.stepNumber}>
            {(registered ? index < 4 : index + 1 < step) ? (
              <Check size={15} aria-hidden />
            ) : (
              index + 1
            )}
          </span>
          <span>
            <strong>{t(rk(title))}</strong>
            <small>{t(rk(hint))}</small>
          </span>
        </Button>
      ))}
    </nav>
  );
}
export function RegistrationFields({
  group,
  config,
  values,
  onChange,
  disabled = false,
  errors = {},
  showTitle = true,
}: {
  showTitle?: boolean;
  group: string;
  config: RegistrationConfig;
  values: RegistrationValues;
  onChange: (key: string, value: string | boolean) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}) {
  const definition = config.groups.find((g) => g.id === group);
  if (!definition) return null;
  return (
    <section className={styles.fieldSection} data-registration-group={group}>
      {showTitle ? <CardTitle title={definition.title} /> : null}
      <CardGrid
        columns={
          group === "identity" || group === "assistanceGroup"
            ? 1
            : group === "visit" || group === "nursing"
              ? 3
              : 2
        }
      >
        {definition.fields
          .filter((field) => {
            if (field.id === "source" || field.id === "responsibility")
              return false;
            if (group === "coverage") {
              if (values.responsibility === "self-pay")
                return field.id === "financialReason";
              if (values.responsibility === "sponsor")
                return ["sponsor", "financialReason"].includes(field.id);
              if (values.responsibility === "package")
                return ["package", "financialReason"].includes(field.id);
              if (["sponsor", "package"].includes(field.id)) return false;
              if (
                [
                  "authorizationId",
                  "authorizationFrom",
                  "authorizationTo",
                ].includes(field.id)
              )
                return values.authorization === "approved";
              if (["approvedSessions", "usedSessions"].includes(field.id))
                return values.template === "physiotherapy";
            }
            if (field.id === "procedure")
              return values.template === "postoperative";
            if (field.id === "program")
              return ["screening-visit", "vaccination"].includes(
                String(values.template),
              );
            if (field.id === "session")
              return values.template === "physiotherapy";
            if (field.id === "consentNote")
              return (
                ["deferred", "declined"].includes(String(values.treatment)) ||
                ["deferred", "declined"].includes(String(values.privacy)) ||
                values.mode === "remote"
              );
            return true;
          })
          .map((field) => {
            const options =
              field.id === "provider" || field.id === "followupProvider"
                ? config.providers.map((p) => ({
                    value: p.id,
                    label: p.name + " · " + p.specialty,
                  }))
                : field.id === "template"
                  ? config.templates.map((p) => ({
                      value: p.id,
                      label: p.label,
                    }))
                  : field.options;
            return (
              <div
                key={field.id}
                data-field={field.id}
                className={
                  field.type === "textarea" || field.id === "reason"
                    ? styles.wideField
                    : undefined
                }
              >
                {field.type === "checkbox" ? (
                  <Checkbox
                    label={field.label}
                    checked={values[field.id] === true}
                    onChange={(e) => onChange(field.id, e.target.checked)}
                    disabled={disabled}
                  />
                ) : (
                  <PatientFieldControl
                    field={{ ...field, ...(options ? { options } : {}) }}
                    value={values[field.id]}
                    onChange={(value) => onChange(field.id, value)}
                    disabled={disabled}
                    error={errors[field.id]}
                  />
                )}
              </div>
            );
          })}
      </CardGrid>
    </section>
  );
}
export function RegistrationPanel({
  title,
  children,
  actions,
  subtitle,
}: {
  subtitle?: string;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card className={styles.panel}>
      <CardHeader className={styles.panelHead}>
        <CardTitle title={title} subtitle={subtitle} />
        {actions}
      </CardHeader>
      <CardContent className={styles.panelBody}>{children}</CardContent>
    </Card>
  );
}
export function RegistrationContext({
  config,
  record,
  format,
}: {
  config: RegistrationConfig;
  record: RegistrationRecord;
  format: Formatters;
}) {
  const { t } = useLocalization(),
    provider = config.providers.find((p) => p.id === record.values.provider);
  return (
    <RegistrationPanel title={rk("context")}>
      <Badge tone="brand">{t(rk(record.status))}</Badge>
      <DescriptionList
        layout="rows"
        itemClassName="py-2"
        valueClassName="min-w-0 text-end break-words font-medium"
        items={[
          {
            id: "provider",
            label: rk("provider"),
            value: provider?.name ?? "—",
          },
          {
            id: "clinic",
            label: rk("clinic"),
            value: String(record.values.clinic ?? ""),
          },
          {
            id: "source",
            label: rk("source"),
            value: t(rk(String(record.values.source))),
          },
          {
            id: "episode",
            label: rk("episode"),
            value: String(record.values.episode || "—"),
          },
          {
            id: "estimate",
            label: rk("estimate"),
            value: format.money(provider?.fee ?? 0),
          },
        ]}
      />
      <p className={styles.note}>{t(rk("demo"))}</p>
    </RegistrationPanel>
  );
}
export function RegistrationPatientSearch({
  rows,
  query,
  onQuery,
  onSelect,
  page,
  total,
  pageSize,
  onPage,
  busy,
  format,
  filters,
}: {
  filters?: React.ReactNode;
  rows: PatientSummary[];
  query: string;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  busy: boolean;
  format: Formatters;
}) {
  const { t } = useLocalization();
  return (
    <div className={styles.searchArea}>
      <Input
        prefix={<Search size={20} aria-hidden />}
        className={styles.searchInput}
        label="template.clinical.search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        disabled={busy}
      />
      <p className={styles.note}>{t(rk("searchHint"))}</p>
      {filters}
      <TableContainer>
        <Table className="w-full text-start">
          <TableHeader>
            <TableRow>
              {["patient", "mrn", "birthDate", "mobile"].map((key) => (
                <TableHead key={key} className="text-start">
                  {t("template.clinical." + key)}
                </TableHead>
              ))}
              <TableHead>{t(rk("select"))}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className={styles.avatar} aria-hidden>
                      {p.name
                        .split(" ")
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <div className={styles.note}>{p.mrn}</div>
                    </div>
                  </div>
                  {p.possibleDuplicate ? (
                    <Badge tone="warning">{t(rk("duplicate"))}</Badge>
                  ) : null}
                </TableCell>
                <TableCell>{p.mrn}</TableCell>
                <TableCell>{format.date(p.birthDate)}</TableCell>
                <TableCell>{p.mobile}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    aria-label={t(rk("select"))}
                    disabled={busy}
                    onClick={() => onSelect(p.id)}
                  >
                    <ArrowRight size={18} aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!rows.length ? <p>{t(rk("empty"))}</p> : null}
      <div className="flex items-center justify-between">
        <span>{format.number(total)}</span>
        <div className="flex gap-2">
          <Button
            disabled={busy || page === 1}
            onClick={() => onPage(page - 1)}
          >
            {t(rk("previous"))}
          </Button>
          <Button
            disabled={busy || page * pageSize >= total}
            onClick={() => onPage(page + 1)}
          >
            {t(rk("next"))}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RegistrationPatientStrip({
  patient,
  format,
  status,
}: {
  patient: PatientRecord;
  format: Formatters;
  status?: string;
}) {
  const { t } = useLocalization(),
    name = [
      patient.values.firstName,
      patient.values.middleName,
      patient.values.lastName,
    ]
      .filter(Boolean)
      .join(" ");
  return (
    <div className={styles.patientStrip}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={styles.avatar} aria-hidden>
          {name
            .split(" ")
            .slice(0, 2)
            .map((word) => word[0])
            .join("")}
        </span>
        <div>
          <strong>{name}</strong>
          <small>
            {patient.mrn} ·{" "}
            {format.date(String(patient.values.birthDate ?? ""))} ·{" "}
            {t("template.clinical." + String(patient.values.gender ?? ""))}
          </small>
        </div>
      </div>
      {status ? <Badge tone="brand">{t(rk(status))}</Badge> : null}
    </div>
  );
}

export function registrationFieldValue(
  field: PatientField,
  value: string | boolean | undefined,
  config: RegistrationConfig,
  format: Formatters,
  t: (key: string) => string,
): string {
  if (value === undefined || value === "") return "—";
  if (typeof value === "boolean") return t(value ? "Yes" : "No");
  if (field.type === "date") return format.date(value);
  if (field.type === "time") return format.time(value);
  if (field.id === "provider" || field.id === "followupProvider")
    return config.providers.find((p) => p.id === value)?.name ?? value;
  if (field.id === "template")
    return t(config.templates.find((p) => p.id === value)?.label ?? value);
  return field.options
    ? t(field.options.find((o) => o.value === value)?.label ?? value)
    : value;
}

export function RegistrationChoices({
  field,
  config,
  value,
  disabled,
  onChange,
}: {
  field: string;
  config: RegistrationConfig;
  value: string | boolean | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useLocalization();
  const definition = config.groups
    .flatMap((g) => g.fields)
    .find((f) => f.id === field);
  return (
    <div
      className={styles.choices}
      role="group"
      aria-label={t(definition?.label ?? field)}
    >
      {definition?.options?.map((option) => (
        <Button
          key={option.value}
          variant="secondary"
          className={styles.choice}
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          <RegistrationChoiceIcon value={option.value} />
          <strong>{t(option.label)}</strong>
          {value === option.value ? (
            <Check size={16} aria-hidden className="ms-auto" />
          ) : null}
        </Button>
      ))}
    </div>
  );
}

function RegistrationChoiceIcon({ value }: { value: string }) {
  const Icon =
    (
      {
        appointment: CalendarDays,
        "walk-in": Footprints,
        referral: Link2,
        insurance: ShieldCheck,
        "self-pay": Wallet,
        sponsor: Building2,
        package: Layers,
      } as Record<string, typeof UserRound>
    )[value] ?? UserRound;
  return <Icon size={20} aria-hidden />;
}
