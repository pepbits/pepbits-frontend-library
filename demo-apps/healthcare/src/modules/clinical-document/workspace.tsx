"use client";
import React, { useMemo, useState } from "react";
import {Card, CardContent, CardGrid, Modal, PresentationProvider} from '@pepbits/components';
import {Input, Select, Badge, Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {effectivePreferences, type UserPreferences} from '@pepbits/preferences';
import {createFormatters, type Formatters} from '@pepbits/i18n';
import {type PatientRecord} from '../../domain/clinical-templates';
import type {ClinicalDocumentAdapter} from '../../adapters/clinical-document';
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
import type { PreferenceHost } from "../preference-choice";
import { ClinicalLoading, useClinicalLoad } from "../clinical-templates/shared";
import {
  ClinicalDocumentEditor,
  type ClinicalDocumentDefinition,
} from "./editor";
export interface ClinicalDocumentWorkspaceProps<V, C> extends PreferenceHost {
  definition: ClinicalDocumentDefinition<V, C>;
  pageId: string;
  adapter: ClinicalDocumentAdapter<V, C>;
  patients: ClinicalTemplateAdapter;
  scopeKey: string;
  patientId?: string;
  renderPatient?: (
    patient: PatientRecord,
    format: Formatters,
  ) => React.ReactNode;
}
export function ClinicalDocumentWorkspace<V, C>(
  props: ClinicalDocumentWorkspaceProps<V, C>,
) {
  const preferences = props.preferencePolicy
    ? effectivePreferences(props.preferences, props.preferencePolicy)
    : props.preferences;
  return (
    <PresentationProvider value={preferences}>
      <DocumentWorkspace
        key={props.scopeKey}
        {...props}
        preferences={preferences}
      />
    </PresentationProvider>
  );
}
function DocumentWorkspace<V, C>(props: ClinicalDocumentWorkspaceProps<V, C>) {
  const { t } = useLocalization(),
    [query, setQuery] = useState(""),
    [id, setId] = useState(props.patientId ?? ""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [next, setNext] = useState<string | null>(null),
    list = useClinicalLoad(
      () => props.patients.search({ q: query, pageSize: props.preferences.pageSize, page: 1 }),
      [props.patients, query, props.preferences.pageSize],
    );
  const options = [
    { value: "", label: "template.clinical.selectPatient" },
    ...(list.value?.rows ?? []).map((p) => ({
      value: p.id,
      label: p.mrn + " • " + p.name,
    })),
  ];
  if (id && !options.some((o) => o.value === id))
    options.push({ value: id, label: id });
  return (
    <div
      data-op-consultation={props.pageId === "op-consultation" ? "" : undefined}
      data-comprehensive-consultation={props.pageId === "comprehensive-consultation" ? "" : undefined}
      data-clinical-document
      data-clinical-triage={props.pageId === "clinical-triage" ? "" : undefined}
      data-clinical-consultation={
        props.pageId === "clinical-consultation" ? "" : undefined
      }
      data-tour={props.pageId}
      className="space-y-3"
      style={{ "--fs-scale": "var(--fs-form)" } as React.CSSProperties}
    >
      <Card>
        <CardContent style={{ paddingBlock: ".5rem" }}>
          <CardGrid columns={3}>
            <Input
              label="template.clinical.search"
              value={query}
              disabled={busy}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              label="template.clinical.selectPatient"
              placeholder=""
              value={id}
              options={options}
              disabled={busy}
              onChange={(e) => {
                if (dirty) setNext(e.target.value);
                else setId(e.target.value);
              }}
            />
            <div className="flex items-center justify-end">
              <Badge tone="warning">
                {t(props.definition.prefix + "demo")}
              </Badge>
            </div>
          </CardGrid>
          {list.error ? (
            <ClinicalLoading error={list.error} retry={list.retry} />
          ) : null}
        </CardContent>
      </Card>
      {id ? (
        <DocumentPatient
          key={id}
          {...props}
          patientId={id}
          onDirty={setDirty}
          onBusy={setBusy}
        />
      ) : (
        <p>{t(props.definition.prefix + "choosePatient")}</p>
      )}
      <Modal
        open={next !== null}
        onClose={() => setNext(null)}
        title={t(props.definition.prefix + "discardTitle")}
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
        <p>{t(props.definition.prefix + "discardHint")}</p>
      </Modal>
    </div>
  );
}
function DocumentPatient<V, C>({
  definition,
  renderPatient,
  adapter,
  patientId,
  preferences,
  preferencesAvailable,
  onDirty,
  onBusy,
}: ClinicalDocumentWorkspaceProps<V, C> & {
  patientId: string;
  onDirty: (b: boolean) => void;
  onBusy: (b: boolean) => void;
}) {
  const { t, language } = useLocalization(),
    loaded = useClinicalLoad(
      () => adapter.load(patientId),
      [adapter, patientId],
    ),
    format = useMemo(
      () =>
        createFormatters({
          ...preferences,
          language: language as UserPreferences["language"],
        }),
      [preferences, language],
    );
  if (!loaded.value)
    return <ClinicalLoading error={loaded.error} retry={loaded.retry} />;
  const patient = loaded.value.patient;
  return (
    <>
      {renderPatient ? (
        renderPatient(patient, format)
      ) : (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <strong>
            {[patient.values.firstName, patient.values.lastName].join(" ")}
          </strong>
          <Badge>{patient.mrn}</Badge>
          <span className="text-xs text-[var(--text-muted)]">
            {format.date(String(patient.values.birthDate ?? ""))} •{" "}
            {t("template.clinical." + patient.values.gender)} •{" "}
            {String(patient.values.mobile ?? "")}
          </span>
        </div>
      )}
      <ClinicalDocumentEditor
        definition={definition}
        initial={loaded.value}
        adapter={adapter}
        preferences={preferences}
        available={preferencesAvailable}
        format={format}
        onDirty={onDirty}
        onBusy={onBusy}
      />
    </>
  );
}
