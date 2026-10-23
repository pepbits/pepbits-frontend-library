"use client";
import React from "react";
import {CardGrid, DescriptionList, StatCard} from '@pepbits/components';
import {Input, Select, Textarea} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {clinicInvoiceLines, type ClinicBillingView} from '../../domain/clinic-billing';
import {type Formatters} from '@pepbits/i18n';
import {type UserPreferences} from '@pepbits/preferences';
import { ClinicPanel, ClinicLedgerTable } from "./parts";
export function ClinicInvoiceReview({
  data,
  selected,
  discount,
  onDiscount,
  insurance,
  onInsurance,
  authorization,
  onAuthorization,
  note,
  onNote,
  disabled,
  format,
  preferences,
}: {
  data: ClinicBillingView;
  selected: string[];
  discount: string;
  onDiscount: (v: string) => void;
  insurance: string;
  onInsurance: (v: string) => void;
  authorization: string;
  onAuthorization: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
  disabled: boolean;
  format: Formatters;
  preferences: UserPreferences;
}) {
  const { t } = useLocalization(),
    policy = data.patient.collections.insurances?.find(
      (p) => p.id === insurance,
    ),
    lines = clinicInvoiceLines(
      data.state.orders.filter(
        (o) => selected.includes(o.id) && o.status === "ordered",
      ),
      data.services,
      Math.min(10000, Math.max(0, Math.round((Number(discount) || 0) * 100))),
      !!policy,
    ),
    money = (n: number) => format.money(n / 100);
  return (
    <ClinicPanel title="template.clinic.review">
      <CardGrid columns={3}>
        <Select
          label="template.clinic.insurance"
          value={insurance}
          disabled={disabled}
          options={[
            { value: "", label: "template.clinic.selfPay" },
            ...(data.patient.collections.insurances ?? []).map((p) => ({
              value: p.id!,
              label:
                [p.payer, p.policyNumber].filter(Boolean).join(" • ") || p.id!,
            })),
          ]}
          onChange={(e) => onInsurance(e.target.value)}
        />
        <Input
          label="template.clinic.authorization"
          value={authorization}
          disabled={disabled || !insurance}
          required={!!insurance}
          onChange={(e) => onAuthorization(e.target.value)}
        />
        <Input
          label="template.clinic.discount"
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={discount}
          disabled={disabled}
          onChange={(e) => onDiscount(e.target.value)}
        />
      </CardGrid>
      {policy ? (
        <DescriptionList
          items={["payer", "policyNumber", "expiry"].map((id) => ({
            id,
            label: "template.clinical." + id,
            value:
              id === "expiry"
                ? format.date(policy[id] ?? "")
                : policy[id] || "—",
          }))}
        />
      ) : null}
      <p className="text-sm text-[var(--text-muted)]">
        {t("template.clinic.insuranceHint")}
      </p>
      <ClinicLedgerTable
        preferences={preferences}
        headers={[
          "template.clinic.service",
          "template.clinic.quantity",
          "template.clinic.price",
          "template.clinic.net",
          "template.clinic.tax",
          "template.clinic.insurer",
          "template.clinic.patientShare",
        ]}
        rows={lines.map((l) => ({
          id: l.orderId,
          cells: [
            t(l.label),
            format.number(l.quantity),
            money(l.price),
            money(l.net),
            money(l.tax),
            money(l.insurance),
            money(l.patient),
          ],
        }))}
      />
      <CardGrid columns={3}>
        <StatCard
          label="template.clinic.total"
          value={money(lines.reduce((s, l) => s + l.net + l.tax, 0))}
        />
        <StatCard
          label="template.clinic.insurer"
          value={money(lines.reduce((s, l) => s + l.insurance, 0))}
        />
        <StatCard
          label="template.clinic.patientShare"
          value={money(lines.reduce((s, l) => s + l.patient, 0))}
        />
      </CardGrid>
      <Textarea
        label="template.clinic.note"
        rows={3}
        value={note}
        maxLength={1000}
        disabled={disabled}
        onChange={(e) => onNote(e.target.value)}
      />
    </ClinicPanel>
  );
}
