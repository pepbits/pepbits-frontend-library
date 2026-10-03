# Testing documentation

Current testing-document version: **[1.0.0](v1.0.0/PRE-COMMIT.md)**. This is the first versioned documentation baseline here; it does not replace the frontend's package version or invent a product release.

- [Pre-commit/change verification](v1.0.0/PRE-COMMIT.md)
- [Library renderer matrix](v1.0.0/MODULE-MATRIX.md)
- [Stable acceptance cases](v1.0.0/USE-CASES.md)
- [Machine-readable inventory](v1.0.0/inventory.json)
- [Active version pointer](current.json)
- [Testing-guide changes](CHANGELOG.md)
- [Recorded delivery evidence](../releases/unreleased/verification-2026-09-09.md)

The current inventory covers 159 Library destinations, including five Registry design family additions, Billing Clinic, Clinical Triage, Clinical Consultation OP Consultation and Comprehensive Consultation, plus OP Registration and the List of pages catalog. Earlier evidence covers the 129-route baseline. Navigation coverage, rendering a shared engine, automated business-flow tests and production acceptance are separate measurements. Do not sum overlapping suite counts or call every setting combination tested.

The documentation checker validates links, pointer structure, route/test inventory and release-record requirements. It does not execute application tests or establish access-control correctness. The runtime gates remain necessary for implementation changes.

Four healthcare reference pages add emergency registration, inpatient admission and two consultation designs; see CARE-01.

## Latest retained implementation evidence

The [healthcare page delivery](../releases/unreleased/care-page-templates-2026-09-10.md) records 1,536 frontend tests, 126 API tests, both builds and repository gates against its identified source. Its [deployment follow-up](../releases/unreleased/care-page-deployment-2026-09-10.md) records read-only Chromium acceptance on both public sites. These results belong to that source and scope; this documentation refresh does not rerun or relabel them.

## Latest DCP verification and hosted follow-up

The [12 September style deployment](../releases/unreleased/dcp-style-deployment-2026-09-12.md) records 1,570 frontend tests, 137 API tests, both builds and repository gates, plus focused local/public browser checks. Its 13 September follow-up records a failed hosted feature-browser job despite the other five jobs passing. These results belong to the identified source. The [documentation audit](../releases/unreleased/documentation-audit-2026-09-13.md) reruns documentation checks only and does not fix or relabel those application failures.

## Shared record component acceptance

The [record component delivery](../releases/unreleased/record-components-2026-09-17.md) covers an independent customer adapter, retained section drafts, disabled/hidden actions, and DCP projection without row-permission fallback. Healthcare verifies the packed consumer with synthetic browser fixtures.

Patient Query host capability/cursor tests are in `desktop-clients/packages/erp-screens/src/clinical-templates/query.test.tsx`.
See [the local host increment](../releases/unreleased/patient-query-host-2026-09-17.md); healthcare integration
checks live in the independent consumer repository and use synthetic data.

## Shared lifecycle configuration

Lifecycle contract, adapter and model tests are in `desktop-clients/packages/erp-config/src/lifecycle/lifecycle.test.ts`.
Page tests are in `desktop-clients/packages/erp-screens/src/lifecycle/lifecycle.test.tsx`. Both use in-memory ports and
fictional fixtures. See [the lifecycle increment](../releases/unreleased/lifecycle-configuration-2026-09-18.md);
host API and browser acceptance belong to the consuming application.
Source registry and mapping tests are in `erp-config/src/lifecycle/sources.test.ts` and `erp-screens/src/lifecycle/sources.test.tsx`
(fictional ERP source metadata, in-memory ports); see [the source mapping increment](../releases/unreleased/lifecycle-source-mapping-2026-09-18.md).

## School role-header acceptance — 28 September 2026

The [School role-header delivery](../releases/unreleased/school-role-header-2026-09-28.md) records 1,883 frontend tests, 248 API tests, both builds and repository gates against commit `9c3cea72e624dccb454cfd60fd2d0a34b774a69b`. All 28 authenticated role checks also passed on the isolated public HTTPS site. Use `desktop-clients/e2e/school-role-header.mjs` with explicit `E2E_BASE` and `E2E_API` to check header views, role grants, direct URLs, refresh/new tabs, search and representative existing modules. Full reference-page regression and deployment receipts are linked from the delivery record; counts from overlapping suites are not summed. Synthetic API acceptance does not establish real School identity/provider integration or native executable acceptance.

