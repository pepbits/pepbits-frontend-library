"use client";
import React, { useEffect, useRef, useState } from "react";
import {Badge, Button, Select} from '@pepbits/ui';
import {Card, CardContent, CardGrid, Modal, Tabs, RecoveryNotice, failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {type ClinicalDocument, type ClinicalDocumentView, type ClinicalDocumentSave} from '../../domain/clinical-document';
import {type UserPreferences} from '@pepbits/preferences';
import {type Formatters} from '@pepbits/i18n';
import type {ClinicalDocumentAdapter} from '../../adapters/clinical-document';
import { RecordSectionLayout } from "@pepbits/page-engines/record-layout";
import { ClinicLedgerTable } from "../clinic-billing/parts";
export interface DocumentFieldsProps<V, C> {
  values: V;
  preferences?: UserPreferences;
  record?: ClinicalDocument<V>;
  format?: Formatters;
  navigate?: (section: string) => void;
  config: C;
  disabled: boolean;
  errors: Record<string, string>;
  change: <K extends keyof V>(key: K, value: V[K]) => void;
}
export interface ClinicalDocumentDefinition<V, C> {
  prefix: string;
  inlineActions?: boolean;
  recordLayout?: boolean;
  afterChange?: (values: V, key: keyof V | "encounterId") => V;
  sections: Array<{ id: string; label: string }>;
  validate: (values: V, config: C, complete: boolean) => Record<string, string>;
  sectionFor: (field: string) => string;
  fresh: (values: V) => V;
  render: (
    props: DocumentFieldsProps<V, C>,
    section: string,
    flat: boolean,
  ) => React.ReactNode;
  confirmation: (
    values: V,
    config: C,
    t: (key: string) => string,
  ) => React.ReactNode;
}
export function ClinicalDocumentEditor<V, C>({
  definition,
  initial,
  adapter,
  preferences,
  available,
  format,
  onBusy,
  onDirty,
}: {
  definition: ClinicalDocumentDefinition<V, C>;
  initial: ClinicalDocumentView<V, C>;
  adapter: ClinicalDocumentAdapter<V, C>;
  preferences: UserPreferences;
  available?: boolean;
  format: Formatters;
  onBusy: (b: boolean) => void;
  onDirty: (b: boolean) => void;
}) {
  const { sections, validate: validateDocument } = definition;
  const prefix = definition.prefix;
  const { t } = useLocalization(),
    [data, setData] = useState(initial),
    [record, setRecord] = useState<ClinicalDocument<V>>(() =>
      structuredClone(initial.assessments[0] ?? initial.blank),
    ),
    [dirty, setDirty] = useState(false),
    [section, setSection] = useState(sections[0]!.id),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [history, setHistory] = useState(false),
    [confirm, setConfirm] = useState(false),
    [switchTo, setSwitchTo] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const pending = useRef<ClinicalDocumentSave<V> | null>(null),
    lock = useRef(false),
    root = useRef<HTMLDivElement>(null),
    disabled =
      busy ||
      !!pending.current ||
      !data.canWrite ||
      available === false ||
      record.status === "completed";
  const change = <K extends keyof V>(key: K, value: V[K]) => {
    if (disabled) return;
    setRecord((r) => {
      const values = { ...r.values, [key]: value };
      return { ...r, values: definition.afterChange?.(values, key) ?? values };
    });
    setDirty(true);
    onDirty(true);
    setErrors({});
    setError(null);
    setNotice("");
  };
  const focusErrors = (next: Record<string, string>) => {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (!first) return;
    setSection(definition.sectionFor(first));
    const focus = () =>
      root.current
        ?.querySelector<HTMLElement>(
          `[name="${first}"], [data-field="${first}"] [role="radio"]`,
        )
        ?.focus();
    requestAnimationFrame(() => {
      focus();
      requestAnimationFrame(focus);
    });
  };
  const save = async (complete: boolean) => {
    if (
      lock.current ||
      !data.canWrite ||
      available === false ||
      record.status === "completed"
    )
      return;
    if (!pending.current) {
      const invalid = validateDocument(record.values, data.config, complete);
      if (Object.keys(invalid).length) {
        setConfirm(false);
        focusErrors(invalid);
        return;
      }
      pending.current = {
        patientId: record.patientId,
        assessment: record,
        expectedVersion: record.version,
        operationId: crypto.randomUUID(),
        complete,
      };
    }
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      const saved = await adapter.save(pending.current);
      setRecord(saved);
      setData((d) => ({
        ...d,
        assessments: [saved, ...d.assessments.filter((r) => r.id !== saved.id)],
      }));
      pending.current = null;
      setDirty(false);
      onDirty(false);
      setConfirm(false);
      setNotice(
        saved.status === "completed"
          ? prefix + "event.completed"
          : prefix + "event.saved",
      );
    } catch (e) {
      setError(e);
      setConfirm(false);
      if (typeof e === "object" && e && "status" in e && e.status === 400) {
        pending.current = null;
        focusErrors(
          "fieldErrors" in e ? (e.fieldErrors as Record<string, string>) : {},
        );
      }
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  useEffect(() => {
    if (!preferences.keyboardShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "s" &&
        root.current?.contains(document.activeElement)
      ) {
        e.preventDefault();
        void save(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const choose = (id: string) => {
    const next =
      id === "new"
        ? {
            ...structuredClone(data.blank),
            values: definition.fresh(structuredClone(data.blank.values)),
          }
        : data.assessments.find((r) => r.id === id);
    if (next) {
      setRecord(structuredClone(next));
      pending.current = null;
      setDirty(false);
      onDirty(false);
      setErrors({});
      setError(null);
      setNotice("");
      setSection(sections[0]!.id);
    }
    setSwitchTo(null);
  };
  const requestSwitch = (id: string) => {
    if (dirty || pending.current) setSwitchTo(id);
    else choose(id);
  };
  const reload = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const latest = await adapter.load(record.patientId);
      setData(latest);
      const saved = latest.assessments.find((r) => r.id === record.id);
      if (saved?.status === "completed") {
        setRecord(saved);
        setDirty(false);
        onDirty(false);
        setNotice(prefix + "completedLocked");
      } else if (saved)
        setRecord((r) => ({
          ...saved,
          values: r.values,
          encounterId: r.encounterId,
        }));
      pending.current = null;
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  const props = {
      values: record.values,
      preferences,
      record,
      format,
      navigate: setSection,
      config: data.config,
      change,
      disabled,
      errors,
    },
    index = sections.findIndex((s) => s.id === section),
    flat = preferences.formNavigation === "rail";
  const actions = (
    <div className="flex gap-2">
      {preferences.formNavigation === "wizard" ? (
        <>
          <Button
            disabled={index === 0}
            onClick={() => setSection(sections[index - 1]!.id)}
          >
            {t("template.previous")}
          </Button>
          <Button
            disabled={index === sections.length - 1}
            onClick={() => setSection(sections[index + 1]!.id)}
          >
            {t("template.next")}
          </Button>
        </>
      ) : null}
      <Button
        disabled={disabled || !dirty}
        loading={busy}
        onClick={() => void save(false)}
      >
        {t(prefix + "saveDraft")}
      </Button>
      <Button
        variant="primary"
        disabled={disabled}
        onClick={() => {
          const invalid = validateDocument(record.values, data.config, true);
          if (Object.keys(invalid).length) {
            focusErrors(invalid);
            return;
          }
          setConfirm(true);
        }}
      >
        {t(prefix + "complete")}
      </Button>
    </div>
  );
  const saveStatus = (
    <div className="text-xs text-[var(--text-muted)]" role="status">
      {notice
        ? t(notice)
        : record.updatedAt
          ? t(prefix + "lastSaved") +
            " " +
            format.dateTime(record.updatedAt) +
            " • " +
            record.actor
          : t(prefix + "manualPriority")}
    </div>
  );
  return (
    <div
      ref={root}
      className="space-y-3"
      data-clinical-document-editor
      data-triage-editor={prefix === "template.triage." ? "" : undefined}
      data-layout={preferences.formNavigation}
    >
      <Card
        className={definition.inlineActions ? "sticky top-0 z-10" : undefined}
      >
        <CardContent
          style={{ paddingBlock: ".5rem" }}
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div className="min-w-56 flex-1">
            <Select
              label={prefix + "encounter"}
              placeholder=""
              value={record.encounterId}
              options={[
                { value: "", label: prefix + "unlinked" },
                ...data.encounters.map((e) => ({
                  value: e.id,
                  label: format.date(e.date) + " • " + t(e.title),
                })),
              ]}
              disabled={disabled}
              error={errors.encounterId}
              onChange={(e) => {
                if (!disabled) {
                  setRecord((r) => ({
                    ...r,
                    encounterId: e.target.value,
                    values:
                      definition.afterChange?.(r.values, "encounterId") ??
                      r.values,
                  }));
                  setDirty(true);
                  onDirty(true);
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                record.status === "completed"
                  ? "success"
                  : dirty
                    ? "warning"
                    : "brand"
              }
            >
              {t(
                record.status === "completed"
                  ? prefix + "completed"
                  : dirty
                    ? prefix + "unsaved"
                    : record.id === "new"
                      ? prefix + "new"
                      : prefix + "draft",
              )}
            </Badge>
            <Button disabled={busy} onClick={() => setHistory(true)}>
              {t(prefix + "history")}
            </Button>
            <Button
              disabled={busy || !data.canWrite || available === false}
              onClick={() => requestSwitch("new")}
            >
              {t(prefix + "new")}
            </Button>
            {definition.inlineActions ? actions : null}
          </div>
        </CardContent>
        {definition.inlineActions && record.updatedAt ? (
          <div className="px-4 pb-1">{saveStatus}</div>
        ) : null}
      </Card>
      {error ? (
        <RecoveryNotice
          failure={failureFromError(error)}
          onRetry={() => void save(pending.current?.complete ?? false)}
        />
      ) : null}
      {error ? (
        <Button disabled={busy} onClick={() => void reload()}>
          {t(prefix + "reload")}
        </Button>
      ) : null}
      {errors.form ? <p role="alert">{t(errors.form)}</p> : null}
      {definition.recordLayout ? (
        <RecordSectionLayout
          activeOnly
          sections={sections.map((s) => ({ id: s.id, title: s.label }))}
          active={section}
          onActive={setSection}
          isDone={(id) =>
            !Object.keys(
              validateDocument(record.values, data.config, true),
            ).some((field) => definition.sectionFor(field) === id)
          }
          railHeader={<strong>{t(prefix + "title")}</strong>}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 p-3">
              {saveStatus}
              {!definition.inlineActions ? actions : null}
            </div>
          }
          renderSection={(s) => (
            <div className="p-3">{definition.render(props, s.id, false)}</div>
          )}
        />
      ) : (
        <>
          {!flat ? (
            <Tabs
              className="flex-wrap"
              items={sections}
              value={section}
              onChange={setSection}
            />
          ) : null}
          {definition.render(props, section, flat)}
          {!definition.inlineActions && (
            <Card className="sticky bottom-0 z-10">
              <CardContent
                style={{ paddingBlock: ".5rem" }}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                {saveStatus}
                {actions}
              </CardContent>
            </Card>
          )}
        </>
      )}
      <Modal
        open={history}
        onClose={() => setHistory(false)}
        title={t(prefix + "history")}
      >
        <div className="space-y-3">
          <ClinicLedgerTable
            preferences={preferences}
            headers={[
              prefix + "lastSaved",
              prefix + "status",
              prefix + "actor",
              prefix + "open",
            ]}
            rows={data.assessments.map((r) => ({
              id: r.id,
              cells: [
                format.dateTime(r.updatedAt),
                t(prefix + r.status),
                r.actor,
                <Button
                  disabled={busy}
                  onClick={() => {
                    setHistory(false);
                    requestSwitch(r.id);
                  }}
                >
                  {t(prefix + "open")}
                </Button>,
              ],
            }))}
          />
          {record.history.map((event, i) => (
            <p key={i} className="text-xs">
              {format.dateTime(event.at)} • {event.actor} •{" "}
              {t(event.messageKey)}
            </p>
          ))}
        </div>
      </Modal>
      <Modal
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title={t(prefix + "complete")}
        footer={
          <>
            <Button disabled={busy} onClick={() => setConfirm(false)}>
              {t("Cancel")}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={busy}
              onClick={() => void save(true)}
            >
              {t("template.clinical.confirm")}
            </Button>
          </>
        }
      >
        <p>{t(prefix + "confirmHint")}</p>
        <p className="mt-3 font-semibold">
          {definition.confirmation(record.values, data.config, t)}
        </p>
      </Modal>
      <Modal
        open={switchTo !== null}
        onClose={() => setSwitchTo(null)}
        title={t(prefix + "discardTitle")}
        footer={
          <>
            <Button onClick={() => setSwitchTo(null)}>{t("Cancel")}</Button>
            <Button onClick={() => choose(switchTo ?? "new")}>
              {t("template.clinical.discard")}
            </Button>
          </>
        }
      >
        <p>{t(prefix + "discardHint")}</p>
      </Modal>
    </div>
  );
}
