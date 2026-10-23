"use client";
import React from "react";
import {Button, Badge} from '@pepbits/ui';
import {CardGrid, DescriptionList, Tabs, PresentationProvider, RecoveryNotice, failureFromError} from '@pepbits/components';
import {effectivePreferences} from '@pepbits/preferences';
import {ClinicalRequestFailure, type ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
import {type RegistrationAdapter} from '../../adapters/op-registration';
import type { PreferenceHost } from "../preference-choice";
import { ClinicalLoading } from "../clinical-templates/shared";

import {
  registrationFieldValue,
  RegistrationChoices,
  RegistrationPatientStrip,
  RegistrationProgress,
  RegistrationFields,
  RegistrationPanel,
  RegistrationPatientSearch,
  RegistrationContext,
  rk,
} from "./components";
import { RegistrationCare } from "./care";

import styles from "./registration.module.css";
import { useRegistrationController } from "./use-registration";
import { RegistrationDialogs } from "./dialogs";
export interface RegistrationWorkspaceProps extends PreferenceHost {
  adapter: RegistrationAdapter;
  patients: ClinicalTemplateAdapter;
  scopeKey: string;
  patientId?: string;
}
export function RegistrationWorkspace(props: RegistrationWorkspaceProps) {
  const preferences = props.preferencePolicy
    ? effectivePreferences(props.preferences, props.preferencePolicy)
    : props.preferences;
  return (
    <PresentationProvider value={preferences}>
      <RegistrationController
        key={props.scopeKey}
        {...props}
        preferences={preferences}
      />
    </PresentationProvider>
  );
}
function RegistrationController(props: RegistrationWorkspaceProps) {
  const state = useRegistrationController(props);
  const {
    t,
    config,
    view,
    setView,
    step,
    setStep,
    tab,
    setTab,
    query,
    setQuery,
    page,
    setPage,
    filter,
    setFilter,
    busy,
    dirty,
    error,
    errors,
    notice,
    setNotice,
    setPatientModal,
    documents,
    setDocuments,
    pending,
    content,
    format,
    pageSize,
    patients,
    active,
    disabled,
    change,
    selectPatient,
    move,
    command,
    openList,
    ask,
  } = state;
  if (!config.value)
    return <ClinicalLoading error={config.error} retry={config.retry} />;
  return (
    <div
      className={styles.workspace}
      data-op-registration
      data-density={props.preferences.density}
      data-stage-active={step > 1}
      data-tour="op-registration"
    >
      <div className={styles.heading}>
        <div>
          <h1>
            {t(rk(active ? "careHeading" : "heading"))}
            <span className="text-[var(--primary)]">.</span>
          </h1>
          <p className={styles.note}>{t(rk("subtitle"))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void openList("worklist")}>
            {t(rk("worklist"))}
          </Button>
          <Button disabled={busy} onClick={() => void openList("appointments")}>
            {t(rk("appointments"))}
          </Button>
        </div>
      </div>
      <RegistrationProgress
        step={step}
        registered={active}
        busy={busy}
        onStep={move}
      />
      {view && step > 1 ? (
        <RegistrationPatientStrip
          patient={view.patient}
          format={format}
          status={view.record.status}
        />
      ) : null}
      <div
        ref={content}
        className={styles.scroll}
        data-tour="op-registration-form"
      >
        {notice ? (
          <div role="status" className={styles.notice}>
            {t(notice)}
          </div>
        ) : null}
        {Object.keys(errors).length ? (
          <div role="alert" className={styles.error}>
            {[...new Set(Object.values(errors))].map((key) => (
              <p key={key}>{t(key)}</p>
            ))}
          </div>
        ) : null}
        {error ? (
          <RecoveryNotice
            failure={failureFromError(error)}
            onRetry={() =>
              pending.current
                ? void command(pending.current.action)
                : view
                  ? void selectPatient(
                      view.record.patientId,
                      view.record.id,
                      true,
                    )
                  : patients.retry()
            }
          />
        ) : null}
        {error instanceof ClinicalRequestFailure &&
        error.status === 409 &&
        view ? (
          <Button
            onClick={() =>
              void selectPatient(view.record.patientId, view.record.id, true)
            }
          >
            {t(rk("reload"))}
          </Button>
        ) : null}
        <div className={styles.columns}>
          <div className={styles.main}>
            {step === 1 ? (
              <RegistrationPanel
                title={rk("findPatient")}
                subtitle={rk("searchHint")}
                actions={
                  <Button
                    disabled={disabled || dirty}
                    onClick={() => setPatientModal("new")}
                  >
                    {t(rk("newPatient"))}
                  </Button>
                }
              >
                {patients.value ? (
                  <RegistrationPatientSearch
                    filters={
                      <Tabs
                        variant="segmented"
                        value={filter}
                        onChange={(value) => {
                          setFilter(value);
                          setPage(1);
                          if (value === "appointments")
                            void openList("appointments");
                        }}
                        items={[
                          {
                            id: "appointments",
                            label: rk("appointmentPatients"),
                          },
                          { id: "all", label: rk("allPatients") },
                          { id: "walk-in", label: rk("walkIn") },
                        ]}
                      />
                    }
                    rows={patients.value.rows}
                    query={query}
                    onQuery={(q) => {
                      setQuery(q);
                      setPage(1);
                    }}
                    onSelect={(id) => void selectPatient(id)}
                    page={page}
                    total={patients.value.total}
                    pageSize={pageSize}
                    onPage={setPage}
                    busy={busy || !!pending.current}
                    format={format}
                  />
                ) : (
                  <ClinicalLoading
                    error={patients.error}
                    retry={patients.retry}
                  />
                )}
              </RegistrationPanel>
            ) : null}
            {step === 2 && view ? (
              <RegistrationPanel title={rk("visitTitle")} subtitle={rk("visitDescription")}>
                <RegistrationChoices
                  field="source"
                  config={view.config}
                  value={view.record.values.source}
                  disabled={disabled || !!pending.current}
                  onChange={(value) => change("source", value)}
                />
                <RegistrationFields
                  group="visit"
                  showTitle={false}
                  config={view.config}
                  values={view.record.values}
                  onChange={change}
                  disabled={disabled || !!pending.current}
                  errors={errors}
                />
                <RegistrationFields
                  group="continuity"
                  config={view.config}
                  values={view.record.values}
                  onChange={change}
                  disabled={disabled || !!pending.current}
                  errors={errors}
                />
              </RegistrationPanel>
            ) : null}
            {step === 3 && view ? (
              <RegistrationPanel
                title={rk("coverageTitle")}
                subtitle={rk("coverageDescription")}
              >
                <RegistrationChoices
                  field="responsibility"
                  config={view.config}
                  value={view.record.values.responsibility}
                  disabled={disabled || !!pending.current}
                  onChange={(value) => change("responsibility", value)}
                />
                <RegistrationFields
                  group="coverage"
                  config={view.config}
                  values={view.record.values}
                  onChange={change}
                  disabled={disabled || !!pending.current}
                  errors={errors}
                />
                <div
                  className="flex items-center gap-3"
                  hidden={view.record.values.responsibility !== "insurance"}
                >
                  <Badge>{t(rk(String(view.record.values.eligibility)))}</Badge>
                  <Button
                    disabled={disabled}
                    onClick={() => void command("eligibility")}
                  >
                    {t(rk("eligibility"))}
                  </Button>
                </div>
                <RegistrationFields
                  group="consent"
                  config={view.config}
                  values={view.record.values}
                  onChange={change}
                  disabled={disabled || !!pending.current}
                  errors={errors}
                />
              </RegistrationPanel>
            ) : null}
            {step === 4 && view ? (
              <RegistrationPanel
                title={rk("reviewTitle")}
                subtitle={rk("reviewDescription")}
              >
                <CardGrid columns={2}>
                  {["visit", "continuity", "coverage", "consent"].map((id) => (
                    <RegistrationPanel
                      key={id}
                      title={view.config.groups.find((g) => g.id === id)!.title}
                      actions={
                        <Button
                          onClick={() =>
                            move(id === "visit" || id === "continuity" ? 2 : 3)
                          }
                        >
                          {t("template.clinical.edit")}
                        </Button>
                      }
                    >
                      <DescriptionList
                        layout="rows"
                        items={view.config.groups
                          .find((g) => g.id === id)!
                          .fields.filter(
                            (f) =>
                              view.record.values[f.id] !== "" &&
                              view.record.values[f.id] !== false,
                          )
                          .map((f) => ({
                            id: f.id,
                            label: f.label,
                            value: registrationFieldValue(
                              f,
                              view.record.values[f.id],
                              view.config,
                              format,
                              t,
                            ),
                          }))}
                      />
                    </RegistrationPanel>
                  ))}
                </CardGrid>
                <h3 className="font-bold">{t(rk("routing"))}</h3>
                <div className="flex gap-3">
                  {["nursing", "direct"].map((value) => (
                    <Button
                      disabled={disabled}
                      variant={
                        view.record.values.routing === value
                          ? "primary"
                          : "secondary"
                      }
                      key={value}
                      onClick={() => change("routing", value)}
                    >
                      {t(rk(value === "nursing" ? "nursingRoute" : "direct"))}
                    </Button>
                  ))}
                </div>
              </RegistrationPanel>
            ) : null}
            {step === 5 && view ? (
              <RegistrationCare
                view={view}
                tab={tab}
                onTab={setTab}
                format={format}
                change={change}
                busy={disabled || !!pending.current}
                errors={errors}
                act={(action, payload) => void command(action, payload)}
                ask={ask}
              />
            ) : null}
          </div>
          <aside className={styles.aside}>
            {step === 1 ? (
              <RegistrationPanel
                title={rk("verify")}
                actions={
                  view ? (
                    <Button
                      disabled={disabled || dirty}
                      onClick={() => setPatientModal("edit")}
                    >
                      {t(rk("editPatient"))}
                    </Button>
                  ) : null
                }
              >
                {view ? (
                  <>
                    <RegistrationPatientStrip
                      patient={view.patient}
                      format={format}
                    />
                    <RegistrationFields
                      group="identity"
                      config={view.config}
                      values={view.record.values}
                      onChange={change}
                      disabled={disabled || !!pending.current}
                      errors={errors}
                    />
                  </>
                ) : (
                  <div className={styles.verificationEmpty}>
                    <span className={styles.verificationIcon} aria-hidden>
                      ✓
                    </span>
                    <h3>{t(rk("verify"))}</h3>
                    <p className={styles.note}>{t(rk("verifyHint"))}</p>
                  </div>
                )}
              </RegistrationPanel>
            ) : null}
            {view && step !== 1 ? (
              <RegistrationContext
                config={view.config}
                record={view.record}
                format={format}
              />
            ) : null}
            {view && step === 2 ? (
              <RegistrationPanel title={rk("assistanceGroup")}>
                <RegistrationFields
                  group="assistanceGroup"
                  showTitle={false}
                  config={view.config}
                  values={view.record.values}
                  onChange={change}
                  disabled={disabled || !!pending.current}
                />
              </RegistrationPanel>
            ) : null}
            <div className={styles.notice}>{t(rk("demo"))}</div>
          </aside>
        </div>
      </div>
      <div className={styles.footer} data-tour="op-registration-actions">
        <div>
          <Button
            variant="ghost"
            disabled={disabled || !view}
            onClick={() => ask("urgent")}
          >
            {t(rk("urgentHandoff"))}
          </Button>
          {view?.record.id ? (
            <p className={styles.note}>
              {t(rk("saved"))}: {format.dateTime(view.record.updatedAt)}
            </p>
          ) : null}
        </div>
        <div className={styles.footerActions}>
          {!active ? (
            <>
              {step > 1 ? (
                <Button disabled={busy} onClick={() => move(step - 1)}>
                  {t(rk("back"))}
                </Button>
              ) : null}
              <Button
                disabled={
                  disabled || !view || view.config.draftsEnabled === false
                }
                onClick={() => void command("draft")}
              >
                {t(rk("saveDraft"))}
              </Button>
              {view?.record.id ? (
                <Button disabled={disabled} onClick={() => ask("discard")}>
                  {t(rk("discard"))}
                </Button>
              ) : null}
              <Button
                variant="primary"
                disabled={disabled || !view}
                onClick={() =>
                  step < 4 ? move(step + 1) : void command("checkin")
                }
              >
                {t(rk(step < 4 ? "continue" : "checkin"))}
              </Button>
            </>
          ) : (
            <>
              <Button
                disabled={busy || dirty || !!pending.current}
                onClick={() => {
                  setView(null);
                  setStep(1);
                  setNotice("");
                }}
              >
                {t(rk("newRegistration"))}
              </Button>
              <Button
                disabled={busy || dirty}
                onClick={() => setDocuments(true)}
              >
                {t(rk("documents"))}
              </Button>
              {view?.record.status !== "completed" ? (
                <Button
                  variant="primary"
                  disabled={disabled}
                  onClick={() =>
                    tab === "checkout" ? ask("complete") : setTab("checkout")
                  }
                >
                  {t(rk(tab === "checkout" ? "complete" : "checkout"))}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
      <RegistrationDialogs state={state} props={props} />
    </div>
  );
}
