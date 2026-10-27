# ERP phase 6c-7a3 — structure and profile masters — 25 October 2026

Status: **implementation complete for the measured composition subset; final verification in progress**. Resumed on **26 October 2026** on the post-phase-8 worktree `restructure/erp-parity-7a3`, base `8cf80044f5f2a8b32ff7141d019833e08f0cbb72` (main `7cdc9e8` plus merged 6c-7a/6c-7a2/6c-7b). This record retains its original 25 October date; earlier focused receipts identify the interrupted old-base work and are not final-tree evidence. No commit, push, merge, rebase, publication or deployment. Fictional data is not accounting acceptance.

[Plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-6c-status), [app guide](../../../demo-apps/erp/README.md), [feature contract](../../features/erp-demo.md), [destination ledger](../../../demo-apps/erp/parity-status.md), [test guide](../../testing/v1.0.0/PRE-COMMIT.md).

The [manifest](manifest-restructure-phase-6c-7a3-2026-10-25.json) and [writer](evidence/restructure-phase-6c-7a3-2026-10-25/write-manifest.mjs) identify root configuration, packages, tooling, demos and affected documentation. This record, manifest and [evidence folder](evidence/restructure-phase-6c-7a3-2026-10-25/) are excluded to avoid self-reference. Historical evidence is preserved.

## Changed behavior and scope

Twenty-two destinations gain source-derived structure/profile composition: Bill of materials, Salary structures, Fee structures, Customers, Suppliers, Items, Employees, Patients, Doctors, Students and Vehicles in ERP1 and ERP2. ERP1 structures use an always-editable 340/360px split pane; ERP2 uses a 320px summary/history rail. Managed component tables supply suggestions, choice/numeric inputs, computed amounts, deduction-aware totals, structure-specific labels and add/remove controls. ERP2 supports copy-to-new and confirmed deletion.

ERP1 profiles have identity/statistics, Details/Activity/Documents tabs, grouped fields, the 2xl 300px recent-activity rail, 340/380px worklist and retained Full table/narrow overlays. ERP2 profiles have source-sized statistic cells, a sticky 170px section rail and 300px side context. ERP2 also restores a separate editing Status section and creation identity; the Status section follows effective rail/tabs/wizard navigation. More actions supplies versioned status changes, Duplicate and confirmed Delete; ERP2 creation supports Save and add another. Files remain explicitly local selections without upload.

There are **0 whole-destination exact-match claims**. The [final scope receipt](evidence/restructure-phase-6c-7a3-2026-10-25/post-phase8/final/master-scope.json) retains every one of these 22 rows and its remaining differences. Common stacked worklist/filter/results chrome and ERP1 table rows still differ from the source compact lists. Loading/empty composition, action/title/icon/notification placement and profile guidance controls have the exact boundaries listed per destination. These shared-engine/worklist differences are deferred to keep this increment a verified record-composition subset. No other destination ledger row or header is changed.

## Contracts and preferences

The existing public WorklistPage, RecordPage, Tabs, tables, field controls, overlays, presentation host and master draft hook remain the foundation. The new ERP-only modules express structure calculations and the source's distinct profile category layout. There are **no shared-package additions**, dependencies, lockfile changes, API changes or generated-catalog edits.

Effective density, table presentation, result view, font/form/result scales, formatting, radius, preview placement and ERP2 form navigation remain authoritative. ERP1 category tabs select Details/Activity/Documents content rather than form sections. Remember filters controls accepted account layout persistence. Mounted permission checks fence writes; the API remains authoritative. Failed saves preserve values and operation identity; conflicts require Reload. Confirmed deletion uses the unchanged delete API, without inventing versioned-delete support. Durable cross-route drafts remain excluded because no ERP form-draft contract exists. Catalog gaps remain readable English; human language review is separate.

## Verification

Focused checks initially pass 103 tests in three files, including 31 new rich-master cases. The first run exposed obsolete tests expecting the ERP1 list to disappear and activity/documents to be simultaneously visible. The second exposed fixture/driver mistakes (editing a read-only calculated amount and omitting the module prefix in a URL assertion). Corrected tests retain workflow assertions. TypeScript also caught overlay width and inferred-union fixture issues before final verification.

The [pinned source audit](evidence/restructure-phase-6c-7a3-2026-10-25/post-phase8/final/rich-source-audit.json) reads commit `3558a131f0fd443693eae0dfc678e3b258b480c1` through `historical-source.mjs`, hashes 15 protected sources, maps all 22 destinations and records numeric targets. JSX, CSS and core adapter resolution were inspected: source 44/52px Avatar requests resolve to 48px, and xl drawers resolve to shared lg/620px. The original desktop runtime was not rendered. Demo computed-style checks are separate from source rendering and pixel equality.

The [verification runner](evidence/restructure-phase-6c-7a3-2026-10-25/verify.sh) uses the shared heavy lock and phase-8 root `bash tooling/scripts/ci-gates.sh` (forced Turbo concurrency 1, at most two workers per Vitest tree), then shell Chromium and production ERP integration. Root `npm ci` and `bash tooling/scripts/install-api.sh` install the existing lockfiles; CI builds/tests the independent `mock-api`. Local integration uses those runtime artifacts, never the retired `dummy-api`. Final results are pending.

Seven conflict-marker files were reconciled without Git metadata writes. All transaction and earlier master subsets are retained. A structural ledger check confirms all 114 rows and the header are preserved, with exactly the 22 scoped rows changed. Documentation receipts also refresh the previously merged table/hierarchy/transaction sources; existing phase-8 removal receipts and guide translation-review state are preserved.

## Upgrade and rollback

No migration is required. Reverting the master wiring restores the prior composition while preserving existing ERP2 URLs, saved views and column layouts. No publication or deployment was performed. The integration launcher owns its API/Next/browser groups and stops them on completion or failure; final cleanup evidence will be recorded after verification.
