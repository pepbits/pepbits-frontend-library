# AllyVora Quality reference import — 1 October 2026

Status: implemented, deployed and verified on the isolated frontend test site as `20261001-quality-01`.

## Added

One AllyVora Quality header module, the original twelve sidebar items in five groups, two record detail routes and the report designer. Shared controls and host preferences render the source design; the authenticated demo API embeds the original SQLite services in isolated tenant/application/branch partitions. The [public header/sidebar screenshot](evidence/quality-reference-2026-10-01/public-header-sidebar.png) shows the imported menu.

## Changed and fixed

Source browser password sessions are replaced by trusted host identity. Directory entries do not grant shared access. Commands and audit writes are transactional; retained idempotency results prevent duplicate effects. Optional current result versions reject stale edits. Event corrections cannot replace another transaction/facility or an already superseded event, and projections exclude superseded occurrences.

The reusable scoped localization alias provider connects original source labels to canonical host translations without changing sibling modules or record values. Shared overlay roots retain the source styles and current theme. Authorized hidden reference pages belong to their effective module while remaining absent from sidebar navigation; the report designer and direct Viewer denial were tested. The browser harness recognizes only the trusted Quality identity read on the expected API base, preserving source-login denial.

## Automated and local validation

The [validation receipt](evidence/quality-reference-2026-10-01/validation.json) records 2,199 frontend tests in 189 files; 322 general API tests and 33 clinical TypeScript API tests, totalling 355 API tests with no failures or skips. All-package typechecking, both production browser builds, packaging smoke checks and all automated repository gates passed. Focused runs overlap these totals and are not added.

[Quality local browser acceptance](evidence/quality-reference-2026-10-01/local-quality-reference-results.json) passed 24 checks: header selection, all twelve actual sidebar destinations, actual record routes/designer, shared Authority form submission, persistence through refresh, trusted actor/audit integrity and restricted-role/server/direct-URL denial. [Language/help/print acceptance](evidence/quality-reference-2026-10-01/local-language-results.json) passed 13 checks in English, Arabic, Hindi and Malayalam and generated a [synthetic PDF](evidence/quality-reference-2026-10-01/local-language-synthetic-quality-report.pdf) through the shared print surface. Native/domain approval remains pending.

Local regressions passed Teleconsult 19, diagnostics 80, Healthcare Suite 49 and School 28 checks. Earlier failed source-label, hidden-designer and test-driver attempts were corrected and rerun; their private failed artifacts remain retained and are not counted as passes.

## Accepted public deployment

[Staging](evidence/quality-reference-2026-10-01/stage-result.json), [remote API preflight](evidence/quality-reference-2026-10-01/runtime-preflight.json), [archive hashes](evidence/quality-reference-2026-10-01/archives.json) and [activation](evidence/quality-reference-2026-10-01/activation2-result.json) identify the matching build and API. The three existing clinical/financial demo JSON files were preserved on startup. Matching previous source/configuration/release and a guarded synthetic-data backup are retained for rollback to `20261001-teleconsult-01`. Provider services and Healthcare Enterprise/ERP/School deployments were untouched. No new dependency download or database migration was required.

Public HTTPS acceptance passed [Quality 24](evidence/quality-reference-2026-10-01/public-quality-reference-results.json), [Teleconsult 18](evidence/quality-reference-2026-10-01/public-teleconsult-reference-results.json), [diagnostics 80](evidence/quality-reference-2026-10-01/public-diagnostic-reference-results.json), [Healthcare Suite 49](evidence/quality-reference-2026-10-01/public-healthcare-suite-results.json) and [School 28](evidence/quality-reference-2026-10-01/public-school-role-header-results.json) checks. Public Teleconsult reused its already signed fixture and did not repeat Doctor signing; local acceptance performed that command. [Forty-five localized guide reads](evidence/quality-reference-2026-10-01/public-guides.json) passed with native review explicitly pending.

Quality, Teleconsult, diagnostics and Healthcare reported no page/console errors; School checks page errors but does not collect console errors. Navigation abort records remain in the results and are not reclassified as successful requests. The public Quality flow used actual authenticated demo HTTP rather than intercepted business responses.

The frozen [530-file source snapshot](quality-reference-source-2026-10-01.json) has SHA256 `bcad65bef04377d084ae1587627d1421f13f5c05e2e9e585d3f7705f88545fec` over base `1eba17bdd3584fcfbef722da317ceb353286b5a8`. All listed files were checked unchanged before these final acceptance-only documentation/evidence updates. Those updates do not relabel the deployed runtime snapshot. Packaging-time help notices retain their original pending status; this dated acceptance record supersedes the public-deployment-pending note. No Git push, npm publication or native executable acceptance is claimed. Refresh existing tabs and sign in again after the API restart.

## Delivery boundary

The source-quality fixture is illustrative. Regulator definitions, external transmissions and clinical events are demonstrations. Production authority integration, an always-on scheduler, native executable and native/domain review are not claimed. Existing product deployments and live databases are outside this import.

See the [feature guide](../../features/quality-reference.md) and [source provenance](../../reference-import/QUALITY-SOURCE.json).
