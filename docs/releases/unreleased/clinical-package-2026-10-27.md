# Clinical package and nurse intake — 27 October 2026

Status: **local working tree on `feature/clinical-package` (from main `9b1978d`); not committed, not published, not deployed.**

## Changes and user impact

- **New package `@pepbits/clinical`** (`packages/clinical`, version 0.2.0 in the prepared fixed group, unpublished). It provides clinical form parts that any encounter type can use: `PatientBanner`, `VitalsSection`/`VitalsFields`, `News2Panel`/`useNews2`, `AllergyReviewSection`/`AddAllergyForm`/`AllergyStrip`, `ArrivalComplaintSection`, `CodedSearch` (on `AsyncLookup`), `ScreeningSection`, the profile-driven `IntakeForm`, and `EncounterQueue`/`IntakeQueue`. Data comes through a host `ClinicalDataPort` given to `ClinicalProvider`; nothing in the package builds a URL. `@pepbits/clinical/model` holds the React-free types, profiles and validation. See the [package guide](../../../packages/healthcare/README.md).
- **New layer `clinical`** beside `page-engines` (may import foundations, `ui`, `components`, `data`, `platform`, `patterns`; nothing generic may import it). `check-boundaries.mjs`, its tests, the [restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#dependency-rules), the fixed Changesets group and `release-pack.mjs` include it.
- **Healthcare demo: AllyVora Outpatient → Nurse intake** at `/allyvora-outpatient/intake` and `/allyvora-outpatient/intake/<encounter>`, rebuilt from the AllyVora clinical workspace (`pepbits/dev` commit `fcde889`, `healthcare/allyvora-consulation/allyvora/frontend`: `OpQueue` intake view, `IntakeForm` outpatient mode, `Vitals`, `PatientBanner`/`AllergyStrip`/`CodedSearch`, `lib/vitals.ts`). Queue filters, stage counts, safety badges, role actions, sections, fields, validation messages, status changes (`registered → intake` on opening; `ready` set by the server on save), API paths and payloads follow the source. Markup and styling are the library's own. Source files, hashes and omissions are in `demo-apps/healthcare/src/modules/outpatient/provenance.json`.

## Preferences, permissions and failures

Semantic theme tokens, font scale and radius apply; the queue table follows managed density, stripes and sticky headers; times use the host time format. Clinician actions (See now) depend on `note.write` from `/auth/me`: UI gating only, the AllyVora API enforces access. Load failures show `ErrorState` with retry, save failures list the server's problems and keep every entered value, a failed queue refresh keeps the previous list, and an inpatient encounter is refused without changing its status. Section copy is English; Arabic, Hindi and Malayalam catalogue entries are a follow-up.

## Limits

The AllyVora clinical workspace API is not part of the demo: on the demo's own `/api` both pages show their error state. Not ported yet: emergency triage (ESI), the full pain assessment (scales, body maps), inpatient observations, the queue's End visit action, reproductive-status and care-gap banner flags, and opening a consultation from See now (no consultation page in the demo, so the action is not offered). There is no configuration-driven composer for arbitrary clinical forms yet; profiles choose sections for intake-style forms.

## Verification

Node 24.22.1 / npm 11.19.1, branch `feature/clinical-package` from main `9b1978d`, uncommitted working tree, 27 October 2026:

- `packages/clinical`: `tsc --noEmit` passed; vitest 20/20 (vitals/screening/intake models and profiles; IntakeForm opening, status change, missing-item list, complete save payload, server problems keeping values, inpatient refusal, load retry; IntakeQueue filtering, stage counts, nurse and doctor actions, restricted safety details, empty and failure states); `npm run build` wrote 42 dist files.
- Healthcare demo: `tsc --noEmit` passed; full vitest 1,927 passed, 4 skipped, 0 failed (95 files), including the new `modules/outpatient/outpatient.test.tsx` (routes; queue and form through the app renderer with a stubbed AllyVora API, unchanged POST payload, axe on both pages) and the new route in all four preference profiles of `src/routes.test.tsx`. Two existing tests were updated for the new module: the module count (14 → 15) and the AllyVora route readiness selector (`[data-outpatient]`). An axe finding during development (`aria-label` on a plain span in the save checklist) was fixed in the package.
- `next build --webpack` into a separate output folder (`HEALTHCARE_BUILD_DIR`, removed afterwards) succeeded; the running demo build was not touched.
- `check-boundaries.mjs` passed (13 packages, 11 demos); tooling tests 24/24; `check-docs.mjs` passed; `git diff --check` clean.

Tests use mocked API responses. Not run: browser rendering against a live AllyVora clinical API, full `npm run ci`, `release:pack`, consumer proof, test-site packaging or deployment.
