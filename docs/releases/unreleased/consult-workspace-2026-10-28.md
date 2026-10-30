# Consultation workspace — 28 October 2026

Status: **unreleased working tree; local verification only. Not committed, published or deployed.**
Package: `@pepbits/healthcare`, currently prepared at `0.2.0`; the new minor changeset is not applied.
Testing guide: [1.0.0](../../testing/v1.0.0/PRE-COMMIT.md). Executor: Codex, INT-B; human review and hosted CI pending.

## Source and scope

Source repository: `pepbits/dev`, AllyVora consultation frontend snapshot **`7ee558f`**, plus the behavior of
**`5a8dea4`**, "Fill yes/no score items from confirmed diagnoses", carried into the ported score calculator.
The frozen source contains 438 files with SHA-256
`83f3991b4a8fdc78d7056ab0d8b85ace0dc9c264c1b7bb6a67966bce484a2570`;
its inventory and historical foundation checks are retained in the
[consultation contracts](../../../packages/healthcare/src/clinical/CONSULT-CONTRACTS.md).

Target base: `f64de071e708b82e0d7f9dacb046afbe34c121ee`, with WP1–WP4 merged and INT-B working-tree changes.
Verification identity: **152 files**, SHA-256
`91423a55a73b0f3526240443b8b81cf01a7b9891f7c143000eecd564924aaf3f`.
Scope: every `.ts`, `.tsx` and `.json` file under `packages/healthcare`, excluding `dist` and `node_modules`.
Algorithm: sort repository-relative paths by code point; for each append UTF-8 path, NUL and the binary SHA-256
of its bytes to one SHA-256 stream. This includes tests and package/compiler configuration, excludes Markdown,
and identifies the package source checked here, not a deployed artifact or the whole repository.

## Changes and user impact

- Added consultation lifecycle, note/findings/history/care/order components and typed data/host contracts from
  WP1–WP4. Save/sign/version coordination, addenda, reviews, care-team and end-visit flows live in the workspace;
  host navigation and domain slots keep application services outside shared UI. See the
  [consultation workspace guide](../../../packages/healthcare/README.md#consultation-workspace).
- Carried confirmed-diagnosis score autofill: encounter context reaches the port, confirmed diagnoses fill Yes,
  provisional diagnoses display provenance without filling, missing diagnoses remain unanswered, and manual
  answers survive refill. Obsolete patient/encounter responses cannot fill a replacement form.
- Fixed procedure-history verification to accept `entered-in-error`, including the editor and versioned,
  reason-required correction payload. Failed writes retain the selected verification and reason.
- Exposed optional procedure completion time, performer and outcome plus typed timing/consent/specialty details
  through `ConsultationOrder`/the existing order model. WP4's local `ProcedureOrder` remains structurally
  compatible; order component files and existing model import locations did not need edits.
- Documented the package rename from `@pepbits/clinical` to `@pepbits/healthcare`: current public paths are
  `@pepbits/healthcare/clinical` and the React-free `@pepbits/healthcare/clinical/model`.
- Added a minor [changeset](../../../.changeset/consult-workspace.md) for the healthcare package in the fixed group.
  No versioning or publishing command was run.

## Installation, data and host responsibilities

Use the existing preference/tenant-lock, localization, presentation and screen-host providers, then
`ClinicalProvider` and `ConsultHostProvider`. Supply `ClinicalDataPort.consult` with the 82-method
`ConsultationDataPort`; the optional domain boundary has 17 methods. The
[package guide](../../../packages/healthcare/README.md#consultation-workspace) lists the groups and a minimal
host composition. INT-B's checked snapshot still has placeholder default sections and no public workspace
export; connecting the registry and barrel belongs to INT-A. This record does not certify that assembly.

Update score adapters from `(patientId, signal?)` to `(patientId, encounterId?, signal?)`; forward encounter
context to the source autofill query and honor abort signals. Additional completion fields are optional.
Procedure corrections preserve record versions and reasons. There is no database/schema migration in this
package; compatibility with the consuming service requires host acceptance.

HTTP/session/authentication, tenant scope and server authorization remain host responsibilities, along with
MAR, returns, vaccines, pharmacy proposal editing, telehealth and printing. Host slots receive records-refresh,
read-only and busy callbacks as applicable; navigation receives semantic destinations. UI permission gating
does not replace server enforcement. Errors carry message/problems/status, failed edits are retained, and
version conflicts require reconciliation. Domain retries retain request IDs and payloads.

## Verification and limits

Environment: Node **24.22.1**, npm **11.19.1**, Vitest **3.2.7**, 28 October 2026 UTC.
Commands used `PATH=/home/pepadmin/.local/opt/node24/bin:$PATH`. Package commands ran in
`packages/healthcare`; boundary/docs commands ran from the repository root. Fixtures are synthetic and UI
tests use jsdom and in-memory port stubs. The table retains a result summary, not complete raw logs.

| Command | Result | Scope |
| --- | --- | --- |
| `npx tsc --noEmit -p .` | PASS, exit 0; 0 errors | Healthcare package, including unchanged orders components |
| `npx vitest run src/clinical/scores/Scores.test.tsx src/clinical/history/History.test.tsx src/clinical/models/consult-contracts.test.ts` | PASS, exit 0; 20/20 tests, 3/3 files | Scores 7, history 11, DTO contracts 2; includes 5 new INT-B cases |
| `npx vitest run` (first run) | FAIL, exit 1; 202 passed, 1 failed; 27 passed files, 1 failed file | First Workspace test expected immediate `onDirtyChange(true)`; no callback was recorded |
| `npx vitest run src/clinical/consult/Workspace.test.tsx` | PASS, exit 0; 11/11 tests, 1/1 files | Isolated rerun, no code change; initial full-suite failure remains recorded |
| `npx vitest run` (second run) | PASS, exit 0; 203/203 tests, 28/28 files | Same source; no test skipped or weakened |
| `node tooling/scripts/check-boundaries.mjs` | PASS, exit 0; 13 packages, 11 demos | Dependency boundaries |
| `node docs/tools/check-docs.mjs` | PASS, exit 0; 238 documentation files | Documentation links, inventory and evidence |
| `git diff --check` | PASS, exit 0 | Whitespace |

Counts overlap and must not be added together. Source was unchanged between the focused, full and isolated
runs, including the successful full rerun; documentation was added afterwards and the docs check rerun.
INT-B changed only its owned scores/history/contracts/models,
package guide, release record/index and changeset. No `consult/` or root clinical `index.ts` edits were made.

Open limits: INT-A default section/barrel assembly, canonical translations for new text (including Arabic,
Hindi and Malayalam) and native/clinical review, host adapter and live API acceptance. No browser, native
executable, production integration, full repository CI, package build/pack, installed consumer, publication
or deployment acceptance was run. The initial Workspace test timing failure needs the owning session's review.

## Upgrade, rollback and publication

Integrate the remaining workspace assembly, update host adapters/providers and complete host acceptance before
an owner versions or publishes this change using the [publishing process](../../development/PUBLISHING.md).
This record creates no tag, commit, push, registry write or deployment. Retain the consumer's prior lockfile
and package versions for rollback; no persistence migration or irreversible operation was introduced here.
