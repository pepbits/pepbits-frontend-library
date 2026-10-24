# ERP source mapping

Initial phase 6c-1, base `9752ea4afc321db6ea70106d03c1648e5c73262d`. Source packages are read-only references. [App guide](README.md), [feature contract](../../docs/features/erp-demo.md) and [current delivery record](../../docs/releases/unreleased/restructure-phase-6c-2-2026-10-23.md) state verification and deferrals.

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

Booking calendar/resource timelines, invoice print geometry, report period/pivot controls, ledger date-range/opening-balance controls, matrix period navigation/bulk-fill and full source dashboard composition remain deferred. Hierarchy canvas and board/profile main workflows are delivered, but ERP2 tree record breadcrumbs/delete/child-table composition, board discussion/history, source-specific profile statistics/activity layout and exact visual matching remain incomplete. Durable and cross-route unsaved recovery and the richer personal-view protocol also remain deferred.

Tests retain all 38 original assertions/cases (20 core + 9 ERP1 + 9 ERP2), adapting old host providers and primitive/export imports to public library APIs. Login uses the real public LoginScreen's username contract. Frozen API fixtures and canonical catalog reads are test-only; generators under `tooling/scripts` read the unchanged source and never run in the app.

Existing create/edit controls and ERP1 tree leaf deletion are enabled for finance, finance-manager and accountant roles on chart-of-accounts, tax-rates, journal-vouchers, payment-vouchers, petty-cash, depreciation-run, receivables-aging and ledger-entries, plus exact server-issued `erp:write:<entity>` grants. Other entities remain read-only; full admin/operations roles retain existing write access. Every command still goes through server authorization. Direct edit routes and retry handlers apply the same entity checks. Export presentation is unchanged.

The Next root layout owns the ERP client/provider host so navigation between a worklist and its record keeps scoped neighbour memory. Catch-all pages supply route identity without remounting that host. A browser refresh still starts a new in-memory scope.

Phase 6c-2 adds public `@pepbits/patterns/tree` and `@pepbits/patterns/board` configured by `keystone/tree.tsx` and `board.tsx`. ERP1 `profile.tsx` composes the existing public worklist/record engines and resource view-state helper. The three tree entities and two case entities apply to both variants; eight profile entities use the ERP1 split composition. Source templates remain read-only. These are main-workflow ports, not a claim of exact source pixels or all record-panel actions.
