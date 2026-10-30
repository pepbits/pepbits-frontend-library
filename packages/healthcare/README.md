# @pepbits/healthcare

Healthcare product components, one subpath per area. `@pepbits/healthcare/clinical` holds the clinical forms (renamed from `@pepbits/clinical` on 28 October 2026; source under `src/clinical`). Later areas (laboratory, pharmacy and so on) get their own subpath.

Clinical form sections, forms and encounter queues that any encounter type can use: outpatient, emergency, inpatient, day care, home care and long-term care. Built on `@pepbits/ui`, `@pepbits/components`, `@pepbits/patterns`, `@pepbits/icons` and the semantic theme tokens. Version `0.2.0` (prepared locally, in the fixed package group); **not published**. React 19 or later.

It covers outpatient nurse intake, emergency triage (ESI) and the consultation workspace, rebuilt from the AllyVora clinical workspace. Field names, validation messages, status changes and API payloads follow that source. Inpatient observation forms remain outside this package's current scope (see [Limits](#limits)).

## Layer

`healthcare` sits beside `page-engines`: it may import `tokens`, `icons`, `i18n`, `preferences`, `ui`, `components`, `data`, `platform` and `patterns`. No generic layer may import it. `npm run check:boundaries` enforces both directions.

## Public API

`@pepbits/healthcare/clinical/model` has no React imports and is safe for servers, workers and tests:

| Area | Exports |
| --- | --- |
| Types | `EncounterClass`, `ClinicalPatient(Lite)`, `Encounter`, `QueueRow`, `EncounterDetail`, `AllergyBlock`, `Allergy`, `Observation`, `CatalogItem`, `CatalogName`, `ScoreResult`, `ClinicalActor`, `LOINC` |
| Data port | `ClinicalDataPort`, `NewAllergy`, `IntakeResult`, `problemsOf` |
| Profiles | `IntakeProfile`, `IntakeSectionId`, `OUTPATIENT_INTAKE`, `EMERGENCY_TRIAGE`, `INTAKE_PROFILES`, `intakeProfileFor` |
| Vitals | `Vitals`, `EMPTY_VITALS`, `VITAL_RANGES`, `measurementErrors`, `vitalsErrors`, `vitalsComplete`, `vitalsPayload`, `withoutUnmeasured`, `bmiPreview`, `news2Inputs` |
| Screening | `SCREENING_QUESTIONS`, `SCREENING_ANSWERS`, `questionsFor`, `flaggedQuestions`, `screeningPayload` |
| Intake | `IntakeState`, `EMPTY_INTAKE`, `IntakePayload`, `intakeProblems`, `intakePayload` |
| Triage (ESI) | `EsiLevel`, `ESI_LEVELS`, `EsiDecisions`, `EMPTY_ESI`, `EsiOverride`, `TriageValue`, `EMPTY_TRIAGE`, `EsiPreview`, `EMERGENCY_AREAS`, `ESI_B_QUESTIONS`, `esiAsksB`, `esiAsksC`, `withEsiAnswer`, `esiInputs`, `finalEsiLevel`, `triageProblems`, `triagePayload` |

`@pepbits/healthcare/clinical` re-exports the model and adds the React parts:

| Kind | Exports |
| --- | --- |
| Context | `ClinicalProvider`, `useClinicalPort`, `useClinicalActor` |
| Sections | `PatientBanner`, `VitalsSection`, `ArrivalComplaintSection`, `AllergyReviewSection`, `ScreeningSection`, `EsiSection` |
| Section parts | Vitals: `VitalsFields`, `News2Panel`, `useNews2`. Arrival and complaint: `ArrivalFields`, `ArrivalModeChoice`, `HistorySourceChoice`, `InterpreterChoice`, `ComplaintField`, `CodedChip`, `PatientWordsField`, `CodedSearch`. Allergies: `AllergyStrip`, `AllergyList`, `AllergyReviewChoice`, `AddAllergyForm`. Screening: `ScreeningQuestionRow`, `ScreeningActionNotice`. Triage: `EsiDecisionPoints`, `EsiDecisionRow`, `YesNoChoice`, `EsiResourcesChoice`, `EsiResultSummary`, `EsiOverrideFields`, `AreaSelect`, `EsiLevelChip`, `useEsiPreview` |
| Layout | `ClinicalPanel`, `ChoiceField`, `ProblemNotice` |
| Forms | `IntakeForm`, `SaveChecklist`, `ChecklistLine`, `FormSaveBar` |
| Queues | `EncounterQueue`, `SafetyBadges`, `OUTPATIENT_STAGES`, `IntakeQueue`, `TriageQueue`, `TriageWaitingRow`, `EsiLevelCounts`, `TRIAGE_ROLES`, `QueueHeader`, `WaitTime`, `PatientFlags`, `StaleListNotice`, `useEncounterRows` |
| Time | `useClock`, `useRelativeTime`, `waitLabel` |

