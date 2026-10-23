"use client";
import React, { useState } from "react";
import {Card, CardContent, CardGrid, Modal} from '@pepbits/components';
import {Badge, Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import { UserRound, Activity } from "@pepbits/icons";
import type {PatientRecord} from '../../domain/clinical-templates';
import type {Formatters} from '@pepbits/i18n';
import type {ClinicalTriageAdapter} from '../../adapters/clinical-triage';
import { useClinicalLoad, ClinicalLoading } from "../clinical-templates/shared";
export function OPPatientContext({
  patient,
  format,
  triage,
}: {
  patient: PatientRecord;
  format: Formatters;
  triage: ClinicalTriageAdapter;
}) {
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const loaded = useClinicalLoad(
    () => triage.load(patient.id),
    [triage, patient.id],
  );
  const latest = loaded.value?.assessments.find(
    (record) => record.status === "completed",
  );
  return (
    <>
      <Card data-op-patient className="border-s-4 border-s-[var(--primary)]">
        <CardContent style={{ paddingBlock: ".5rem" }}>
          <CardGrid columns={3}>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)]">
                <UserRound className="size-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>
                    {[patient.values.firstName, patient.values.lastName].join(
                      " ",
                    )}
                  </strong>
                  <Badge>{patient.mrn}</Badge>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {format.date(String(patient.values.birthDate ?? ""))} •{" "}
                  {patient.values.gender
                    ? t("template.clinical." + patient.values.gender)
                    : t("template.op.notRecorded")}{" "}
                  • {String(patient.values.mobile ?? "")}
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={!latest}
                  onClick={() => setOpen(true)}
                >
                  <Activity className="size-3" />
                  {t("template.op.triage")}
                </Button>
                <Button size="xs" onClick={loaded.retry}>
                  {t("template.op.refreshTriage")}
                </Button>
              </div>
              {latest ? (
                <>
                  <p className="text-xs">
                    {format.dateTime(latest.updatedAt)} •{" "}
                    {t(
                      loaded.value?.config.priorities.find(
                        (p) => p.value === latest.values.priority,
                      )?.label ?? latest.values.priority,
                    )}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {t("template.triage.allergyStatus")}:{" "}
                    {t("template.triage." + latest.values.allergyStatus)}
                    {latest.values.allergies
                      ? " • " + latest.values.allergies
                      : ""}
                  </p>
                </>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  {t(
                    loaded.error
                      ? "template.op.notRecorded"
                      : loaded.value
                        ? "template.op.noTriage"
                        : "Loading…",
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-wrap content-center items-center gap-2">
              {latest ? (
                loaded.value?.config.vitals
                  .filter((field) => latest.values.vitals[field.id] !== "")
                  .map((field) => (
                    <Badge key={field.id}>
                      {t(field.label)}:{" "}
                      {format.number(Number(latest.values.vitals[field.id]))}{" "}
                      {field.unit}
                    </Badge>
                  ))
              ) : (
                <Badge>{t("template.op.contextHint")}</Badge>
              )}
            </div>
          </CardGrid>
          {loaded.error ? (
            <ClinicalLoading error={loaded.error} retry={loaded.retry} />
          ) : null}
        </CardContent>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("template.op.triage")}
        subtitle={t("template.op.contextHint")}
      >
        {latest ? (
          <div className="space-y-3">
            <p>
              {t("template.triage.lastSaved")}:{" "}
              {format.dateTime(latest.updatedAt)}
            </p>
            <p>
              {t("template.triage.measuredAt")}:{" "}
              {latest.values.measuredAt
                ? format.dateTime(latest.values.measuredAt)
                : t("template.op.notRecorded")}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {t("template.triage.complaint")}: {latest.values.complaint}
            </p>
            <p className="whitespace-pre-wrap break-words">
              {t("template.triage.allergies")}:{" "}
              {latest.values.allergies || t("template.op.notRecorded")}
            </p>
            <CardGrid columns={2}>
              {loaded.value?.config.vitals.map((field) => (
                <div key={field.id}>
                  <strong>{t(field.label)}</strong>
                  <p>
                    {latest.values.vitals[field.id] !== ""
                      ? format.number(Number(latest.values.vitals[field.id])) +
                        " " +
                        field.unit
                      : t("template.op.notRecorded")}
                  </p>
                </div>
              ))}
            </CardGrid>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
