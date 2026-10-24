# ERP demo

Private `@pepbits-demo/erp`, using Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phase 6c-1 supplies a separate shell, shared Keystone configuration and **57 catalogue destinations each for ERP1 and ERP2**, across the original 20 template families. Financial behaviour and all data are fictional demonstrations, **not accounting acceptance**. This is a local build/run, not a deployment.

## Run locally

From the repository root:

```sh
npm install
# Start the unchanged API using its documented Node 24/runtime environment.
node dummy-api/server.mjs
NEXT_PUBLIC_API_URL=http://localhost:3330 npm run dev -w @pepbits-demo/erp
```

Use the actual API port/origin from the [API guide](../../dummy-api/README.md). Dev/start use port **3320**. Fixture credentials stay in the API fixtures and are omitted here. The optional same-origin proxy accepts these settings in an ignored app `.env.local`:

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

Optional receipts: `ERP_RESULT`, `ERP_IDENTITY`, `ERP_SCREENSHOT`; cancellation/deadline: `ERP_STOP_FILE`, `ERP_TIMEOUT_MS` (30-minute default); build output: `ERP_BUILD_DIR`. Keep at most one Next server, one API and one Vitest tree running. The [delivery record](../../docs/releases/unreleased/restructure-phase-6c-3-2026-10-24.md) identifies exact checks and limits.

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

Remaining: ERP1 booking drawer/detail geometry and specialized ERP2 booking detail composition; exact source chart/widget geometry and source pixel comparison; exhaustive multi-page invoice pagination; full report advanced filters/sorting/column and saved-view parity; ERP2 tree record breadcrumbs/delete/child tables; board discussion/history; source-specific profile statistics/activity layout; richer personal views; durable cross-route record-form recovery. The protected `/drafts` API accepts only import/approval/DCP kinds and original navigation IDs, so ERP record drafts require a backend contract. No form values enter browser storage. Physical printing, accounting acceptance, native executables and human accessibility/localization review remain outside verification.

All 38 original source cases are retained with public-provider adaptations. Added tests cover adapter errors, accepted preference updates, save-refresh/retry and every static/ERP2 record pattern under default, Arabic RTL, reduced-motion and locked-density profiles. Real HTTP checks are separate from mocked component checks. Original desktop/backend/deployment files are unchanged; no commit, push, publication or deployment is part of this run.

Existing create/edit controls and ERP1 tree leaf deletion are enabled for finance, finance-manager and accountant roles on chart-of-accounts, tax-rates, journal-vouchers, payment-vouchers, petty-cash, depreciation-run, receivables-aging and ledger-entries, plus exact server-issued `erp:write:<entity>` grants. Other entities remain read-only; full admin/operations roles retain existing write access. Every command still goes through server authorization. Direct edit routes and retry handlers apply the same entity checks. Entity grants also require the shell capability, so an expired session or mounted host denial keeps writes disabled. Export presentation is unchanged.

The Next root layout owns the ERP client/provider host so navigation between a worklist and its record keeps scoped neighbour memory. Catch-all pages supply route identity without remounting that host. A browser refresh still starts a new in-memory scope.
