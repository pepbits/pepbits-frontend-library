"use client";
import React from "react";
import {Badge, Button, Input, Select} from '@pepbits/ui';
import {CardGrid} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {clinicBalance, type ClinicBillingView, type ClinicBillingCommand} from '../../domain/clinic-billing';
import {type Formatters} from '@pepbits/i18n';
import {type UserPreferences} from '@pepbits/preferences';
import { ClinicLedgerTable, ClinicPanel } from "./parts";
export function ClinicPayments({
  data,
  invoiceId,
  onInvoice,
  amount,
  onAmount,
  method,
  onMethod,
  reference,
  onReference,
  disabled,
  onCommand,
  onPrint,
  onEdit,
  format,
  preferences,
}: {
  data: ClinicBillingView;
  invoiceId: string;
  onInvoice: (v: string) => void;
  amount: string;
  onAmount: (v: string) => void;
  method: "cash" | "card" | "transfer";
  onMethod: (v: "cash" | "card" | "transfer") => void;
  reference: string;
  onReference: (v: string) => void;
  disabled: boolean;
  onCommand: (c: ClinicBillingCommand) => void;
  onPrint: (id: string) => void;
  onEdit: (id: string) => void;
  format: Formatters;
  preferences: UserPreferences;
}) {
  const { t } = useLocalization(),
    money = (n: number) => format.money(n / 100),
    invoice = data.state.invoices.find((i) => i.id === invoiceId),
    balance = invoice ? clinicBalance(data.state, invoice) : 0,
    payment = Math.round(Number(amount) * 100);
  return (
    <ClinicPanel title="template.clinic.payments">
      <ClinicLedgerTable
        preferences={preferences}
        headers={[
          "template.clinic.invoice",
          "template.clinic.date",
          "template.clinic.total",
          "template.clinic.insurer",
          "template.clinic.balance",
          "template.clinic.status",
          "template.clinic.actions",
        ]}
        rows={data.state.invoices.map((i) => ({
          id: i.id,
          cells: [
            i.id,
            format.dateTime(i.at),
            money(i.total),
            money(i.insurance),
            money(clinicBalance(data.state, i)),
            <Badge
              tone={
                i.status === "void"
                  ? "warning"
                  : clinicBalance(data.state, i) === 0
                    ? "success"
                    : "brand"
              }
            >
              {t(
                "template.clinic.status." +
                  (i.status === "void"
                    ? "void"
                    : clinicBalance(data.state, i) === 0
                      ? "paid"
                      : "issued"),
              )}
            </Badge>,
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onPrint(i.id)}>
                {t("template.clinic.viewBill")}
              </Button>
              <Button
                size="sm"
                disabled={
                  disabled ||
                  i.status !== "issued" ||
                  data.state.payments.some((p) => p.invoiceId === i.id)
                }
                onClick={() => onEdit(i.id)}
              >
                {t("template.clinic.editBill")}
              </Button>
              <Button
                size="sm"
                disabled={disabled || i.status === "void"}
                onClick={() => {
                  onInvoice(i.id);
                  onAmount(String(clinicBalance(data.state, i) / 100));
                }}
              >
                {t("template.clinic.collect")}
              </Button>
            </div>,
          ],
        }))}
      />
      <CardGrid columns={3}>
        <Select
          label="template.clinic.invoice"
          value={invoiceId}
          disabled={disabled}
          options={[
            { value: "", label: "template.clinical.select" },
            ...data.state.invoices
              .filter((i) => i.status === "issued")
              .map((i) => ({ value: i.id, label: i.id })),
          ]}
          onChange={(e) => onInvoice(e.target.value)}
        />
        <Input
          label="template.clinic.amount"
          type="number"
          min={0.01}
          step={0.01}
          value={amount}
          disabled={disabled}
          onChange={(e) => onAmount(e.target.value)}
        />
        <Select
          label="template.clinic.method"
          value={method}
          disabled={disabled}
          options={["cash", "card", "transfer"].map((id) => ({
            value: id,
            label: "template.clinic.method." + id,
          }))}
          onChange={(e) => onMethod(e.target.value as typeof method)}
        />
      </CardGrid>
      <Input
        label="template.clinic.reference"
        value={reference}
        maxLength={500}
        disabled={disabled}
        onChange={(e) => onReference(e.target.value)}
      />
      <p className="text-sm text-[var(--text-muted)]">
        {t("template.clinic.paymentHint")}
      </p>
      <div className="flex gap-3">
        <Button
          variant="primary"
          disabled={
            disabled ||
            !invoice ||
            !Number.isFinite(payment) ||
            payment <= 0 ||
            payment > balance ||
            (method !== "cash" && !reference.trim())
          }
          onClick={() =>
            onCommand({
              action: "payment",
              invoiceId,
              amount: payment,
              method,
              reference,
            })
          }
        >
          {t("template.clinic.recordPayment")}
        </Button>
        <Button
          disabled={
            disabled ||
            !invoice ||
            !reference.trim() ||
            data.state.payments.some((p) => p.invoiceId === invoiceId)
          }
          onClick={() => onCommand({ action: "void", invoiceId, reference })}
        >
          {t("template.clinic.void")}
        </Button>
      </div>
      <ClinicLedgerTable
        preferences={preferences}
        headers={[
          "template.clinic.receipt",
          "template.clinic.date",
          "template.clinic.amount",
          "template.clinic.method",
          "template.clinic.reference",
          "template.clinic.actions",
        ]}
        rows={data.state.payments.map((p) => ({
          id: p.id,
          cells: [
            p.id,
            format.dateTime(p.at),
            money(p.amount),
            t("template.clinic.method." + p.method),
            p.reference || "—",
            p.amount > 0 ? (
              <Button
                size="sm"
                disabled={
                  disabled ||
                  !reference.trim() ||
                  data.state.payments.some((r) => r.refundOf === p.id)
                }
                onClick={() =>
                  onCommand({ action: "refund", paymentId: p.id, reference })
                }
              >
                {t("template.clinic.refund")}
              </Button>
            ) : (
              <Badge>{t("template.clinic.refunded")}</Badge>
            ),
          ],
        }))}
      />
    </ClinicPanel>
  );
}
