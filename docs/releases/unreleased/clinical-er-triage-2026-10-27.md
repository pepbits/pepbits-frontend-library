# Emergency triage on @pepbits/clinical — 27 October 2026

Status: **local working tree on `feature/clinical-er-triage` (from main `68431ba`); not committed, not published, not deployed.**

## Changes and user impact

- **Emergency triage profile.** `EMERGENCY_TRIAGE` runs the shared `IntakeForm` for emergency visits: arrival including how the patient arrived, a required coded complaint, vital signs with NEWS2, allergy review, screening (with the emergency-only self-harm question) and the new Emergency Severity Index section. Opening the form keeps the visit in `waiting-triage`; saving posts `mode: "er"` and the server moves it on. See the [package guide](../../../packages/healthcare/README.md).
- **ESI section from small parts.** Decision points A, B and C (`EsiDecisionPoints`, `EsiDecisionRow`, `YesNoChoice`, `EsiResourcesChoice`), the calculated level with the server's steps and danger-zone warning (`EsiResultSummary`, `EsiLevelChip`), an optional override that requires a reason (`EsiOverrideFields`) and the destination area (`AreaSelect`). `useEsiPreview` asks the data port's new `previewEsi` 300 ms after the last change; the algorithm stays on the server.
- **Triage worklist.** `TriageQueue` lists patients waiting for triage, longest wait first, refreshed every 20 seconds, with unidentified-patient flags and "Triage now" for nurses and doctors. `EsiLevelCounts` (waiting and per-level counts) is ready for a tracking board.
- **Existing sections split into parts.** Arrival, complaint, allergy, screening, checklist, save bar and queue pieces are now separate exported components; the outpatient pages look and behave as before.
- **Healthcare demo: AllyVora Emergency → Triage** at `/allyvora-emergency/triage` and `/allyvora-emergency/triage/<encounter>`, rebuilt from the committed AllyVora clinical workspace (`pepbits/dev` commit `e025f48`). Uncommitted work in progress in that workspace (configurable vital-sign parameters) is not included. Source files, hashes, deliberate differences and omissions are in `demo-apps/healthcare/src/modules/emergency/provenance.json`.

## Deliberate differences

Changing an earlier ESI answer clears the later answers that no longer apply, so hidden decisions are never sent (the source kept them; the server ignores them). The worklist sorts by wait in the browser. ESI colours use the semantic theme tokens.

## Limits

The AllyVora clinical workspace API is not part of the demo: on the demo's own `/api` both pages show their error state. Not ported yet: the emergency tracking board (in-department table, reassessment timers, medication administration), End visit from the list, the full pain assessment, configurable vital-sign parameters, and translations for the new copy. Triage permission is UI gating by role; the API enforces access.

## Verification

Node 24.22.1 / npm 11.19.1, branch `feature/clinical-er-triage` from main `68431ba`, uncommitted working tree, 27 October 2026:

- `packages/clinical`: `tsc --noEmit` passed; vitest 33/33 (adds the triage model: decision visibility and clearing, preview inputs, final level, override reason, payload; triage form: no status change on opening, arrival mode and ESI shown, complaint and level required, danger-zone level 2, override with reason, saved payload and message, level 1 hiding later questions, outpatient visit refused; triage worklist: waiting only, longest first, unidentified flag, nurse action, other roles, empty and failure states; level counts); `npm run build` wrote 78 dist files.
- Healthcare demo: `tsc --noEmit` passed; full vitest 1,934 passed, 4 skipped, 0 failed (96 files), including the new `modules/emergency/emergency.test.tsx` (routes; worklist and form through the app renderer with a stubbed AllyVora API, unchanged preview and save payloads, axe on both pages) and the new routes in all four preference profiles of `src/routes.test.tsx`. Two existing tests were updated for the new module: the module count (15 → 16) and the AllyVora route readiness selector (`[data-emergency]`).
- `next build --webpack` into a separate output folder (removed afterwards) succeeded; the running demo build was not touched.
- `check-boundaries.mjs` passed (13 packages, 11 demos); tooling tests 24/24; `check-docs.mjs` passed; `git diff --check` clean.

Tests use mocked API responses. Not run: browser rendering against a live AllyVora clinical API, full `npm run ci`, `release:pack`, consumer proof, test-site packaging or deployment.
