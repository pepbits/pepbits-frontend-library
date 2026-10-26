# ERP phase 6c-7a — masters editor and geometry subset — 25 October 2026

Status: **verified editor and geometry subset at 18 destinations; whole-destination parity remains incomplete at all 52 masters**. Unreleased working tree on `restructure/phase-6c-7a`, base `ac6439c4b65399541c6022ccbc34e18f4a3e4972`. No commit, push, merge, rebase, publication or deployment. Fictional data is not accounting acceptance.

[Plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-6c-status), [app guide](../../../demo-apps/erp/README.md), [feature contract](../../features/erp-demo.md), [destination ledger](../../../demo-apps/erp/parity-status.md), [test guide](../../testing/v1.0.0/PRE-COMMIT.md).

The [manifest](manifest-restructure-phase-6c-7a-2026-10-25.json) and [writer](evidence/restructure-phase-6c-7a-2026-10-25/write-manifest.mjs) identify root configuration, packages, tooling, demos and affected documentation. This record, its manifest and [evidence](evidence/restructure-phase-6c-7a-2026-10-25/) are excluded to avoid self-reference. Historical records remain unchanged.

## Changes and user impact

Countries, states, currencies, units, holidays, departments, leave types, shifts and lab tests in both ERP variants now retain the list during editing (18 destinations). ERP1 creates/edits table rows inline. ERP2 creates/edits in a two-column quick dialog with Save and add another and confirmed deletion. Saves refresh accepted data without resetting list criteria. Source row/header/control dimensions and the ERP1 256/288px parent sidebar are applied. Effective non-default preferences remain intentional differences.

The protected source's `WorkList.startNew` creates an inline row in ERP1. This corrects the prior ledger's description of a new-record dialog. ERP1 card view uses the quick dialog; ERP2 direct record routes remain compatible. The other 34 master destinations retain their prior exact differences. No destination is certified as a whole-page visual match: the updated ledger names the remaining toolbar/filter/results-card arrangement, chips/drawer, action visibility, card activation and states context differences.

## Remaining destination differences

There are **0 whole-destination matches**. The [52-row scope receipt](evidence/restructure-phase-6c-7a-2026-10-25/master-scope.json) reproduces each destination's delivered behavior and exact remaining difference. The following groups apply to both ERP variants unless qualified.

| Destinations per variant | Remaining difference |
| --- | --- |
| countries, states, currencies, units, holidays, departments, leave-types, shifts, lab-tests | Stacked toolbar/filter/results cards instead of the source single toolbar, quick-filter chips and advanced-filter drawer; row hover actions, resulting row height, cell emphasis/colours and card activation; textual loading/empty states instead of source skeletons/first-record actions. ERP2 bulk deletion is unavailable. States retain the selected Country column; ERP1 parent heading/search spacing differs; ERP2's 224px selector remains in the filter card instead of the toolbar. |
| org-structure, chart-of-accounts, product-categories | ERP1 360/400px tree/editor split, tree rows/icons and record identity. ERP2 retains the tree canvas instead of the source table and uses a managed child table instead of the compact child list. Delete confirmation is intentional. |
| tax-rates, price-lists, consultation-fees | As-of/effective-date selection and rate-editor composition still use the shared list/record; toolbar and input geometry differs. |
| bill-of-materials, salary-structures, fee-structures | Component-editor split (including ERP1 340/360px list), structure-specific total labels, copy/delete actions and line-editor controls. |
| customers, suppliers, items, employees, patients, doctors, students, vehicles | ERP1 compact Details/Activity/Documents tabs, 2xl recent-activity rail and Full table/mobile overlay. ERP2 sticky section rail and status/duplicate/delete/save-another actions. Shared edit controls and section spacing differ in both variants. |

These remaining compositions were deferred to keep this increment a verified editor subset; they are not covered by the new geometry match claims. Durable cross-route drafts remain excluded because the API has no ERP form-draft contract.

## Library additions and compatibility

