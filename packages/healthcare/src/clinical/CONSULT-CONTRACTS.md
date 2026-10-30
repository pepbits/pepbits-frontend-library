# Consultation foundation freeze — 28 October 2026

All paths below are relative to `packages/healthcare/src/clinical/`.
WP1–WP4 are merged for integration. The foundation ownership and verification below are retained historical context;
the integration amendments below take precedence. No host adapter or deployment is included.

## Integration amendments — INT-B, 28 October 2026

- Source repository: `pepbits/dev`; frozen frontend snapshot `7ee558f`, with the score-autofill behavior
  from `5a8dea4` ("Fill yes/no score items from confirmed diagnoses") carried forward.
- `ScoresPort.loadScoreAutofill(patientId, encounterId?, signal?)` now includes encounter context and keeps the
  abort signal last. Adapters using the old `(patientId, signal?)` signature must update their second/third
  arguments and forward encounterId to the source query when supplied. The method count remains 82.
- `ScoreAutofillValue.value` includes boolean; source includes `condition`; diagnosis provenance includes
  `unconfirmed`, `verification` and `where`. Confirmed diagnoses fill Yes only into unanswered inputs.
  Provisional diagnoses display their provenance and are not used; missing diagnoses leave items unanswered.
  Manual answers survive refill. Patient/encounter/port changes fence obsolete reads.
- `ProcedureHistory.verification` and `ProcedureHistoryPatch` accept `entered-in-error`, matching the source
  `components/clinical/PatientHistory.tsx`. Corrections require a reason and version; quick confirmation keeps
  its existing optional reason. The procedure editor now offers all four source verification values.
- `ConsultationDetail.orders` uses the named `ConsultationOrder` DTO, extending the existing `MedicationOrder`
  model. Shared order fields now include `completedAt`, `performedByName`, `outcome`, and typed
  `details.timing`, `details.consentRequired`, `details.specialty`. These optional fields preserve intake and
  medication compatibility and structurally satisfy WP4's local `ProcedureOrder`. No type was moved;
  existing imports from `models/consult-orders` and order-component imports continue to compile.
