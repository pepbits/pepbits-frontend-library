# Independent ERP demo

Feature ID: ERD. Latest: [6c-6 source composition subset](../releases/unreleased/restructure-phase-6c-6-2026-10-24.md). State: detailed record context, worklist personal views, source analytical controls and multipage A4 invoices, with calendars and dashboards; full source parity remains incomplete. Delivery records: [6c-4](../releases/unreleased/restructure-phase-6c-4-2026-10-24.md), [6c-5](../releases/unreleased/restructure-phase-6c-5-2026-10-24.md); [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; fictional financial behaviour is **not accounting acceptance**.

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
13. Open a profile record to review grouped fields, statistics, activity and stored-document metadata. Edit to see changed fields and required-field guidance. File selection is screen-local and explicitly not uploaded. Loading, empty and retry states remain distinct.
14. Open a case to post an update or change stage/priority. A failed write retains the comment and operation identity; a conflict requires explicit Reload. Ctrl/Cmd+Enter posts only when effective keyboard shortcuts are enabled. Current role/entity and mounted host denials disable writes.
15. ERP2 tree records show ancestor buttons, direct children, Add child and confirmed leaf deletion; parents with children or incomplete trees cannot be deleted. Booking records show their live day/resource schedule, refetch it when the edit date changes, and disable related-record navigation during editing.
16. Request records show balances/trails and decisions; approvals retain decision notes and ERP1 related pending requests from the same department. Document summaries include tax/deductions or debit/credit differences. Process logs/step state come from support data; inspections show checked/pass/fail counts. These are panel additions; remaining lifecycle and source layout differences are listed per destination.
17. Open Saved views on a worklist (List mode on boards/calendars). Name and save the current search, filters, sorting and columns, or save only the column set. Apply restores it; saving the same name replaces it; Delete removes it. Advanced filters support multiple choices, text, date/numeric ranges and booleans. Account persistence follows Remember filters; when off, views stay in scoped session memory. Columns follows its separate browser/account preference. Failed account operations expose Retry; the unsaved snapshot stays available.
18. Unsaved editors warn on browser close/refresh. Saving or unmounting removes that warning. The warning does not retain values across routes or refresh.
19. Open Preferences. Language, presentation, formatting, motion and shortcuts follow one accepted update path. Tenant locks and allowed values disable conflicting changes. Failed preference saves retain accepted settings until reload; policy refresh can replace effective values.

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
| ERD-17 | All eight report destinations: typed filters, sorting, complete group subtotals, effective CSV/XLSX exports and expanded Arabic axe |
| ERD-18 | Both invoice destinations: measured wrapped rows, repeating headers, carry totals, page/item numbering, final summary and long-invoice A4 PDFs |
| ERD-19 | Record summaries/side content: profile, booking, ERP2 tree, document/request/approval/process and inspection context; shared RecordPage slots |
| ERD-20 | Case conversations and board history: versioned retry, comment retention, mounted permission/shortcut guards; approval notes |
| ERD-21 | Support loading/error/retry/empty/version refresh; screen-local profile file selection; ERP1 opened-record four-profile axe matrix and live panel-state checks |
| ERD-22 | Named personal views, column-only sets, typed filter conditions, legacy source views, scoped account/session persistence, failure/retry, locks, RTL/axe and real HTTP reload/apply/delete |
| ERD-23 | Source browser unload warning: dirty/clean/unmounted and failure/save coverage; explicitly no durable or SPA-route recovery |
| ERD-24 | Source composition: ERP1 booking overlay/focus, ERP2 booking/tree context, profile statistics, case identity and retained list save/search, source field typography; geometry metrics, drawer preference/RTL/axe and Avatar contrast across 14 themes |
| ERD-25 | All eight report column layouts and named snapshots: source hidden-key persistence, order/reset, retry, failed-read write fencing, reload/apply/delete over real HTTP |

[The per-destination handoff](../../demo-apps/erp/parity-status.md) records all 114 destinations and the remaining source composition/lifecycle and visual work. Named views are delivered on 84 worklist destinations through `keystone.views.<slug>` with source-compatible base fields and additive snapshot metadata; source-only old views still apply. The limits are 30 views and 20,000 serialized characters. Column keys at `keystone.cols.<slug>` are hidden keys; account order and sort are retained in named snapshots, not the hidden-column array. Shared WorklistPage exposes typed filter/view control slots; all normal result/column/paging behavior stays in the engine. Snapshot page size respects mounted policy.

Report/ledger/matrix controls and invoice pagination were delivered by 6c-5. The 6c-6 original JSX/CSS audit and selected browser measurements are recorded; whole-destination visual matching remains incomplete. No source ERP form has durable draft persistence: source ERP2 only installs a browser unload warning, now provided by `@pepbits/patterns/drafts`. Durable cross-route recovery remains unimplemented; the protected draft service needs an ERP form contract. No business drafts enter browser storage or view-state. Physical printing, accounting acceptance, native executables and human accessibility/localization review remain outside verification.


## Operations and support

Use Node 24 and the existing API runtime environment. Integration checks compare API sources before reusing existing runtime artifacts and record their hashes. The launcher owns temporary storage, services and browser cleanup, including failures and cancellation. Keep credentials and headers out of receipts. Runtime errors and rejected writes should be diagnosed from the source-scoped response evidence. Removing the new app from use does not change the original desktop consumers or backend.

Existing create/edit controls and ERP1 tree leaf deletion are enabled for finance, finance-manager and accountant roles on chart-of-accounts, tax-rates, journal-vouchers, payment-vouchers, petty-cash, depreciation-run, receivables-aging and ledger-entries, plus exact server-issued `erp:write:<entity>` grants. Other entities remain read-only; full admin/operations roles retain existing write access. Every command still goes through server authorization. Direct edit routes and retry handlers apply the same entity checks. Entity grants also require the shell capability, so an expired session or mounted host denial keeps writes disabled. Export presentation is unchanged.


## Phase 6c-5: report controls and long invoices

Open Advanced filter on a report, enter conditions, then Apply filters. Choice/reference fields accept several values; numeric/date ranges accept either bound; people use text matching. Invalid ranges cannot be applied. Cancel retains accepted filters, Reset clears the draft, and Clear filters resets the report. Main date presets and advanced invoice-date conditions replace one another explicitly. Column headings cycle ascending, descending and unsorted. Group by keeps each group together and shows complete filtered subtotals even when a group spans screen pages. Exports contain every filtered row in the selected order plus one grand total; group header/subtotal display rows are omitted. Effective CSV/XLSX, table/card, density, page-size and formatting policies remain authoritative. Lookup failures have retry, and incomplete responses suppress totals/export.

| Destinations (both ERP1 and ERP2) | Source analytical controls now covered |
| --- | --- |
| Sales register | Customer multiple choices, invoice/due dates, salesperson text, total range, multiple statuses; grouping by customer/salesperson/status, sorting, subtotal/grand totals, CSV/XLSX |
| Purchase register | Supplier choices, PO date, buyer text, warehouse/status choices and total range; supplier/buyer/warehouse/status grouping, sorting, subtotal/grand totals, CSV/XLSX |
| Stock summary | Category/warehouse choices, opening/inward/outward/closing/value ranges; category/warehouse grouping, sorting, subtotal/grand totals, CSV/XLSX; source has no period dimension |
| Receivables aging | Customer/bucket choices, invoice date, every age-bucket amount and outstanding ranges; customer/bucket grouping, sorting, subtotal/grand totals, CSV/XLSX |
| Customer ledger | Customer, month/90-day/365-day/all/custom period, search and full-statement export; opening/running/closing balances remain independent of search |
| Attendance | Month navigation, search, fill blanks today, row/column summaries and save/discard |
| Timesheets | Monday-normalized week navigation, search, total/overtime summaries and save/discard |
| Marks entry | Term 1/Term 2/Final, search, score/grade/average summaries and save/discard |

No source report, ledger or matrix offers a pivot designer or comparison-period control. Matrices have no source export control. No options are fabricated for these absent capabilities. Source column persistence and saved views are delivered by 6c-6 at all eight report destinations.

Long Invoice print documents now measure actual row heights and reserve A4 space for repeating company/customer/invoice identity and item headers, carried/brought totals including tax, and Page n / total. Item numbers remain continuous. Payment details, tax/grand totals, English amount words and optional terms appear once on the final page; the summary may occupy a separate page. Font/format/terms changes trigger measurement again, and zoom changes only screen scale. Printing waits for a valid layout. An individual item or final summary too tall for one page produces an explicit error and disables printing; splitting a single oversized block is outside this delivery. Fixed A4 geometry and ink colors remain intentional physical-document values. Physical printer and accounting acceptance remain separate from local Chromium PDF checks.

Compatibility: older 6c-1..6c-3 demo builds wrote visible columns into the source hidden-column key. An existing layout saved by those builds may appear inverted after this correction; use Columns → Reset once. There is no reliable schema marker to distinguish those arrays from original-source hidden-key layouts, so no heuristic migration is applied.

Within an opened case, unsent reply and assignee input survive another property’s acknowledged save. Posting clears only the accepted reply; Save assignee persists that field explicitly. This is mounted-input preservation, not durable cross-route recovery.

## Phase 6c-6 source composition

Phase 6c-6 improves source composition at 35 destinations: ERP1 booking drawers retain the calendar and restore focus; ERP2 booking records show time/resource identity and a 340px schedule rail; profiles have source-sized avatars/statistic strips and ERP1 340/380px worklists; cases have subject/status/stage identity and avatar conversations, with ERP1 drawers retaining the board or list and refreshing acknowledged changes without losing search; ERP2 tree records have top breadcrumbs and 380px child context; all eight reports now support column layouts and named snapshots. Read-only fields use source-scaled stacked labels/values. Shared additions are opt-in plain RecordPage/RecordSectionLayout presentation and configurable ResourceTimeline geometry/resource/event slots, plus WorklistPage `refreshKey` for acknowledged external writes. Shared Avatar accent initials now use the effective text token after real-browser axe exposed insufficient contrast. Effective preferences, tenant locks, retry/version handling and source API boundaries remain authoritative.

The source audit maps all 114 destinations to original JSX/CSS and retains 84 source-file hashes. Local verification passes: forced CI has 6,097 Vitest tests with 42/42 tasks and zero cached; shell Chromium has 18 cases; real HTTP has 122 workflows, all 114 routes, 15 extra axe states and 27 geometry comparisons, with zero violations or application/HTTP/console errors. Source JSX/CSS was audited; the original desktop runtime was not rendered. **Exact visual parity is incomplete at all 114 destinations**: the ledger lists specific remaining differences and workflows. Durable cross-route drafts stay out of scope. Reports now raise personal-view coverage from 84 worklists to 92 destinations. No API, deployment or protected-source changes are required.

ERP1 booking creates/views use the effective left/right/center preview presentation over the retained calendar, with source 360px detail and 460px creation widths for drawers. Direct create supplies the current day, first resource, 09:00 and 30 minutes; free-slot selection overrides those defaults. Confirm booking writes through the existing versioned adapter. Completion requires check-in; cancellation/no-show require Booked. Terminal records disable those commands. ERP2 labels editing Reschedule. Client overlap checks still are not an atomic server reservation guarantee.

Reports now expose Columns and Saved views alongside their existing filters. Account visibility uses hidden-key arrays; named snapshots preserve column order/sort and typed conditions. Browser/account storage follows columnLayoutScope, explicit named saves follow rememberFilters, and applying a view never changes locked page size. Load/save failures expose Retry; a failed read cannot overwrite the unread layout. No new persistence API, business draft store or source translation catalog is introduced. Localized source aliases are unchanged; unmatched wording retains source English.

## Phase 6c-7a master editing

For Countries, States, Currencies, Units, Holidays, Departments, Leave types, Shifts and Lab tests, ERP1 Add row/row activation edits within the table; ERP2 New/Edit opens a quick dialog over the retained worklist. Save refreshes accepted rows without resetting search, filters, sorting or columns. ERP2 Save and add another keeps the dialog open with fresh defaults after acknowledgement; Delete requires confirmation and retains values on a failed command. ERP1 card view uses the same dialog. Existing ERP2 direct record links continue to work.

ERP1 States places parent search/counts in a responsive sidebar and carries the selected parent into creation. Shared controls still follow effective presentation and mounted permission changes. Enter-to-save follows keyboardShortcuts; explicit Save/Cancel and dialog Escape remain keyboard accessible. Failed saves retain input and operation identity, while a row-version conflict requires Reload. No new backend contract, catalog, dependency or persistent draft store is introduced.

This delivery measures the table, editor and parent-rail subset; source toolbar/filter/chip arrangement and other master families remain explicit in the [destination ledger](../../demo-apps/erp/parity-status.md). Verification and source identity belong to the [6c-7a record](../releases/unreleased/restructure-phase-6c-7a-2026-10-25.md). Local fictional HTTP is not deployed or accounting acceptance.

## Phase 6c-7a2 tree and rate composition

ERP1 hierarchy masters have a 360/400px tree pane beside an always-editable node form. Search names or codes, choose a node, change its fields and Save; breadcrumbs and child rows navigate within the pane. Add child inherits parent/level/nature and a default code. Required fields block invalid saves; retry preserves input and operation identity, and a version conflict requires explicit Reload. Delete remains confirmed and is disabled for non-leaves or incomplete trees. ERP2 retains its record routes, with a compact hierarchy table and child list.

On Tax rates, Price lists or Consultation fees, choose Valid on or Today to ask the existing API for effective rows; Show all dates clears that date. Validity includes both date boundaries and open-ended periods. The status reflects the selected date, while the bar remains centred on today, as in the source. Edit within the ERP1 row or ERP2 quick dialog, then Save; creation, save-another, permission guards and recovery reuse the existing master contract. The selected date survives saves but is not a durable preference or draft. Effective formatting, density, RTL, result view and policy locks remain authoritative.

ERD-26 covers tree composition/search/versioned saves/leaf guards and ERD-27 covers effective-date request/clear, validity boundaries and inline/dialog saves. Unit tests use fictional mocks; local HTTP geometry and axe evidence are separate in the [6c-7a2 record](../releases/unreleased/restructure-phase-6c-7a2-2026-10-25.md). Component-editor/profile masters and the listed tree/rate chrome/loading differences remain incomplete. No API or durable draft contract is introduced.
