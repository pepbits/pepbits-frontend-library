"use client";
import React, { useEffect, useRef, useState } from "react";
import {Card, CardHeader, CardTitle, CardContent, RecoveryNotice, failureFromError} from '@pepbits/components';
import {Button, Badge, Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {PatientEligibility, PatientRecord} from '../../domain/clinical-templates';
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
export function PatientInsuranceCheck({
  patient,
  adapter,
  disabled,
}: {
  patient: PatientRecord;
  adapter: ClinicalTemplateAdapter;
  disabled: boolean;
}) {
  const { t, dateTime } = useLocalization(),
    [id, setId] = useState(patient.collections.insurances![0]?.id ?? ""),
    [result, setResult] = useState<PatientEligibility | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const check = async () => {
    if (busy || disabled || !id) return;
    setBusy(true);
    setError(null);
    try {
      const value = await adapter.eligibility(patient.id, id);
      if (alive.current) setResult(value);
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle title="template.clinical.eligibility" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[var(--text-muted)]">
          {t("template.clinical.eligibilityHelp")}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="template.clinical.insurance"
            value={id}
            disabled={busy}
            options={[
              { value: "", label: "template.clinical.select" },
              ...patient.collections.insurances!.map((p) => ({
                value: p.id!,
                label: [p.payer, p.memberNumber].join(" · "),
              })),
            ]}
            onChange={(e) => {
              setId(e.target.value);
              setResult(null);
            }}
          />
          <Button
            disabled={disabled || !id}
            loading={busy}
            onClick={() => void check()}
          >
            {t("template.clinical.checkEligibility")}
          </Button>
        </div>
        {error ? (
          <RecoveryNotice
            failure={failureFromError(error)}
            onRetry={() => void check()}
          />
        ) : null}
        {result ? (
          <p role="status" className="flex flex-wrap items-center gap-2">
            <Badge tone={result.status === "eligible" ? "success" : "warning"}>
              {t(`template.clinical.${result.status}`)}
            </Badge>
            <span className="text-xs">
              {dateTime(result.checkedAt)} · {result.reference}
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
