'use client';
import {usePreferences} from '@pepbits/preferences/react';
import type {UserPreferences} from '@pepbits/preferences';
import {useFormatters} from '../screen-host';
import React, { useEffect, useMemo, useRef, useState } from "react";
import {Button,Select,Input,Checkbox,Badge} from '@pepbits/ui';
import {Card,CardHeader,CardTitle,CardContent,Table,TableContainer,TableHeader,TableHead,TableRow,TableBody,TableCell,DescriptionList,RecoveryNotice,failureFromError,PresentationProvider} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {
  labelFitsProfile,
  type LabelCommand,
  type LabelLibrary,
  type LabelJob,
  type LabelPolicy,
} from "@pepbits/data/label-printing";
import { WorkflowRequestFailure } from "@pepbits/data";
import type { LabelAdapter } from "@pepbits/data";
import { LabelPreview, LabelPrintDialog, WristbandPreview } from "./components";
import styles from "./printing.module.css";
export interface LabelWorkspaceProps {
  adapter: LabelAdapter;
  scopeKey: string;
  category: string;
  /** Host decides which stock uses the wristband preview. */
  isWristband?: (job: LabelJob) => boolean;
}
export function LabelPrintingWorkspace(props: LabelWorkspaceProps) {
  const {preferences, preferencesAvailable} = usePreferences();
  return (
    <PresentationProvider value={preferences}>
      <Workspace key={props.scopeKey} {...props} preferences={preferences} preferencesAvailable={preferencesAvailable} />
    </PresentationProvider>
  );
}
function Workspace(props: LabelWorkspaceProps & {preferences:UserPreferences;preferencesAvailable:boolean}) {
  const { t, language } = useLocalization(),
    [data, setData] = useState<LabelLibrary>(),
    [job, setJob] = useState<LabelJob>(),
    [templateId, setTemplate] = useState(""),
    [profile, setProfile] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [copies, setCopies] = useState(1),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [policy, setPolicy] = useState<LabelPolicy>(),
    [tab, setTab] = useState("demo");
  const [historyPage, setHistoryPage] = useState(1);
  const historySize = Number(props.preferences.pageSize);
  const currentHistoryPage = Math.min(
    historyPage,
    Math.max(1, Math.ceil((data?.jobs.length ?? 0) / historySize)),
  );
  const pending = useRef<LabelCommand | undefined>(undefined),
    alive = useRef(true);
  const format = useFormatters();
  async function load() {
    try {
      const d = await props.adapter.library();
      if (!alive.current) return;
      setData(d);
      setPolicy(d.policy);
      setProfile(d.defaultProfile);
      setError(undefined);
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
  }, [props.adapter]);
  useEffect(() => {
    setSelected([]);
    setTemplate("");
    setCopies(1);
    setJob(undefined);
    setPreview(false);
  }, [props.category]);
  useEffect(() => {
    if (!job?.paymentStatus || job.paymentStatus !== "pending") return;
    const id = setInterval(() => {
      void props.adapter
        .command({ action: "job", jobId: job.id })
        .then((value) => {
          if (alive.current) setJob(value);
        })
        .catch((e) => {
          if (alive.current) setError(e);
        });
    }, 5000);
    return () => clearInterval(id);
  }, [job?.id, job?.paymentStatus, props.adapter]);
  async function run(input: LabelCommand) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    pending.current = input;
    try {
      const value = await props.adapter.command(input);
      if (!alive.current) return;
      pending.current = undefined;
      if (["create", "job", "print", "simulate"].includes(input.action)) {
        setJob(value);
        if (input.action === "create") setPreview(false);
        if (input.action === "print") {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          window.print();
        }
      } else await load();
    } catch (e) {
      if (
        e instanceof WorkflowRequestFailure &&
        e.status >= 400 &&
        e.status < 500
      )
        pending.current = undefined;
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const disabled =
    busy || !!pending.current || props.preferencesAvailable === false;
  const templates =
      data?.templates.filter(
        (x) =>
          ["batch", "profiles"].includes(props.category) ||
          x.category === props.category,
      ) ?? [],
    template = templates.find((x) => x.id === templateId) ?? templates[0];
  const compatibleProfiles =
    data?.profiles.filter(
      (p) =>
        props.category === "profiles" ||
        (template && labelFitsProfile(template, p)),
    ) ?? [];
  const resolvedProfileId =
    data?.policy.lockedProfile ||
    (compatibleProfiles.some((p) => p.id === profile)
      ? profile
      : (compatibleProfiles[0]?.id ?? ""));
  const resolvedProfile = data?.profiles.find(
    (p) => p.id === resolvedProfileId,
  );
  const incompatible =
    props.category !== "profiles" &&
    (!template ||
      !resolvedProfile ||
      !labelFitsProfile(template, resolvedProfile));
  const profileError = incompatible
    ? data?.policy.lockedProfile
      ? "labels.lockedFit"
      : "labels.fit"
    : undefined;
  const apiFields =
    error instanceof WorkflowRequestFailure ? error.fieldErrors : {};
  const rows =
    data?.records.filter((r) => r.category === template?.category) ?? [];
  function submit(input: LabelCommand) {
    void run({ ...input, operationId: crypto.randomUUID() });
  }
  return (
    <div
      className={styles.workspace}
      data-label-library
      data-tour="label-printing"
    >
      <div>
        <h1 className="text-xl font-bold">{t("labels.title")}</h1>
        <p>{t("labels.demoNotice")}</p>
      </div>
      <div className={styles.actions}>
        {["demo", "code", "history"].map((id) => (
          <Button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              if (id === "history") void load();
            }}
          >
            {t("labels." + id)}
          </Button>
        ))}
      </div>
      {error ? (
        <RecoveryNotice
          failure={failureFromError(error)}
          preservesValues
          onRetry={() =>
            pending.current ? void run(pending.current) : void load()
          }
        />
      ) : null}
      {Object.keys(apiFields).length ? (
        <div role="alert">
          {[...new Set(Object.values(apiFields))].map((message) => (
            <p key={message}>{t(message)}</p>
          ))}
        </div>
      ) : null}
      {tab === "code" ? (
        <Card>
          <CardHeader>
            <CardTitle title="labels.integration" />
          </CardHeader>
          <CardContent>
            <p>{t("labels.integrationHint")}</p>
            <pre className="overflow-auto whitespace-pre-wrap">
              <code>{`Supply an authenticated adapter and an identity scope. Wrap this workspace in PreferenceHost and ScreenHostProvider. Device drivers remain host-owned through @pepbits/platform/devices.`}</code>
            </pre>
          </CardContent>
        </Card>
      ) : null}
      {tab === "demo" && data ? (
        <div className={styles.layout}>
          <Card>
            <CardHeader>
              <CardTitle
                title={
                  props.category === "profiles"
                    ? "labels.profiles"
                    : "labels.configure"
                }
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="labels.profile"
                value={resolvedProfileId}
                error={profileError ?? apiFields.profileId}
                hint={
                  !data.policy.lockedProfile &&
                  profile &&
                  resolvedProfileId !== profile
                    ? "labels.profileAdjusted"
                    : undefined
                }
                options={data.profiles
                  .filter(
                    (p) =>
                      p.id === data.policy.lockedProfile ||
                      compatibleProfiles.some((c) => c.id === p.id),
                  )
                  .map((p) => ({
                    value: p.id,
                    label: p.title,
                  }))}
                disabled={disabled || !!data.policy.lockedProfile}
                onChange={(e) => {
                  setProfile(e.target.value);
                  setError(undefined);
                }}
              />
              {props.category !== "profiles" && template && resolvedProfile ? (
                <DescriptionList
                  items={[
                    {
                      id: "label-size",
                      label: "labels.template",
                      value: `${format.number(template.widthMm)} × ${format.number(template.heightMm)} mm`,
                    },
                    {
                      id: "paper-size",
                      label: "labels.profile",
                      value: `${format.number(resolvedProfile.widthMm)} × ${format.number(resolvedProfile.heightMm)} mm`,
                    },
                  ]}
                />
              ) : null}
              <Button
                disabled={
                  disabled || !!data.policy.lockedProfile || !resolvedProfileId
                }
                onClick={() =>
                  submit({ action: "preference", profileId: resolvedProfileId })
                }
              >
                {t("labels.saveDefault")}
              </Button>
              {data.policy.lockedProfile ? (
                <Badge>{t("labels.locked")}</Badge>
              ) : null}
              {props.category !== "profiles" ? (
                <>
                  <Select
                    label="labels.template"
                    value={template?.id ?? ""}
                    options={templates.map((x) => ({
                      value: x.id,
                      label: x.title,
                    }))}
                    disabled={disabled}
                    onChange={(e) => {
                      setTemplate(e.target.value);
                      setError(undefined);
                      setSelected([]);
                      setJob(undefined);
                    }}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={
                      template?.category === "payment"
                        ? 1
                        : data.policy.maxCopies
                    }
                    label="labels.copies"
                    value={copies}
                    disabled={disabled}
                    onChange={(e) => setCopies(Number(e.target.value))}
                  />
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <Checkbox
                        key={r.id}
                        label={r.name + " · " + r.identifier}
                        checked={selected.includes(r.id)}
                        disabled={disabled}
                        onChange={(e) =>
                          setSelected(
                            template?.category === "payment"
                              ? e.target.checked
                                ? [r.id]
                                : []
                              : e.target.checked
                                ? [...selected, r.id]
                                : selected.filter((id) => id !== r.id),
                          )
                        }
                      />
                    ))}
                  </div>
                  <Button
                    variant="primary"
                    disabled={disabled || !selected.length || incompatible}
                    onClick={() =>
                      submit({
                        action: "create",
                        templateId: template?.id,
                        recordIds: selected,
                        profileId: resolvedProfileId,
                        copies,
                      })
                    }
                  >
                    {t("labels.generate")}
                  </Button>
                </>
              ) : (
                <>
                  <p>{t("labels.calibration")}</p>
                  {data.profiles.map((p) => (
                    <DescriptionList
                      key={p.id}
                      items={[
                        {
                          id: p.id,
                          label: p.title,
                          value: `${format.number(p.widthMm)} × ${format.number(p.heightMm)} mm`,
                        },
                      ]}
                    />
                  ))}
                  {data.canManage && policy ? (
                    <>
                      <h2>{t("labels.policy")}</h2>
                      <Input
                        label="labels.maxCopies"
                        type="number"
                        min={1}
                        max={100}
                        value={policy.maxCopies}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            maxCopies: Number(e.target.value),
                          })
                        }
                        disabled={disabled}
                      />
                      <Checkbox
                        label="labels.allowReprint"
                        checked={policy.reprintAllowed}
                        disabled={disabled}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            reprintAllowed: e.target.checked,
                          })
                        }
                      />
                      <Select
                        label="labels.lockProfile"
                        value={policy.lockedProfile}
                        options={[
                          { value: "", label: "labels.unlocked" },
                          ...data.profiles.map((p) => ({
                            value: p.id,
                            label: p.title,
                          })),
                        ]}
                        disabled={disabled}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            lockedProfile: e.target.value,
                          })
                        }
                      />
                      <Button
                        disabled={disabled}
                        onClick={() => submit({ action: "policy", policy })}
                      >
                        {t("Save")}
                      </Button>
                    </>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle title="labels.preview" />
            </CardHeader>
            <CardContent className="space-y-4">
              {job ? (
                <>
                  <Badge>{t("labels." + (job.paymentStatus ?? "ready"))}</Badge>
                  <p>
                    {t("labels.job")}: {job.id}
                  </p>
                  {job.expiresAt ? (
                    <p>
                      {t("labels.expires")}: {format.dateTime(job.expiresAt)}
                    </p>
                  ) : null}
                  <div className={styles.preview}>
                    {job.labels.map((label) =>
                      props.isWristband?.(job) ? (
                        <WristbandPreview key={label.recordId} label={label} />
                      ) : (
                        <LabelPreview key={label.recordId} label={label} />
                      ),
                    )}
                  </div>
                  <Input
                    label="labels.reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={disabled}
                  />
                  <Button disabled={disabled} onClick={() => setPreview(true)}>
                    {t("labels.previewPrint")}
                  </Button>
                  {job.paymentStatus === "pending" && data.canManage ? (
                    <div className={styles.actions}>
                      {(["paid", "failed"] as const).map((status) => (
                        <Button
                          key={status}
                          disabled={disabled}
                          onClick={() =>
                            submit({
                              action: "simulate",
                              jobId: job.id,
                              paymentStatus: status,
                            })
                          }
                        >
                          {t("labels.simulate")} · {t("labels." + status)}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  <p>{t("labels.requestedOnly")}</p>
                </>
              ) : (
                <p>{t("labels.selectHint")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
      {tab === "history" && data ? (
        <Card>
          <CardHeader>
            <CardTitle title="labels.history" />
            <Button onClick={() => void load()} disabled={disabled}>
              {t("Refresh")}
            </Button>
          </CardHeader>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    {["job", "template", "created", "attempts", "preview"].map(
                      (k) => (
                        <TableHead key={k}>{t("labels." + k)}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.jobs
                    .slice(
                      (currentHistoryPage - 1) * historySize,
                      currentHistoryPage * historySize,
                    )
                    .map((j) => (
                      <TableRow key={j.id}>
                        <TableCell>{j.id}</TableCell>
                        <TableCell>
                          {t(
                            data.templates.find((x) => x.id === j.templateId)
                              ?.title ?? j.templateId,
                          )}
                        </TableCell>
                        <TableCell>{format.dateTime(j.createdAt)}</TableCell>
                        <TableCell>
                          {format.number(j.attempts.length)}
                        </TableCell>
                        <TableCell>
                          <Button
                            disabled={disabled}
                            onClick={() => {
                              setJob(j);
                              setTab("demo");
                            }}
                          >
                            {t("labels.open")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            <div className={styles.actions}>
              <Button
                disabled={disabled || currentHistoryPage <= 1}
                onClick={() => setHistoryPage(currentHistoryPage - 1)}
              >
                {t("registration.previous")}
              </Button>
              <span>{format.number(currentHistoryPage)}</span>
              <Button
                disabled={
                  disabled ||
                  currentHistoryPage * historySize >= data.jobs.length
                }
                onClick={() => setHistoryPage(currentHistoryPage + 1)}
              >
                {t("registration.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {preview && job ? (
        <LabelPrintDialog
          job={job}
          busy={disabled}
          onClose={() => setPreview(false)}
          onPrint={() => submit({ action: "print", jobId: job.id, reason })}
        />
      ) : null}
    </div>
  );
}