## Healthcare Suite import acceptance — 29 September 2026

The [Healthcare Suite delivery](../releases/unreleased/healthcare-suite-2026-09-29.md) adds the registered `desktop-clients/e2e/healthcare-suite.mjs` suite. It uses real authenticated demo HTTP, not intercepted business responses: 23 static destinations, five dynamic routes and the patient→appointment→encounter→order/sign→paid invoice workflow, plus actual actor, facility and denied-role checks. The focused tests cover trusted transport, preferences, populated encounters, rollback, stock limits and replay. Existing reference and School suites remain independent regression checks; overlapping suite results are not added together.

## Healthcare Suite RCM acceptance — 29 September 2026

The [RCM delivery record](../releases/unreleased/healthcare-suite-rcm-2026-09-29.md) records 1,943 frontend tests, 274 JavaScript and 33 clinical TypeScript API tests, both builds and repository gates. The registered `desktop-clients/e2e/healthcare-suite-rcm.mjs` suite uses actual authenticated UI commands and dedicated provider HTTP: 53 checks, 38 UI commands and 50 screenshots passed without provider skips. Original Suite regression passed 49 checks, including all 32 static routes. Public HTTPS acceptance against deployed source `4fec17b5b482732d3e418879c8a3450108a6515f`, release `20260929122358894-3da821b0`, passed RCM 53/53 checks (38 UI commands, 50 screenshots), original Suite 49/49 checks (6 UI commands) and School 28/28 checks, with zero page errors; RCM and original Suite also reported zero console errors. Navigation abort requests are retained in the RCM/original logs (12/6); they are not ignored or reclassified as successful requests. Six authenticated HQ/Dubai workspace/patient/invoice JSON hashes remained unchanged across an API restart. The focused 39 backend tests overlap the full API result and are not added. These checks use synthetic Healthcare Suite data and dedicated HTTP simulators; live payer/bank acceptance, licensed DRG, native executable acceptance and native/clinical review remain separate.

## Diagnostic reference acceptance — 1 October 2026

The [diagnostic delivery record](../releases/unreleased/diagnostic-reference-2026-10-01.md) records source identity, dependencies, eight actual diagnostic policy/service checks, 312 API regression checks, frontend tests, both builds and all automated release gates. `desktop-clients/e2e/diagnostic-reference.mjs` passed all 71 checks on the public HTTPS test site, including all 55 menu destinations, explicit sidebar toggles, host actor, API patient writes and branch isolation. Existing Healthcare Suite and School public regression passed 49 and 28 checks respectively. The School suite now waits for the actual Fees URL before recording it and reloading; the failed first attempt and test-only correction remain in the receipt.

`desktop-clients/e2e/diagnostic-localization.mjs` passed 174 local results: nine module/language dashboards plus 165 complete guides. It deliberately rejects a public target because it exercises mutable language preferences. Arabic direction and stable RIS API filter values were checked. These checks do not establish native-speaker/domain approval, every viewer/print/clinical workflow, native executable acceptance or real analyzer/DICOM delivery. Local RCM provider flows explicitly remain not run where their adapters are unconfigured.


## Shared sidebar correction acceptance — 1 October 2026

The [sidebar correction record](../releases/unreleased/sidebar-navigation-2026-10-01.md) supersedes the initial diagnostic route-driver scope with 80 public checks: all 55 destinations are reached through actual sidebar links, and physical hit tests prove the expanded rail leaves module selection clickable. It also checks hover, outside dismissal and Escape. Healthcare Suite and School passed 49 and 28 public regression checks. Diagnostics and Healthcare reported no page/console errors; School reported no page errors and does not capture console errors. Eight diagnostic aborted prefetch requests are retained separately; Healthcare recorded no failed requests.

