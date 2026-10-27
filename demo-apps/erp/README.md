# ERP demo

Private `@pepbits-demo/erp`, using Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phase 6c-1 supplies a separate shell, shared Keystone configuration and **57 catalogue destinations each for ERP1 and ERP2**, across the original 20 template families. Financial behaviour and all data are fictional demonstrations, **not accounting acceptance**. This is a local build/run, not a deployment.

## Run locally

From the repository root:

```sh
npm ci
bash tooling/scripts/install-api.sh
npm run build:api
# Start the API in a separate terminal, using Node 24.21+.
node mock-api/server.mjs
NEXT_PUBLIC_API_URL=/api ERP_API_URL=http://127.0.0.1:3200 npm run dev -w @pepbits-demo/erp
```

Use the actual API port/origin from the [API guide](../../mock-api/README.md). Dev/start use port **3320**. Fixture credentials stay in the API fixtures and are omitted here. The optional same-origin proxy accepts these settings in an ignored app `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=/api
ERP_API_URL=http://127.0.0.1:3200
```

The public URL is build-time configuration; `ERP_API_URL` is server-only. Components receive an authenticated request callback. Scripts are `dev`, `build`, `start`, `typecheck`, `test` and `test:integration`:

```sh
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/erp
npm run typecheck -w @pepbits-demo/erp
npm test -w @pepbits-demo/erp
npm run test:integration -w @pepbits-demo/erp
```

