# Independent ERP demo

Feature ID: ERD. State: specialized workflow subset through calendars, A4 invoices, analytical controls and dashboards; full source parity remains incomplete. [Delivery record](../releases/unreleased/restructure-phase-6c-3-2026-10-24.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; fictional financial behaviour is **not accounting acceptance**.

## User problem and outcome

ERP1 and ERP2 now run in a separate Next.js app using public library engines and the unchanged demo API. Each has 57 catalogue destinations across 20 original template families. ERP1 opens an in-page editor; ERP2 gives records and creation their own URLs. The [app guide](../../demo-apps/erp/README.md) explains setup and supported routes; the [source mapping](../../demo-apps/erp/source-mapping.md) distinguishes engine reuse from specialized presentation still pending.

## User and administrator flows

1. Start the synthetic API and app, then sign in with a local fixture account through the shared login screen. Choose ERP1 or ERP2 in the shell header. Branch and role come from the authenticated session.
2. Open Customers, search the worklist and select a row. ERP1 retains its page URL; ERP2 navigates to the record URL. Edit and save fictional data. The accepted server row appears immediately; refresh an ERP2 record to confirm persistence.
3. Use New on a supported worklist. Required fields are checked, source lookups come from the API and an accepted response identifies the new record. ERP2 creation routes end at the created record. Previous/next follows the last worklist result page; direct links without that memory disable these actions.
4. Use Columns to choose or reset displayed fields. Storage follows the browser/account preference; account layouts use the current user/branch/module API scope. Pending Approvals expose approve/reject commands; server authority and versions remain decisive.
5. On Organisation structure, Chart of accounts or Product categories, expand branches or search a nested name. Search keeps ancestors visible. ERP1 shows the selected editor beside the tree and permits child creation and confirmed leaf deletion; ERP2 opens record URLs. A save adopts the acknowledged record before the hierarchy reloads.
6. On Support tickets or Maintenance requests, filter by text, priority or assignee. Drag a card into another status column, or use its Move to select with the keyboard. The card stays in its old column until HTTP accepts the change; retry retains the operation identity and version. Reload explicitly after a conflict. List switches to the shared worklist.
7. ERP1 profile masters open a selected record beside the worklist. Choose Full table or List and details side by side; the existing account view-state API saves the choice only when effective `rememberFilters` is enabled. ERP2 keeps its source full worklist and record URLs.
8. On Appointments or Meeting rooms, choose a day, hide/show resources, and select a free slot. Create with the selected date/resource/time, then check in, complete or cancel through the record actions. Client overlap checks preserve input; they are not an atomic server reservation guarantee. Schedule/List switches retain the shared worklist workflow.
9. On Invoice print, select an invoice and wait for the server company profile. Choose Original/Duplicate, terms and zoom, then Print or save PDF. The print surface uses the source A4 document structure; the shell is hidden. The English amount-in-words block is labeled explicitly.
10. Reports provide period/date filters, status/select filters, grouping, totals and preference-selected CSV/XLSX export; ERP2 rows open the owning record. Customer ledger shows opening, debits, credits and closing balance. Searching entries preserves the full statement balance and export. Truncated responses disable totals/export rather than misrepresenting them.
11. Attendance, Timesheets and Marks entry provide period navigation, row/column summaries and bounded entry. Mark all present today fills only blanks. Save removes each acknowledged row from the batch; retry keeps failed rows and operation IDs. Save or Discard before changing period; conflicts require explicit discard/reload.
12. Dashboard includes all source data panels. Inspect chart values with the native select or focusable status controls; open registers, orders, approvals and ticket/purchase shortcuts within the selected module. Source dashboards have no global filter API or pivot designer.
13. Open Preferences. Language, presentation, formatting, motion and shortcuts follow one accepted update path. Tenant locks and allowed values disable conflicting changes. Failed preference saves retain accepted settings until reload; policy refresh can replace effective values.

## Integration and failure behaviour

The public renderer registry receives app-owned navigation. ApplicationProviders composes session, preferences, runtime localization and shell. Public WorklistPage, RecordPage, TemplateFields, FieldRows, EditableMatrix, TemplateReport and charts supply generic rendering. Only ERP field definitions, calculations and command composition remain in the app.

The adapter receives the configured authenticated transport and maps to `/reference-modules/{erp1,erp2}/api/...`. There is no component origin, second token store, another-demo import or frontend data fallback. Scoped resource state separates tenant, user, role, branch and module. The API owns validation, versions, authorization and synthetic persistence. Save failures retain values, and an identical ambiguous retry retains its operation ID. Conflicts require explicit reload; durable drafts and recovery after leaving an editor are deferred.

## Compatibility, localization and accessibility

Canonical localization comes from the protected API catalogs at runtime. Literal aliases are generated from those catalogs; missing terminology stays in source English and needs backend authoring/human review. Four-profile tests cover default, Arabic RTL, reduced motion and locked density. Structural calendar/hierarchy/board canvases retain complete source-loaded groups (up to 2,000 tree nodes or 1,000 cases/day bookings); generic resultView/pageSize apply to the shared worklist, not to splitting those canvases. Effective density, result scale, semantic colors/radius and formatting still apply. Profile/worklist tables retain all applicable managed table settings. Jsdom axe does not measure contrast; browser axe is separate and includes the full shell. Automated checks do not establish assistive-technology, language or accounting acceptance. Original source packages and API/deployment files remain unchanged.

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| ERD-01 | Shared sign-in/provider chain, header module selection, own navigation and API scope |
| ERD-02 | All 114 catalogue pages and 132 ERP2 record/create/edit patterns render through public engines; four-profile route/axe matrix |
| ERD-03 | Search → record → edit → save for both modules; ERP2 deep-link refresh and create navigation |
| ERD-04 | Previous/next list memory and shared column reset/persistence; original source contracts retained |
| ERD-05 | Pending approval commands, transient failed-save retention and version/operation identity |
| ERD-06 | Preferences with serialized revisions, policy locks and mounted language changes; actual runtime catalog |
| ERD-07 | Forced root CI, production builds, shell Chromium, documentation, source identity and protected-path scans |
| ERD-08 | Six hierarchy destinations: search/ancestors, expand/collapse, child creation/edit and scoped visible neighbours |
| ERD-09 | Four case boards: status grouping, filters, pointer/keyboard moves, acknowledged status, failure/retry and list switching |
| ERD-10 | Eight ERP1 profile splits: selection, accepted record saves, account layout persistence and managed rememberFilters |
| ERD-11 | Finance entity-grant presentation, explicit grants, mounted shell denial, direct-edit denial and actual HTTP command denial |
| ERD-12 | Direct public-library HTTP, preference adapter, application provider and field-interoperability tests |
| ERD-13 | Four day/resource calendars: slots, overlap preflight, date/resource controls, commands and list switching |
| ERD-14 | Company-backed A4 invoice, copy/terms/zoom and isolated Chromium PDF printing |
| ERD-15 | Reports, ledgers and matrices: periods, grouping, balances, totals, export, bounded/bulk edits and partial retry |
| ERD-16 | Dashboard source panels, keyboard chart inspection and module-owned drill-downs |

Remaining: ERP1 booking drawer/detail geometry and specialized ERP2 booking detail composition; exact source chart/widget geometry and source pixel comparison; exhaustive multi-page invoice pagination; full report advanced filters/sorting/column and saved-view parity; ERP2 tree record breadcrumbs/delete/child tables; board discussion/history; source-specific profile statistics/activity layout; richer personal views; durable cross-route record-form recovery. The protected `/drafts` API accepts only import/approval/DCP kinds and original navigation IDs, so ERP record drafts require a backend contract. No form values enter browser storage. Physical printing, accounting acceptance, native executables and human accessibility/localization review remain outside verification.


## Operations and support

Use Node 24 and the existing API runtime environment. Integration checks compare API sources before reusing existing runtime artifacts and record their hashes. The launcher owns temporary storage, services and browser cleanup, including failures and cancellation. Keep credentials and headers out of receipts. Runtime errors and rejected writes should be diagnosed from the source-scoped response evidence. Removing the new app from use does not change the original desktop consumers or backend.

Existing create/edit controls and ERP1 tree leaf deletion are enabled for finance, finance-manager and accountant roles on chart-of-accounts, tax-rates, journal-vouchers, payment-vouchers, petty-cash, depreciation-run, receivables-aging and ledger-entries, plus exact server-issued `erp:write:<entity>` grants. Other entities remain read-only; full admin/operations roles retain existing write access. Every command still goes through server authorization. Direct edit routes and retry handlers apply the same entity checks. Entity grants also require the shell capability, so an expired session or mounted host denial keeps writes disabled. Export presentation is unchanged.
