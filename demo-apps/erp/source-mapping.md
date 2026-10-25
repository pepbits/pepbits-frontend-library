# ERP source mapping

Initial phase 6c-1, base `9752ea4afc321db6ea70106d03c1648e5c73262d`. Source packages are read-only references. [App guide](README.md), [feature contract](../../docs/features/erp-demo.md) and [current delivery record](../../docs/releases/unreleased/restructure-phase-6c-6-2026-10-24.md) state verification and deferrals.

| Original responsibility | Destination and treatment |
| --- | --- |
| `reference-erp1` catalogue, route metadata and tests | `src/modules/erp1`; shared sanitized `keystone/catalog.ts`, all 57 configurations and nine original cases |
| `reference-erp2` catalogue, route metadata and tests | `src/modules/erp2`; same 57 configurations, nine original cases; record/create/edit routes in `src/navigation.ts` |
| `reference-keystone-core` domain types, lookup hydration, process/support contracts | `src/modules/keystone/{types,registry,api,process}.ts`; source-compatible API configuration, twenty original core cases |
| Core field primitives, select-child conversion | Public UI controls and AsyncLookup; only pure `optionsFromChildren`/`splitFieldClasses` added to `@pepbits/ui` |
| Core WorkList and column layouts | Public WorklistPage, its filters, layouts, exports and preview; ERP adapter translates the existing service contract |
| RecordForm/FieldInput, line editor and template frames | Public RecordPage, TemplateFields and new controlled FieldRows; ERP owns fields, validations, line amount calculation and commands |
| Ledger/report rendering | Public TemplateReport with explicit optional date/amount keys; ERP selects ledger party and computes synthetic running balance |
| Matrix rendering | Public controlled EditableMatrix; ERP supplies dimensions, period, values and save commands |
| Settings/dashboard rendering | Public record fields/cards/StatCard/TemplateChart configured with API data |
| Scoped fetch/cache/view state | Public `@pepbits/patterns/resources`; explicit request, identity and persistence endpoint |
| CSV/XLSX and formatting | Public page-engines export helpers and i18n formatters, retaining formula-safe strings and numeric spreadsheet cells |
| Healthcare provider/transport/preferences setup also needed by ERP | Extracted to public shell/platform exports; healthcare updated to consume them; no inter-demo import |
| Local API/runtime startup and cleanup | Shared `tooling/scripts/run-demo-integration.mjs`, called by each app's own wrapper |

The 20 original keys are retained in the catalogue and mapped through the shared Keystone page configuration. Generic renderers are not copied. List-based families use WorklistPage and the configured record editor; dashboard, ledger, matrix, report and settings compose the corresponding public renderers. Catalogue hash assertions retain titles, sections, groups, templates, entities and field/workflow metadata. They do not prove specialized visual parity.

ERP1 keeps its in-page editor. ERP2 permits 46 view, 44 new and 42 edit patterns, preserving query/prefill identity and scoped previous/next memory. Default reset/persistence uses the library column engine and effective browser/account storage preference. Each module has its own header selection, navigation and API scope.

At the phase 6c-2 baseline, booking calendars, invoice print geometry, analytical controls and full dashboard composition were deferred. Phase 6c-3 below replaces those generalized views with the documented specialized subset. Hierarchy canvas and board/profile main workflows are delivered, but ERP2 tree record breadcrumbs/delete/child-table composition, board discussion/history, source-specific profile statistics/activity layout and exact visual matching remain incomplete. Durable and cross-route unsaved recovery and the richer personal-view protocol also remain deferred.

Tests retain all 38 original assertions/cases (20 core + 9 ERP1 + 9 ERP2), adapting old host providers and primitive/export imports to public library APIs. Login uses the real public LoginScreen's username contract. Frozen API fixtures and canonical catalog reads are test-only; generators under `tooling/scripts` read the unchanged source and never run in the app.

Existing create/edit controls and ERP1 tree leaf deletion are enabled for finance, finance-manager and accountant roles on chart-of-accounts, tax-rates, journal-vouchers, payment-vouchers, petty-cash, depreciation-run, receivables-aging and ledger-entries, plus exact server-issued `erp:write:<entity>` grants. Other entities remain read-only; full admin/operations roles retain existing write access. Every command still goes through server authorization. Direct edit routes and retry handlers apply the same entity checks. Export presentation is unchanged.

The Next root layout owns the ERP client/provider host so navigation between a worklist and its record keeps scoped neighbour memory. Catch-all pages supply route identity without remounting that host. A browser refresh still starts a new in-memory scope.

Phase 6c-2 adds public `@pepbits/patterns/tree` and `@pepbits/patterns/board` configured by `keystone/tree.tsx` and `board.tsx`. ERP1 `profile.tsx` composes the existing public worklist/record engines and resource view-state helper. The three tree entities and two case entities apply to both variants; eight profile entities use the ERP1 split composition. Source templates remain read-only. These are main-workflow ports, not a claim of exact source pixels or all record-panel actions.


## Phase 6c-3 source treatment

