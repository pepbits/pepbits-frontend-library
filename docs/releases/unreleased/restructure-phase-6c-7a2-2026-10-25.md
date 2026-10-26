# ERP phase 6c-7a2 — tree and rate composition — 25 October 2026

Status: **verified tree/rate composition subset at 12 destinations; whole-destination parity remains incomplete at all 52 masters**. Unreleased working tree on `restructure/phase-6c-7a2`, base `983c807baa2ee91d356485696218dd7ec09c91a6`, following the committed 6c-7a subset. No commit, push, merge, rebase, publication or deployment. Fictional data is not accounting acceptance.

[Plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-6c-status), [app guide](../../../demo-apps/erp/README.md), [feature contract](../../features/erp-demo.md), [destination ledger](../../../demo-apps/erp/parity-status.md), [test guide](../../testing/v1.0.0/PRE-COMMIT.md).

The [manifest](manifest-restructure-phase-6c-7a2-2026-10-25.json) and [writer](evidence/restructure-phase-6c-7a2-2026-10-25/write-manifest.mjs) identify source configuration, packages, tooling, demos and affected documentation. This release record, manifest and [evidence folder](evidence/restructure-phase-6c-7a2-2026-10-25/) are excluded to avoid self-reference. Historical evidence is preserved.

## Changes and user impact

Twelve destinations gain source-derived tree/rate composition: Organisation structure, Chart of accounts, Product categories, Tax rates, Price lists and Consultation fees in ERP1 and ERP2. ERP1 trees use a 360/400px pane and an always-editable form with breadcrumb/status identity, direct/descendant counts and acknowledged versioned saves. ERP2 trees use a compact table and record child list. Search includes codes and retains ancestors. Required fields, complete-tree guards and confirmed leaf deletion remain.

Rates now send the existing API's `asOf` parameter from Valid on/Today; Show all dates clears it. The badge uses the accepted selection and the 112×8px bar remains centred on today. Inclusive/open-ended intervals, inline ERP1 editors and ERP2 quick dialogs reuse existing worklist/draft contracts. Effective preferences/tenant locks, server authority, version/conflict/retry and mounted input retention remain authoritative. Durable cross-route drafts remain excluded: no API contract exists.

## Remaining destination differences

There are **0 whole-destination pixel-match claims**. The [master scope receipt](evidence/restructure-phase-6c-7a2-2026-10-25/master-scope.json) records all 52 master rows, including the 12 changed destinations. Only these 12 ledger rows change; the header and other destinations stay intact.

| Destinations | Exact remaining difference |
| --- | --- |
| ERP1 org-structure, chart-of-accounts, product-categories | Initial loading uses shared text instead of twelve source skeleton nodes. Selected-row foreground, automatic expansion when adding under a collapsed branch and prefilled creation codes differ (source assigns missing codes on save). Shared recovery/validation and confirmed deletion remain intentional; source notification placement differs. |
| ERP2 org-structure, chart-of-accounts, product-categories | Labelled expand/collapse toolbar, clear-search action/highlighting, descendant badges and whole-row opening; fourteen source skeleton rows remain replaced by shared loading. Generic record header/action and child-section heading/action spacing remain. |
| ERP1/ERP2 tax-rates, price-lists, consultation-fees | Common stacked toolbar/filter/results cards, missing quick-filter chips/advanced-filter drawer, row hover emphasis/colours, card validity/activation and skeleton/first-record empty actions. Tax-rate percentages retain the baseline plain-text cell renderer. ERP2 bulk deletion remains unavailable. |
| ERP1/ERP2 bill-of-materials, salary-structures, fee-structures | Deferred component-editor split, ERP1 340/360px list, structure-specific total labels, copy/delete actions and line controls. |
| ERP1 customers, suppliers, items, employees, patients, doctors, students, vehicles | Deferred Details/Activity/Documents tabs, 2xl recent-activity rail, Full table/mobile overlay and edit/section spacing. |
| ERP2 customers, suppliers, items, employees, patients, doctors, students, vehicles | Deferred sticky section rail, status/duplicate/delete/save-another actions and edit/section spacing. |
| ERP1/ERP2 countries, states, currencies, units, holidays, departments, leave-types, shifts, lab-tests | The 6c-7a editor subset is unchanged. Source single toolbar, quick filters/drawer, row hover/loading/empty/card composition remain; states parent/column context and ERP2 bulk deletion remain as listed in each ledger row. |

The 22 component/profile destinations remain deferred. Verification is concentrated on the tree/rate subset rather than extending unverified composition changes to those families.

## Shared additions and compatibility

`HierarchyPanel` is a new optional public tree composition with compact list/table modes, code search and ancestor retention; the existing `HierarchyView` defaults are unchanged. Four generic Lucide exports live in their own module. `WorklistTableComposition.renderCell` optionally renders read-only cells while retaining managed table/selection/navigation behavior. Public API READMEs and direct tests accompany these additions. Existing shared defaults are unchanged; no dependency, lockfile or API change is needed.

