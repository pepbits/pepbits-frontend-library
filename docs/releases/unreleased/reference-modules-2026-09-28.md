# Reports, ERP1, ERP2 and School reference modules — 28 September 2026

State: implementation and local validation complete. Package publication and live deployment are outside this task. The candidate was compared with the original frontend library at `a9703f1`; the source inventory and [guide audit](../../reference-import/GUIDE-REVIEW.md) record scope and traceability.

## Scope

The import provides six public packages: Reports, ERP1, ERP2, School, the shared reference host contract and the shared ERP core. The [source inventory](../../reference-import/SOURCE-INVENTORY.json) covers 341 original source files across the four designs; their original source trees were left unchanged. The imported modules expose 152 static destinations:

| Module | Design | Static destinations |
| --- | --- | ---: |
| Reports | Lumen Reports | 14 |
| ERP1 | Keystone ERP1 | 57 |
| ERP2 | Keystone ERP2 | 57 |
| School | Scholaris | 24 |
| **Total** |  | **152** |

ERP1 and ERP2 each render their catalogue through 20 template families. ERP1 keeps the source in-page editor behavior; ERP2 includes routed record actions. The shared host owns sign-in, module selection, navigation and authenticated scope. The `dummy-api` reference stores contain fictional demo records and server-side demo operations.

## Verification results

- **Browser coverage:** 162 records passed with no recorded errors: 152 static destinations, six dynamic report/ERP2/School destinations and four desktop module-choice/page checks. All 14 legacy Page Library identities were also opened in the browser; their ordering, examples, guides, search, language, RTL and width checks passed. The final detailed results are in the [evidence index](evidence/reference-modules-2026-09-28/README.md), [route results](evidence/reference-modules-2026-09-28/routes/results.json) and [Page Library browser log](evidence/reference-modules-2026-09-28/logs/existing-page-library.log).
- **Module actions:** Reports builder preview/save, dynamic navigation, API-key create/pull/revoke and non-owner report-recipient download passed. After a partial ERP probe, focused browser runs verified an ERP1 invoice totaling 150, editor save/back-to-list and ERP2 record edit/cancel/middle-open cleanup; a separate ERP2 run verified an invoice totaling 200, print view and cleanup. Both focused result files report no errors; their JSON and screenshots are in the [evidence index](evidence/reference-modules-2026-09-28/README.md). School passed four UI actions: exact 75-byte attachment round-trip, idempotent library return (6 copies to 7, still 7 on retry), server-side quiz grading and persisted live-room chat/participants/end.
- **Context and preferences:** branch switching and draft clearing, logout module eviction, teacher module restriction and ERP denial (403) passed. RTL, compact density, midnight theme, host font scaling and locked page-size denial (403) passed.
- **Healthcare compatibility:** six existing pages were compared; text and measured geometry matched for all six, and five screenshot pairs were byte-identical. The remaining query screenshot difference was 63 border pixels (0.009%). A pre-existing page-ID mapping bug caused both source and first candidate to open the query page for record and 360 routes. The candidate now uses explicit forward/reverse IDs; three real query/new-record/360 navigation checks and eight focused tests passed without changes to form UI or clinical data.
- **Automated suites:** 1,859 Vitest tests in 156 files passed; 238 API tests passed (205 general API and 33 clinical API); separate ERP and School suites passed 46 and 35 tests. All package/client type checks and localization/adaptation checks passed. Five existing browser regressions passed: OP Registration, Clinical Consultation, Clinic Billing, DCP host runtime and the 14-ID Page Library run.
- **Builds:** web and desktop production builds passed. The largest gzip client chunks measured 266,229 bytes (web) and 528,673 bytes (desktop), both within the 550,000-byte budget.
- **Documentation:** the normal lifecycle check passed for 468 current guides and the documentation link/inventory check passed. The strict check remains correctly blocked by 1,572 pending items: 168 inherited workflow-authoring entries and 1,404 guide-translation review entries.

## Evidence

The [evidence README](evidence/reference-modules-2026-09-28/README.md) describes the capture environment, results, reproducible npm commands and acceptance limits. [ARTIFACTS.json](evidence/reference-modules-2026-09-28/ARTIFACTS.json) records hashes and sizes for the captured files. The source/candidate [visual comparison](../../reference-import/VISUAL-COMPARISON.md) and its [paired-image hash index](../../reference-import/evidence/visual-index.json) cover 16 matched states.

## Remaining boundaries

All 152 English guides are authored and source-reviewed. Draft translations are present for all 456 Arabic, Hindi and Malayalam guide states; 455 revision states report current and the Malayalam school-library `ISBN` identifier exception remains incomplete in the conservative lifecycle heuristic. All 456 await native review, and generated UI translations and Pending CSV rows do not count as approval. The [translation validation record](../../reference-import/TRANSLATION-VALIDATION.json) documents the mapped content and retained identifiers. This local work does not verify a consuming production backend, production authorization configuration, real mail delivery, a native executable, package publication or live deployment.

Demo records are fictional. Formatting, currency, dates, pagination, fonts, density, theme and direction follow the host's effective preferences; consuming applications must provide authorized business services and their own domain acceptance.
