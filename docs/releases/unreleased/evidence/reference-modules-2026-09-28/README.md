# Reference module verification evidence — 28 September 2026

This evidence records local checks against the integrated candidate using Chromium and the isolated demo API with fictional data. The [artifact manifest](ARTIFACTS.json) lists captured evidence files and their hashes. The source baseline is commit `a9703f1`; the [source inventory](../../../../reference-import/SOURCE-INVENTORY.json) covers 341 original source files across Reports, ERP1, ERP2 and School. Those original source trees were left unchanged. Six public packages expose the four modules, the shared host contract and the shared ERP core.

## Browser journeys and actions

[The archived route results](routes/results.json) contain 162 passed records and no errors: 152 static destinations, six dynamic destinations (three Reports, one ERP2 and two School), and four module-header/desktop checks. [The source captures index](original/captures.json) identifies 18 original module screenshots used for comparison.

Additional interactive results are recorded separately:

- [Reports actions](logs/reference-reports-browser-actions-frozen.log) cover report-builder preview and save, dynamic navigation, and API-key create, pull and revoke. The [workflow result](reports/actions-result.json) records those actions. The [recipient result](reports/result.json) records a successful download for a non-owner recipient; the screenshot is [here](reports/authenticated-recipient.png). The module also has captured [overview](reports/overview.png), [library](reports/library.png), [detail](reports/detail.png) and [builder](reports/builder.png) views.
- The earlier [ERP workflow probe](erp/workflow-results.json) recorded customer create/edit steps in both variants and 63 successful API requests, but later invoice and cleanup selectors timed out. Separate focused runs then verified an ERP1 invoice (total 150), editor save/back-to-list and ERP2 record edit/cancel/middle-open cleanup ([results](../../../../reference-import/evidence/erp1-invoice-and-erp2-navigation.json), [invoice screenshot](../../../../reference-import/evidence/erp1-saved-invoice.png)), plus an ERP2 invoice (total 200), print view and cleanup ([results](../../../../reference-import/evidence/erp2-invoice-and-print.json), [light](../../../../reference-import/evidence/erp2-invoice-print.png), [midnight](../../../../reference-import/evidence/erp2-invoice-print-dark.png)). Both focused result files report no errors. Separate ERP tests cover role and branch scope; see the [46-test log](logs/reference-erp-final-independent-tests.log).
- [School action results](school/action-results-final.json) and the [School evidence notes](school/EVIDENCE.md) cover four real UI actions: a 75-byte attachment round-trip with exact-byte verification; a library return that changes stock from 6 to 7 and stays at 7 on retry; server-side quiz grading; and a persisted live-room message, seven participants and session end. The independent [35-test School API log](logs/reference-school-final-frozen-independent.log) records additional role, scope and domain checks.
- [Scope-change results](scope/result.json) show branch headers `hq` and `dubai`, draft clearing, module eviction on logout, School-only module choices for a teacher and an ERP access denial with HTTP 403. [Preference results](preferences/result.json) cover RTL, compact density, midnight theme, host font scaling, and a locked page-size write rejected with 403.

## Compatibility comparison

The [healthcare comparison notes](healthcare/EVIDENCE.md) and [structured comparison](healthcare/comparison-final.json) cover six existing pages. Rendered text and measured geometry match on all six; five screenshot pairs are byte-identical. The query page differs at 63 border pixels (0.009%). A pre-existing page-ID alias caused the source baseline and first candidate to open the query page for record and 360 routes. The candidate now uses explicit forward and reverse page-ID mappings. Three real query/new-record/360 navigation checks passed with no API writes; the [focused component log](logs/reference-patient-routing-tests.log) records eight passing tests. The broader [visual comparison](../../../../reference-import/VISUAL-COMPARISON.md) and [matched-state SHA index](../../../../reference-import/evidence/visual-index.json) record 16 paired source/candidate states.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Vitest | 1,859 tests across 156 files passed | [unit log](logs/reference-unit-final-routing.log) |
| API tests | 238 passed (205 general API + 33 clinical API) | [API log](logs/reference-full-api-final.log) |
| ERP-specific tests | 46 passed | [ERP log](logs/reference-erp-final-independent-tests.log) |
| School-specific tests | 35 passed | [School log](logs/reference-school-final-frozen-independent.log) |
| Package/client type checks | All packages and both clients passed | [typecheck log](logs/reference-typecheck-final-routing.log) |
| Web and desktop builds | Passed; largest compressed client chunks were 266,229 and 528,673 bytes, under the 550,000-byte limit | [web build](logs/reference-web-build-final-routing.log), [desktop build](logs/reference-desktop-build-final-routing.log), [bundle check](logs/reference-bundle-final-routing.log) |
| Localization and source adaptation checks | Passed | [localization log](logs/reference-localization-final-routing.log), [adaptation log](logs/reference-adaptation-final.log) |
| Authored-guide translation mapping checks | Passed for 543 paragraph and 685 metadata/help/rule mappings per locale; native review remains pending | [translation validation](../../../../reference-import/TRANSLATION-VALIDATION.json) |
| Documentation API and storage checks | 5 passed after the translation update | [test log](logs/reference-documentation-api-final-translated.log) |
| Full package verification | All repository verification rules passed after the guide translation mappings and revision baselines were finalized | [final verifier log](logs/rule-verifier.log) |

