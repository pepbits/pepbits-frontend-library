# Pharmacy-1 reference import — 1 October 2026

Status: implemented, deployed and verified on the isolated frontend test site as `20261001-pharmacy-01`.

## Added

An independent **Pharmacy-1** header module hosts all thirteen original Phial destinations, including the Settings footer destination. Original view composition, search, prescription stages, stock, counter sales, orders, purchasing, authorizations, claims, remittance, returns and patient forms use shared authenticated UI/API adapters. The [public header/sidebar screenshot](evidence/pharmacy-reference-2026-10-01/public-pharmacy-header-sidebar.png) shows the selection and menu.

## Changed and fixed

The host supplies header/sidebar, identity, scope, preferences, translations and formatting. Source user switching is removed. A reusable worker broker partitions persisted SQLite data by trusted tenant/application/branch and bounds worker capacity. Source services remain API-owned; fictional business records are not embedded in the frontend.

Commands, history and durable replay results commit atomically. Failed commands roll back. Lost-response retries retain the operation key and simultaneous UI submissions are guarded. Successful commands without a source status transition receive a payload-free authenticated history entry. Technician verification and viewer mutations are denied on the server. Source clinical and tax examples remain illustrative, including explicitly permitted single-pharmacist checking.

Source sidebar icons and all thirteen destinations are preserved inside the shared navigation. Shared controls, portals and receipt printing consume effective preferences and locks. A shared React runtime chunk keeps the desktop build within the existing bundle budget. English, Arabic, Hindi and Malayalam copy is canonical; thirteen new help pages are authored, with translated drafts pending native/domain review.

## Validation

The [validation receipt](evidence/pharmacy-reference-2026-10-01/validation.json) records final full runs: 2,265 frontend tests in 198 files, 324 general API tests and 33 clinical TypeScript API tests, totalling 357 API tests with no failures or skips. Both production browser builds, package smoke tests, typechecking and all repository gates passed. Focused runs overlap these totals and are not added.

[Local Pharmacy browser acceptance](evidence/pharmacy-reference-2026-10-01/local-pharmacy-results.json) passed 23 checks, including every sidebar page, actual prescription query links, the original search palette, shared patient form, persisted API writes, command replay, actor attribution and role denial. [Language/help/print acceptance](evidence/pharmacy-reference-2026-10-01/local-language-results.json) passed nine checks and generated an actual [synthetic receipt PDF](evidence/pharmacy-reference-2026-10-01/local-language-synthetic-pharmacy-receipt.pdf) using the shared print surface. [The packaged desktop shell](evidence/pharmacy-reference-2026-10-01/local-desktop-results.json) passed fourteen browser checks across all pages and actual API reads. Desktop navigation uses typed in-memory targets; web record/query targets appear in the URL. These desktop browser checks are not native executable tests.

Early startup, source-copy, command-history and browser-driver issues were corrected and rerun. Private failed attempts are retained and are not counted as passes. Later desktop-driver corrections changed only private validation code; the shipped runtime remained unchanged.

## Accepted deployment

[Staging](evidence/pharmacy-reference-2026-10-01/stage-result.json), [remote API preflight](evidence/pharmacy-reference-2026-10-01/runtime-preflight.json), [archive hashes](evidence/pharmacy-reference-2026-10-01/archives.json), [activation](evidence/pharmacy-reference-2026-10-01/activation2-result.json) and [deployed source verification](evidence/pharmacy-reference-2026-10-01/deployed-source-verification.json) identify the matching release and API. The three existing clinical/financial demo JSON files were preserved on startup. The previous matching source/configuration/release and synthetic-data backup remain available for rollback to `20261001-quality-01`. Only the three isolated frontend test units changed; provider services and Healthcare Enterprise/ERP/School deployments were untouched.

Public HTTPS acceptance passed [Pharmacy 23](evidence/pharmacy-reference-2026-10-01/public-pharmacy-reference-results.json), [Quality 24](evidence/pharmacy-reference-2026-10-01/public-quality-reference-results.json), [Teleconsult 18](evidence/pharmacy-reference-2026-10-01/public-teleconsult-reference-results.json), [diagnostics 80](evidence/pharmacy-reference-2026-10-01/public-diagnostic-reference-results.json), [Healthcare Suite 49](evidence/pharmacy-reference-2026-10-01/public-healthcare-suite-results.json) and [School 28](evidence/pharmacy-reference-2026-10-01/public-school-role-header-results.json). [Fifty-two actual help reads](evidence/pharmacy-reference-2026-10-01/public-guides.json) verified all thirteen new guides in four languages; native review remains pending. Teleconsult reused its already signed public fixture. School collects page errors, not console errors; navigation aborts remain explicitly retained where collected.

The frozen [652-file snapshot](pharmacy-reference-source-2026-10-01.json) has SHA256 `28eb1f2ee7694873c0636507b59e570399780b26f1b4794684e7332f2d5a4890` over base `1eba17bdd3584fcfbef722da317ceb353286b5a8`. All listed source files were verified unchanged locally and on the server before these final documentation/evidence-only updates. The frozen snapshot is retained; these acceptance updates do not relabel deployed source bytes. No Git commit, push, npm publication or native executable approval is claimed. Refresh existing tabs and sign in again after the API restart.

## Completion boundary

This delivers the reference application to `frontend.test.pepbits.com`. Payer adjudication, eRx intake and payments remain simulations. It does not activate real prescribing, bank or payer systems, validate pharmacy/tax rules, or approve native-language/clinical use. Source look and workflows remain the reference baseline; shared host controls can differ in portal sizing and formatting.

See the [feature guide](../../features/pharmacy-reference.md) and [source provenance](../../reference-import/PHARMACY-SOURCE.json).
