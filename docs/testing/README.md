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

The [RCM delivery record](../releases/unreleased/healthcare-suite-rcm-2026-09-29.md) records 1,943 frontend tests, 274 JavaScript and 33 clinical TypeScript API tests, both builds and repository gates. The registered `desktop-clients/e2e/healthcare-suite-rcm.mjs` suite uses actual authenticated UI commands and dedicated provider HTTP: 53 checks, 38 UI commands and 50 screenshots passed without provider skips. Original Suite regression passed 49 checks, including all 32 static routes. These are synthetic local checks; live payer acceptance and licensed DRG remain separate.
