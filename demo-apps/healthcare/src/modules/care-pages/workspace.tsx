"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {Button, Input, SearchInput, Select, Textarea, Badge} from '@pepbits/ui';
import {Modal, Tabs, PresentationProvider, RecoveryNotice, failureFromError, DescriptionList} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {effectivePreferences} from '@pepbits/preferences';
import {createFormatters} from '@pepbits/i18n';
import {type CareView, type CareCommand, type CareValues, type CarePageId} from '../../domain/care-pages';
import {ClinicalRequestFailure} from '../../adapters/clinical-templates';
import {type CareAdapter} from '../../adapters/care-pages';
import type { PreferenceHost } from "../preference-choice";
import { ClinicalLoading } from "../clinical-templates/shared";
import {
  CarePanel,
  CareFields,
  CareSteps,
  CareHero,
  CareChoices,
  CareBedBoard,
  CareVerification,
  CareReview,
} from "./components";
import styles from "./care.module.css";
export interface CareWorkspaceProps extends PreferenceHost {
  adapter: CareAdapter;
  pageId: CarePageId;
  scopeKey: string;
}
export function CareWorkspace(props: CareWorkspaceProps) {
  const preferences = props.preferencePolicy
    ? effectivePreferences(props.preferences, props.preferencePolicy)
    : props.preferences;
  return (
    <PresentationProvider value={preferences}>
      <CareController
        key={props.scopeKey + props.pageId}
        {...props}
        preferences={preferences}
      />
    </PresentationProvider>
  );
}
function CareController(props: CareWorkspaceProps) {
  const { t } = useLocalization(),
    [view, setView] = useState<CareView | null>(null),
    [values, setValues] = useState<CareValues>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState("overview"),
    [section, setSection] = useState("complaint"),
    [modal, setModal] = useState(""),
    [dialogValues, setDialogValues] = useState<CareValues>({}),
    [orderKind, setOrderKind] = useState("medication");
  const pending = useRef<CareCommand | null>(null),
    lock = useRef(false),
    alive = useRef(true),
    format = useMemo(
      () => createFormatters(props.preferences),
      [props.preferences],
    );
  const record = view?.record,
    def = view?.definition,
    consult = def?.kind === "consultation",
    admitted = record?.status === "admitted" || record?.status === "completed",
    readOnly = record?.status === "signed" || record?.status === "completed";
  const disabled =
    busy ||
    !!pending.current ||
    readOnly ||
    props.preferencesAvailable === false;
  async function run(input: CareCommand) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await props.adapter.command(input);
      if (!alive.current) return;
      setView(result);
      setValues(result.record?.values ?? {});
      setDirty(false);
      pending.current = null;
      setModal("");
      setNotice(input.action === "load" ? "" : "care.saved");
    } catch (e) {
      if (alive.current) {
        setError(e);
        if (
          e instanceof ClinicalRequestFailure &&
          [400, 403, 404, 409, 422].includes(e.status)
        )
          pending.current = null;
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const load = (id?: string) =>
    run({ pageId: props.pageId, action: "load", id });
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [props.adapter]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function command(action: string, extra: Partial<CareCommand> = {}) {
    const input: CareCommand = {
      pageId: props.pageId,
      action,
      operationId: crypto.randomUUID(),
      ...(record ? { id: record.id, version: record.version, values } : {}),
      ...extra,
    };
    pending.current = input;
    void run(input);
  }
  function change(k: string, v: string | boolean) {
    if (disabled) return;
    setValues((s) => ({ ...s, [k]: v }));
    setDirty(true);
  }
  function jump(id: string) {
    setSection(id);
    document
      .getElementById("care-" + id)
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  const fieldsError =
    error instanceof ClinicalRequestFailure ? error.fieldErrors : {};
  if (!view || !def)
    return <ClinicalLoading error={error} retry={() => void load()} />;
  const tools = def.tools;
  const activeGroups = def.groups.filter((g) =>
    consult || admitted
      ? consult || g.tab === tab
      : !g.tab && g.step === (record?.step ?? 1),
  );
  const choices = (id: string) => {
    const c = tools.choices.find((c) => c.group === id);
    return c ? (
      <CareChoices
        multiple={c.multiple}
        label={c.label}
        options={c.options}
        value={String(values[c.field] ?? "")}
        change={(v) => change(c.field, v)}
        disabled={!record || disabled}
      />
    ) : null;
  };
  const orderList = (
    <div className={styles.stack}>
      {record?.orders
        .filter((o) => o.status !== "cancelled")
        .map((o) => (
          <div key={o.id}>
            <strong>{String(o.values.name)}</strong>
            <p className={styles.note}>
              {t("care.order." + o.kind)} · {String(o.values.dose ?? "")}{" "}
              {String(o.values.priority ?? "")}
            </p>
            <Badge>{t("care.status." + o.status)}</Badge>
            <Button
              disabled={disabled}
              onClick={() => command("removeOrder", { orderId: o.id })}
            >
              {t("Remove")}
            </Button>
          </div>
        ))}
      {(!consult || def.ordersEnabled) && record ? (
        <Button
          disabled={disabled}
          onClick={() => {
            setDialogValues({});
            setModal("order");
          }}
        >
          {t("care.addOrder")}
        </Button>
      ) : null}
    </div>
  );
  return (
    <div
      className={styles.workspace}
      data-density={props.preferences.density}
      data-care-page={props.pageId}
      data-tour="care-page"
    >
      <div className={styles.heading}>
        <div>
          <h1>{t(def.title)}</h1>
          <p className={styles.note}>
            {t(
              consult
                ? "care.consultHint"
                : def.kind === "emergency"
                  ? "care.emergencyHint"
                  : "care.admissionHint",
            )}
          </p>
        </div>
        <Badge tone="warning">{t("care.synthetic")}</Badge>
      </div>
      {error ? (
        <RecoveryNotice
          failure={failureFromError(error)}
          onRetry={() =>
            pending.current ? void run(pending.current) : void load(record?.id)
          }
          onReturn={() => {
            pending.current = null;
            setError(null);
          }}
          onReload={() => setModal("reload")}
          onSignIn={() => window.location.reload()}
        />
      ) : null}
      <CareHero record={record ?? null} />
      {!consult && !admitted ? (
        <CareSteps
          steps={def.steps}
          value={record?.step ?? 1}
          disabled={!record || disabled}
          change={(step) => command("step", { step })}
        />
      ) : null}
      {admitted ? (
        <Tabs items={tools.tabs} value={tab} onChange={setTab} />
      ) : null}
      {consult ? (
        <CarePanel title="care.configuration">
          <CareFields
            group={tools.configuration}
            values={values}
            change={change}
            disabled={!record || disabled}
          />
        </CarePanel>
      ) : null}
      <div className={`${styles.layout} ${consult ? styles.consultation : ""}`}>
        {consult ? (
          <nav className={styles.rail} aria-label={t("care.sections")}>
            {def.groups.map((g) => (
              <Button
                variant={section === g.id ? "primary" : "ghost"}
                key={g.id}
                onClick={() => jump(g.id)}
              >
                {t(g.navigationLabel??g.title)}
              </Button>
            ))}
          </nav>
        ) : null}
        <div className={styles.stack}>
          {!record || (!consult && !admitted && record.step === 1) ? (
            <CarePanel title="care.patientSearch">
              <SearchInput
                aria-label={t("care.patientSearch")}
                value={query}
                onChange={setQuery}
              />
              <div className={styles.choices}>
                {view.patients
                  .filter((p) =>
                    `${p.id} ${p.name} ${p.dob} ${p.mobile}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .slice(0, props.preferences.pageSize)
                  .map((p) => (
                    <Button
                      key={p.id}
                      disabled={busy || dirty || !!pending.current}
                      onClick={() =>
                        command("create", {
                          id: undefined,
                          version: undefined,
                          values: undefined,
                          patientId: p.id,
                        })
                      }
                    >
                      {p.name} · {p.id}
                    </Button>
                  ))}
              </div>
              <Button
                disabled={busy || dirty}
                onClick={() => {
                  setDialogValues({});
                  setModal("patient");
                }}
              >
                {t("care.newPatient")}
              </Button>
              {def.kind === "emergency" ? (
                <Button
                  disabled={busy || dirty}
                  onClick={() =>
                    command("create", {
                      id: undefined,
                      values: undefined,
                      version: undefined,
                      patient: {
                        name: "DEMO unidentified patient",
                        dob: "",
                        sex: "",
                        mobile: "",
                        temporary: true,
                      },
                    })
                  }
                >
                  {t("care.unidentified")}
                </Button>
              ) : null}
            </CarePanel>
          ) : null}
          {activeGroups.map((g) => (
            <CarePanel key={g.id} title={g.title} id={"care-" + g.id}>
              {choices(g.id)}
              <CareFields
                group={g}
                values={values}
                change={change}
                disabled={!record || disabled}
                errors={fieldsError}
              />
              {g.id === "g2" && def.kind === "emergency" ? (
                <Button
                  disabled={!record || disabled || record.status !== "draft"}
                  onClick={() => command("open")}
                >
                  {t("care.openEncounter")}
                </Button>
              ) : null}
              {g.id === "g10" && def.kind === "inpatient" && record ? (
                <CareBedBoard
                  beds={view.beds}
                  record={record}
                  disabled={disabled}
                  reserve={(bedId) => command("reserve", { bedId })}
                />
              ) : null}
              {g.tab === "orders" ||
              (g.id === "plan" && def.ordersEnabled) ||
              (g.id === "g13" && def.kind === "emergency")
                ? orderList
                : null}
              {g.tab === "overview" ? (
                <DescriptionList
                  items={
                    record?.events.map((e, i) => ({
                      id: String(i),
                      label: e.action,
                      value: format.dateTime(e.at),
                    })) ?? []
                  }
                />
              ) : null}
            </CarePanel>
          ))}
          {record &&
          ((record.step === 5 && !consult) || consult || admitted) ? (
            <CarePanel title="care.review">
              <CareVerification
                values={values}
                change={change}
                disabled={!!disabled}
              />
              {!consult ? (
                <>
                  <Select
                    label="care.disposition"
                    value={String(values.disposition ?? "")}
                    onChange={(e) => change("disposition", e.target.value)}
                    disabled={!!disabled}
                    options={tools.dispositions}
                  />
                  <Textarea
                    label="care.pendingPlan"
                    value={String(values.pendingPlan ?? "")}
                    onChange={(e) => change("pendingPlan", e.target.value)}
                    disabled={!!disabled}
                  />
                </>
              ) : null}
            </CarePanel>
          ) : null}
        </div>
        <aside className={styles.aside}>
          <CarePanel title="care.snapshot">
            <DescriptionList
              items={[
                {
                  id: "patient",
                  label: "care.patient",
                  value: record?.patient.name ?? t("care.choosePatient"),
                },
                {
                  id: "dob",
                  label: "care.dob",
                  value: record?.patient.dob
                    ? format.date(record.patient.dob)
                    : "—",
                },
                {
                  id: "status",
                  label: "Status",
                  value: t("care.status." + (record?.status ?? "draft")),
                },
                {
                  id: "saved",
                  label: "care.lastSaved",
                  value: record ? format.dateTime(record.updatedAt) : "—",
                },
              ]}
            />
            <p className={styles.note}>{t("care.separateStates")}</p>
          </CarePanel>
          {consult ? (
            <CarePanel title="care.orders">{orderList}</CarePanel>
          ) : null}
          <CarePanel title="care.records">
            <Select
              label="care.restore"
              value={record?.id ?? ""}
              disabled={busy || dirty || !!pending.current}
              options={[
                { value: "", label: "Select…" },
                ...view.records.map((r) => ({
                  value: r.id,
                  label: r.patient.name + " · " + format.dateTime(r.updatedAt),
                })),
              ]}
              onChange={(e) => {
                if (e.target.value) void load(e.target.value);
              }}
            />
            <p className={styles.note}>{t("care.saveBeforeSwitch")}</p>
          </CarePanel>
        </aside>
      </div>
      <div className={styles.actions}>
        <p role="status" className={styles.note}>
          {t(dirty ? "care.unsaved" : notice || "care.apiHint")}
        </p>
        <div>
          <Button
            disabled={!record || !!disabled}
            onClick={() => command("save")}
          >
            {t("Save draft")}
          </Button>
          <Button
            disabled={!record || busy}
            onClick={() => setModal("preview")}
          >
            {t("care.preview")}
          </Button>
          {!consult && !admitted && record ? (
            <>
              <Button
                disabled={!!disabled || record.step <= 1}
                onClick={() => command("step", { step: record.step - 1 })}
              >
                {t("Back")}
              </Button>
              {record.step < 5 ? (
                <Button
                  variant="primary"
                  disabled={!!disabled}
                  onClick={() => command("step", { step: record.step + 1 })}
                >
                  {t("Continue")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={!!disabled}
                  onClick={() => setModal("confirm")}
                >
                  {t(def.kind === "inpatient" ? "care.admit" : "care.complete")}
                </Button>
              )}
            </>
          ) : null}
          {(consult || admitted) && !readOnly ? (
            <Button
              variant="primary"
              disabled={!record || !!disabled}
              onClick={() => setModal("confirm")}
            >
              {t(consult ? "care.sign" : "care.complete")}
            </Button>
          ) : null}
          {readOnly ? (
            <Button
              onClick={() => {
                setDialogValues({});
                setModal("addendum");
              }}
            >
              {t("care.addendum")}
            </Button>
          ) : null}
        </div>
      </div>
      <Modal
        open={!!modal}
        onClose={() => {
          if (!busy) setModal("");
        }}
        title={
          modal === "order"
            ? "care.addOrder"
            : modal === "patient"
              ? "care.newPatient"
              : modal === "preview"
                ? "care.preview"
                : modal === "addendum"
                  ? "care.addendum"
                  : "Confirm"
        }
        size={modal === "preview" ? "xl" : "lg"}
        footer={
          <>
            <Button disabled={busy} onClick={() => setModal("")}>
              {t("Cancel")}
            </Button>
            {modal === "preview" ? null : (
              <Button
                disabled={busy}
                variant="primary"
                onClick={() => {
                  if (modal === "reload") {
                    pending.current = null;
                    void load(record?.id);
                  }
                  if (modal === "confirm")
                    command(
                      consult
                        ? "sign"
                        : def.kind === "inpatient" && !admitted
                          ? "admit"
                          : "complete",
                    );
                  if (modal === "patient")
                    command("create", {
                      id: undefined,
                      values: undefined,
                      version: undefined,
                      patient: {
                        name: String(dialogValues.name ?? ""),
                        dob: String(dialogValues.dob ?? ""),
                        sex: String(dialogValues.sex ?? ""),
                        mobile: String(dialogValues.mobile ?? ""),
                      },
                    });
                  if (modal === "order")
                    command("order", {
                      order: { kind: orderKind, values: dialogValues },
                    });
                  if (modal === "addendum")
                    command("addendum", {
                      text: String(dialogValues.text ?? ""),
                    });
                }}
              >
                {t("Confirm")}
              </Button>
            )}
          </>
        }
      >
        {error ? (
          <p role="alert">
            {t(
              error instanceof ClinicalRequestFailure
                ? Object.values(error.fieldErrors).join(" ")
                : "care.failed",
            )}
          </p>
        ) : null}
        {modal === "preview" ? (
          <CareReview groups={def.groups} values={values} />
        ) : modal === "patient" ? (
          <CareFields
            group={tools.patient}
            values={dialogValues}
            change={(k, v) => setDialogValues((s) => ({ ...s, [k]: v }))}
            disabled={busy}
          />
        ) : modal === "order" ? (
          <>
            <Tabs
              items={tools.orderTypes}
              value={orderKind}
              onChange={setOrderKind}
            />
            <CareFields
              group={tools.order}
              values={dialogValues}
              change={(k, v) => setDialogValues((s) => ({ ...s, [k]: v }))}
              disabled={busy}
            />
          </>
        ) : modal === "addendum" ? (
          <Textarea
            label="care.addendum"
            value={String(dialogValues.text ?? "")}
            onChange={(e) => setDialogValues({ text: e.target.value })}
          />
        ) : (
          <p>
            {t(modal === "reload" ? "care.reloadWarning" : "care.confirmHint")}
          </p>
        )}
      </Modal>
    </div>
  );
}
