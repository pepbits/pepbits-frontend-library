# Assembled consultation workspace — INT-A

Unreleased, 28 October 2026. WP1–WP4 are integrated in `@pepbits/healthcare/clinical`.
Contracts: [foundation](../CONSULT-CONTRACTS.md); checks: [testing guide](../../../../../docs/testing/README.md).
Source comparison: frozen AllyVora `7ee558f`, consultation Workspace/Sections and clinical EncounterEnd/CareTeam.

## User flow and behavior

1. Load the encounter in `ClinicalProvider` and `ConsultHostProvider`, keyed by encounter ID; retry failed reads.
   IP encounters use host replacement navigation. The banner includes allergies, reproductive status and care gaps.
2. Follow the source section order: findings, allergies, problems, complaint, HPI, pain, ROS, history, examination,
   scores/assessments, diagnosis, care gaps, investigations/procedures, medicines, education/referral, plan.
   The spine tracks scrolling, completion and required work using instance-scoped anchors and the host sticky offset.
   Care gaps are hidden when no programme applies; signed snapshots remain visible when present.
3. Review abnormal findings individually, batch only routine acknowledgements, verify allergies and record vitals.
   Record refreshes preserve unsaved note content. Configured vital parameters drive measurement checks and trends.
4. Edit the controlled note. Autosave waits 1.2 seconds; queued saves serialize and advance versions only on success.
   Signing freezes edits, awaits the latest save and sends its returned version. A 409 retains the local draft until
   explicit discard/reload. Remotely signed refreshes preserve unsaved content and require conflict recovery.
5. Signing requires a primary diagnosis, allergy review, vitals or a reason, disposition and valid clinical discharge
   time, plus applicable referral/admission/follow-up details. Pending/failed/incomplete order evaluation, missing
   procedure sites, stopped-medicine conflicts and unresolved medication safety reasons block signing.
   High medication alerts require a nonblank reason even when the check's `needsReason` flag is false.
6. Signed notes remain read-only; addenda are separately signed. Later assessments can still be created with the
   assessment permission. Order results, procedures, substitution decisions, clinical discharge corrections and
   emergency disposition remain available through their capabilities. Discharge corrections retain audit history.
7. End visits using server-authorized outcomes. Care-team I-PASS supports request/accept/read-back, decline/cancel,
   reassignment, membership and history. AI proposals enter the note only on acceptance; allergies start unconfirmed.

## Host and data contracts

No backend methods or DTOs were added. The composed `ConsultationDataPort` supplies note/save/sign/addendum,
review/allergy/vitals, histories, scores/assessments, care programmes, order evaluation/safety, reference, AI,
care-team, end-visit and discharge operations. Domain substitution retains its typed retry/version contracts.
The workspace passes one order evaluation to both order sections and consumes WP4 `onSafetyChange` for signing.
`sections` remains an optional ordered registry; its default now renders the actual WP2–WP4 sections.
`renderRecordVitals` can override the built-in vitals editor. Busy callbacks protect signing/tab changes and report
unsaved domain work through `onDirtyChange`; note drafts also register an unload warning. Draft retention is in memory.
Host slots own telehealth, MAR/returns/vaccination, pharmacy substitution proposals and optional history/screening.
Absent slots show unavailable states. URLs, patient-shell state, links/new tabs and navigation stay host-owned.
The root barrel exports the workspace/provider and all folder public APIs. The component `ScreeningReview` is exported
as `ConsultScreeningReview` to preserve the existing DTO name; React-free contracts remain in `clinical/model`.
Shared controls/localization/formatters and effective shortcut preferences remain in use; backend authorization is authoritative.

## Composition-only edits outside consult

- `allergy/AllergySection.tsx`: report open editors and pending writes through `onBusyChange`.
- `consult-records/ReviewSection.tsx`: workspace vitals action and review/readings busy callback.
- `vitals/RecordVitals.tsx`: pending-write callback for the workspace drawer.
- `scores/ScoresSection.tsx`: separate assessment lock from the signed-note lock.
- `consult-orders/OrdersSection.tsx` and `MedicinesSection.tsx`: optional shared order-evaluation prop.
- `consult-orders/PlanSection.tsx` and `DispositionSection.tsx`: forward the workspace signed-discharge renderer.
All retain standalone defaults; no section behavior engine was rewritten.

## Verification and delivery boundary

Integration base: `f64de071e708b82e0d7f9dacb046afbe34c121ee` plus this working tree.
Changed code: 18 `.ts`/`.tsx` files; SHA256 `70f7c4eff1306f44c88a6d2324e848c292c48b36c31b3c3054f70a9cc81a8d52`.
Digest: sorted repository-relative changed/untracked code paths + NUL + binary SHA256(file), then SHA256.
Node 24, package cwd: `npx tsc --noEmit -p .` passes with 0 errors; `npx vitest run` passes 204/204 tests,
27/27 files (198 retained + 6 assembled cases). Session logs: `/tmp/consult-tsc.log`, `/tmp/consult-full-tests.log`.
Root: `node tooling/scripts/check-boundaries.mjs` passes (13 packages/11 demos);
`node docs/tools/check-docs.mjs` passes (237 files); `git diff --check` passes.
Tests use synthetic data, a typed full consultation fake and jsdom. New assembled cases cover autosave → missing
primary diagnosis → sign → read-only/addendum, high medication safety, order evaluation/retry, abnormal acknowledgements,
mandatory fields, banner flags and scroll navigation. The existing 198 tests remain in the regression scope.
The removed `validation.json` held WP1 session evidence only: its earlier run was 79/79 tests at base `4a58c63a`,
code digest `e2a1d92a3d782add92f1c09e4655548e3aa6e44a23bbc09c1883db72ebf39958`; it is not integration evidence.
No browser, real HTTP, native executable, deployed, clinical or native-speaker acceptance is claimed.
No commit, push, publication, deployment, package-version or schema change.
Canonical catalog translations/fallbacks, broader user/release guides and host adapters remain with their owners.