- Host integration and limits are in the [package guide](../../README.md#consultation-workspace).
  Current local check results and source identity belong to the
  [integration record](../../../../docs/releases/unreleased/consult-workspace-2026-10-28.md), not the historical
  foundation test counts below. New text still needs canonical translations; live API acceptance is not included.

## Ownership (inventory section 5)

| Package | Exact owned files | Responsibility / dependency |
| --- | --- | --- |
| **WP1 — workspace and lifecycle** | `index.ts`, `consult/index.ts`, `consult/Workspace.tsx`, `consult/useConsultDraft.ts`, `consult/draft-save.ts`, `consult/SignDialog.tsx`, `consult/AiTray.tsx`, `consult/EncounterEnd.tsx`, `consult/CareTeam.tsx`, `consult/Workspace.test.tsx`, `consult/draft-save.test.ts` | Workspace state, save/sign/conflict sequencing, addenda/end visit, AI, care-team workflow, host slots/navigation, final public exports. Develop against frozen section slots; assemble WP2–4 after they land. |
| **WP2 — findings and safety review** | `allergy/AllergySection.tsx`, `allergy/AllergyForm.tsx`, `allergy/AllergyActions.tsx`, `allergy/AllergyHistory.tsx`, `vitals/model.ts`, `vitals/VitalsSection.tsx`, `vitals/News2Panel.tsx`, `vitals/useVitalParameters.ts`, `vitals/RecordVitals.tsx`, `vitals/Corrections.tsx`, `vitals/Trends.tsx`, `pain/BodyMap.tsx`, `pain/PainSection.tsx`, `screening/ScreeningSection.tsx`, `screening/ScreeningReview.tsx`, `screening/PregnancyStatus.tsx`, `banner/PatientBanner.tsx`, `consult-records/index.ts`, `consult-records/ReviewSection.tsx`, `consult-records/NursingEntries.tsx`, `consult-records/ReviewSection.test.tsx` | Extend existing sections; allergy lifecycle, configurable vitals/corrections, pain, screening, review tasks and nursing clarification. Depends only on foundation and pre-existing shared exports. |
| **WP3 — note and longitudinal history** | `consult-note/index.ts`, `consult-note/ComplaintSection.tsx`, `consult-note/HpiSection.tsx`, `consult-note/RosSection.tsx`, `consult-note/ExamSection.tsx`, `consult-note/HistorySection.tsx`, `consult-note/AssessmentSection.tsx`, `history/PatientHistory.tsx`, `history/MedicationHistory.tsx`, `history/InvestigationHistory.tsx`, `problems/ProblemList.tsx`, `scores/ScoreCalculator.tsx`, `scores/ScoresSection.tsx`, `assessments/PatientAssessmentsPanel.tsx`, `care/CareGaps.tsx`, `care/CareProgrammesPanel.tsx`, `consult-note/NoteSections.test.tsx` | Controlled note sections, problem list, histories, scores, assessment launch, care gaps. Shared care/note helpers come from foundation; no import of WP4 UI. |
| **WP4 — orders, medicines, and plan** | `consult-orders/index.ts`, `consult-orders/OrdersSection.tsx`, `consult-orders/MedicinesSection.tsx`, `consult-orders/ReferralSection.tsx`, `consult-orders/PlanSection.tsx`, `orders/OrderInfo.tsx`, `orders/OrderPriority.tsx`, `orders/LabOrderQuestions.tsx`, `orders/ToothPicker.tsx`, `orders/ProcedureDone.tsx`, `orders/SubstitutionDecision.tsx`, `orders/IssuedCertificates.tsx`, `orders/OrderSections.test.tsx` | Orders/evaluation, medication safety and prescriber substitution decision, dental sites, referral/education/disposition/certificates. Extract only laboratory ordering subset. History, screening, and domain administration supplied through foundation-defined slots. |

FOUNDATION retains `types.ts`, `model.ts`, `context/port.ts`, `context/consult-contracts.ts`, `context/consult-host.ts`,
`models/consult-{note,records,orders,workflow,reference}.ts`, `layout/panel.tsx`, `layout/ConsultSection.tsx`,
`reference/FacilityPicker.tsx`, `complaint/CodedSearch.tsx`, `hooks/useDebounced.ts`, and their foundation tests.
WP1 takes over root `index.ts` after this freeze; never change another package's barrel.
Host adapters, canonical catalogs, package/release guides and integration evidence have separate owners.

## DTOs and pure entry

- `types.ts`: full `ConsultationDetail`/patient/encounter, observation metadata/history/withdrawals, allergy audit fields,
  note version/addenda/assessment and care snapshots, orders, reviews, scores, medications, problems and histories.
  Intake `EncounterDetail` stays minimal; added metadata on existing intake DTOs is optional for compatibility.
- `models/consult-note.ts`: `NoteContent`, order-line/admission/referral DTOs, `emptyNote`, `initialConsultNote`,
  ROS/exam defaults, `TriValue`, `TRI_OPTIONS`, section IDs and completion helpers. Stored legacy content is partial;
  initialize once per encounter; background refreshes must preserve unsaved edits. TRI labels are translation keys.
- `models/consult-records.ts`: allergy, pain/map, histories, problems, score-autofill and nursing DTOs;
  `ConsultVitals`, `ConsultVitalsPayload`, parameter catalogue/settings and pure configurable calculations.
  `consultMeasurementErrors`, `consultVitalsPayload`, `consultVitalsErrors`, `consultBmiPreview` accept parameters explicitly.
  WP2 imports these helpers; preserve existing intake exports in `vitals/model.ts`. There is no global settings cache.
- `models/consult-orders.ts`: priority/safety helpers, order evaluation, medication/substitution/MAR/course/returns,
  and lab-order question DTOs. Pass the effective number formatter to `priorityCountdown`'s third argument.
- `models/consult-workflow.ts`: `SavedDraft`, `SignResult`, `DraftSaver`, `SaveState`, assessments/care/team/end/AI
  DTOs and helpers. WP1 imports the coordinator; do not fork it. Signing must await saves and freeze editing.
  `DraftSaver` snapshots queued content and advances baseVersion only on success; workspace owns conflict handling.
- `models/consult-reference.ts`: facilities, services, clinicians, certificates, education, referral pharmacies,
  plus host-only tele/session/identity projections. No authentication operations enter the clinical data port.
- `model.ts` exports DTOs/contracts and pure helpers. Host contracts are type-only exports; no React runtime is bundled.
  `index.ts` additionally exports host provider/hooks, section layout, facility lookup and debounce hook.

## Port composition

`ClinicalDataPort.consult?: ConsultationDataPort` is required for consultation, optional for intake.
The composed consultation interface has exactly **82 inventory methods**, including inherited intake operations.
Groups: `ConsultNotePort`, `AllergyLifecyclePort`, `VitalsPort`, `PainPort`, `ScreeningPort`, `HistoryPort`,
`ProblemPort`, `ScoresPort`, `AssessmentsPort`, `CareProgrammesPort`, `OrdersPort`, `ReferencePort`,
`CareTeamPort`, `EncounterEndPort`, `AiPort`; plus existing `setEncounterStatus`, `previewEsi`, `saveIntake`.
`ClinicalDataPort.domain?: ConsultDomainPort` contains 17 optional-boundary operations: substitution decisions/proposals,
MAR/checks/observations/reactions/reassessment, medication returns, vaccine-course lots, lab questions/specimen tests.
The domain object may be omitted when host slots supply these workflows. Never use an untyped path/write escape hatch.
All reads/previews accept trailing `signal?: AbortSignal`; the specified compatibility exception is
`searchCatalog(catalog, query, signal?, {limit?, category?}?)`. Catalogs include `procedures`; score method is `string`.
`NewAllergy` accepts simple intake and detailed master-driven payloads. API field names and retry IDs remain unchanged.
Domain retries must retain the same requestId and payload. Versions and server capability flags remain authoritative.

## Host, slots and section convention

Wrap the workspace with `ClinicalProvider` and `ConsultHostProvider value={host}`; key it by encounter ID.
`useConsultPort()` throws a clear error without `port.consult`; `useConsultHost()` requires its provider.
`ConsultDestination` uses `kind`: patient-chart, emergency-disposition, consultation-list, emergency-list,
consultation, inpatient, assessment, certificate, admission, planned-admissions, bed-board, mar, mar-queue,
pharmacy-verification. Each record destination carries its typed ID; inpatient optionally carries its tab.
`onNavigate(destination, {replace?, newTab?})` and `renderLink(destination, {children, className?, "aria-label"?, replace?, newTab?})`
leave URLs and real anchor/new-tab behavior to the host. `onPatientOpened(patient|null)` owns shell patient state.
`initialTab` is `"consult" | "administer"`; `onDirtyChange` reports unsaved note/domain work to host SPA navigation guards.
Slots `renderAdministration`, `renderTelehealth`, `renderSubstitution` return ReactNode and receive
`{detail, readOnly, onRecordsChanged, onBusyChange}`; substitution also receives `order`.
History/screening slots are `renderMedicationHistory`, `renderInvestigationHistory` (also `kind`), `renderScreening`.
They receive `ConsultSectionProps`. Render an explicit unavailable state when a required visible host workflow lacks a slot.
Telehealth owns synchronous popup opening; MAR, returns, vaccination, pharmacy proposal editing and permissions stay host-side.
Every controlled note section uses `ConsultSectionProps`: `{detail, draft, onChange, readOnly, onRecordsChanged?, id?}`.
`onChange(update)` mutates a fresh cloned draft supplied by WP1, never the incoming prop. Additional callbacks extend this interface.
`onRecordsChanged` reloads server records after successful writes without replacing unsaved draft content.
`ConsultSection` takes `{id, title, subtitle?, actions?, status?, collapsed?, defaultCollapsed?, onCollapsedChange?, collapsible?}`.
Collapse preserves mounted children; controlled collapsed state stays controlled. Workspace supplies instance-scoped
`consultSectionId(instanceId, section)` anchors and the host `stickyOffset` for scroll margins.

## UI mapping and errors

The authoritative UI mapping comment is at the top of `context/consult-contracts.ts`.
Use UI Button/Input/Textarea/Select/Segmented/Badge/Skeleton; `icon` becomes `leftIcon`, quiet becomes ghost, AI primary.
Field becomes FieldShell/ChoiceField; native children/optgroups use SourceSelect. Segmented disables options individually;
provide explicit Clear for null and show tone separately. Badge tones become success/warning/danger/brand/violet; omit dot.
Drawer uses a supported width and string title; rich title content goes in the body. Panel/SubCard use shared Cards/ClinicalPanel.
EmptyState body becomes description; compose unsupported custom actions beside it. Sparkline comes from components.
`useScreenHost().notify` replaces toast; all rendered labels and dates/numbers use effective localization/preferences.
`CodedSearch` forwards limit/category. Multiple mode requires `{multiple:true, value:CatalogItem[], onChange}`;
`onPick` is optional there. Single mode retains required onPick. Selection/removal is controlled and duplicate-safe.
`FacilityPicker` emits names, supports free text/emergency filtering, and aborts/fences reads on host replacement.
`useDebounced(value, delay)` cancels obsolete timers. No shared mutable reference-data cache is introduced.
Call `const port = useConsultPort()` and typed methods; fence/abort obsolete reads on patient/host changes.
For failures, `catch (error) { setProblems(problemsOf(error)); }`, then `<ProblemNotice problems={problems}/>`.
Host errors follow `ClinicalPortError`: Error.message, optional problems:string[], optional status (409 for conflicts).
Preserve drafts on failure; successful mutations trigger onRecordsChanged. Use RecoveryNotice/ErrorState for load recovery.

## Local verification and identity

Validation is package-local TypeScript/Vitest with synthetic data and jsdom; no browser, live API, native or deployment acceptance.
Base: `a669a7b283d29dbe0f79e65b812e7c88592b1339`. Frozen snapshot identity is measured from files, since source reports differ.
Frozen source: 438 files, SHA256 `83f3991b4a8fdc78d7056ab0d8b85ace0dc9c264c1b7bb6a67966bce484a2570`.
Foundation code digest: `a09c9ced155d1e508145913554703b05a40698daf2acf47798b4426eb7da0440` (21 files; this Markdown excluded).
Digest algorithm: sorted relative path + NUL + binary SHA256(file bytes), fed into SHA256; source excludes dependencies/build/.git.
Checks: `npx tsc --noEmit -p .` and `npx vitest run` in packages/healthcare; boundaries/docs from repository root.
Final results: TypeScript pass (0 errors); Vitest 52/52 tests, 11/11 files (33 existing + 19 new); boundaries pass (13 packages/11 demos); docs pass (237 files).
Static audits: all 82 main inventory methods present, all 161 dependency-closure DTO declarations retain their source fields;
17 domain methods; model entry bundles 13 modules with zero React runtime modules. No commit or publication performed.
