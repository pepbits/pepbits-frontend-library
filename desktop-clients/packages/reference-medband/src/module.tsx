"use client";
import { useMemo, type ReactNode } from "react";
import { DEFAULT_PREFERENCES } from "@pepbits/erp-config";
import { LocalizedText, LocalizationAliasProvider } from "@pepbits/ops-ui";
import { ReferenceHostProvider, referenceScopeKey, type ReferenceHost, type ReferenceModuleProps } from "@pepbits/reference-host";
import medbandCopy from "../medband-copy.json";
import TodayPage from "./app/page";
import FindPatientPage from "./app/patients/page";
import RegisterPatientPage from "./app/patients/new/page";
import PatientRecordPage from "./app/patients/[id]/page";
import EncountersPage from "./app/encounters/page";
import NewEncounterPage from "./app/encounters/new/page";
import AdmissionsPage from "./app/admissions/page";
import NewAdmissionPage from "./app/admissions/new/page";
import EpisodesPage from "./app/episodes/page";
import { MedbandShell } from "./components/shell/MedbandShell";
import { ToastProvider } from "./components/ui/overlay";
import { MedbandProvider } from "./lib/store";
import { resolveMedbandRoute, type MedbandMatch } from "./routes";

function page(match: MedbandMatch): ReactNode {
  switch (match.kind) {
    case "today": return <TodayPage />;
    case "patients": return <FindPatientPage />;
    case "patient-new": return <RegisterPatientPage />;
    case "patient": return <PatientRecordPage params={{ id: match.params.id }} />;
    case "encounters": return <EncountersPage />;
    case "encounter-new": return <NewEncounterPage />;
    case "admissions": return <AdmissionsPage />;
    case "admission-new": return <NewAdmissionPage />;
    case "episodes": return <EpisodesPage />;
  }
}

/**
 * Reference-default presentation. The source skin (teal palette, Public Sans, source table cells) shows while the effective
 * theme, font and table preferences are at the host defaults; any other effective value (a user choice or a tenant lock) is the
 * host's and drives the module through the shared tokens. Corner radius and font scales are always preference-driven.
 */
export function medbandPresentation(preferences: ReferenceHost["preferences"]) {
  return {
    "data-medband-palette": preferences.theme === DEFAULT_PREFERENCES.theme ? "reference" : "host",
    "data-medband-font": preferences.fontFamily === DEFAULT_PREFERENCES.fontFamily ? "reference" : "host",
    "data-medband-table": preferences.density === DEFAULT_PREFERENCES.density && preferences.wrapCellText === DEFAULT_PREFERENCES.wrapCellText ? "reference" : "host",
  } as const;
}

/**
 * MedBand patient access workspace. The host supplies the enterprise header and sidebar; this renders only the source page body
 * plus its working toolbar. Identity comes from the host session: GET /bootstrap through the host API transport returns the
 * source `{ master, data }` with the trusted current user. Everything loaded, cached or in flight lives under the authenticated
 * scope key, so a tenant, branch, user or role change disposes the workspace, aborts its requests and starts empty.
 */
export function ReferenceMedbandModule({ path, host }: ReferenceModuleProps) {
  const current = useMemo(() => ({ ...host, path }), [host, path]);
  const match = resolveMedbandRoute(path);
  return (
    <ReferenceHostProvider host={current}><LocalizationAliasProvider aliases={medbandCopy}>
      <div className="reference-medband" data-reference-module="medband" data-theme={host.preferences.theme} data-density={host.preferences.density} {...medbandPresentation(host.preferences)}>
        <MedbandProvider key={referenceScopeKey(host.scope)} fallback={<div role="status" className="flex min-h-[40vh] items-center justify-center gap-3 text-ink-soft"><span className="h-3 w-10 animate-pulse rounded-full bg-band" /><span className="text-sm font-medium"><LocalizedText message="Loading MedBand" /></span></div>}>
          <ToastProvider>
            <MedbandShell>
              {match ? <div key={`${match.kind}:${match.params.id ?? ""}`} className="h-full">{page(match)}</div> : <p role="status" className="p-6 text-sm"><LocalizedText message="MedBand page not found" /></p>}
            </MedbandShell>
          </ToastProvider>
        </MedbandProvider>
      </div>
    </LocalizationAliasProvider></ReferenceHostProvider>
  );
}