ERP-only changes extend the existing master draft hook with opt-in retained acknowledgements/read-only opening. Worklist source parameters, extra columns and toolbar content apply only to rate masters. Hidden extra columns round-trip through the existing account/browser layout paths. Original ERP2 record URLs stay compatible. New literal labels use the runtime localization alias path; canonical catalog gaps remain readable English because protected catalogs are unchanged.

## Verification and limits

Focused ERP checks pass **118 tests in five files**, including new tree/rate coverage, existing record panels and the 6c-7a editors. The first focused attempt had six fixture/driver failures: duplicate breadcrumb/tree names, missing explicit fixture versions, an asynchronous deletion assertion and Arabic labels. The corrected checks pass without weakening workflow assertions. Early TypeScript checks also caught missing public icon exports, a generated-expression bracket and test typing errors; these were corrected before full verification.

There are **26 new unit tests: 19 ERP and 7 shared-package cases**, plus **12 new live geometry/workflow checks**. Focused shared checks pass 12 tests in five files, including those seven new cases. The filtered route/preference run passes 120 cases across four profiles; its 864 intentionally unselected cases are covered by the subsequent full CI run. These focused counts overlap full CI and are not added to its total.

The [final verification summary](evidence/restructure-phase-6c-7a2-2026-10-25/verification-summary.json) records:

| Check | Final result |
| --- | --- |
| Forced CI, concurrency 3 | **57/57 tasks, 0 cached**; **6,813 workspace tests in 371 files**, including **1,236 ERP tests in 17 files**; **19 tooling tests**, **23 typechecks**, **10 Next builds** and **1 Vite build**. |
| Shell Chromium | **18 tests in 1 file** pass with the required library path. |
| Documentation | **218 files** pass the absolute-path `jiti docs/tools/check-docs.mjs` validator; rerun after final release-status documentation. |
| Separate ERP build and live fictional HTTP | **152 workflows: 148 UI and 4 direct HTTP**; **114 route/style samples**, **15 extra panel axe states**, **33 master axe states** and **57 geometry checks**. **0 application, console or HTTP errors; 0 axe violations**. |
| Protected paths and import boundaries | Empty protected status, forbidden-import scan and whitespace check; lockfile unchanged. Exactly 12 master ledger rows changed; header, order and all other 102 destinations preserved. |

The browser receipt retains **259 axe incomplete results** for human review; zero violations is not complete accessibility certification. The [visual review](evidence/restructure-phase-6c-7a2-2026-10-25/visual-review.json) documents three inspected captures and their remaining composition differences. Only these three small screenshots are retained, without video.

CI source digest is `98aa7ad4d25272a6358aec0f153ced6acde6f9aa5822a58a4f5b2508dd97bfff`; live HTTP uses `6532e45d2a913cf53541ea6a040955dd5e995ae1ac1ed82dcddf35760cb6a22e`, each across **2,114 files**. The [source comparison](evidence/restructure-phase-6c-7a2-2026-10-25/source-reconciliation.json) identifies only README/ledger/index documentation deltas. Runtime, tests and browser drivers are unchanged after CI. The final manifest includes the completed release-index status. The [boundary scan](evidence/restructure-phase-6c-7a2-2026-10-25/boundary-scan.json) justifies every URL-pattern match: **11 React documentation links in retained CI warnings**, with no credential match.

The [verification runner](evidence/restructure-phase-6c-7a2-2026-10-25/verify.sh) uses the shared heavy lock and concurrency 3, serializes Vitest trees and caps each at two workers. The root CI script supplies Turbo `--force`. Historical healthcare browser-contract fixture checks are not a fresh healthcare HTTP run. The [lock receipt](evidence/restructure-phase-6c-7a2-2026-10-25/queue.json) records a blocking wait from 05:19:52 UTC to 05:35:17 UTC; it completed naturally. CI, build and live integration passed on the first full verification attempt.

The final runner exited 0. [Runtime identity and cleanup](evidence/restructure-phase-6c-7a2-2026-10-25/identity-final.json) record Node 24.21.0, **483 protected API source comparisons with zero mismatches**, and stopped Browser/Next/API process groups. Next's exit 143 is its requested shutdown after successful browser completion. No process from this work remains running.

The [read-only source audit](evidence/restructure-phase-6c-7a2-2026-10-25/source-audit.json) records 13 protected hashes and numeric targets. `deferred-masters-visual.mjs` adds 12 route-specific geometry/save/date-filter/axe comparisons to existing 114-route, preference, RTL and live workflows. The original desktop app was not rendered. This is not screenshot equality, deployed integration, native execution, accounting acceptance or human localization/accessibility review.

## Upgrade and rollback

No migration or API rebuild. Reverting the additive master wiring restores the earlier composition and retains record URLs and saved layouts. No publication or deployment was performed. The launcher owns and stops its API, production Next server and browser on completion/failure; final cleanup is recorded with the HTTP identity receipt.

## Merged to main after phase 8

26 October integration note: prepared for the post-phase-8 main baseline on `restructure/erp-parity-merge`; the actual merges remain pending linked worktree metadata access. The `main` branch has not been changed. This dated record and all original evidence hashes remain unchanged apart from this note. [The integration record](erp-parity-integration-2026-10-26.md) will identify the combined source and fresh verification separately. Whole-destination parity remains incomplete.
