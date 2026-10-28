# Consultation workspace and lifecycle — WP1

Feature ID: CONSULT-WP1. State: implemented; local synthetic tests only. Unreleased, 28 October 2026.
Package: `@pepbits/healthcare` 0.2.0 (unchanged). No commit, tag, push, publication or deployment.
Contracts: [frozen foundation](../CONSULT-CONTRACTS.md). Testing guide: [repository guide](../../../../../docs/testing/README.md).

## User problem and outcome

The shared package now owns the consultation shell and lifecycle previously implemented in the source application.
Edits are cloned and autosaved after 1.2 seconds. Saves serialize through the foundation `DraftSaver`, advance versions only on success,
and preserve subsequent edits. Signing locks editing synchronously, waits for the latest save, then sends that returned version.
A conflict stops writes and retains local content until explicit discard/reload. A background refresh discovering a remotely signed note also preserves local work.

## User and administrator flows

1. Open an encounter inside `ClinicalProvider` and `ConsultHostProvider`. Loading failures offer retry. Inpatient visits use host replacement navigation.
2. Review the patient and ordered sections; the rail moves between instance-scoped anchors. Record refreshes retain draft edits.
3. Save, or review and sign. The summary includes medicines, assessments, care gaps, referral and disposition. Server validation remains authoritative.
   Signing locks the note and displays orders, admission and certificate results.
4. Add a signed addendum, correct clinical discharge with a reason, or select a server-authorized exceptional visit-end outcome.
5. Use care-team capabilities for I-PASS handover, acceptance/read-back, decline/cancel, reassignment, member changes and history.
6. Extract AI suggestions or summarize the chart. Acceptance is explicit; allergy acceptance adds an unconfirmed allergy. Failures retain form values.

## Technical contract and integration

Exports are in [the owned barrel](index.ts); the root public barrel is unchanged per task scope.
Mount keyed by encounter ID. The workspace fences reads and remounts its loaded session when the consultation port changes.
No component builds routes, calls fetch, imports Next, or modifies the foundation.
Used port groups: ConsultNotePort, AllergyLifecyclePort, CareTeamPort, EncounterEndPort, AiPort, plus assessment/programme reads for signing.
There are no new backend methods or DTO changes.

`sections` is an ordered readonly `ConsultWorkspaceSection` array: `id`, `title`, `render(context)`, optional completion-state callback.
Render `ConsultSection` with `context.id`; each registry renderer owns its anchor. Context retains `ConsultSectionProps` and adds
acknowledgement, allergy verification, record-vitals entry, and busy callbacks. `onChange` receives a fresh cloned draft.
The default registry renders placeholders and imports no WP2–WP4 UI. Placeholders never claim completion.
`renderRecordVitals` receives `ConsultRecordVitalsContext`, including close/busy callbacks. Its absent state is explicit.

Host navigation/links, patient-shell state and dirty guards use `useConsultHost`. Telehealth and administration use host slots;
missing slots show unavailable text. History, screening, substitution and other sections remain for WP2–WP4 assembly.
Domain busy/dirty state blocks signing and tab changes. Unsaved notes register a browser unload warning.

## Compatibility, localization and accessibility

Initialization uses frozen `initialConsultNote`; existing data and social-history defaults follow that contract.
Shared controls provide presentation behavior. Labels use localization; dates/numbers use effective formatters.
Save shortcuts follow effective `keyboardShortcuts`. Scrolling is instant and applies the host sticky offset.
Clinical actor permissions gate note actions; care-team and visit-end capabilities come from server responses. Backend authorization remains required.
Canonical translations and fallback regeneration belong to another owner; WP1 does not modify catalogs.

## Acceptance, completed and pending work

[Validation summary](validation.json) records base identity, digest, commands and counts; it is summarized evidence, not a raw log.
Draft tests cover snapshots, versions, edits during save, save-before-sign, locks, retry, conflicts and closure races.
Workspace tests cover load/save/sign, conflict reload, refresh retention, autosave, permissions, host navigation/slots and cancellation.
Lifecycle tests cover outcome payloads, failed addenda, I-PASS, explicit AI acceptance and discharge audit.
No browser, real HTTP adapter, native executable, clinical, assistive-technology or native-speaker acceptance was performed.

## Operations and support

Transport failures retain drafts for retry. A 409 requires explicit discard/reload; no silent rebase or overwrite.
Local retained content is transient memory, not durable draft storage. Confirmed writes persist through the supplied port.
No schema migration or package version changes. Removing the untracked consult folder removes this increment.

## Requests for other owners

- Assembly: export this folder barrel from the root barrel; wire WP2–WP4 registry entries and completion-state callbacks.
- WP2: connect RecordVitals via local `ConsultRecordVitalsContext`; consume review/allergy callbacks from `ConsultWorkspaceSectionContext`.
- Foundation/assembly: review local `ConsultWorkspaceSection`, `ConsultWorkspaceSectionContext` and `ConsultRecordVitalsContext` assembly types.
  These do not change frozen section props or ports; no foundation edit is required to compile.
- Localization/documentation: supply canonical messages/translations and regenerated fallbacks; integrate this flow into user help,
  feature/release indexes, package guides and assembled acceptance evidence. WP1 is restricted to this folder.
