# ERP demo

Private `@pepbits-demo/erp`, using Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phase 6c-1 supplies a separate shell, shared Keystone configuration and **57 catalogue destinations each for ERP1 and ERP2**, across the original 20 template families. Financial behaviour and all data are fictional demonstrations, **not accounting acceptance**. This is a local build/run, not a deployment.

## Run locally

From the repository root:

```sh
npm install
# Start the unchanged API using its documented Node 24/runtime environment.
node mock-api/server.mjs
NEXT_PUBLIC_API_URL=http://localhost:3330 npm run dev -w @pepbits-demo/erp
```

Use the actual API port/origin from the [API guide](../../mock-api/README.md). Dev/start use port **3320**. Fixture credentials stay in the API fixtures and are omitted here. The optional same-origin proxy accepts these settings in an ignored app `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=/api
ERP_API_URL=http://127.0.0.1:3330
```

The public URL is build-time configuration; `ERP_API_URL` is server-only. Components receive an authenticated request callback. Scripts are `dev`, `build`, `start`, `typecheck`, `test` and `test:integration`:

```sh
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/erp
npm run typecheck -w @pepbits-demo/erp
npm test -w @pepbits-demo/erp
npm run test:integration -w @pepbits-demo/erp
```

Build before integration. The shared launcher starts one API, one production Next server and Chromium on free loopback ports with temporary API storage, and cleans up on success, failure, cancellation or deadline. Set `ERP_API_NODE` to a Node 24 executable. If generated runtimes are absent, `ERP_RUNTIME_ARTIFACTS` can name a source-identical existing API checkout; all tracked sources are compared before reuse and runtime hashes are recorded. This does not rebuild the API. Chromium on this machine needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`.

Optional receipts: `ERP_RESULT`, `ERP_IDENTITY`, `ERP_SCREENSHOT`; cancellation/deadline: `ERP_STOP_FILE`, `ERP_TIMEOUT_MS` (30-minute default); build output: `ERP_BUILD_DIR`. Keep at most one Next server, one API and one Vitest tree running. The latest [6c-6 record](../../docs/releases/unreleased/restructure-phase-6c-6-2026-10-24.md) and the delivery records for [6c-4](../../docs/releases/unreleased/restructure-phase-6c-4-2026-10-24.md) and [6c-5](../../docs/releases/unreleased/restructure-phase-6c-5-2026-10-24.md) identify exact checks and limits.

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

All 38 original source cases are retained with public-provider adaptations. Added tests cover adapter errors, accepted preference updates, save-refresh/retry and every static/ERP2 record pattern under default, Arabic RTL, reduced-motion and locked-density profiles. Real HTTP checks are separate from mocked component checks. Original desktop/backend/deployment files are unchanged; no commit, push, publication or deployment is part of this run.

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

Use `flock /home/pepadmin/.cache/pepbits-heavy.lock <command>` for CI, builds and every browser/API/server session on this shared host. Unit tests use one worker (never more than two). The release launcher limits the completed run to three representative screenshots and no videos; the initial diagnostic run is retained separately. `scripts/source-visual-audit.mjs` reads original sources without running or modifying them; `scripts/visual-workflows.mjs` extends the existing real-HTTP browser driver. [The destination ledger](parity-status.md) is the current completion boundary.
