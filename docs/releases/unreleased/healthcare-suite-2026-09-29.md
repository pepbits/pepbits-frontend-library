# Healthcare Suite reference module — 29 September 2026

State: local implementation verified; isolated deployment preparation pending. Source base: original CarePoint frontend/backend under `reference/frontend/healthcare-suite/healthcare-suite`; see the [source inventory](../../reference-import/healthcare-suite/SOURCE-INVENTORY.json). Source baseline: `fedf5cf16222334e0da598be13a72d0b3f57f05f`; exact runtime file hashes are recorded in [the candidate manifest](manifest-healthcare-suite-2026-09-29.json).

## Scope

Import the CarePoint design as a separate header module named **Healthcare Suite**, module ID `reference-healthcare-suite`, distinct from existing **Healthcare**. The module preserves the source presentation and uses API-backed operations. The [feature guide](../../features/healthcare-suite.md) describes intended coverage and boundaries. The current frontend port exposes 23 static destinations from 17 page templates, with 14 metadata-driven master entities. Its module package exports `ReferenceHealthcareSuiteModule({ path, host })`, `HEALTHCARE_SUITE_NAV` and `healthcareSuiteRoutes`.

The original source tree is unchanged. The [per-file SHA-256 inventory](../../reference-import/healthcare-suite/SOURCE-INVENTORY.json) covers original source inputs, including source code, configs, lockfiles and demo CSV data; dependency/build outputs and private environment files are excluded.

## Data, identity and permissions

The source frontend uses `/api` and contains no frontend mock data stores. The imported boundary is `/reference-modules/healthcare-suite/api`, preserving original request/response contracts; the imported JavaScript API adapter owns simulated business operations in process-lifetime tenant/application/branch partitions seeded from the original CSV fixtures. The host integration supplies the existing demo authentication, actual actor session and navigation. Source CarePoint has no authentication of its own. The API validates the selected active facility and checks host actor, product, branch, module and role. Its current demo read roles are enterprise-admin, admin, operations-analyst, operations, finance-manager, finance and read-only; write roles are enterprise-admin, admin, operations-analyst and operations. Module visibility is a host navigation decision and cannot be inferred as authorization. These roles and guards are demo integration policy, not production healthcare permissions. The CarePoint AppShell, Header and Sidebar are replaced by the host shell, while page and component layouts are retained.

The original API simulates payer eligibility, prior approval and eRx. There is no real payer service, electronic prescribing integration, claims submission or production healthcare backend in this scope. Do not interpret source business scenarios as imported-flow acceptance or production readiness.

## Verification and publication

The final frontend suite passes **1,903 tests across 163 files**; the final API suite passes **265 tests** (232 general plus 33 clinical). Full package typechecks, both production builds and normal repository gates pass. Focused package tests pass 19 cases and overlap the full frontend total. Registry and deployment mechanics pass 2 and 14 cases respectively. Bundle limits pass: desktop 530,699 and web 274,849 gzip bytes against the 550,000-byte limit.

Authenticated localhost Chromium passes **40 checks**, with no page or console errors: all 23 static destinations, five dynamic routes, host actor, patient creation, provider-slot appointment, linked encounter/check-in, catalog order/signing, invoice creation/collection/print, created invoice URL, pharmacy facility and finance/School permission boundaries. All six consequential UI POSTs carried operation identifiers. The populated-encounter translation collision discovered during this flow was fixed and added to the component regression suite. Initial failed attempts are retained separately.

[Browser results and screenshots](evidence/healthcare-suite-2026-09-29/browser-local/results.json), [unit log](evidence/healthcare-suite-2026-09-29/unit-frozen.log), [Claude review dispositions](../../reference-import/healthcare-suite/REVIEW.md) and [source/adaptation hashes](../../reference-import/ADAPTATION-MANIFEST.json) record actual scope. Production-build browser repetition, legacy module regressions and public HTTPS deployment results will be appended after completion. No package publication or release tag is claimed.

The new immutable help patch `2026-09-29-healthcare-suite` contains 491 registrations, including 23 new authored guides and current draft translations in Arabic, Hindi and Malayalam. Earlier snapshots remain unchanged. The 1,641 tracked authoring/native review items consist of inherited authoring work and human review; automated translation checks do not grant native approval.
