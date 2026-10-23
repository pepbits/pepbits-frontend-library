'use client';
import {usePreferences} from '@pepbits/preferences/react';
import type {UserPreferences} from '@pepbits/preferences';
import {useFormatters} from '../screen-host';
import React, { useState, useRef, useEffect, useMemo } from "react";
import {Card,CardHeader,CardTitle,CardContent,CardGrid,RecoveryNotice,failureFromError,PresentationProvider} from '@pepbits/components';
import {Button,Select,Input,Checkbox} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {
  type IdentityLibrary,
  type IdentityCommand,
  type IdentityPolicy,
  type IdentityAttempt,
} from "@pepbits/data/identity-devices";
import {
  WorkflowRequestFailure,
  type IdentityAdapter,
} from "@pepbits/data";
import { IdentityResultPanel, IdentityHistory } from "./components";
export interface IdentityWorkspaceProps {
  adapter: IdentityAdapter;
  scopeKey: string;
  mode: "card" | "passport" | "biometric";
  stationId: string;
}
export function IdentityDeviceWorkspace(props: IdentityWorkspaceProps) {
  const {preferences, preferencesAvailable} = usePreferences();
  return (
    <PresentationProvider value={preferences}>
      <Workspace
        key={
          props.scopeKey + props.mode + (props.stationId)
        }
        {...props}
        preferences={preferences} preferencesAvailable={preferencesAvailable}
      />
    </PresentationProvider>
  );
}
function Workspace(props: IdentityWorkspaceProps & {preferences:UserPreferences;preferencesAvailable:boolean}) {
  const { t } = useLocalization(),
    [data, setData] = useState<IdentityLibrary>(),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [device, setDevice] = useState(""),
    [subject, setSubject] = useState(""),
    [consent, setConsent] = useState(false),
    [scenario, setScenario] = useState("match"),
    [attempt, setAttempt] = useState<IdentityAttempt>(),
    [policy, setPolicy] = useState<IdentityPolicy>(),
    [page, setPage] = useState(1),
    [example, setExample] = useState(false);
  const station = props.stationId,
    alive = useRef(true),
    pending = useRef<IdentityCommand | undefined>(undefined),
    format = useFormatters();
  async function load() {
    try {
      const d = await props.adapter.library(station);
      if (!alive.current) return;
      setData(d);
      setPolicy(d.policy);
      setDevice(d.defaultDevice);
      const resumed = d.attempts.find((x) => x.status === "pending");
      setAttempt((a) => (a ? d.attempts.find((x) => x.id === a.id) : resumed));
      if (resumed) {
        setConsent(true);
        setSubject(resumed.subjectId);
        setDevice(resumed.deviceId);
      }
    } catch (e) {
      if (alive.current) setError(e);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [props.adapter, station]);
  const bio = props.mode === "biometric";
  const devices =
    data?.devices.filter((d) =>
      bio
        ? ["face", "fingerprint"].includes(d.method)
        : props.mode === "passport"
          ? d.method === "passport"
          : ["card", "eid"].includes(d.method),
    ) ?? [];
  const resolved =
    attempt?.status === "pending"
      ? attempt.deviceId
      : data?.policy.lockedDevice ||
        (devices.some((d) => d.id === device)
          ? device
          : (devices[0]?.id ?? ""));
  const blocked =
    !!data &&
    (!devices.some((d) => d.id === resolved) ||
      (bio && !data.policy.biometricsEnabled) ||
      (!!data.policy.lockedDevice && resolved !== data.policy.lockedDevice));
  const active = attempt?.status === "pending";
  const disabled =
    busy || !!pending.current || props.preferencesAvailable === false;
  async function run(input: IdentityCommand) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    pending.current = input;
    try {
      const result = await props.adapter.command<IdentityAttempt>(input);
      if (!alive.current) return;
      pending.current = undefined;
      if (["start", "simulate", "manual", "cancel"].includes(input.action))
        setAttempt(result);
      await load();
      if (["simulate", "manual", "cancel"].includes(input.action))
        setConsent(false);
    } catch (e) {
      if (alive.current) {
        setError(e);
        if (e instanceof WorkflowRequestFailure && e.status < 500)
          pending.current = undefined;
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function submit(input: Omit<IdentityCommand, "stationId">) {
    void run({
      ...input,
      stationId: station,
      operationId: crypto.randomUUID(),
    });
  }
  useEffect(() => {
    if (!active || !attempt) return;
    const delay = Math.max(0, Date.parse(attempt.expiresAt) - Date.now());
    const timer = setTimeout(
      () => {
        setAttempt((a) =>
          a?.status === "pending" ? { ...a, status: "expired" } : a,
        );
        void load();
      },
      Math.min(delay, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [active, attempt?.id, attempt?.expiresAt]);
  const size = Number(props.preferences.pageSize),
    currentPage = Math.min(
      page,
      Math.max(1, Math.ceil((data?.attempts.length ?? 0) / size)),
    );
  return (
    <div
      className="space-y-4"
      data-identity-library
      data-tour="identity-devices"
    >
      <h2 className="text-xl font-semibold">{t(props.mode === "biometric" ? "identity.patient-biometric-verification" : props.mode === "passport" ? "identity.passport-scanner" : "identity.identity-card-readers")}</h2>
      <p>{t("identity.notice")}</p>
      <Button
        disabled={disabled}
        onClick={() => {
          setError(undefined);
          void load();
        }}
      >
        {t("identity.refresh")}
      </Button>
      <Button onClick={() => setExample(!example)}>
        {t("identity.example")}
      </Button>
      {example ? (
        <pre className="overflow-auto p-4">
          <code>{`Supply an authenticated adapter and an identity scope. Wrap this workspace in PreferenceHost and ScreenHostProvider. Device drivers remain host-owned through @pepbits/platform/devices.`}</code>
        </pre>
      ) : null}
      {error ? (
        <>
          <RecoveryNotice
            failure={failureFromError(error)}
            preservesValues
            busy={busy}
            onRetry={() =>
              pending.current ? void run(pending.current) : void load()
            }
            onReturn={() => {
              pending.current = undefined;
              setError(undefined);
            }}
          />
          {error instanceof WorkflowRequestFailure ? (
            <p role="alert">{t(error.fieldErrors.form??"")}</p>
          ) : null}
        </>
      ) : null}
      {data ? (
        <>
          <CardGrid className="gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle title="identity.capture" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="identity.patient"
                  value={subject}
                  options={[
                    { value: "", label: "identity.choose" },
                    ...data.subjects.map((p) => ({
                      value: p.id,
                      label: p.name,
                    })),
                  ]}
                  disabled={disabled || active}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setAttempt(undefined);
                    setConsent(false);
                  }}
                />
                <Select
                  label="identity.device"
                  value={resolved}
                  options={data.devices
                    .filter(
                      (d) =>
                        devices.some((x) => x.id === d.id) ||
                        d.id === data.policy.lockedDevice ||
                        (active && d.id === attempt.deviceId),
                    )
                    .map((d) => ({ value: d.id, label: d.title }))}
                  disabled={disabled || active || !!data.policy.lockedDevice}
                  onChange={(e) => {
                    setDevice(e.target.value);
                    setConsent(false);
                  }}
                />
                <Button
                  disabled={
                    disabled ||
                    active ||
                    !!data.policy.lockedDevice ||
                    !resolved
                  }
                  onClick={() =>
                    submit({ action: "preference", deviceId: resolved })
                  }
                >
                  {t("identity.saveDefault")}
                </Button>
                {blocked ? (
                  <p role="alert">
                    {t(
                      active && !devices.some((d) => d.id === resolved)
                        ? "identity.active"
                        : "identity.locked",
                    )}
                  </p>
                ) : null}
                <Checkbox
                  label="identity.consent"
                  checked={consent}
                  disabled={disabled || active || blocked}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <Button
                  disabled={
                    disabled || active || blocked || !subject || !consent
                  }
                  onClick={() =>
                    submit({
                      action: "start",
                      deviceId: resolved,
                      subjectId: subject,
                      consent,
                    })
                  }
                >
                  {t("identity.start")}
                </Button>
                <p>{t("identity.nativeHint")}</p>
                {!active ? (
                  <Button
                    disabled={disabled || !subject}
                    onClick={() =>
                      submit({ action: "manual", subjectId: subject })
                    }
                  >
                    {t("identity.manual")}
                  </Button>
                ) : null}
                {active ? (
                  <>
                    <Select
                      label="identity.scenario"
                      value={scenario}
                      options={data.scenarios
                        .filter((s) => !bio || s.id !== "expired")
                        .map((s) => ({ value: s.id, label: s.title }))}
                      disabled={disabled}
                      onChange={(e) => setScenario(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={disabled || blocked}
                        onClick={() =>
                          submit({
                            action: "simulate",
                            attemptId: attempt.id,
                            scenarioId: scenario,
                          })
                        }
                      >
                        {t("identity.simulate")}
                      </Button>
                      <Button
                        disabled={disabled}
                        onClick={() =>
                          submit({ action: "manual", attemptId: attempt.id })
                        }
                      >
                        {t("identity.manual")}
                      </Button>
                      <Button
                        disabled={disabled}
                        onClick={() =>
                          submit({ action: "cancel", attemptId: attempt.id })
                        }
                      >
                        {t("identity.cancel")}
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
            <IdentityResultPanel
              attempt={attempt}
              date={(value) =>
                value.includes("T")
                  ? format.dateTime(value)
                  : format.date(value)
              }
            />
          </CardGrid>
          {bio && policy ? (
            <Card>
              <CardHeader>
                <CardTitle title="identity.policy" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Checkbox
                  label="identity.enableBio"
                  checked={policy.biometricsEnabled}
                  disabled={disabled || !data.canManage}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      biometricsEnabled: e.target.checked,
                    })
                  }
                />
                <Select
                  label="identity.lockDevice"
                  value={policy.lockedDevice}
                  options={[
                    { value: "", label: "identity.unlocked" },
                    ...data.devices.map((d) => ({
                      value: d.id,
                      label: d.title,
                    })),
                  ]}
                  disabled={disabled || !data.canManage}
                  onChange={(e) =>
                    setPolicy({ ...policy, lockedDevice: e.target.value })
                  }
                />
                <Button
                  disabled={disabled || !data.canManage}
                  onClick={() => submit({ action: "policy", policy })}
                >
                  {t("identity.savePolicy")}
                </Button>
                <p>{t("identity.manualHint")}</p>
              </CardContent>
            </Card>
          ) : null}
          <IdentityHistory
            attempts={data.attempts.slice(
              (currentPage - 1) * size,
              currentPage * size,
            )}
            date={(v) => format.dateTime(v)}
          />
          <div className="flex gap-3">
            <Button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              {t("devices.previous")}
            </Button>
            <span>{format.number(currentPage)}</span>
            <Button
              disabled={currentPage * size >= data.attempts.length}
              onClick={() => setPage(currentPage + 1)}
            >
              {t("devices.next")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
