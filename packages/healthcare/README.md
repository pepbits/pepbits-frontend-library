# @pepbits/healthcare

Healthcare product components, one subpath per area. `@pepbits/healthcare/clinical` holds the clinical forms (renamed from `@pepbits/clinical` on 28 October 2026; source under `src/clinical`). Later areas (laboratory, pharmacy and so on) get their own subpath.

Clinical form sections, forms and encounter queues that any encounter type can use: outpatient, emergency, inpatient, day care, home care and long-term care. Built on `@pepbits/ui`, `@pepbits/components`, `@pepbits/patterns`, `@pepbits/icons` and the semantic theme tokens. Version `0.2.0` (prepared locally, in the fixed package group); **not published**. React 19 or later.

It covers outpatient nurse intake and emergency triage (ESI), rebuilt from the AllyVora clinical workspace. Field names, validation messages, status changes and API payloads follow that source. The full pain assessment and inpatient observations are not included yet (see [Limits](#limits)).

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

## Preferences, accessibility and failures

Theme tokens, `--fs-scale` text sizes and the radius token apply; the queue table follows managed density, stripes and sticky headers; times use the host time format and relative times the interface language. Control labels pass through the host translator; the section copy is English, and no canonical catalogue keys were added yet. Segmented choices are radio groups, the pain score is a radio group, panels are labelled regions and problems are an alert. Load failures show `ErrorState` with retry; save failures keep every entered value; a failed queue refresh keeps the previous list.

## Limits

Not included yet: the emergency tracking board (in-department table, reassessment timers, medication administration; `EsiLevelCounts` is ready for it), the full pain assessment (scales and body maps), inpatient observation forms, configurable vital-sign parameters, a configuration-driven composer for arbitrary clinical forms, the queues' End visit action, and reproductive-status and care-gap flags in the banner. Arabic, Hindi and Malayalam copy for the section text is a follow-up.