Local multilingual acceptance passed 183 results, including left/right rail and header hit tests in Arabic, Hindi and Malayalam. The complete 1,962-test run preceded final pin/toggle placement; the final focused 52 tests, both builds and automated gates cover the final implementation. The [validation receipt](../releases/unreleased/evidence/sidebar-navigation-2026-10-01/validation.json) records these separate scopes and source digest. Prior failed RTL and test-driver attempts remain evidence. Native/clinical approval and production provider acceptance are not established by these synthetic tests.


## Teleconsult import acceptance — 1 October 2026

The [Teleconsult record](../releases/unreleased/teleconsult-reference-2026-10-01.md) separates full frontend/API unit runs, two browser builds, local module and role acceptance, four-language layout/print checks and existing diagnostic/Healthcare/School regressions. Public deployment is recorded only after activation and HTTPS acceptance. The simulated clinical/media boundary and pending native/domain review remain explicit.

## AllyVora Quality acceptance — 1 October 2026

The [Quality delivery record](../releases/unreleased/quality-reference-2026-10-01.md) records 2,199 frontend tests, 355 API tests, all-package typechecking, both production browser builds and automated gates. `desktop-clients/e2e/quality-reference.mjs` passed 24 checks locally and publicly: original sidebar navigation, record routes/designer, an actual shared-modal command, persistence, audit and role/URL denials. `desktop-clients/e2e/quality-localization.mjs` passed 13 local language/help/print checks; it is intentionally restricted to local targets because it changes language preferences. Public regression passed Teleconsult 18, diagnostics 80, Healthcare Suite 49 and School 28 checks. Public Teleconsult did not repeat signing its retained signed fixture; local regression performed signing and passed 19 checks. Counts are separate scopes and are not summed. Simulation, pending native/domain review and untested native executables remain explicit.


Pharmacy-1 checks: `npm run test:pharmacy-api`, the package tests, `e2e/pharmacy-reference.mjs` and `e2e/pharmacy-localization.mjs`; see [release evidence](../releases/unreleased/pharmacy-reference-2026-10-01.md).


Tenant Admin/MedBand tests: `npm run test:access-api`, the two reference-package tests and the registered access browser suites. See [delivery status](../releases/unreleased/access-reference-2026-10-01.md).

## RCM Workspace and MedBand fidelity acceptance — 1 October 2026

[The current delivery record](../releases/unreleased/rcm-reference-2026-10-01.md) retains 2,537 frontend tests, 329 JavaScript API tests, 33 clinical TypeScript API tests, both browser builds and all gates against the frozen 973-file source. `e2e/rcm-reference.mjs` passed 49 public checks and `e2e/access-reference.mjs` passed 52, including every original destination, source controls/search and denied-role behavior. Six existing-module public regression suites also passed. Public guide reads passed 328; local four-language checks passed 164 RCM and 176 Access results. The additional legacy provider-flow driver is explicitly incomplete because its invoice had no available patient receivable; its correct HTTP 409 guard and prior successful steps are retained separately. No live-provider, native executable or native/domain approval is inferred.

SurgiSuite checks: `test:surgisuite-api`, `reference-surgisuite/src/module.test.tsx` and the registered `e2e/surgisuite-reference.mjs`. See [the exact delivery boundary](../releases/unreleased/surgisuite-reference-2026-10-02.md); socket/network restrictions block browser/deployment acceptance in this session.

Shared reference-font imports are covered by `npm run test:reference-fonts` (actual host Tailwind/PostCSS imports, Next CSS loader, emitted asset identity for both host stylesheets). See [the Webpack font correction](../releases/unreleased/shared-reference-font-resolution-2026-10-02.md); this is separate from complete Next build and browser acceptance.

Canonical English catalog chunk separation is tested with `npm run test:catalog-chunks`; see [the dated Webpack correction](../releases/unreleased/shared-catalog-chunks-2026-10-02.md).

MedSlot checks: `test:medslot-api`, `reference-medslot/src/module.test.tsx` and `e2e/medslot-reference.mjs`; see [the delivery boundary](../releases/unreleased/medslot-reference-2026-10-02.md).