The final staging whitespace check normalized trailing whitespace and terminal blank lines in five tracked source files. No substantive source or runtime content changed; impact receipts record `no-content-impact` for those files.
| Reference-module HTTP boundary | Passed; authentication, role and branch scope preserved | [HTTP log](logs/reference-modules-http.log) |
| Documentation normal check | Passed for 468 guides | [lifecycle log](logs/reference-docs-final-normal.log) |
| Documentation links and inventory check | Passed | [documentation check log](logs/reference-docs-final-check-docs.log) |

Five existing browser regressions passed: [OP Registration](logs/existing-op-registration.log), [Clinical Consultation](logs/existing-clinical-consultation.log), [Clinic Billing](logs/existing-clinic-billing.log), [DCP host runtime](logs/existing-dcp-host-runtime.log) and the [Page Library 14-ID run](logs/existing-page-library.log). Page Library verified order, examples, guides, search, all 14 open-page actions, four languages, direction, width and absence of page errors; captured views are [catalog](existing-page-library/catalog.png), [English](existing-page-library/en.png), [Arabic](existing-page-library/ar.png), [Hindi](existing-page-library/hi.png) and [Malayalam](existing-page-library/ml.png).

The [guide translation validation](../../../../reference-import/TRANSLATION-VALIDATION.json) passed exact-key, placeholder, path, and numeric checks for 543 authored paragraph and 685 metadata/help/rule mappings per locale; existing mappings were retained. The 152 guides have 456 Arabic, Hindi and Malayalam translated drafts with current revision hashes. The helper classifies 455 as current and the Malayalam school-library `ISBN` identifier exception as incomplete; all 456 human review states remain pending. The strict documentation gate therefore remains blocked by 1,572 explicit items: 168 inherited workflow-authoring and 1,404 guide-translation review items. The strict check was not bypassed; see its [captured result](logs/reference-docs-final-strict.log).

## Reproduce the checks

Use Node 24 for these commands. Install the declared frontend and API dependencies from the repository root:

```sh
npm ci --prefix desktop-clients
npm ci --prefix dummy-api
```

The repository includes the test and build scripts; none require AI tooling. From `desktop-clients/`, run:

```sh
npm run typecheck
npm test
npm run test:api
npm run build -w web
npm run build -w desktop
```

For the recorded static, dynamic and desktop browser route checks, start the local API, web and desktop shells so they answer at the harness URLs (`http://127.0.0.1:3200`, `http://127.0.0.1:3100` and `http://127.0.0.1:3101`). From the repository root, `MODE=dev ./run.sh start api web desktop` starts the development services. Then, from `desktop-clients/`, run:

```sh
E2E_BASE=http://127.0.0.1:3100 \
E2E_DESKTOP=http://127.0.0.1:3101 \
E2E_API=http://127.0.0.1:3200 \
E2E_ARTIFACTS=/tmp/reference-modules-browser \
node e2e/reference-modules.mjs
```

The browser runner needs Playwright Chromium installed locally. From `desktop-clients/`, install the harness version and browser with:

```sh
npm install --no-save --package-lock=false playwright@1.49.1
npx playwright install --with-deps chromium
```

Alternatively, set `PLAYWRIGHT_PATH` to an existing Playwright package directory; the harness loads its `index.js`. The route run checks the 152 static destinations, six dynamic URLs, module choices and four desktop pages, then writes its own `results.json` and screenshots to `E2E_ARTIFACTS`.

## Acceptance limits

These results describe a local candidate and fictional demo services. They do not verify a production backend, real authorization policy in a consuming application, live email delivery, a native executable, deployment or package publication. The 152 English guide bodies are authored and source-reviewed; the generated UI-copy CSV rows and current language catalogs do not replace native-speaker review of guide translations.