## How it fits together

- **Sections are controlled.** Each takes `value`/`onChange` (or the data it shows) and never builds a URL, so the same `VitalsSection` works in intake, triage, ward rounds or a home visit.
- **Data comes through a port.** The host implements `ClinicalDataPort` (an HTTP client, a test double) and passes it to `ClinicalProvider`. A rejected call is an `Error`; an optional `problems: string[]` property lists server validation failures, which the forms show as a list.
- **Small parts compose into sections.** Every section is built from exported parts (a single choice, a list, a row), so a host can assemble a different form from the same pieces without copying markup.
- **Profiles decide the form.** `IntakeProfile` lists the sections, whether the complaint is required, whether to ask how the patient arrived, which queue statuses are waiting, the status change on opening and the save wording. `EMERGENCY_TRIAGE` adds the `triage` section; opening it keeps the visit in `waiting-triage`. `intakeProfileFor('IP')` is undefined: inpatients record observations instead, and the form refuses an inpatient encounter as the API does.
- **Scores are previews.** `useNews2` and `useEsiPreview` ask the port 300 ms after the last change and never send invalid measurements; the server recalculates on save. The ESI algorithm stays on the server: the package only sends the answered decisions, age and HR/RR/SpO₂ and shows the level and steps it returns. Changing an earlier ESI answer clears the answers below it.
- **Triage roles.** `TriageQueue` offers "Triage now" to the `nurse` and `doctor` roles only, as the source does; the API enforces it.
- **Actor gating is UI only.** `ClinicalProvider actor` (role and permissions) shows or hides actions; the server enforces access.

```tsx
import {ClinicalProvider, IntakeForm, IntakeQueue, OUTPATIENT_INTAKE, type ClinicalDataPort} from '@pepbits/healthcare/clinical';

export function NurseIntake({port, actor, encounterId, open}: {port: ClinicalDataPort; actor: {role: string; permissions: string[]} | null; encounterId?: string; open: (id?: string) => void}) {
  return <ClinicalProvider port={port} actor={actor}>
    {encounterId
      ? <IntakeForm encounterId={encounterId} profile={OUTPATIENT_INTAKE} onSaved={() => open()} onCancel={() => open()}/>
      : <IntakeQueue profile={OUTPATIENT_INTAKE} onOpenIntake={row => open(row.id)}/>}
  </ClinicalProvider>;
}
```

The host also provides `PreferenceHost`, `LocalizationProvider` and `ScreenHostProvider` (notifications), as for every `@pepbits` screen. The [healthcare demo module](../../demo-apps/healthcare/src/modules/outpatient) implements the port over the AllyVora clinical workspace API.

## Consultation workspace

`ConsultWorkspace` assembles the consultation note, clinical records and orders for an encounter. Open a visit, review the patient banner and safety findings, complete the note and plan, review orders, then save and sign. The workspace coordinates versioned draft saves, signing, conflicts, signed-note addenda, care-team changes and ending the visit. Signing waits for pending saves; refreshed records must not replace unsaved note content. A server conflict requires reconciliation before signing again.

Integration status at the INT-B verification snapshot: section implementations are merged, but the default workspace registry still contains placeholders and the public barrel does not yet export the workspace. Connecting those sections and exports belongs to the parallel INT-A integration. The host example below describes the public composition after that assembly; it is not evidence of a working installed consumer.

Included sections cover complaint/HPI, review of systems and examination, social and family history, diagnoses and the problem list, assessment, allergies and their audit history, configurable vitals and corrections/trends, NEWS2, pain scales/body map, screening and reproductive status, nursing review/clarification, medication/investigation/procedure history, scores, assessments and care gaps/programmes. Orders include laboratory questions, imaging and procedures (including dental sites and completion), medication safety and substitution decisions, referrals, education, disposition and issued certificates. AI suggestions require clinician review; the port supplies their service.

Score autofill uses `loadScoreAutofill(patientId, encounterId?, signal?)`. Confirmed diagnoses fill Yes and show provenance; provisional diagnoses show a warning for clinician review. Missing diagnoses never mean No, and record fills do not overwrite an answered item. Surgical-history corrections include `entered-in-error`, with the record version and a reason. `ConsultationOrder` includes procedure completion time, performer, outcome and typed timing/consent/specialty details, so hosts can pass loaded orders to procedure controls.

The [consultation contracts](src/clinical/CONSULT-CONTRACTS.md) describe the DTOs and lifecycle rules. Supply `ClinicalDataPort.consult: ConsultationDataPort`; it is optional only for intake hosts. The 82-method interface composes these groups:

| Group | Host responsibility |
| --- | --- |
| `ConsultNotePort` | Load consultation, save/version/sign note and addenda |
| `AllergyLifecyclePort`, `VitalsPort`, `PainPort`, `ScreeningPort` | Findings, corrections, review and parameter/reference reads |
| `HistoryPort`, `ProblemPort` | Longitudinal history, corrections and diagnosis/problem links |
| `ScoresPort`, `AssessmentsPort`, `CareProgrammesPort` | Score preview/autofill/save, governed assessment launch and care decisions |
| `OrdersPort`, `ReferencePort` | Order evaluation/safety/completion, certificates and reference searches |
| `CareTeamPort`, `EncounterEndPort`, `AiPort` | Team assignment, visit-end checks and AI suggestions |
| Inherited intake methods | `setEncounterStatus`, `previewEsi`, `saveIntake` |

`ClinicalDataPort.domain?: ConsultDomainPort` exposes the separate 17-method domain boundary for substitution, MAR, returns, vaccine courses and laboratory questions. Optional means a host may supply the workflow through a slot; it does not mean an unavailable workflow succeeded. All HTTP, API path mapping, authentication/session services, tenant scoping and server permission enforcement stay in the host.

Wrap the workspace in `ConsultHostProvider` as well as `ClinicalProvider`. `ConsultHost.onNavigate` receives typed destinations, such as patient-chart, consultation, inpatient, assessment, certificate or MAR, plus `replace`/`newTab` options. `renderLink` must produce a real link with the same destination semantics. The host resolves URLs and browser windows. `onPatientOpened` synchronizes the shell patient, `onDirtyChange` connects SPA navigation guards, `initialTab` selects consult/administer, and `stickyOffset` matches the containing shell.

The administration, telehealth and substitution slots (`renderAdministration`, `renderTelehealth`, `renderSubstitution`) receive the detail, read-only state, records-refresh callback and busy callback; substitution also receives the order. Report unsaved domain work through `onBusyChange`. `renderMedicationHistory`, `renderInvestigationHistory` and `renderScreening` receive controlled section props; investigation history also receives its kind. Call `onRecordsChanged` after writes. The host owns MAR, medication returns, vaccines, the pharmacy proposal editor, telehealth sessions/popups and printing. Certificate navigation delegates document rendering/printing to the host. Missing visible host workflows show an unavailable state.

Minimal composition inside the host's existing preferences, localization, presentation and screen-host providers:

```tsx
import {
  ClinicalProvider, ConsultHostProvider, ConsultWorkspace,
  type ClinicalActor, type ClinicalDataPort, type ConsultationDataPort,
  type ConsultHost,
} from '@pepbits/healthcare/clinical';

export function ConsultationPage({encounterId, port, actor, host}: {
  encounterId: string;
  port: ClinicalDataPort & {consult: ConsultationDataPort};
  actor: ClinicalActor | null;
  host: ConsultHost;
}) {
  // host supplies onNavigate/renderLink and the domain slots this app supports.
  return <ClinicalProvider port={port} actor={actor}>
    <ConsultHostProvider value={host}>
      <ConsultWorkspace key={encounterId} encounterId={encounterId}/>
    </ConsultHostProvider>
  </ClinicalProvider>;
}
```

Keep adapter/provider identities stable between renders. Read methods accept abort signals; hosts should honor them. Reject failed writes with `ClinicalPortError`-compatible errors (`message`, optional `problems`, `status: 409` for conflicts), retain retry request IDs/payloads for domain writes, and return server versions/capabilities unchanged. The package does not supply an HTTP adapter, durable offline persistence or server authorization.

New copy still needs canonical translations and native-language review, including Arabic, Hindi and Malayalam. This port has local TypeScript and synthetic Vitest verification only; no live API acceptance, browser acceptance or clinical validation is claimed. See the [integration release record](../../docs/releases/unreleased/consult-workspace-2026-10-28.md) for the exact source and checks.

## Preferences, accessibility and failures

Theme tokens, `--fs-scale` text sizes and the radius token apply; the queue table follows managed density, stripes and sticky headers; times use the host time format and relative times the interface language. Control labels pass through the host translator; the section copy is English, and no canonical catalogue keys were added yet. Segmented choices are radio groups, the pain score is a radio group, panels are labelled regions and problems are an alert. Load failures show `ErrorState` with retry; save failures keep every entered value; a failed queue refresh keeps the previous list.

## Limits

Not included yet: the emergency tracking board (in-department table and reassessment timers; `EsiLevelCounts` is ready for it), inpatient observation forms, a configuration-driven composer for arbitrary clinical forms, and the queues' End visit action (the consultation workspace has its own end-visit flow). MAR, returns, vaccines, pharmacy proposal editing, telehealth and printing require host workflows. Translations for new section text, live API acceptance and clinical review remain follow-ups.
