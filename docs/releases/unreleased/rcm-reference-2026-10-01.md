# RCM reference import and MedBand controls — 1 October 2026

Status: implemented, deployed and verified on [the isolated test site](https://frontend.test.pepbits.com) as `20261001-rcm-01`.

## Added and corrected

Select **RCM Workspace** in the header to open all forty original reference pages across eight sidebar categories. Original worklists, forms, dashboards, financial documents, approvals and command palette retain their source layouts. The host supplies authenticated identity, sidebar navigation, preferences and tenant locks; source components reuse shared controls and accessible dialog mechanics.

MedBand controls now retain the reference palette, fonts, dimensions, spacing, wrapping and modal frames under default settings. Non-default effective preferences still apply. Ctrl+K opens only the selected module's search palette. Licensed Public Sans and Bricolage Grotesque fonts are self-hosted and loaded in both browser builds.

The RCM service retains thirty-six original resources behind authenticated role/domain guards and tenant/application/branch-isolated durable SQLite stores. Trusted actor context replaces the source actor switcher. Transactions, audit, retry identity, row versions and independent approvals remain server-enforced. Currency/operational scope filters do not grant tenant authority. Board pagination accepts the source's 300-row requests and rejects invalid or excessive bounds. All synthetic business data and financial/provider simulations remain API-owned.

Forty authored RCM page guides and corrected MedBand help are included in the immutable `2026-10-01-rcm-reference-import` help patch. English, Arabic, Hindi and Malayalam content is available; native-language and domain approval remains pending. See [the feature contract](../../features/rcm-reference.md) for the complete page inventory and integration boundaries.

## Validation

[The validation receipt](evidence/rcm-reference-2026-10-01/validation.json) records the exact scopes. The final source passed 2,537 frontend tests across 225 files, 329 JavaScript API tests and 33 clinical TypeScript API tests. Four opt-in browser-wrapper tests remain skipped; authenticated browser suites were executed independently. All-package typechecking, both production browser builds, component/preference/security/localization/bundle/documentation gates and deterministic source generation passed.

Direct source-style comparison passed twenty-four MedBand and twenty-eight RCM checks, including control and overlay frames, with no measured differences. These are bounded computed-style comparisons, not a claim that every viewport is pixel-identical. The shared host header/sidebar and effective preference behavior are intentional integration boundaries.

Public authenticated acceptance passed RCM Workspace 49, Tenant Admin/MedBand 52, Pharmacy 23, Quality 24, Teleconsult 18, diagnostics 80, original Healthcare Suite 49 and School 28 checks. Captured page-error arrays were empty. School captures page errors, not console errors. Retained navigation aborts are recorded separately: diagnostics 4, Teleconsult 4, Quality 21 and one original Healthcare request. No business-response interception was used. Overlapping suites are not added to unit totals.

Local four-language checks passed RCM 164 and Tenant Admin/MedBand 176 results; [public guide reads](evidence/rcm-reference-2026-10-01/public-guides.json) passed all 328 reads. Native/domain review is not inferred from automated checks. Representative screenshots and each visible RCM/MedBand page are retained alongside the original result files.

An additional older Healthcare Suite provider-flow driver passed 42 checks, including claims, remittance/clawback, packages, independent pricing approvals, provider deposit capture and payout. It then stopped at a fixture guard: the new insured invoice had no unreserved patient receivable, so the server correctly rejected its fixed 10.00 collection with HTTP 409. [The retained result](evidence/rcm-reference-2026-10-01/additional-legacy-rcm-results.json) is incomplete, not counted as a pass. Existing records were not reset to accommodate the driver. This does not alter the eight completed public module suites above.

## Source identity, activation and recovery

The [frozen manifest](rcm-reference-source-2026-10-01.json) identifies 973 files over base `1eba17bdd3584fcfbef722da317ceb353286b5a8`, SHA-256 `0f36ff868d43de73db30c8a0a26d8116f7539fa0e3ab2897f65fe5baa101d2ea`. [Server verification](evidence/rcm-reference-2026-10-01/server-verification.json) checked all frozen files, eleven configuration overlays, both browser release markers, API health and the three active isolated services.

[Activation](evidence/rcm-reference-2026-10-01/activation.json) retained the previous matching source/config/release and guarded data backup. Three existing Healthcare Suite data files were preserved at cutover. The rollback release is `20261001-access-01`. Existing Healthcare Enterprise, ERP and School application deployments and provider-simulator services were not replaced. The activation receipt predates browser acceptance and therefore retains its original pending field; the later validation receipt records completed public checks.

The pinned TypeScript compiler and runtime dependencies were packaged before maintenance. Staging verified generated source and embedded APIs against temporary synthetic data before activating only the isolated frontend-test units. No server DNS change or deployment-time package download was needed. Documentation/evidence was finalized after the freeze; application source remains the deployed frozen snapshot. No new Git push or npm publication is claimed.

## Remaining external acceptance

Live payer/bank credentials, certified DRG grouping, real accounting integrations, native executable acceptance and clinical/financial/native-language review are outside this reference import. API-owned simulations are available for demonstration and automated checks. See [the deployment runbook](../../../desktop-clients/docs/frontend-test-deployment.md) for isolated operations and recovery.
