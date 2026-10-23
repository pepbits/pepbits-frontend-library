'use client';
import {usePreferences} from '@pepbits/preferences/react';
import type {UserPreferences} from '@pepbits/preferences';
import {useFormatters} from '../screen-host';
import React, { useEffect, useMemo, useRef, useState } from "react";
import {Button,Input,Select,Checkbox,ScannerInput} from '@pepbits/ui';
import {Card,CardGrid,CardHeader,CardTitle,CardContent,PresentationProvider,RecoveryNotice,failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {
  type IntegrationCommand,
  type IntegrationLibrary,
  type IntegrationRecord,
  type IntegrationJob,
  type IntegrationPolicy,
  type DeviceCapability,
} from "@pepbits/data/device-integrations";
import {
  WorkflowRequestFailure,
  type IntegrationAdapter,
} from "@pepbits/data";
import { DeviceJobList, DeviceDocument } from "./components";
export interface DeviceWorkspaceProps {
  adapter: IntegrationAdapter;
  scopeKey: string;
  mode: "workbench" | "automation";
  contexts: {value:string;label:string}[];
  stationId: string;
}
export function DeviceIntegrationWorkspace(props: DeviceWorkspaceProps) {
  const {preferences, preferencesAvailable} = usePreferences();
  return (
    <PresentationProvider value={preferences}>
      <Workspace key={props.scopeKey} {...props} preferences={preferences} preferencesAvailable={preferencesAvailable} />
    </PresentationProvider>
  );
}
function Workspace(props: DeviceWorkspaceProps & {preferences:UserPreferences;preferencesAvailable:boolean}) {
  const { t } = useLocalization(),
    [station, setStation] = useState(props.stationId),
    [stationDraft, setStationDraft] = useState(station),
    [data, setData] = useState<IntegrationLibrary>(),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [device, setDevice] = useState(""),
    [record, setRecord] = useState(""),
    [capability, setCapability] = useState<DeviceCapability>("receipt"),
    [copies, setCopies] = useState(1),
    [context, setContext] = useState(props.contexts[0]?.value ?? ""),
    [found, setFound] = useState<IntegrationRecord>(),
    [policy, setPolicy] = useState<IntegrationPolicy>(),
    [print, setPrint] = useState<IntegrationJob>(),
    [historyPage, setHistoryPage] = useState(1),
    [example, setExample] = useState(false);
  const pending = useRef<IntegrationCommand | undefined>(undefined),
    generation = useRef(0),
    scanGeneration = useRef(0),
    format = useFormatters();
  async function load() {
    const g = generation.current;
    try {
      const d = await props.adapter.library(station);
      if (g !== generation.current) return;
      setData(d);
      setDevice(d.defaultDevice);
      setPolicy(d.policy);
      setError(undefined);
    } catch (e) {
      if (g === generation.current) setError(e);
    }
  }
  useEffect(() => {
    generation.current++;
    setData(undefined);
    setFound(undefined);
    setPrint(undefined);
    setRecord("");
    setHistoryPage(1);
    pending.current = undefined;
    setBusy(false);
    void load();
    return () => {
      generation.current++;
    };
  }, [station, props.adapter]);
  async function run(input: IntegrationCommand) {
    if (busy) return;
    const g = generation.current;
    setBusy(true);
    pending.current = input;
    setError(undefined);
    try {
      const result = await props.adapter.command<IntegrationJob>(input);
      if (g !== generation.current) return;
      pending.current = undefined;
      await load();
      if (input.action === "dispatch" && result.status === "print-requested") {
        setPrint(result);
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (g === generation.current) {
          window.print();
          setPrint(undefined);
        }
      }
    } catch (e) {
      if (g === generation.current) {
        setError(e);
        if (e instanceof WorkflowRequestFailure && e.status < 500)
          pending.current = undefined;
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  function submit(input: Omit<IntegrationCommand, "stationId">) {
    void run({
      ...input,
      stationId: station,
      operationId: crypto.randomUUID(),
    });
  }
  const disabled =
    busy || !!pending.current || props.preferencesAvailable === false;
  const selectedDevice = data?.policy.lockedDevice || device;
  const options =
    data?.devices
      .find((d) => d.id === selectedDevice)
      ?.capabilities.filter((c) =>
        ["receipt", "label", "report", "drawer"].includes(c),
      ) ?? [];
  const selectedCapability = options.includes(capability)
    ? capability
    : options[0];
  const pageSize = Number(props.preferences.pageSize),
    page = Math.min(
      historyPage,
      Math.max(1, Math.ceil((data?.jobs.length ?? 0) / pageSize)),
    );
  const scan = async (code: string) => {
    const g = generation.current,
      scanId = ++scanGeneration.current;
    setError(undefined);
    try {
      const r = await props.adapter.command<IntegrationRecord>({
        action: "lookup",
        stationId: station,
        code,
        context,
      });
      if (g === generation.current && scanId === scanGeneration.current) {
        setFound(r);
        setRecord(r.id);
      }
      return true;
    } catch (e) {
      if (g === generation.current && scanId === scanGeneration.current)
        setError(e);
      return false;
    }
  };
  return (
    <div
      className="space-y-4"
      data-device-library
      data-tour="device-integrations"
    >
      <h2 className="text-xl font-semibold">{t(props.mode === "automation" ? "devices.device-automation" : "devices.device-integrations")}</h2>
      <p>{t("devices.notice")}</p>
      <Button onClick={() => setExample(!example)}>
        {t("devices.example")}
      </Button>
      {example ? (
        <pre className="overflow-auto rounded-[var(--radius)] border border-[var(--border)] p-4">
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
      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="devices.station"
              value={stationDraft}
              disabled={disabled}
              onChange={(e) => setStationDraft(e.target.value)}
            />
            <Button
              disabled={disabled || !stationDraft.trim()}
              onClick={() => setStation(stationDraft.trim())}
            >
              {t("devices.openStation")}
            </Button>
            <Button disabled={disabled} onClick={() => void load()}>
              {t("devices.refresh")}
            </Button>
          </div>
        </CardContent>
      </Card>
      {data ? (
        <>
          <CardGrid className="gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle title="devices.route" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="devices.device"
                  value={selectedDevice}
                  options={data.devices.map((d) => ({
                    value: d.id,
                    label: d.title,
                  }))}
                  disabled={disabled || !!data.policy.lockedDevice}
                  onChange={(e) => setDevice(e.target.value)}
                />
                <Button
                  disabled={disabled || !!data.policy.lockedDevice}
                  onClick={() =>
                    submit({ action: "preference", deviceId: selectedDevice })
                  }
                >
                  {t("devices.saveDefault")}
                </Button>
                <Select
                  label="devices.capability"
                  value={selectedCapability ?? ""}
                  options={options.map((c) => ({
                    value: c,
                    label: "devices." + c,
                  }))}
                  disabled={disabled || !options.length}
                  onChange={(e) =>
                    setCapability(e.target.value as DeviceCapability)
                  }
                />
                <Select
                  label="devices.record"
                  value={record}
                  options={[
                    { value: "", label: "devices.choose" },
                    ...data.records.map((r) => ({
                      value: r.id,
                      label: r.title,
                    })),
                  ]}
                  disabled={disabled}
                  onChange={(e) => setRecord(e.target.value)}
                />
                <Input
                  type="number"
                  label="devices.copies"
                  min={1}
                  max={data.policy.maxCopies}
                  value={copies}
                  disabled={disabled}
                  onChange={(e) => setCopies(Number(e.target.value))}
                />
                <Button
                  disabled={disabled || !record || !selectedCapability}
                  onClick={() =>
                    submit({
                      action: "enqueue",
                      deviceId: selectedDevice,
                      recordId: record,
                      capability: selectedCapability,
                      copies,
                    })
                  }
                >
                  {t("devices.queue")}
                </Button>
                <p>{t("devices.nativeHint")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle title="devices.scanner" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="devices.context"
                  value={context}
                  options={props.contexts}
                  disabled={disabled}
                  onChange={(e) => {
                    scanGeneration.current++;
                    setRecord("");
                    setContext(e.target.value);
                    setFound(undefined);
                  }}
                />
                <ScannerInput
                  label="devices.code"
                  hint="devices.scanHint"
                  disabled={disabled}
                  onScan={scan}
                />
                {found ? (
                  <p role="status">
                    {found.title} · {found.code}
                  </p>
                ) : null}
                <p>{t("devices.sampleCodes")}</p>
                <p>
                  {data.records
                    .filter((r) => r.context === context)
                    .map((r) => r.code)
                    .join(" · ")}
                </p>
              </CardContent>
            </Card>
          </CardGrid>
          {props.mode === "automation" ? (
            <Card>
              <CardHeader>
                <CardTitle title="devices.automation" />
              </CardHeader>
              <CardContent className="space-y-4">
                <p>{t("devices.eventHint")}</p>
                {data.rules.map((rule) => (
                  <Card
                    shadow="none"
                    key={rule.id}
                    className="flex flex-wrap items-end gap-3 p-3"
                  >
                    <span>{t("devices." + rule.event)}</span>
                    <Select
                      label="devices.device"
                      value={rule.deviceId}
                      options={data.devices
                        .filter((d) => d.capabilities.includes(rule.capability))
                        .map((d) => ({ value: d.id, label: d.title }))}
                      disabled={disabled || !data.canManage}
                      onChange={(e) =>
                        submit({
                          action: "rule",
                          rule: { ...rule, deviceId: e.target.value },
                          version: data.policy.version,
                        })
                      }
                    />
                    <Checkbox
                      label="devices.enabled"
                      checked={rule.enabled}
                      disabled={disabled || !data.canManage}
                      onChange={(e) =>
                        submit({
                          action: "rule",
                          rule: { ...rule, enabled: e.target.checked },
                          version: data.policy.version,
                        })
                      }
                    />
                    <Button
                      disabled={
                        disabled ||
                        !data.canManage ||
                        !data.policy.automatic ||
                        !rule.enabled ||
                        !record
                      }
                      onClick={() =>
                        submit({
                          action: "event",
                          event: rule.event,
                          eventId: crypto.randomUUID(),
                          recordId: record,
                        })
                      }
                    >
                      {t("devices.simulateEvent")}
                    </Button>
                  </Card>
                ))}
              </CardContent>
            </Card>
          ) : null}
          {policy && props.mode === "automation" ? (
            <Card>
              <CardHeader>
                <CardTitle title="devices.policy" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  label="devices.lock"
                  value={policy.lockedDevice}
                  options={[
                    { value: "", label: "devices.unlocked" },
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
                <Checkbox
                  label="devices.automatic"
                  checked={policy.automatic}
                  disabled={disabled || !data.canManage}
                  onChange={(e) =>
                    setPolicy({ ...policy, automatic: e.target.checked })
                  }
                />
                <Input
                  label="devices.maxCopies"
                  type="number"
                  min={1}
                  max={100}
                  value={policy.maxCopies}
                  disabled={disabled || !data.canManage}
                  onChange={(e) =>
                    setPolicy({ ...policy, maxCopies: Number(e.target.value) })
                  }
                />
                <Button
                  disabled={disabled || !data.canManage}
                  onClick={() => submit({ action: "policy", policy })}
                >
                  {t("devices.savePolicy")}
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <DeviceJobList
            jobs={data.jobs.slice((page - 1) * pageSize, page * pageSize)}
            disabled={disabled}
            onAction={(j, action) => submit({ action, jobId: j.id })}
            formatDate={(v) => format.dateTime(v)}
          />
          <div className="flex gap-3">
            <Button
              disabled={page <= 1}
              onClick={() => setHistoryPage(page - 1)}
            >
              {t("devices.previous")}
            </Button>
            <span>{format.number(page)}</span>
            <Button
              disabled={page * pageSize >= data.jobs.length}
              onClick={() => setHistoryPage(page + 1)}
            >
              {t("devices.next")}
            </Button>
          </div>
        </>
      ) : null}
      {print ? <DeviceDocument job={print} /> : null}
    </div>
  );
}
