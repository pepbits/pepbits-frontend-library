"use client";
import React, { useMemo, useRef, useState } from "react";
import {Badge, Button, Input, Select} from '@pepbits/ui';
import {Card, CardContent, CardGrid, DescriptionList, Modal, PresentationProvider, RecoveryNotice, failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {effectivePreferences, type UserPreferences} from '@pepbits/preferences';
import {clinicBalance, type ClinicBillingCommand, type ClinicBillingMutation} from '../../domain/clinic-billing';
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
import type {ClinicBillingAdapter} from '../../adapters/clinic-billing';
import type { PreferenceHost } from "../preference-choice";
import { RecordSectionLayout } from "@pepbits/page-engines/record-layout";
import {
  ClinicalLoading,
  useClinicalLoad,
} from "../clinical-templates/shared";
import { ClinicPanel, ClinicLedgerTable } from "./parts";
import { ClinicOrders } from "./orders";
import { ClinicInvoiceReview } from "./invoice";
import { createClinicFormatters } from "./format";
import { downloadClinicInvoice } from "./receipt";
import { ClinicBillScreen } from "./bill-screen";
import { ClinicPayments } from "./payments";
export interface BillingClinicWorkspaceProps extends PreferenceHost {
  adapter: ClinicBillingAdapter;
  patients: ClinicalTemplateAdapter;
  scopeKey: string;
  patientId?: string;
  /** Hosted catalog navigation selects the patient before opening this workspace. */
  patientSelection?: "inline" | "external";
  onChoosePatient?: () => void;
}
export function BillingClinicWorkspace(props: BillingClinicWorkspaceProps) {
  const preferences = props.preferencePolicy
    ? effectivePreferences(props.preferences, props.preferencePolicy)
    : props.preferences;
  return (
    <PresentationProvider value={preferences}>
      {props.patientSelection === "external" ? (
        <div data-billing-clinic data-tour="billing-clinic" style={{ "--fs-scale": "var(--fs-form)" } as React.CSSProperties}>
          {props.patientId ? <ClinicEditor key={JSON.stringify([props.scopeKey, props.patientId])} {...props} preferences={preferences} patientId={props.patientId} onDirty={() => {}} onBusy={() => {}} /> : <ClinicPatientRequired onChoose={props.onChoosePatient} />}
        </div>
      ) : <ClinicSelector
        key={props.scopeKey}
        {...props}
        preferences={preferences}
      />
      }
    </PresentationProvider>
  );
}
function ClinicPatientRequired({ onChoose }: { onChoose?: () => void }) {
  const { t } = useLocalization();
  return <div className="space-y-3"><p>{t("template.clinic.choosePatient")}</p>{onChoose ? <Button onClick={onChoose}>{t("template.pageLibrary.title")}</Button> : null}</div>;
}
function ClinicSelector(props: BillingClinicWorkspaceProps) {
  const { t } = useLocalization(),
    [query, setQuery] = useState(""),
    [id, setId] = useState(props.patientId ?? ""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [next, setNext] = useState<string | null>(null);
  const patients = useClinicalLoad(
    () => props.patients.search({ q: query, page: 1, pageSize: props.preferences.pageSize }),
    [props.patients, query, props.preferences.pageSize],
  );
  const options = [
    { value: "", label: "template.clinical.selectPatient" },
    ...(patients.value?.rows ?? []).map((p) => ({
      value: p.id,
      label: p.mrn + " • " + p.name,
    })),
  ];
  if (id && !options.some((o) => o.value === id))
    options.push({ value: id, label: id });
  const change = (value: string) => {
    if (dirty) setNext(value);
    else setId(value);
  };
  return (
    <div
      className="space-y-4"
      data-billing-clinic
      data-tour="billing-clinic"
      style={{ "--fs-scale": "var(--fs-form)" } as React.CSSProperties}
    >
      <Card>
        <CardContent>
          <CardGrid columns={3}>
            <Input
              label="template.clinical.search"
              value={query}
              disabled={busy}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              label="template.clinical.selectPatient"
              value={id}
              options={options}
              disabled={busy}
              onChange={(e) => change(e.target.value)}
            />
            <div className="flex items-end">
              <Badge tone="warning">{t("template.clinic.demo")}</Badge>
            </div>
          </CardGrid>
          {patients.error ? (
            <ClinicalLoading error={patients.error} retry={patients.retry} />
          ) : null}
        </CardContent>
      </Card>
      {id ? (
        <ClinicEditor
          key={id}
          {...props}
          patientId={id}
          onDirty={setDirty}
          onBusy={setBusy}
        />
      ) : (
        <p>{t("template.clinic.choosePatient")}</p>
      )}
      <Modal
        open={next !== null}
        onClose={() => setNext(null)}
        title={t("template.clinic.switchPatient")}
        footer={
          <>
            <Button onClick={() => setNext(null)}>{t("Cancel")}</Button>
            <Button
              onClick={() => {
                setId(next ?? "");
                setNext(null);
                setDirty(false);
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
const sections = [
  { id: "patient", title: "template.clinic.patientContext" },
  { id: "orders", title: "template.clinic.orders" },
  { id: "review", title: "template.clinic.review" },
  { id: "payments", title: "template.clinic.payments" },
  { id: "history", title: "template.clinic.history" },
];
function ClinicEditor({
  adapter,
  patientId,
  preferences,
  preferencesAvailable,
  onDirty,
  onBusy,
}: BillingClinicWorkspaceProps & {
  patientId: string;
  onDirty: (v: boolean) => void;
  onBusy: (v: boolean) => void;
}) {
  const { t, language } = useLocalization(),
    loaded = useClinicalLoad(
      () => adapter.load(patientId),
      [adapter, patientId],
    ),
    [section, setSection] = useState("orders"),
    [selected, setSelected] = useState<string[]>([]),
    [service, setService] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [doctor, setDoctor] = useState(""),
    [discount, setDiscount] = useState("0"),
    [insurance, setInsurance] = useState(""),
    [authorization, setAuthorization] = useState(""),
    [note, setNote] = useState(""),
    [invoiceId, setInvoiceId] = useState(""),
    [amount, setAmount] = useState(""),
    [method, setMethod] = useState<"cash" | "card" | "transfer">("cash"),
    [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [confirm, setConfirm] = useState<ClinicBillingCommand | null>(null),
    [billScreen, setBillScreen] = useState<{
      id: string;
      mode: "view" | "edit";
    } | null>(null);
  const pending = useRef<ClinicBillingMutation | null>(null),
    lock = useRef(false),
    data = loaded.value;
  const format = useMemo(
    () =>
      createClinicFormatters(
        {
          ...preferences,
          language: language as UserPreferences["language"],
        },
        data?.currency ?? preferences.currencyCode,
      ),
    [preferences, language, data?.currency],
  );
  const edit =
    <T,>(setter: (v: T) => void) =>
    (value: T) => {
      if (lock.current || pending.current) return;
      setter(value);
      onDirty(true);
    };
  const execute = async (command?: ClinicBillingCommand) => {
    if (lock.current || !data?.canWrite || preferencesAvailable === false)
      return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError(null);
    pending.current ??= command
      ? {
          ...command,
          patientId,
          expectedVersion: data.state.version,
          operationId: crypto.randomUUID(),
        }
      : null;
    if (!pending.current) {
      lock.current = false;
      setBusy(false);
      onBusy(false);
      return;
    }
    try {
      const next = await adapter.mutate(pending.current);
      loaded.setValue(next);
      const completed = pending.current,
        action = completed.action;
      pending.current = null;
      setConfirm(null);
      setSelected([]);
      onDirty(false);
      if (action === "invoice") {
        setSection("payments");
        setInvoiceId(next.state.invoices.at(-1)?.id ?? "");
        setNote("");
      }
      if (action === "editInvoice")
        setBillScreen({ id: completed.invoiceId, mode: "view" });
      if (action === "payment" || action === "refund") {
        setAmount("");
        setReference("");
      }
      if (completed.action === "export") {
        if (completed.format === "print") window.print();
        else
          downloadClinicInvoice(
            next,
            completed.invoiceId,
            format,
            completed.format,
            t,
          );
      }
    } catch (e) {
      setError(e);
      setConfirm(null);
      if (typeof e === "object" && e && "status" in e && e.status === 400)
        pending.current = null;
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  const refreshLedger = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const latest = await adapter.load(patientId);
      loaded.setValue(latest);
      pending.current = null;
      setError(null);
      setSelected((ids) =>
        ids.filter((id) =>
          latest.state.orders.some((o) => o.id === id && o.status !== "billed"),
        ),
      );
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  if (!data)
    return <ClinicalLoading error={loaded.error} retry={loaded.retry} />;
  const disabled =
      busy ||
      !!pending.current ||
      !data.canWrite ||
      preferencesAvailable === false,
    money = (n: number) => format.money(n / 100),
    ordered = data.state.orders.filter(
      (o) => o.status === "ordered" && selected.includes(o.id),
    ),
    request = (command: ClinicBillingCommand) => setConfirm(command);
  const errorKey =
    error && typeof error === "object" && "fieldErrors" in error
      ? (error as { fieldErrors: Record<string, string> }).fieldErrors.billing
      : undefined;
  const shared = { data, disabled, format, preferences, onCommand: request };
  return (
    <div className="space-y-4">
      {error ? (
        <div className="space-y-2">
          <RecoveryNotice
            failure={failureFromError(error)}
            onRetry={() => void execute()}
          />
          {errorKey ? <p role="alert">{t(errorKey)}</p> : null}
          <Button disabled={busy} onClick={() => void refreshLedger()}>
            {t("template.clinic.loadLatest")}
          </Button>
        </div>
      ) : null}
      {billScreen ? (
        <ClinicBillScreen
          key={billScreen.id + billScreen.mode}
          {...shared}
          invoiceId={billScreen.id}
          mode={billScreen.mode}
          busy={busy || !!pending.current}
          onDirty={onDirty}
          onBack={() => setBillScreen(null)}
          onEdit={() => setBillScreen({ ...billScreen, mode: "edit" })}
        />
      ) : (
        <RecordSectionLayout
          activeOnly
          railAlignment="start"
          sections={sections}
          active={section}
          onActive={setSection}
          isDone={(id) =>
            id === "patient"
              ? true
              : id === "orders"
                ? data.state.orders.length > 0
                : id === "review"
                  ? data.state.invoices.length > 0
                  : id === "payments"
                    ? data.state.invoices.some((i) => i.status === "issued") &&
                      data.state.invoices.every(
                        (i) => clinicBalance(data.state, i) === 0,
                      )
                    : data.state.history.length > 0
          }
          railHeader={<strong>{t("template.clinic.title")}</strong>}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="text-sm text-[var(--text-muted)]">
                {t("template.clinic.preferencesHint")}
              </span>
              <div className="flex gap-2">
                {preferences.formNavigation === "wizard" ? (
                  <>
                    <Button
                      disabled={section === "patient"}
                      onClick={() =>
                        setSection(
                          sections[
                            Math.max(
                              0,
                              sections.findIndex((s) => s.id === section) - 1,
                            )
                          ]!.id,
                        )
                      }
                    >
                      {t("template.previous")}
                    </Button>
                    <Button
                      disabled={section === "history"}
                      onClick={() =>
                        setSection(
                          sections[
                            Math.min(
                              4,
                              sections.findIndex((s) => s.id === section) + 1,
                            )
                          ]!.id,
                        )
                      }
                    >
                      {t("template.next")}
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="primary"
                  loading={busy}
                  disabled={
                    disabled ||
                    !ordered.length ||
                    !Number.isFinite(Number(discount)) ||
                    Number(discount) < 0 ||
                    Number(discount) > 100 ||
                    (!!insurance && !authorization.trim())
                  }
                  onClick={() => {
                    if (section !== "review") {
                      setSection("review");
                      return;
                    }
                    request({
                      action: "invoice",
                      orderIds: ordered.map((o) => o.id),
                      discountBps: Math.round(Number(discount) * 100),
                      insuranceId: insurance,
                      authorization,
                      note,
                    });
                  }}
                >
                  {t(
                    section === "review"
                      ? "template.clinic.issueInvoice"
                      : "template.clinic.reviewBill",
                  )}
                </Button>
              </div>
            </div>
          }
          renderSection={(item) => (
            <div className="p-4">
              {item.id === "patient" ? (
                <ClinicPanel title="template.clinic.patientContext">
                  <DescriptionList
                    items={[
                      "mrn",
                      "birthDate",
                      "gender",
                      "mobile",
                      "email",
                      "nationality",
                    ].map((id) => ({
                      id,
                      label: "template.clinical." + id,
                      value:
                        id === "mrn"
                          ? data.patient.mrn
                          : id === "birthDate"
                            ? format.date(String(data.patient.values[id] ?? ""))
                            : id === "gender"
                              ? t(
                                  "template.clinical." +
                                    data.patient.values[id],
                                )
                              : String(data.patient.values[id] || "—"),
                    }))}
                  />
                  <ClinicLedgerTable
                    preferences={preferences}
                    headers={[
                      "template.clinic.date",
                      "template.clinic.service",
                      "template.clinic.doctor",
                      "template.clinic.status",
                    ]}
                    rows={data.context.map((row) => ({
                      id: row.id,
                      cells: [
                        format.dateTime(row.date),
                        <div>
                          <strong>{t(row.title)}</strong>
                          <p>{t(row.detail)}</p>
                        </div>,
                        row.provider || "—",
                        t("template.clinical." + row.status),
                      ],
                    }))}
                  />
                </ClinicPanel>
              ) : item.id === "orders" ? (
                <ClinicOrders
                  {...shared}
                  selected={selected}
                  onSelect={edit(setSelected)}
                  service={service}
                  onService={edit(setService)}
                  quantity={quantity}
                  onQuantity={edit(setQuantity)}
                  doctor={doctor}
                  onDoctor={edit(setDoctor)}
                />
              ) : item.id === "review" ? (
                <ClinicInvoiceReview
                  {...shared}
                  selected={selected}
                  discount={discount}
                  onDiscount={edit(setDiscount)}
                  insurance={insurance}
                  onInsurance={edit(setInsurance)}
                  authorization={authorization}
                  onAuthorization={edit(setAuthorization)}
                  note={note}
                  onNote={edit(setNote)}
                />
              ) : item.id === "payments" ? (
                <ClinicPayments
                  {...shared}
                  invoiceId={invoiceId}
                  onInvoice={edit(setInvoiceId)}
                  amount={amount}
                  onAmount={edit(setAmount)}
                  method={method}
                  onMethod={edit(setMethod)}
                  reference={reference}
                  onReference={edit(setReference)}
                  onPrint={(id) => setBillScreen({ id, mode: "view" })}
                  onEdit={(id) => setBillScreen({ id, mode: "edit" })}
                />
              ) : (
                <ClinicPanel title="template.clinic.history">
                  <ClinicLedgerTable
                    preferences={preferences}
                    headers={[
                      "template.clinic.date",
                      "template.clinic.event",
                      "template.clinic.actor",
                      "template.clinic.reference",
                    ]}
                    rows={data.state.history.map((h) => ({
                      id: h.id,
                      cells: [
                        format.dateTime(h.at),
                        t(h.messageKey),
                        h.actor,
                        h.reference,
                      ],
                    }))}
                  />
                </ClinicPanel>
              )}
            </div>
          )}
        />
      )}
      <Modal
        open={!!confirm}
        onClose={() => {
          if (!busy) setConfirm(null);
        }}
        title={t("template.clinic.confirm")}
        footer={
          <>
            <Button disabled={busy} onClick={() => setConfirm(null)}>
              {t("Cancel")}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={busy}
              onClick={() => void execute(confirm ?? undefined)}
            >
              {t("template.clinical.confirm")}
            </Button>
          </>
        }
      >
        <p>{t("template.clinic.confirm." + (confirm?.action ?? "invoice"))}</p>
        {confirm?.action === "payment" ? (
          <strong>{money(confirm.amount)}</strong>
        ) : null}
      </Modal>
    </div>
  );
}
