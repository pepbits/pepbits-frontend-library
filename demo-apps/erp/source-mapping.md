# ERP source mapping

Phase 6c-1, base `9752ea4afc321db6ea70106d03c1648e5c73262d`. Source packages are read-only references. [App guide](README.md), [feature contract](../../docs/features/erp-demo.md) and [delivery record](../../docs/releases/unreleased/restructure-phase-6c-1-2026-10-23.md) state verification and deferrals.

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

Deferred specialized source views: hierarchy canvas, calendar/resource timeline, grouped/dragged boards, bespoke profile layout, invoice print paper, report period/pivot controls and full dashboard composition. The available alternatives are shared data list/record/report views. Durable drafts and cross-route unsaved recovery require further host/API work; no accounting or native-print acceptance is asserted.

Tests retain all 38 original assertions/cases (20 core + 9 ERP1 + 9 ERP2), adapting old host providers and primitive/export imports to public library APIs. Login uses the real public LoginScreen's username contract. Frozen API fixtures and canonical catalog reads are test-only; generators under `tooling/scripts` read the unchanged source and never run in the app.

Finance-specific entity-grant presentation remains deferred: the app enables writes for the API's admin/enterprise-admin/operations/operations-analyst roles; finance/accountant sessions currently receive read-only controls. The server still enforces every command. Live write evidence uses the fixture administrator.

The Next root layout owns the ERP client/provider host so navigation between a worklist and its record keeps scoped neighbour memory. Catch-all pages supply route identity without remounting that host. A browser refresh still starts a new in-memory scope.
