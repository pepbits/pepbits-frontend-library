# Tenant Admin and MedBand import — 1 October 2026

Status: implemented, deployed and verified on [the isolated test site](https://frontend.test.pepbits.com) as `20261001-access-01`.

## Added and changed

Two separate header modules preserve the reference Tenant Admin and MedBand pages through shared components and original scoped layouts. The shared host supplies identity, sidebar navigation, permissions and effective preferences. Backend-owned fictional data and original services run in scope-isolated workers. No frontend business mocking or source actor switching is retained.

Commands, source history and durable replay results share one transaction. Original approval immutability/independence, row-version guards, encounter/case/admission validation and bed exclusivity are retained. Reset and destructive startup migrations are blocked. These reference modules do not change real Healthcare Enterprise, ERP, School or platform configuration.

## Validation and delivery

The complete frontend run passed 2,409 tests in 214 files; the complete API run passed 327 JavaScript and 33 clinical TypeScript tests. Focused module tests overlap those runs and are not added. All-package typechecking, both production browser builds and automated repository gates passed.

Local authenticated browser acceptance passed 51 checks, including both header selectors, all 40 sidebar destinations, an actual Tenant Admin draft, actual MedBand registration and refresh, audit, admission form and viewer denials. Existing Pharmacy, Quality, Teleconsult, diagnostics, Healthcare Suite and School browser regression also passed. Local localization passed 176 results: eight source-layout/language/direction checks plus 168 authored-guide reads for 42 destinations across English, Arabic, Hindi and Malayalam. Native-language review remains pending. Frozen-artifact and public deployment receipts are recorded below.

The full unit run precedes a tool-only explicit TypeScript export suffix and corrected acceptance-driver assertions/selectors; final typechecking, builds and actual browser runs cover those corrections. An initial headless-browser font issue was resolved using the existing test font runtime without changing application styles. Earlier failed attempts are retained privately and are not counted as passes. Native executable acceptance, native/domain review and real payer/bank integration are separate and are not claimed.

See [the feature contract](../../features/access-reference.md).

## Public delivery evidence

The [validation receipt](evidence/access-reference-2026-10-01/validation.json) records the separate test scopes. [Public new-module acceptance](evidence/access-reference-2026-10-01/public-access-reference-results.json) passed 51 checks with no page, console or fetched API errors. Both header selections, all forty original sidebar destinations, real draft/registration commands, refresh, audit, admission form and read-only denial checks passed. [Tenant Admin](evidence/access-reference-2026-10-01/public-tenant-admin-header.png) and [MedBand](evidence/access-reference-2026-10-01/public-medband-header.png) screenshots show the shared header and original workspaces. Screenshots of each visible source page are retained in the evidence folder.

[Public help verification](evidence/access-reference-2026-10-01/public-guides.json) passed all 168 reads. [Local language/layout verification](evidence/access-reference-2026-10-01/local-language-results.json) passed 176 results, including Arabic RTL. Native/domain review is pending and is not inferred from these automated checks.

Public existing-module regression passed Pharmacy 23, Quality 24, Teleconsult 18, diagnostics 80, Healthcare Suite 49 and School 28 checks. Local Teleconsult passed 19 because it signed its owned fixture; the public suite preserves the already-signed fixture. The original result files and navigation-abort evidence are retained separately. All captured page/console error arrays were empty; the School suite captures page errors, not console errors. Regression counts are not added to full unit totals.

## Source identity and recovery

The [source manifest](access-reference-source-2026-10-01.json) freezes 858 files at SHA-256 `87e1e0659b1f52412bf82468daa9fd800a6897f0bd0a9bbad26a198e38fd05d1`. [Server verification](evidence/access-reference-2026-10-01/deployment.json) checked every frozen file, all eleven configuration overlays and both browser release markers. Package HTML/assets passed isolated smoke checks before staging.

The first stage lacked TypeScript, a verification dependency. The exact local `typescript@5.9.3` package was hash-verified into the isolated stage; deterministic generation checks and actual backend preflight then passed. No package download, server DNS change or live mutation preceded successful staging. The original failed stage result remains preserved privately. Activation retained the matching previous source/config/release and guarded data backup; three existing Healthcare data files remained unchanged at cutover. Other application deployments were not touched.

Documentation and evidence were finalized after the artifact freeze; application source was not changed after public validation. Browser rendering of the desktop shell is not native executable acceptance. The modules use synthetic backend-owned data; real clinical, payer, bank, tax and regulatory acceptance remain independent deployment activities.
