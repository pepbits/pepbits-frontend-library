"use client";
import React, { useState } from "react";
import {Badge, Button, Input, Textarea} from '@pepbits/ui';
import {CardGrid, Card, CardContent, DescriptionList, Modal} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {clinicBalance, type ClinicBillingView, type ClinicBillingCommand} from '../../domain/clinic-billing';
import {type Formatters} from '@pepbits/i18n';
import {type UserPreferences} from '@pepbits/preferences';
import { ClinicPanel, ClinicLedgerTable } from "./parts";
import { ClinicInvoiceReview } from "./invoice";

/** A document screen over the authoritative ledger; edits are staged until API confirmation. */
export function ClinicBillScreen({
  data,
  invoiceId,
  mode,
  disabled,
  busy,
  format,
  preferences,
  onBack,
  onEdit,
  onCommand,
  onDirty,
}: {
  data: ClinicBillingView;
  invoiceId: string;
  mode: "view" | "edit";
  disabled: boolean;
  busy: boolean;
  format: Formatters;
  preferences: UserPreferences;
  onBack: () => void;
  onEdit: () => void;
  onCommand: (command: ClinicBillingCommand) => void;
  onDirty: (value: boolean) => void;
}) {
  const { t } = useLocalization();
  const invoice = data.state.invoices.find((i) => i.id === invoiceId)!;
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(
      invoice.lines.map((l) => [l.orderId, String(l.quantity)]),
    ),
  );
  const [discount, setDiscount] = useState(String(invoice.discountBps / 100)),
    [insurance, setInsurance] = useState(invoice.insuranceId),
    [authorization, setAuthorization] = useState(invoice.authorization),
    [note, setNote] = useState(invoice.note),
    [reason, setReason] = useState(""),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const editable =
    invoice.status === "issued" &&
    !data.state.payments.some((p) => p.invoiceId === invoiceId);
  const locked = disabled || !editable;
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      if (locked) return;
      setter(value);
      setDirty(true);
      onDirty(true);
    };
  const money = (n: number) => format.money(n / 100);
  const ids = invoice.lines.map((l) => l.orderId);
  const valid =
    Object.values(quantities).every(
      (v) =>
        v.trim() !== "" &&
        Number.isSafeInteger(Number(v)) &&
        Number(v) >= 1 &&
        Number(v) <= 100,
    ) &&
    discount.trim() !== "" &&
    Number.isFinite(Number(discount)) &&
    Number(discount) >= 0 &&
    Number(discount) <= 100 &&
    (!insurance || authorization.trim()) &&
    reason.trim();
  const preview = {
    ...data,
    state: {
      ...data.state,
      orders: data.state.orders
        .filter((o) => ids.includes(o.id))
        .map((o) => ({
          ...o,
          status: "ordered" as const,
          quantity: Number(quantities[o.id]) || 0,
        })),
    },
  };
  const close = () => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onBack();
  };
  return (
    <div className="space-y-3" data-clinic-bill-screen={mode}>
      <Card className="sticky top-0 z-10">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              {t(
                "template.clinic." +
                  (mode === "edit" ? "editBill" : "viewBill"),
              )}
            </h2>
            <p className="break-all text-xs text-[var(--text-muted)]">
              {invoice.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={close}>
              {t("template.clinic.backBills")}
            </Button>
            {mode === "view" ? (
              <>
                <Button disabled={locked} onClick={onEdit}>
                  {t("template.clinic.editBill")}
                </Button>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    onCommand({
                      action: "export",
                      invoiceId,
                      format: preferences.exportFormat,
                    })
                  }
                >
                  {t("template.clinical.export")}
                </Button>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    onCommand({ action: "export", invoiceId, format: "print" })
                  }
                >
                  {t("Save as PDF")}
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                disabled={locked || !dirty || !valid}
                onClick={() =>
                  onCommand({
                    action: "editInvoice",
                    invoiceId,
                    quantities: ids.map((orderId) => ({
                      orderId,
                      quantity: Number(quantities[orderId]),
                    })),
                    discountBps: Math.round(Number(discount) * 100),
                    insuranceId: insurance,
                    authorization,
                    note,
                    reason,
                  })
                }
              >
                {t("template.clinic.saveChanges")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {!editable ? (
        <p role="status" className="text-sm text-[var(--text-muted)]">
          {t("template.clinic.error.editLocked")}
        </p>
      ) : null}
      {mode === "edit" ? (
        <>
          <ClinicPanel title="template.clinic.service">
            <p className="text-sm text-[var(--text-muted)]">
              {t("template.clinic.editHint")}
            </p>
            <CardGrid columns={3}>
              {invoice.lines.map((line) => (
                <Input
                  key={line.orderId}
                  label={t(line.label) + " · " + t("template.clinic.quantity")}
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={quantities[line.orderId]}
                  disabled={locked}
                  onChange={(e) =>
                    edit(setQuantities)({
                      ...quantities,
                      [line.orderId]: e.target.value,
                    })
                  }
                />
              ))}
            </CardGrid>
          </ClinicPanel>
          <ClinicInvoiceReview
            data={preview}
            selected={ids}
            discount={discount}
            onDiscount={edit(setDiscount)}
            insurance={insurance}
            onInsurance={edit(setInsurance)}
            authorization={authorization}
            onAuthorization={edit(setAuthorization)}
            note={note}
            onNote={edit(setNote)}
            disabled={locked}
            format={format}
            preferences={preferences}
          />
          <Textarea
            label="template.clinic.editReason"
            required
            maxLength={500}
            value={reason}
            disabled={locked}
            onChange={(e) => edit(setReason)(e.target.value)}
          />
        </>
      ) : (
        <div data-invoice-print className="space-y-3">
          <ClinicPanel title="template.clinic.invoice">
            <Badge tone="warning">{t("template.clinic.demo")}</Badge>
            <DescriptionList
              items={[
                {id:"invoice",label:"template.clinic.invoice",value:invoice.id},
                {
                  id: "patient",
                  label: "template.clinical.mrn",
                  value: data.patient.mrn,
                },
                {
                  id: "date",
                  label: "template.clinic.date",
                  value: format.dateTime(invoice.at),
                },
                {
                  id: "actor",
                  label: "template.clinic.actor",
                  value: invoice.actor,
                },
                {
                  id: "status",
                  label: "template.clinic.status",
                  value: t("template.clinic.status." + invoice.status),
                },
                {
                  id: "total",
                  label: "template.clinic.total",
                  value: money(invoice.total),
                },
                {
                  id: "insurance",
                  label: "template.clinic.insurer",
                  value: money(invoice.insurance),
                },
                {
                  id: "share",
                  label: "template.clinic.patientShare",
                  value: money(invoice.patient),
                },
                {
                  id: "balance",
                  label: "template.clinic.balance",
                  value: money(clinicBalance(data.state, invoice)),
                },
                {
                  id: "policy",
                  label: "template.clinic.insurance",
                  value:
                    data.patient.collections.insurances?.find(
                      (p) => p.id === invoice.insuranceId,
                    )?.policyNumber ||
                    invoice.insuranceId ||
                    t("template.clinic.selfPay"),
                },
                {
                  id: "authorization",
                  label: "template.clinic.authorization",
                  value: invoice.authorization || "—",
                },
                {
                  id: "discount",
                  label: "template.clinic.discount",
                  value: format.number(invoice.discountBps / 100) + "%",
                },
                {
                  id: "note",
                  label: "template.clinic.note",
                  value: invoice.note || "—",
                },
              ]}
            />
            <ClinicLedgerTable
              paginate={false}
              preferences={preferences}
              headers={[
                "service",
                "doctor",
                "quantity",
                "price",
                "net",
                "tax",
                "insurer",
                "patientShare",
              ].map((k) => "template.clinic." + k)}
              rows={invoice.lines.map((l) => ({
                id: l.orderId,
                cells: [
                  t(l.label),
                  data.state.orders.find((o) => o.id === l.orderId)?.doctor ||
                    "—",
                  format.number(l.quantity),
                  money(l.price),
                  money(l.net),
                  money(l.tax),
                  money(l.insurance),
                  money(l.patient),
                ],
              }))}
            />
          </ClinicPanel>
          <ClinicPanel title="template.clinic.payments">
            <ClinicLedgerTable
              paginate={false}
              preferences={preferences}
              headers={["receipt", "date", "amount", "method", "reference"].map(
                (k) => "template.clinic." + k,
              )}
              rows={data.state.payments
                .filter((p) => p.invoiceId === invoiceId)
                .map((p) => ({
                  id: p.id,
                  cells: [
                    p.id,
                    format.dateTime(p.at),
                    money(p.amount),
                    t("template.clinic.method." + p.method),
                    p.reference || "—",
                  ],
                }))}
            />
          </ClinicPanel>
          <ClinicPanel title="template.clinic.revisions">
            <ClinicLedgerTable
              preferences={preferences}
              headers={["date", "actor", "editReason", "total", "note"].map(
                (k) => "template.clinic." + k,
              )}
              rows={(invoice.revisions ?? []).map((r, i) => ({
                id: String(i),
                cells: [
                  format.dateTime(r.at),
                  r.actor,
                  r.reason,
                  money(r.invoice.total),
                  r.invoice.note || "—",
                ],
              }))}
            />
          </ClinicPanel>
        </div>
      )}
      <Modal
        open={discard}
        onClose={() => setDiscard(false)}
        title={t("template.clinic.switchPatient")}
        footer={
          <>
            <Button onClick={() => setDiscard(false)}>{t("Cancel")}</Button>
            <Button
              onClick={() => {
                onDirty(false);
                onBack();
              }}
            >
              {t("template.clinical.discard")}
            </Button>
          </>
        }
      >
        <p>{t("template.clinic.switchHint")}</p>
      </Modal>
    </div>
  );
}
