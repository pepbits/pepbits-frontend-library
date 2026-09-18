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
