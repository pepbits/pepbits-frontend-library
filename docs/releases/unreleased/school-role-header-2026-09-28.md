# School role views in the header — 28 September 2026

Status: unreleased; implementation and verification in progress. Date UTC: 28 September 2026. Source identity: worktree based on `6f470dc`; final commit/diff identity pending. Tag and package publication: not created. Deployment: none claimed for this change. Affected area: frontend School reference module and synthetic demo API.

## Changes and user impact

Adds six School module-header views: Administrator, Teacher, Student, Parent, Librarian and Accountant. The views reuse the canonical 24 School page registrations and route set. The synthetic `enterprise-admin` account is explicitly entitled to all six views; each synthetic School-role account is entitled only to its own view. Reports, ERP1 and ERP2 keep their legacy header behavior. See the [user instructions](../../features/school-role-views.md).

The server validates the requested `X-Reference-Module` against the authenticated account, resolves the effective School persona for request handling, and carries the authenticated account identity into the API handler. Client navigation metadata is not authorization. The data remains synthetic demo data; production identity, authorization and school services are outside this change.

## Compatibility and data

No duplicate role-specific page registry is added. Existing School page identities are reused. No persistent schema migration is recorded in the current change. Reports, ERP1 and ERP2 module identities and behaviors are intended to remain unchanged.

## Verification and limits

- Source review: current worktree code inspected; runtime changes are still being integrated.
- Runtime/API, browser, build and localization checks: pending final integrated candidate.
- Documentation checks: pending final documentation gate.
- Publication, native execution, production integration and deployment: not claimed.

Update this record with exact commands, results, source identity and retained evidence after the integrated checks complete. Do not copy earlier reference-module or test-site verification as evidence for these role-view changes.

## Upgrade, rollback and publication

No package publication or deployment has occurred for this change. No migration or rollback operation is currently identified. Reassess compatibility and rollback steps against the final implementation before publication or deployment.
