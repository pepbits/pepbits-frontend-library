"use client";
import React, { useEffect, useRef, useState } from "react";
import {Card, CardHeader, CardTitle, CardContent, DescriptionList, ConfirmDialog, Modal, RecoveryNotice, failureFromError} from '@pepbits/components';
import {Button, Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {PatientRecord, PatientSave, PatientSection} from '../../domain/clinical-templates';
import {ClinicalRequestFailure} from '../../adapters/clinical-templates';
import {
  ClinicalLoading,
  useClinicalLoad,
  type ClinicalPageProps,
  type PatientDestination,
} from "./shared";
import { PatientInsuranceCheck } from "./insurance-check";
import { PatientCareAction } from "./care-action";
import { RecordSectionLayout } from "@pepbits/page-engines/record-layout";
import { PatientRecordSection, patientSectionDone } from "./record-sections";
export function PatientRecordTemplate(props: ClinicalPageProps) {
  const { adapter, patientId } = props;
  const loaded = useClinicalLoad(
    () => (patientId ? adapter.load(patientId) : adapter.newRecord()),
    [adapter, patientId],
  );
  return loaded.value ? (
    <PatientRecordEditor
      key={patientId ?? "new"}
      {...props}
      initial={loaded.value}
    />
  ) : (
    <ClinicalLoading error={loaded.error} retry={loaded.retry} />
  );
}
function PatientRecordEditor({
  initial,
  adapter,
  metadata,
  preferences,
  format,
  mode = "new",
  onOpen,
  preferenceControls,
  patientId,
}: ClinicalPageProps & { initial: PatientRecord }) {
  const { t } = useLocalization(),
    [patient, setPatient] = useState(initial),
    [saved, setSaved] = useState(initial),
    [section, setSection] = useState(metadata.sections[0]!.id),
    [editing, setEditing] = useState(mode !== "view"),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState(false),
    [error, setError] = useState<unknown>(null),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [latest, setLatest] = useState<PatientRecord | null>(null),
    [leave, setLeave] = useState<PatientDestination | null>(null),
    [discard, setDiscard] = useState(false),
    [success, setSuccess] = useState(false),
    [care, setCare] = useState<"appointment" | "encounter" | null>(null),
    [collapsed, setCollapsed] = useState<string[]>([]);
  const pending = useRef<PatientSave | null>(null),
    cancelRequested = useRef(false),
    lock = useRef(false),
    alive = useRef(true),
    disabled = !editing || !metadata.canWrite || busy;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (p: PatientRecord) => {
    if (disabled) return;
    setPatient(p);
    setDirty(true);
    setSuccess(false);
    setError(null);
    pending.current = null;
  };
  const navigate = async (target: PatientDestination) => {
    if (target.view !== "record" || target.mode !== "new" || patientId) {
      onOpen(target);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const next = await adapter.newRecord();
      if (!alive.current) return;
      setPatient(next);
      setSaved(next);
      setDirty(false);
      setEditing(true);
      setErrors({});
      setError(null);
      setSuccess(false);
      setSection(metadata.sections[0]!.id);
      pending.current = null;
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const go = (target: PatientDestination) => {
    if (dirty) setLeave(target);
    else void navigate(target);
  };
  const reviewSave = () => {
    const e: Record<string, string> = {};
    for (const s of metadata.sections)
      for (const f of s.fields)
        if (f.required && !String(patient.values[f.id] ?? "").trim())
          e[f.id] = "template.validation.required";
    setErrors(e);
    if (Object.keys(e).length) {
      setSection(
        metadata.sections.find((s) => s.fields.some((f) => e[f.id]))!.id,
      );
      return;
    }
    setReview(true);
  };
  const save = async () => {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    pending.current ??= {
      record: structuredClone(patient),
      expectedVersion: patient.version,
      operationId: crypto.randomUUID(),
    };
    try {
      const result = await adapter.save(pending.current);
      if (!alive.current) return;
      setPatient(result);
      setSaved(result);
      setDirty(false);
      setSuccess(true);
      setErrors({});
      setReview(false);
      pending.current = null;
    } catch (e) {
      if (!alive.current) return;
      setReview(false);
      setError(e);
      if (e instanceof ClinicalRequestFailure) {
        setErrors(e.fieldErrors);
        const s = metadata.sections.find(
          (s) =>
            s.fields.some((f) => e.fieldErrors[f.id]) ||
            s.collections.some((c) =>
              Object.keys(e.fieldErrors).some(
                (k) => k === c || k.startsWith(c + "."),
              ),
            ),
        );
        if (s) setSection(s.id);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const loadLatest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const p = await adapter.load(patient.id);
      if (alive.current) setLatest(p);
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const index = metadata.sections.findIndex((s) => s.id === section),
    layout = preferences.formNavigation;
  const fullName = [
    patient.values.firstName,
    patient.values.middleName,
    patient.values.lastName,
  ]
    .filter(Boolean)
    .join(" ");
  const primaryAction = (
    <Button
      variant="primary"
      loading={busy}
      disabled={!metadata.canWrite}
      onClick={() => (editing ? reviewSave() : setEditing(true))}
    >
      {t(
        patient.id === "new"
          ? "template.clinical.createPatient"
          : editing
            ? "template.clinical.saveChanges"
            : "template.clinical.editRecord",
      )}
    </Button>
  );
  return (
    <div data-clinical-record>
      {success ? (
        <p role="status" className="p-2 text-sm">
          {t("template.clinical.saved")}
        </p>
      ) : null}
      {error ? (
        <div>
          <RecoveryNotice
            failure={failureFromError(error)}
            onRetry={() => void save()}
            preservesValues
            busy={busy}
          />
          {(error as { status?: number }).status === 409 ? (
            <Button disabled={busy} onClick={() => void loadLatest()}>
              {t("template.reviewLatest")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {Object.keys(errors).length ? (
        <div role="alert" className="text-sm text-[var(--danger-ink)]">
          {[...new Set(Object.values(errors))].map((e) => (
            <p key={e}>{t(e)}</p>
          ))}
        </div>
      ) : null}
      <RecordSectionLayout
        sections={metadata.sections}
        active={section}
        onActive={setSection}
        isDone={(id) => patientSectionDone(id, patient)}
        identity={
            <div>
              <h2 className="font-bold">{fullName || t("template.clinical.newPatient")}</h2>
              <div className="flex gap-3 text-xs text-[var(--text-muted)]">
                {patient.mrn ? <Badge>{patient.mrn}</Badge> : null}
                {patient.values.gender
                  ? t(`template.clinical.${patient.values.gender}`)
                  : null}
                {patient.values.birthDate
                  ? format.date(String(patient.values.birthDate))
                  : null}
              </div>
            </div>
        }
        railHeader={
          <>
            <p className="text-[10px] uppercase tracking-widest opacity-70">
              {t("template.clinical.record")}
            </p>
            <p className="mt-1 text-xl font-semibold">
              {fullName || t("template.clinical.newPatient")}
            </p>
            <p className="mt-1 text-xs opacity-70">
              {patient.mrn || t("template.clinical.mrnPending")}
            </p>
          </>
        }
        renderSection={(s) => (
          <PatientRecordSection
            section={s}
            index={metadata.sections.indexOf(s)}
            patient={patient}
            metadata={metadata}
            disabled={disabled}
            canToggleRead={editing}
            reading={collapsed.includes(s.id) || !editing}
            onRead={() =>
              setCollapsed((c) =>
                c.includes(s.id) ? c.filter((v) => v !== s.id) : [...c, s.id],
              )
            }
            update={update}
            errors={errors}
            format={format}
          >
            {s.id === "insurance" &&
            patient.id !== "new" &&
            patient.values.hasInsurance ? (
              <PatientInsuranceCheck
                key={patient.version}
                patient={patient}
                adapter={adapter}
                disabled={busy || dirty}
              />
            ) : null}
          </PatientRecordSection>
        )}
        footer={
          <>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Badge tone={dirty ? "warning" : "success"}>
                {t(
                  dirty
                    ? "template.unsaved"
                    : patient.id === "new"
                      ? "template.clinical.draftRecord"
                      : editing
                        ? "template.clinical.edit"
                        : "template.clinical.view",
                )}
              </Badge>
              {dirty ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setDiscard(true)}
                >
                  {t("template.clinical.discard")}
                </Button>
              ) : null}
            </div>
            {preferenceControls}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={busy || !metadata.canWrite}
                onClick={() => go({ view: "record", mode: "new" })}
              >
                {t("New")}
              </Button>
              {patient.id !== "new" && !editing ? (
                <>
                  <Button
                    size="sm"
                    disabled={busy || !metadata.canWrite}
                    onClick={() => setCare("encounter")}
                  >
                    {t("template.clinical.encounter")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || !metadata.canWrite}
                    onClick={() => setCare("appointment")}
                  >
                    {t("template.clinical.book")}
                  </Button>
                </>
              ) : null}
              {editing ? (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (patient.id === "new") {
                      go({ view: "query" });
                      return;
                    }
                    if (dirty) {
                      cancelRequested.current = true;
                      setDiscard(true);
                    } else setEditing(false);
                  }}
                >
                  {t("Cancel")}
                </Button>
              ) : null}
              {layout === "wizard" ? (
                <>
                  <Button
                    disabled={index === 0}
                    onClick={() => setSection(metadata.sections[index - 1]!.id)}
                  >
                    {t("template.previous")}
                  </Button>
                  {index < metadata.sections.length - 1 ? (
                    <Button
                      variant="primary"
                      onClick={() =>
                        setSection(metadata.sections[index + 1]!.id)
                      }
                    >
                      {t("template.next")}
                    </Button>
                  ) : (
                    primaryAction
                  )}
                </>
              ) : (
                primaryAction
              )}
            </div>
          </>
        }
      />
      <Modal
        open={review}
        onClose={() => {
          if (!busy) setReview(false);
        }}
        title="template.clinical.reviewSave"
        size="xl"
        footer={
          <>
            <Button disabled={busy} onClick={() => setReview(false)}>
              {t("Cancel")}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() => void save()}
            >
              {t(
                patient.id === "new"
                  ? "template.clinical.createPatient"
                  : "template.clinical.confirm",
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">{t("template.clinical.reviewHelp")}</p>
          {metadata.sections.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle
                  title={s.title}
                  action={
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setReview(false);
                        setSection(s.id);
                      }}
                    >
                      {t("template.clinical.edit")}
                    </Button>
                  }
                />
              </CardHeader>
              <CardContent>
                <DescriptionList
                  items={[
                    ...s.fields
                      .filter(
                        (f) =>
                          patient.values[f.id] !== "" &&
                          patient.values[f.id] !== false,
                      )
                      .map((f) => ({
                        id: f.id,
                        label: f.label,
                        value:
                          f.type === "checkbox"
                            ? t("template.clinical.yes")
                            : f.options
                              ? t(
                                  f.options.find(
                                    (o) => o.value === patient.values[f.id],
                                  )?.label ?? String(patient.values[f.id]),
                                )
                              : String(patient.values[f.id]),
                      })),
                    ...s.collections.map((id) => ({
                      id,
                      label: `template.clinical.${id}`,
                      value: String(patient.collections[id]?.length ?? 0),
                    })),
                  ]}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </Modal>
      <ConfirmDialog
        open={discard}
        title="template.clinical.discard"
        message="template.replaceLocalHelp"
        onCancel={() => {
          cancelRequested.current = false;
          setDiscard(false);
        }}
        onConfirm={() => {
          setPatient(structuredClone(saved));
          if (cancelRequested.current) setEditing(false);
          cancelRequested.current = false;
          setDirty(false);
          setErrors({});
          setError(null);
          pending.current = null;
          setDiscard(false);
        }}
      />
      <ConfirmDialog
        open={!!leave}
        title="template.clinical.unsaved"
        message="template.replaceLocalHelp"
        onCancel={() => setLeave(null)}
        onConfirm={() => {
          if (leave) {
            setDirty(false);
            void navigate(leave);
            setLeave(null);
          }
        }}
      />
      <ConfirmDialog
        open={!!latest}
        title="template.reviewLatest"
        message="template.replaceLocalHelp"
        onCancel={() => setLatest(null)}
        onConfirm={() => {
          if (latest) {
            setPatient(latest);
            setSaved(latest);
            setDirty(false);
            setErrors({});
            setError(null);
            pending.current = null;
            setLatest(null);
          }
        }}
      />
      {care ? (
        <PatientCareAction
          kind={care}
          patientId={patient.id}
          adapter={adapter}
          metadata={metadata}
          onClose={() => setCare(null)}
          onDone={() => setCare(null)}
        />
      ) : null}
    </div>
  );
}