`WorklistTableComposition` adds opt-in creation rows, per-record row replacement, row actions and selection visibility; creation rows work with empty results. `renderLeading` composes parent context through the existing filter state; `newLabel` supplies source wording. Existing shared defaults are unchanged. The [page-engines README](../../../packages/page-engines/README.md#worklist-row-composition) describes the contract. ERP-specific metadata, drafts and styling are in new masters modules. No dependency or lockfile change, migration or generated-catalog edit is needed.

## Data, failures and preferences

Required fields are validated before writing. Failed saves preserve input and retry identity; conflicts disable saves until explicit reload. Busy commands cannot be duplicated or dismissed. Mounted host permissions fence writes. ERP2 deletion uses the existing delete contract and confirmation; no versioned-delete API is invented. Parent selection supplies creation defaults. Fields use public UI primitives, ISO native date/time values, effective font/result scales, density, radius, table/column/page-size policies and localization aliases. Shortcut-disabled users retain explicit controls. Durable cross-route drafts and human language/accessibility review remain out of scope.

## Verification and limits

Focused ERP: 49 tests in 3 files pass, including 27 new master composition cases. New tests cover all 18 editors with axe, empty creation/validation, save-another/delete retry, conflict reload, mounted permission/table locks, parent defaults and Arabic/Hindi/Malayalam. The first focused run's five driver failures (changed action labels, datalist role and an overly broad test edit) are retained separately; implementation paths passed after corrected assertions. Shared worklist composition and existing preference tests pass 9 tests in 2 files, including 3 new composition cases. Their initial fixture assertion incorrectly expected creation to be enabled under the default denied host grant; the corrected check preserves that default.

The [final verification summary](evidence/restructure-phase-6c-7a-2026-10-25/verification-summary.json) records:

| Check | Final result |
| --- | --- |
| Forced CI, concurrency 3 | **57/57 tasks, 0 cached**; **6,787 workspace tests in 366 files**, including **1,217 ERP tests**; **19 tooling tests**, **23 typechecks**, **10 Next builds** and **1 Vite build**. |
| Shell Chromium | **18 tests in 1 file** pass with the required library path. |
| Documentation | **217 files** pass the absolute-path `jiti docs/tools/check-docs.mjs` validator; rerun after final release-status documentation. |
| Separate ERP build and live fictional HTTP | **140 workflows: 136 UI and 4 direct HTTP**; **114 route/style samples**, **15 extra panel axe states**, **18 master-editor axe states** and **45 geometry checks**. **0 application, console or HTTP errors; 0 axe violations**. |
| Protected paths and import boundaries | Empty protected status, forbidden-import scan and whitespace check; lockfile unchanged. Exactly 18 master ledger rows changed; header, order and all other 96 destinations preserved. |

The browser receipt retains **266 axe incomplete results** for human review; zero violations is not a complete accessibility certification. The [two inspected master captures](evidence/restructure-phase-6c-7a-2026-10-25/visual-review.json) document the visible subset and its remaining composition differences. Five small screenshots are retained in total, without video.

CI and live HTTP use source digest `e021a04ebe4722880e7700e7f4b6a3e9c50c802a9c3c69fe160a1823222b5388` across 2,102 files. The [source comparison](evidence/restructure-phase-6c-7a-2026-10-25/source-reconciliation.json) identifies the final release-index status-only delta; runtime, tests and scripts are unchanged after CI. The final manifest includes that documentation update. The [boundary scan](evidence/restructure-phase-6c-7a-2026-10-25/boundary-scan.json) justifies every URL-pattern match: 32 React documentation links in retained test warnings, with no credential match.

[Source audit](evidence/restructure-phase-6c-7a-2026-10-25/source-audit.json) retains thirteen protected source hashes and targets. Original JSX/CSS, adapter mappings and managed-table cascade were read (effective cell padding is 4/12/16px, overriding template literals); the original desktop runtime was not rendered. `masters-visual-workflows.mjs` adds 18 real-HTTP editor geometry/axe/save checks to the existing route/preference/RTL coverage. No screenshot/pixel equality or whole-page match is claimed. Local browser rendering is not a native executable or deployed release.

The [verification runner](evidence/restructure-phase-6c-7a-2026-10-25/verify.sh) uses the shared heavy lock and Turbo concurrency 3 with forced execution. Its preload serializes Vitest trees and caps each at two workers without removing assertions. The healthcare historical browser-contract fixture remains a historical receipt, not a fresh healthcare HTTP run. API runtime reuse compares protected sources before loading the existing Node 24 builds; the integration launcher stops its own Next/API/browser groups on success or failure.

Retained attempts document failures rather than replacing them with the passing receipt. The first CI attempt found a test-fixture TypeScript union issue, corrected by converting the input default to a string. The next full CI passed 57 tasks with zero cache, but live integration stopped after 117 workflows and all 45 geometry checks: the ERP2 customer personal-view assertion sampled zero column headers during a refresh instead of the expected ten. That existing browser driver now waits for the same exact header count. Its [retry record](evidence/restructure-phase-6c-7a-2026-10-25/integration-retry.json) links the failure and confirms cleanup. The complete verification sequence passed after this assertion timing correction.

All three [heavy-lock waits](evidence/restructure-phase-6c-7a-2026-10-25/queue.json) completed naturally. The final runner exited 0. [Runtime identity and cleanup](evidence/restructure-phase-6c-7a-2026-10-25/identity-final.json) record Node 24.21.0, 483 protected API source comparisons with zero mismatches, and stopped Browser/Next/API process groups. Next's exit 143 is its requested shutdown after successful browser completion. No process from this work remains running.

## Upgrade and rollback

No API changes or data migration. Removing the additive editor wiring restores the previous master worklist/record composition; existing ERP2 record links and saved layouts remain compatible. Publication, deployment and real financial acceptance are not part of this work.

## Merged to main after phase 8

26 October integration note: prepared for the post-phase-8 main baseline on `restructure/erp-parity-merge`; the actual merges remain pending linked worktree metadata access. The `main` branch has not been changed. This dated record and all original evidence hashes remain unchanged apart from this note. [The integration record](erp-parity-integration-2026-10-26.md) will identify the combined source and fresh verification separately. Whole-destination parity remains incomplete.