Build before integration. The shared launcher starts one API, one production Next server and Chromium on free loopback ports with temporary API storage, and cleans up on success, failure, cancellation or deadline. Set `ERP_API_NODE` to a Node 24 executable. If generated runtimes are absent, `ERP_RUNTIME_ARTIFACTS` can name a source-identical existing API checkout; all tracked sources are compared before reuse and runtime hashes are recorded. This does not rebuild the API. Chromium on this machine needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`.

Optional receipts: `ERP_RESULT`, `ERP_IDENTITY`, `ERP_SCREENSHOT`; cancellation/deadline: `ERP_STOP_FILE`, `ERP_TIMEOUT_MS` (30-minute default); build output: `ERP_BUILD_DIR`. Keep at most one Next server, one API and one Vitest tree running. The historical [6c-6 record](../../docs/releases/unreleased/restructure-phase-6c-6-2026-10-24.md) and the delivery records for [6c-4](../../docs/releases/unreleased/restructure-phase-6c-4-2026-10-24.md) and [6c-5](../../docs/releases/unreleased/restructure-phase-6c-5-2026-10-24.md) identify exact checks and limits.

## Current integration boundary

The [post-phase-8 integration candidate](../../docs/releases/unreleased/erp-parity-integration-2026-10-26.md) combines the 18 master editors, 12 tree/rate destinations and 14 transaction document compositions described below. Those subsets are included in base `8cf8004`; phase 6c-7a3 adds the 22 structure/profile compositions below, with verification recorded in its own delivery record. All 114 destinations retain explicit differences in the [ledger](parity-status.md). Dated records describe their own sources, not the combined candidate.

## Structure and routes

`src/navigation.ts` defines both header modules, their own sidebar groups, 114 page definitions and preferences. `src/renderer.tsx` uses the public page-renderer registry. `src/modules/keystone` holds ERP metadata, field/API mappings and workflow composition; `src/modules/erp1` and `erp2` select the shared catalogue and retain module contracts. [Source mapping](source-mapping.md) lists the engine replacements and remaining specialized views. Runtime code imports only public `@pepbits/*` exports.

Both modules use `/{erp1|erp2}/{section}/{slug}`. ERP1 opens and edits a record within its current page. ERP2 adds `/:id`, `/new` and `/:id/edit` where permitted: **46 record, 44 create and 42 edit patterns**. Refresh retains ERP2 record identity. Previous/next follows the most recently loaded worklist page within the authenticated module scope; a fresh direct link has no previous list memory. Columns uses the shared worklist layout/reset behaviour and follows the effective browser/account storage preference; account storage uses the existing scoped view-state API. `/preferences` uses the shared shell settings page. Unknown or malformed paths show not-found. `/` honours the accepted default module. AI is off.

## Host, data and preferences

The public ApplicationProviders chain is SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider/EnterpriseShell. Healthcare and ERP both use this extracted host, HTTP transport and preference adapter. Preferences have one serialized update path with accepted revisions, tenant locks, allowed values and policy refresh. Runtime localization loads the canonical API catalog; generated literal-to-key aliases contain no translated catalog copy. Unmapped source wording remains readable English. Arabic/RTL automation does not establish human language review.

The API adapter maps relative calls to `/reference-modules/erp1/api/...` or `/reference-modules/erp2/api/...`, using existing `nexora` product metadata and authenticated branch/module headers. Resource caches and view state are scoped by tenant, user, role, branch and module. Source lookups come from HTTP before a page renders. No frontend business-data fallback exists; frozen fictional data is confined to tests.

Effective theme, font/scales, density, radius, table wrapping/stripes/sticky header, page size, date/number/currency formatting, motion and keyboard preferences come from the host. Native date machine values and financial cell calculations retain domain meaning. Lists configure WorklistPage; records configure RecordPage/TemplateFields/FieldRows; matrix cells configure EditableMatrix; ledger/report output configures TemplateReport; dashboards use shared cards/charts. The API owns validation, row versions and command authority. Failed record saves retain input; identical ambiguous retries retain their operation ID. A conflict requires an explicit reload. No durable draft API is invented.

## Completion boundary

All 114 catalogue destinations render their own API data. Phase 6c-2 adds hierarchy canvases to Organisation structure, Chart of accounts and Product categories in both variants (six destinations), status boards to Support tickets and Maintenance requests in both (four), and list/detail split composition to all eight ERP1 profile masters. ERP2 profiles retain their source worklist → record routes. Tree search retains ancestors; expand/collapse controls and visible record order remain scoped. ERP1 can add/edit children and confirm leaf deletion. Board drag and the keyboard-operable Move to select issue the same versioned command; failures retain the previous status until an acknowledged retry. Profiles use shared worklist/record engines; layout persistence follows effective `rememberFilters`.

Phase 6c-3 adds **24 specialized destinations** on this structure: booking timelines (Appointments and Meeting rooms in each module), Invoice print, four reports, Customer ledger, three matrices and Dashboard in each module. Day navigation/resource visibility and free-slot defaults compose the generic calendar; booking commands recheck the selected date before writing. The overlap check is a client preflight, not atomic server scheduling authorization. Status commands preserve acknowledged state and retry identity. ERP1 uses its existing in-page editor; ERP2 uses record URLs.

Invoice preview loads company/customer identity, supports Original/Duplicate, terms, zoom and Print or save PDF, and isolates an A4 document from the shell. Fixed paper dimensions and colors are deliberate source geometry; font family/scale and date/amount formats remain preference-bound. Amount-in-words is explicitly English. Reports expose period/date, status/select filtering, grouping, totals, CSV/XLSX and ERP2 owner-record opening. Ledger search does not alter statement balances or the complete exported statement. Full-result totals/export require a complete response (up to the unchanged API's 5,000-row bound). Matrices normalize weeks to Monday, navigate months/terms, fill only blank attendance cells, clamp numeric values, show summaries, and save rows sequentially. A failed row retains its values and operation ID; accepted rows are removed from the retry batch. Save or Discard is required before changing period. Drafts remain mounted state.

Dashboards include KPI deltas/sparklines, combined sales/purchase trends, invoice-status distribution, recent orders, approvals, receivables and ticket/purchase shortcuts. Chart values can be inspected with keyboard controls. Source dashboards have no global date/filter API; their selectors inspect the provided data rather than pretending to refetch a filtered dashboard. Generic canvas/chart geometry has no animation or custom shortcut. The source reports have no independent pivot designer.

Phase 6c-4 adds a record-panel subset: profile field groups, statistics, changes/required fields and activity/documents; case conversations with versioned comments, priority/stage edits and board movement history; booking day/resource context; ERP2 tree breadcrumbs/children/confirmed leaf deletion; document/voucher/structure summaries; request balances/trails and decisions; approval notes and ERP1 related requests; support-backed process logs/steps; inspection statistics. The record configurations cover 59 module/destination combinations; parent context and counts also cover States in both variants. Case properties include assignee editing; approval context includes request amounts/dates, overdue state and attachment metadata. Existing simpler record activity/documents also gain explicit loading, error/retry and empty states. Support metadata refreshes after an accepted row version. Profile file choices remain local to the screen and are clearly labeled; no upload or download service is invented.

Phase 6c-4 also enables **84 worklist destinations** with named search/filter/sort/column snapshots and column-only sets through the source account view-state service. Open Saved views, enter a name, then Save current view or Save column set. Apply restores the snapshot; saving the same name replaces it, and Delete removes it. Advanced filters support multiple choices, text, date/numeric ranges and booleans. Existing source views remain readable. Column persistence now translates visible engine keys to the API’s hidden keys. Load/save failures expose Retry. Remember filters controls account persistence; when off, named views stay in scoped session memory. Column storage follows its own effective browser/account preference. Snapshot application respects page-size locks and never changes that preference for ERP views. The source sort is mounted state; named sort snapshots are an additive improvement. Account column visibility alone does not persist order/sort; save a named view or column set for those.

**Durable draft boundary:** no protected ERP source form persists unsaved values across routes/refresh. ERP2’s source unload warning is now ported through public `useUnsavedWarning`; it detaches when clean or unmounted. It is not draft storage or a client-route guard. Durable recovery remains unavailable because the protected draft API has no ERP form contract. Business drafts are not placed in browser storage or view-state.

This is **not complete source visual/lifecycle parity**. [The destination handoff](parity-status.md) lists all 114 destinations, exact remaining source composition/lifecycle differences and durable recovery. Report/ledger/matrix controls and invoice pagination were merged from 6c-5. The 6c-6 source CSS audit is recorded; selected browser measurements pass and exact source matching remains incomplete. Physical printing, accounting acceptance, native executables and human accessibility/localization review remain outside verification.

All 38 original source cases are retained with public-provider adaptations. Added tests cover adapter errors, accepted preference updates, save-refresh/retry and every static/ERP2 record pattern under default, Arabic RTL, reduced-motion and locked-density profiles. Real HTTP checks are separate from mocked component checks. Phase 8 retired the original desktop workspace. The [integration record](../../docs/releases/unreleased/erp-parity-integration-2026-10-26.md) preserves the earlier merge preparation; the current task starts after those subsets were merged; the backend and original inputs remain unchanged. This task leaves reviewer-ready working-tree changes; main, publication and deployment remain outside its scope.

Existing create/edit controls and ERP1 tree leaf deletion are enabled for finance, finance-manager and accountant roles on chart-of-accounts, tax-rates, journal-vouchers, payment-vouchers, petty-cash, depreciation-run, receivables-aging and ledger-entries, plus exact server-issued `erp:write:<entity>` grants. Other entities remain read-only; full admin/operations roles retain existing write access. Every command still goes through server authorization. Direct edit routes and retry handlers apply the same entity checks. Entity grants also require the shell capability, so an expired session or mounted host denial keeps writes disabled. Export presentation is unchanged.

The Next root layout owns the ERP client/provider host so navigation between a worklist and its record keeps scoped neighbour memory. Catch-all pages supply route identity without remounting that host. A browser refresh still starts a new in-memory scope.


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

No source report, ledger or matrix offers a pivot designer or comparison-period control. Matrices have no source export control. No options are fabricated for these absent capabilities. Phase 6c-6 now provides source column persistence and saved views at all eight report destinations.

Long Invoice print documents now measure actual row heights and reserve A4 space for repeating company/customer/invoice identity and item headers, carried/brought totals including tax, and Page n / total. Item numbers remain continuous. Payment details, tax/grand totals, English amount words and optional terms appear once on the final page; the summary may occupy a separate page. Font/format/terms changes trigger measurement again, and zoom changes only screen scale. Printing waits for a valid layout. An individual item or final summary too tall for one page produces an explicit error and disables printing; splitting a single oversized block is outside this delivery. Fixed A4 geometry and ink colors remain intentional physical-document values. Physical printer and accounting acceptance remain separate from local Chromium PDF checks.

Compatibility: older 6c-1..6c-3 demo builds wrote visible columns into the source hidden-column key. An existing layout saved by those builds may appear inverted after this correction; use Columns → Reset once. There is no reliable schema marker to distinguish those arrays from original-source hidden-key layouts, so no heuristic migration is applied.

Within an opened case, unsent reply and assignee input survive another property’s acknowledged save. Posting clears only the accepted reply; Save assignee persists that field explicitly. This is mounted-input preservation, not durable cross-route recovery.

## Phase 6c-6: source composition and report layouts

Phase 6c-6 improves source composition at 35 destinations: ERP1 booking drawers retain the calendar and restore focus; ERP2 booking records show time/resource identity and a 340px schedule rail; profiles have source-sized avatars/statistic strips and ERP1 340/380px worklists; cases have subject/status/stage identity and avatar conversations, with ERP1 drawers retaining the board or list and refreshing acknowledged changes without losing search; ERP2 tree records have top breadcrumbs and 380px child context; all eight reports now support column layouts and named snapshots. Read-only fields use source-scaled stacked labels/values. Shared additions are opt-in plain RecordPage/RecordSectionLayout presentation and configurable ResourceTimeline geometry/resource/event slots, plus WorklistPage `refreshKey` for acknowledged external writes. Shared Avatar accent initials now use the effective text token after real-browser axe exposed insufficient contrast. Effective preferences, tenant locks, retry/version handling and source API boundaries remain authoritative.

The source audit maps all 114 destinations to original JSX/CSS and retains 84 source-file hashes. Local verification passes: forced CI has 6,097 Vitest tests with 42/42 tasks and zero cached; shell Chromium has 18 cases; real HTTP has 122 workflows, all 114 routes, 15 extra axe states and 27 geometry comparisons, with zero violations or application/HTTP/console errors. Source JSX/CSS was audited; the original desktop runtime was not rendered. **Exact visual parity is incomplete at all 114 destinations**: the ledger lists specific remaining differences and workflows. Durable cross-route drafts stay out of scope. Reports now raise personal-view coverage from 84 worklists to 92 destinations. No API, deployment or protected-source changes are required.

On Appointments or Meeting rooms, click a free slot, check the default date/resource/09:00 time (direct creation) or selected slot time, and Confirm booking. Booked records can check in, cancel or mark no-show when supported; checked-in records can complete. ERP2 uses Reschedule for editable bookings. Effective previewMode chooses ERP1’s left/right drawer or centered dialog; `inline` retains the source right-drawer fallback. Escape/Back dismisses without reloading the unchanged calendar. Save failures retain input and operation identity.

On a report, Columns changes visibility/order and Reset restores defaults. Saved views stores search/filter/sort/columns or a column-only set; Apply is explicit. Browser layouts include order/sort; source account `keystone.cols.<slug>` contains only hidden keys, so use a named snapshot for account order/sort. A failed account read exposes Retry and cannot be followed by a default-layout overwrite. Remember filters and column storage policies apply independently. The ledger, matrix and invoice behaviors from 6c-5 remain.

Use `flock /home/pepadmin/.cache/pepbits-heavy.lock <command>` for CI, builds and every browser/API/server session on this shared host. Unit tests use one worker (never more than two). The release launcher limits the completed run to three representative screenshots and no videos; the initial diagnostic run is retained separately. The historical source audit records original sources without running or modifying them; `scripts/visual-workflows.mjs` extends the existing real-HTTP browser driver. [The destination ledger](parity-status.md) is the current completion boundary.

Phase 8 retired the original runtime visual comparison generators, including `source-visual-audit.mjs`. Historical source hashes, screenshots and dated receipts remain unchanged. The three subset source audits below read immutable blobs with `git show` at `3558a131f0fd443693eae0dfc678e3b258b480c1`; no deleted workspace is restored or executed. Run from the repository root and pass fresh output directories (existing receipt files are rejected):

```sh
node demo-apps/erp/scripts/masters-source-audit.mjs /tmp/erp-master-audit-new
node demo-apps/erp/scripts/deferred-masters-source-audit.mjs /tmp/erp-tree-rate-audit-new
node demo-apps/erp/scripts/transaction-source-audit.mjs /tmp/erp-transaction-audit-new
```

`masters-visual-workflows.mjs`, `deferred-masters-visual.mjs` and `transaction-visual-workflows.mjs` run through `visual-workflows.mjs` in the normal ERP integration launcher, against the production demo build and `mock-api`. The combined driver retains all subset geometry/save/date-filter/copy/status/axe checks. These are demo measurements against source-derived targets, not a new original-runtime render or source pixel comparison.

## Phase 6c-7a: small master editors

Countries, states, currencies, units, holidays, departments, leave types, shifts and lab tests retain the worklist during editing. In ERP1 table view, use Add row or activate a row, then Save/Cancel inline. ERP2 uses New/Edit in a two-column quick dialog; Save and add another resets only after acknowledgement. Existing records expose Delete followed by Keep it/Delete confirmation. ERP1 cards use the quick dialog so edits remain reachable under the effective result-view preference. Existing ERP2 direct record URLs remain supported.

States in ERP1 has a 256px parent rail (288px at 1280px and wider), with search, counts and a mobile selector. Choosing a parent supplies the new row's country. All editors retain mounted input on failure; identical ambiguous retries reuse their operation ID, and conflicts require explicit Reload. Permissions are checked again at the command boundary. Field/result scales, density, radius, formatting, RTL and tenant locks remain effective; Enter saves only when keyboard shortcuts are enabled. These are mounted drafts, not durable cross-route drafts.

`masters-composition.test.tsx`, `scripts/masters-source-audit.mjs` and `scripts/masters-visual-workflows.mjs` cover this subset. The [6c-7a record](../../docs/releases/unreleased/restructure-phase-6c-7a-2026-10-25.md) separates measured dimensions from remaining toolbar/filter/card composition and all untouched master families. No whole-page pixel match is claimed.

## Phase 6c-7a2: tree and rate masters

Organisation structure, Chart of accounts and Product categories now use the source 360/400px tree/editor split in ERP1, with always-editable fields, breadcrumbs, code search, compact rows/icons and direct/descendant counts. Save adopts the accepted version while retaining the tree search. Child creation inherits hierarchy values; deletion requires confirmation and a complete loaded hierarchy. ERP2 uses a compact hierarchy table and record child list. Version failures retain input and operation identity; conflicts require Reload. Effective permissions, density, result/form scales, RTL and table policies still apply. Initial loading, some tree toolbar/action styling and full record chrome remain different.

Tax rates, Price lists and Consultation fees in both variants now offer Valid on, Today and Show all dates. The server selects effective rows inclusively; the badge uses the selected day, while the 112×8px validity bar keeps the source today-centred timeline. ERP1 edits inline; ERP2 opens a quick dialog with save-another and confirmed deletion. Search, accepted date and list remain after save. Table/card and tenant policy still govern presentation. The date is mounted selection state, not a saved view or durable form draft. Common worklist toolbar/filter/card/loading differences remain; tax-rate percentage cells still use the baseline plain-text renderer.

See the [6c-7a2 record](../../docs/releases/unreleased/restructure-phase-6c-7a2-2026-10-25.md) and [per-destination ledger](parity-status.md). Component-editor and profile masters retain their listed differences; this is a composition subset, not whole-page pixel certification.

## Phase 6c-7b: transaction document subset

Sales orders, Sales invoices, Purchase orders, Goods receipts, Journal vouchers, Payment vouchers and Petty cash in both modules now use a document header, status progress, tabular lines and a source-sized summary/history rail (ERP1 300px, ERP2 320px). ERP1 opens editable nonterminal documents in place, retaining worklist search and refreshing acknowledged changes; ERP2 keeps view/edit/new URLs. Add or remove lines, edit quantities/rates/tax or debit/credit cells, then Save. Changing a positive debit clears that line’s credit and vice versa. Totals include tax; voucher progression requires nonzero matching debit/credit totals. Empty documents cannot save. Narration belongs beside the lines, and document metadata is available under Documents.

Copy to new retains header/line values but resets identity, date and status. Supported progress commands advance the displayed status; terminal documents are read-only. Cancellation follows the source terminal transition even where filter options omit Cancelled; ERP1 vouchers must balance before cancelling. The source itself makes Posted terminal, so no reversal command is invented. Sales invoices have a Print preview shortcut: ERP1 opens the source invoice selector; ERP2 opens the selected invoice. History reloads after acknowledged versions. Failed saves retain input and operation identity; conflicts require Reload. Host permissions and effective preferences remain authoritative. Native close/refresh warnings are not durable drafts.

The [6c-7b record](../../docs/releases/unreleased/restructure-phase-6c-7b-2026-10-25.md) identifies the selected geometry, component and real-HTTP checks. This improves 14 transaction destinations; it does not certify whole-page parity. The [ledger](parity-status.md) retains exact worklist/header/action/history differences and all 24 deferred transaction destinations. Original JSX/CSS is read-only; source desktop rendering and native execution are not claimed.

## Phase 6c-7a3: structure and profile composition

Bill of materials, Salary structures and Fee structures now use an always-editable ERP1 split pane (340/360px list) or an ERP2 record with a 320px summary/history rail. Add/remove component lines, type or choose suggestions and edit quantities/rates; amounts recalculate, deductions subtract, and each structure uses its own total label. ERP2 offers Copy to new and confirmed Delete. Failed saves retain values and retry identity; conflicts require Reload.

The eight profile masters in each variant gain source-derived identity/section composition. ERP1 has Details/Activity/Documents tabs, grouped fields, a recent-activity rail at 1536px and Full table/narrow-screen overlays that retain the worklist. ERP2 has a sticky section rail, source-sized statistic cells and a separate Status section while editing, plus identity during creation. ERP1 Documents shows the support metadata count. More actions contains status changes, Duplicate and confirmed Delete; new ERP2 profiles also offer Save and add another. Files selected in Documents remain local metadata only. Layout persistence, preview placement, fields/tables and ERP2 form navigation continue to follow effective preferences and locks. ERP1 category tabs select content categories; they do not persist drafts.

These are measured composition changes at 22 destinations, not whole-destination pixel matches. Common worklist/loading chrome and specific remaining controls are listed per destination in [parity-status.md](parity-status.md). The [6c-7a3 record](../../docs/releases/unreleased/restructure-phase-6c-7a3-2026-10-25.md) separates the source audit, mocked tests, local browser geometry and real fictional HTTP evidence. No shared-package or API change, dependency installation, deployment or durable draft contract is introduced.
