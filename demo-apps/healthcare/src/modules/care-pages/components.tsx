"use client";
import React from "react";
import {Button, Avatar, Badge, Checkbox} from '@pepbits/ui';
import {Card, CardHeader, CardTitle, CardContent, CardGrid, DescriptionList} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {CareGroup, CareValues, CareRecord, CareBed} from '../../domain/care-pages';
import { PatientFieldControl } from "../clinical-templates/shared";
import styles from "./care.module.css";
export function CarePanel({
  title,
  children,
  actions,
  id,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  id?: string;
}) {
  return (
    <Card className={styles.panel} id={id}>
      <CardHeader>
        <CardTitle title={title} />
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function CareFields({
  group,
  values,
  change,
  disabled,
  errors = {},
}: {
  group: CareGroup;
  values: CareValues;
  change: (k: string, v: string | boolean) => void;
  disabled: boolean;
  errors?: Record<string, string>;
}) {
  return (
    <div className={styles.fields}>
      {group.fields
        .filter(
          (f) =>
            !f.visibleWhen ||
            (f.visibleWhen.field === "pathway" ? String(values.pathway??"").split("|").includes(String(f.visibleWhen.value)) : values[f.visibleWhen.field] === f.visibleWhen.value),
        )
        .map((f) => (
          <div
            key={f.id}
            style={{ gridColumn: `span ${Math.min(12, f.span ?? 4)}` }}
          >
            <PatientFieldControl
              field={f}
              value={values[f.id]}
              onChange={(v) => change(f.id, v)}
              disabled={disabled || f.readOnly}
              error={errors[f.id]}
            />
          </div>
        ))}
    </div>
  );
}
export function CareSteps({
  steps,
  value,
  change,
  disabled,
}: {
  steps: string[];
  value: number;
  change: (n: number) => void;
  disabled: boolean;
}) {
  const { t } = useLocalization();
  return (
    <nav className={styles.steps} aria-label={t("care.workflow")}>
      {steps.map((s, i) => (
        <Button
          key={s}
          variant="ghost"
          disabled={disabled}
          aria-current={value === i + 1 ? "step" : undefined}
          onClick={() => change(i + 1)}
        >
          <span className={styles.stepNumber}>{i + 1}</span>
          <span>{t(s)}</span>
        </Button>
      ))}
    </nav>
  );
}
export function CareHero({
  record,
  children,
}: {
  record: CareRecord | null;
  children?: React.ReactNode;
}) {
  const { t } = useLocalization();
  return (
    <div className={styles.hero}>
      <Avatar name={record?.patient.name ?? "?"} size="lg" />
      <div className={styles.grow}>
        <strong>{record?.patient.name ?? t("care.choosePatient")}</strong>
        <p>{record?.patient.id ?? t("care.synthetic")}</p>
      </div>
      <div>
        <small>{t("care.encounter")}</small>
        <p>
          <Badge>{t("care.status." + (record?.status ?? "draft"))}</Badge>
        </p>
      </div>
      <div>
        <small>{t("care.bed")}</small>
        <p>{record?.bedId || t("care.unassigned")}</p>
      </div>
      {children}
    </div>
  );
}
export function CareChoices({
  label,
  options,
  value,
  change,
  disabled,
  multiple=false,
}: {
  multiple?:boolean;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  change: (v: string) => void;
  disabled: boolean;
}) {
  const { t } = useLocalization();
  return (
    <div className={styles.choices} role="group" aria-label={t(label)}>
      {options.filter((option,index,list)=>list.findIndex(item=>item.value===option.value)===index).map((o) => (
        <Button
          key={o.value}
          variant="secondary"
          aria-pressed={multiple?value.split("|").includes(o.value):o.value === value}
          disabled={disabled}
          onClick={() => change(multiple?(value.split("|").includes(o.value)?value.split("|").filter(v=>v!==o.value):[...value.split("|").filter(Boolean),o.value]).join("|"):o.value)}
        >
          {t(o.label)}
        </Button>
      ))}
    </div>
  );
}
export function CareBedBoard({
  beds,
  record,
  disabled,
  reserve,
}: {
  beds: CareBed[];
  record: CareRecord;
  disabled: boolean;
  reserve: (id: string) => void;
}) {
  const { t } = useLocalization();
  return (
    <CardGrid columns={3}>
      {beds.map((b) => (
        <Card key={b.id} className={styles.bed}>
          <CardContent>
            <strong>
              {t(b.ward)} · {b.room}
            </strong>
            <p>{t(b.care)}</p>
            <Badge>
              {b.id === record.bedId ? t("care.reserved") : t(b.status)}
            </Badge>
            <p>
              {b.telemetry ? t("care.telemetry") : ""}{" "}
              {b.isolation ? t("care.isolation") : ""}
            </p>
            <Button
              disabled={
                disabled ||
                b.status !== "Available" ||
                (!!record.bedId && record.bedId === b.id)
              }
              onClick={() => reserve(b.id)}
            >
              {t("care.reserve")}
            </Button>
          </CardContent>
        </Card>
      ))}
    </CardGrid>
  );
}
export function CareVerification({
  values,
  change,
  disabled,
}: {
  values: CareValues;
  change: (k: string, v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className={styles.verification}>
      <Checkbox
        label="care.identityVerified"
        checked={values.identityVerified === true}
        disabled={disabled}
        onChange={(v) => change("identityVerified", v.target.checked)}
      />
      <Checkbox
        label="care.consentReviewed"
        checked={values.consentReviewed === true}
        disabled={disabled}
        onChange={(v) => change("consentReviewed", v.target.checked)}
      />
    </div>
  );
}
export function CareReview({
  groups,
  values,
}: {
  groups: CareGroup[];
  values: CareValues;
}) {
  const { t } = useLocalization();
  return (
    <div className={styles.review}>
      {groups.map((g) => (
        <CarePanel key={g.id} title={g.title}>
          <DescriptionList
            items={g.fields
              .filter((f) => String(values[f.id] ?? "").length > 0)
              .map((f) => ({
                id: f.id,
                label: f.label,
                value:
                  typeof values[f.id] === "boolean"
                    ? t(values[f.id] ? "Yes" : "No")
                    : t(
                        f.options?.find((o) => o.value === values[f.id])
                          ?.label ?? String(values[f.id]),
                      ),
              }))}
          />
        </CarePanel>
      ))}
    </div>
  );
}
