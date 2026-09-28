# Reference design and workflow evidence

The import preserves the source page content, domain layouts, fields, charts, record templates and actions inside the existing application shell. It uses the host's shared controls and authoritative preferences. This review establishes source coverage and representative design/workflow retention; it does not assert pixel equivalence for every route.

[The visual index](evidence/visual-index.json) contains SHA-256 hashes and links for 16 matched source/candidate states, captured at a 1440 × 1000 viewport. Some original images include the full page; candidate images show the host viewport or bounded module content. Compare the domain content, excluding the different source and host shells. Loaded content was checked before capture, and the ERP document transition was allowed to reach full opacity. Earlier login, skeleton and transition frames were rejected.

| Module | Matched states | Retained content and actions |
| --- | --- | --- |
| Reports | Overview, 28-report library, revenue report, new builder | Source headings, report filters, date-range strip, six service-line bars, table/totals, views/columns/export/print/email/schedule controls, builder fields and preview |
| ERP 1 | Dashboard, purchase-order worklist, existing document editor | Source dashboard panels, list columns/status counts, document workflow, supplier/date/buyer/shipping fields, six item rows, summary and history panel |
| ERP 2 | Dashboard, purchase-order worklist, routed record and new document | Source layouts and record navigation, document form/lines/summary; thin variant wrappers reuse the shared Keystone engine |
| School | Admin dashboard, students, student drawer, live list, quizzes | Six KPI cards, six dashboard panels, ten-column student list, detail sections, live cards and quiz workflows |

The original file named `erp1_03_purchase_order_form_modal.png` contains a full document editor. Its candidate counterpart is therefore named `erp1-document-editor-candidate.png`. ERP 1 master-record overlays and ERP 2 routed records remain separate behaviors; documents are not all modal forms.

The screenshots show deliberate preference integration: the host's font, blue theme, rounded shared controls, density, decimal/currency/date/time formatting and page size replace the standalone sources' defaults. For example, the same revenue values display in the host's AED format instead of the source INR format, and the same 92.5% School attendance value rounds according to host formatting. Dark mode and Arabic RTL were separately verified with real persisted preferences. Managed page-size controls remain disabled, and unauthorized override writes return 403.

The source definitions for both ERP variants retain all 57 pages and 20 template families. Stable renderer, form, API and UI logic is shared in `@pepbits/reference-keystone-core`; variant wrappers keep their navigation behavior. The source/generated fixtures run only in the API. The [adaptation manifest](ADAPTATION-MANIFEST.json) verifies all 341 source files unchanged, the 152 static destinations and six public packages.

## Actual workflow checks

[Route sweep](evidence/route-sweep.json): 152 static destinations, six dynamic URLs and four desktop module renders passed, with the four distinct header choices present and no page errors. This is a rendering/contract sweep, not an assertion that every possible action was exhaustively tested.

[Reports actions](evidence/reports-actions.json): actual builder preview and save, dynamic navigation, API-key create, key-only BI query and revocation. [Authenticated download](evidence/authenticated-download.json): a legitimate recipient who was not the job owner downloaded through the injected authenticated transport. API tests cover wrong owner/branch, signature tampering and expiry; anonymous token possession is not authority.

[ERP 1 invoice and ERP 2 navigation](evidence/erp1-invoice-and-erp2-navigation.json): actual invoice create/save (three items at 50, total 150), back-to-list, routed record/edit/cancel and middle-open. [ERP 2 invoice and print](evidence/erp2-invoice-and-print.json): actual invoice create/save (two items at 100, total 200), print view and fixed white paper under midnight theme. Both final manifests have no JavaScript/API errors and cleanup returned 200. The earlier customer/create-edit probe had an invoice-selector timeout and cleanup timeouts; it is partial evidence and does not support a complete workflow claim.

[School actions](evidence/school-actions.json): real attachment upload → assignment save → exact-byte download; canonical book return and idempotent repeat; server quiz grading/review; instant live room join, persisted chat and end. Headless camera/microphone availability was reported honestly. This demo provides no media relay or recording-byte verification.

[Scope changes](evidence/scope-switch.json): changing HQ to Dubai clears an unsaved ERP draft and subsequent requests carry the validated new branch. Logout removes module content. Signing in as a teacher exposes School only and ERP API access returns 403. [Preferences](evidence/preferences.json): all four modules honor real persisted RTL/dark/density/font settings, plus managed locks.

## Existing healthcare regression

[Six before/after states](evidence/healthcare-baseline-comparison.json) have identical rendered text, fonts, styles and geometry; five PNG pairs are byte-identical. The query comparison differed by 63 border/caret pixels. The baseline had a pre-existing array-index routing defect that made Patient Record and 360 Data open Patient Query. The bounded fix uses explicit stable page IDs in both directions. [Three corrected-view browser checks](evidence/healthcare-corrected-routing.json) verify actual query, new-record and real-patient overview/record navigation. Eight focused routing tests also passed.

Existing OP registration, consultation, billing and DCP runtime browser suites passed against the real API. These cover registration/signing/service/payment/checkout/reload, consultation save/reload/complete/history, prescription/order/invoice/payment/refund/export/print, and authoritative DCP validation/repeating rows/revisions/save/recovery. Original admin preference overrides were restored between and after these suites. The [library regression](evidence/existing-page-library.log) also passed all fourteen existing entries, examples, guides, Open-page actions and four locales. Its harness corrections cover the stale eight-entry count, actual care-page markers, and closing inspected tabs before the next action to respect the existing twelve-document capacity; authorization and runtime behavior were preserved.

## Limits

The dummy API is a configurable fictional implementation; its in-memory stores do not promise production persistence, email delivery, scheduler operation or media transport. The modules expose public typed boundaries for replacing it with an authenticated application API. Human native-language review remains pending for new translations. Print-document fixed paper styling and English amount-in-words are documented package limitations. No deployment or native Tauri execution occurred in this task.
