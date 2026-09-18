# Shared lifecycle configuration — 18 September 2026

Status: developed and validated locally in an uncommitted working tree. No commit, push, registry publication, archive
packaging or deployment was performed. [Feature guide](../../features/lifecycle-configuration.md).

## Added

- `@pepbits/erp-config/lifecycle` (new package subpath): TypeScript records for backend lifecycle wire contract v1, runtime
  response guards that reject unknown enums and missing lists with a JSON path and carry additive properties through,
  host-metadata envelope parsing, model helpers (key formats, reference-safe renames, structural diff, catalogue
  projection, governance gating, stable operation keys), the `LifecycleApi` port and `createLifecycleHttpApi`
  (Response or decoded-JSON transport, `Idempotency-Key`, `If-Match`, optional change-reason header with `reasonEncoding`
  `raw` (default, Latin-1) or `percent-utf8` (ASCII `UTF-8''` + `encodeURIComponent`, decoded reason at most 1,000
  characters and 1,500 UTF-8 bytes, controls and lone surrogates refused), and `lifecycleReasonHeaderValue`).
- `@pepbits/erp-screens/lifecycle` (new package subpath; the page is also exported from the root):
  `LifecycleConfigurationPage` with catalogue tree, cursor worklist, visual editor for dimensions, stages, events,
  lifecycles and bindings, optional advanced JSON, server validation, read-only resolution preview, independent approval,
  immutable publication, scoped activation/rollback, version comparison and unsaved-change protection. The open
  definition's lifecycles are grouped in the catalogue by their optional `module`/`domain` codes, which are editable,
  format-checked fields in the lifecycle editor; nothing is fetched or guessed to build the groups.
- 350 `lifecycle.*` messages in each of the four canonical catalogs (en, ar, hi, ml). `sync-fallbacks.mjs` now includes the `lifecycle.` prefix in the
  generated erp-config fallbacks and ops-ui English messages.

## Changed

- New validation: the page requires a change reason for create/save by default. Invalid typed preview values block
  preview, and change reasons the configured header encoding cannot carry are refused before sending
  (`REASON_NOT_TRANSMITTABLE`, `REASON_TOO_LONG`, `REASON_INVALID_CHARACTERS`, each with a localized message).

No existing export, page, preference or API contract changed. No Library demo route, fictional dataset or dummy-API
endpoint was added, and nothing renders the page in this repository's applications.

## Verification

Node v24.21.0. Commands run from `desktop-clients` against base `c2e1532` plus this working tree:

- `npx vitest run packages/erp-config/src/lifecycle packages/erp-screens/src/lifecycle`: 2 files, 34 tests passed
  (19 contract/adapter/model, 15 page).
- `npx vitest run packages/erp-config packages/erp-screens`: 65 files, 383 tests passed.
- `npm run typecheck`: all 11 packages and `apps/desktop` passed.
- `npm run build -w web`: Next.js 16.3.3 production build and TypeScript passed after the final edits.
- Gates: `verify:form-controls`, `verify:shared-components`, `verify:library-preferences`, `verify:library`,
  `verify:templates`, `verify:contrast`, `verify:parity` and `verify:localization` passed after the final edits. `verify:bundle` was not
  applicable: it requires an existing `apps/desktop/dist` build and exited with `ENOENT` before checking anything.
- From the repository root: `node docs/tools/check-docs.mjs` and `node docs/tools/documentation-lifecycle.mjs check` passed
  after impact receipts were recorded (no registered page guide changes; the inherited backlog remains).

- Cross-language check (read-only, parent-owned script in the healthcare repository):
  `node pepbits-healthcare-enterprise/scripts/lifecycle/check-wire.mjs` passed 13 Java-produced wire fixtures through the
  final guards unchanged. The two real definition fixtures group as `patient-administration` → `patient-identity` →
  `registration` and `procurement` → `purchasing` → `purchase-order` in the catalogue projection.

The full Vitest suite, API tests, e2e/browser suites, the desktop Vite build and native execution were not run; the change
adds isolated modules and did not modify shared renderers. Tests use in-memory ports and fictional ERP purchase-order
fixtures, not a live backend. Healthcare consumption, archive packaging, live BFF/API acceptance and browser checks belong
to the healthcare integration and are not claimed here. The Arabic, Hindi and Malayalam texts are machine-drafted and
awaiting native-speaker review. Arabic RTL and long Hindi/Malayalam strings have not been checked in a browser.