| Source area | Current composition and boundary |
| --- | --- |
| Both BookingTemplate implementations | `booking.tsx` configures `@pepbits/patterns/calendar`, source day/resource windows, upcoming list, new-record defaults and status commands. Existing RecordEditor remains; exact source drawer/record-detail composition is deferred. |
| Keystone Invoice and both PrintTemplate implementations | `invoice.tsx` loads the company/customer API, preserves A4 794 × 1123 screen geometry and paper structure, copy/terms/zoom and shared PrintDocument isolation. Fixed ink/paper colors and logo geometry are source-document content. English words use the public explicit-language spelling helper. Physical printers and exhaustive pagination/source pixel comparison are not accepted. |
| ReportTemplate/WorkList and LedgerTemplate | `analytics.tsx` configures TemplateReport grouping/totals/drill-downs and shared exports. Ledger opening/running/closing balances are computed before search. Source advanced filtering/sorting/columns and saved-view parity remain; source has no independent pivot designer. |
| MatrixTemplate | `matrix.tsx` configures EditableMatrix dimensions/bounds/summary slots, source periods, attendance bulk fill, column totals and acknowledged sequential saves. It retains mounted drafts only. |
| DashboardTemplate | `dashboard.tsx` configures shared KPI/chart/collection components with every source response panel and module-owned links. Source-specific pixel geometry remains; no unsupported global filter API is invented. |

Detailed hierarchy/board/profile panels, richer personal-view protocol and durable cross-route drafts remain as listed in the current guide. Original source tests stay intact; route assertions now identify calendar and invoice surfaces instead of generic list/record placeholders.

## Phase 6c-5 control audit

The source ERP1/ERP2 template registries both select the core ReportTemplate, LedgerTemplate and MatrixTemplate. Their WorkList provides typed filters, a three-state column sort, grouping, first-currency group sums, grand totals and preference-selected CSV/XLSX. Neither source has a pivot designer, comparison-period selector or selectable subtotal mode. Ledger has customer, month/90-day/365-day/all/custom dates, search and complete-statement export. Matrix has month/week/term navigation, search, summaries and attendance fill; it has no export, grouping, pivot or comparison control. These absences are not deferred implementations.

Both variants now cover all of those analytical controls. `analytics.tsx` uses the additive public ReportFilterField, sort and host groupTotals contracts; all numeric subtotals come from the complete filtered response. Saved views and source column persistence remain owned by the parallel 6c-4 scope. Invoice pagination uses public measured row partitioning, repeated identity/item headers, carried totals including tax, continuous item numbers, page numbers and one final summary. Exact visual matching remains separate. Source catalogs/backend files are unchanged; new uncatalogued labels retain readable English.

## Phase 6c-4 source treatment

`record-panels.tsx` configures profile groups/statistics/change guidance, support metadata, booking-day related records, ERP2 hierarchy context, case conversations, request/approval trails and notes, document summaries, process steps and inspection counts over existing shared components. `RecordPage` adds optional summary/aside slots; it keeps its existing form layout when absent. API support is keyed by accepted record version. Board moves append source-compatible conversation entries. Original source files remain read-only.

[The destination handoff](parity-status.md) supersedes the earlier remaining-work paragraphs for current status and lists all 114 routes. Panel content and personal views are delivered; remaining source composition/actions, durable recovery, parallel report/invoice work and later visual comparison remain explicit. `personal-views.tsx` adapts source saved views and hidden-column keys, extends named snapshots with typed filters/sort/columns, and composes typed WorklistPage slots. States adds parent context/counts and defaults. The public patterns unload warning ports source behavior without claiming persistence.

## Phase 6c-6 source comparison

Phase 6c-6 improves source composition at 35 destinations: ERP1 booking drawers retain the calendar and restore focus; ERP2 booking records show time/resource identity and a 340px schedule rail; profiles have source-sized avatars/statistic strips and ERP1 340/380px worklists; cases have subject/status/stage identity and avatar conversations, with ERP1 drawers retaining the board or list and refreshing acknowledged changes without losing search; ERP2 tree records have top breadcrumbs and 380px child context; all eight reports now support column layouts and named snapshots. Read-only fields use source-scaled stacked labels/values. Shared additions are opt-in plain RecordPage/RecordSectionLayout presentation and configurable ResourceTimeline geometry/resource/event slots, plus WorklistPage `refreshKey` for acknowledged external writes. Shared Avatar accent initials now use the effective text token after real-browser axe exposed insufficient contrast. Effective preferences, tenant locks, retry/version handling and source API boundaries remain authoritative.

The source audit maps all 114 destinations to original JSX/CSS and retains 84 source-file hashes. Local verification passes: forced CI has 6,097 Vitest tests with 42/42 tasks and zero cached; shell Chromium has 18 cases; real HTTP has 122 workflows, all 114 routes, 15 extra axe states and 27 geometry comparisons, with zero violations or application/HTTP/console errors. Source JSX/CSS was audited; the original desktop runtime was not rendered. **Exact visual parity is incomplete at all 114 destinations**: the ledger lists specific remaining differences and workflows. Durable cross-route drafts stay out of scope. Reports now raise personal-view coverage from 84 worklists to 92 destinations. No API, deployment or protected-source changes are required.

`source-visual-audit.mjs` reads every source file in the three protected reference packages and maps each destination to its template and ERP2 record renderer. It records source geometry classes and hashes. The browser driver measures the demo against those source CSS values and retains per-route samples/captures; the complete run passes all 114 destination samples and 27 selected record-state comparisons. It does not execute the original app, compare identical rendered source pixels or certify every control. `parity-status.md` supersedes earlier time-specific deferrals, including the completed 6c-5 controls/pagination.
