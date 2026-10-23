"use client";
import React, { useState } from "react";
import {DEFAULT_PREFERENCES, effectivePreferences, type UserPreferences} from '@pepbits/preferences';
import {createFormatters} from '@pepbits/i18n';
import type {PreferenceHost} from "../preference-choice";
import {PresentationProvider} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {ClinicalTemplateAdapter} from '../../adapters/clinical-templates';
import { PatientQueryTemplate } from "./patient-query";
import { PatientRecordTemplate } from "./patient-record";
import { Patient360Template } from "./patient-360";
import {
  ClinicalLoading,
  useClinicalLoad,
  type PatientDestination,
} from "./shared";
export interface ClinicalPatientWorkspaceProps extends Partial<PreferenceHost> {
  adapter: ClinicalTemplateAdapter;
  scopeKey: string;
  initialPage?: PatientDestination;
  preferences?: UserPreferences;
  preferenceControls?: React.ReactNode;
  onOpen?: (target: PatientDestination) => void;
}
/** Remount on tenant/application/user/record scope changes. No implicit browser persistence. */
export function ClinicalPatientWorkspace(props: ClinicalPatientWorkspaceProps) {
  const preferences=props.preferencePolicy?effectivePreferences(props.preferences??DEFAULT_PREFERENCES,props.preferencePolicy):props.preferences??DEFAULT_PREFERENCES;
  return <PresentationProvider value={preferences}><ClinicalWorkspace key={props.scopeKey} {...props} preferences={preferences} /></PresentationProvider>;
}
function ClinicalWorkspace({
  adapter,
  initialPage = { view: "query" },
  preferences = DEFAULT_PREFERENCES,
  onOpen,
  preferenceControls,
  preferencePolicy, preferencesAvailable, onPreferenceChange,
}: ClinicalPatientWorkspaceProps) {
  const [page, setPage] = useState(initialPage),
    { language } = useLocalization();
  const metadata = useClinicalLoad(() => adapter.metadata(), [adapter]);
  if (!metadata.value)
    return <ClinicalLoading error={metadata.error} retry={metadata.retry} />;
  const props = {
    adapter,
    metadata: metadata.value,
    preferenceControls,
  preferencePolicy, preferencesAvailable, onPreferenceChange,
    preferences,
    format: createFormatters({
      ...preferences,
      language: language as UserPreferences["language"],
    }),
    patientId: page.patientId,
    mode: page.mode,
    onOpen: onOpen ?? setPage,
  };
  return (
    <div style={{"--fs-scale": "var(--fs-form)"} as React.CSSProperties} key={[page.view, page.patientId, page.mode].join(":")}>
      {page.view === "query" ? (
        <PatientQueryTemplate {...props} />
      ) : page.view === "record" ? (
        <PatientRecordTemplate {...props} />
      ) : (
        <Patient360Template {...props} />
      )}
    </div>
  );
}
