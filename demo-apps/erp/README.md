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

Optional receipts: `ERP_RESULT`, `ERP_IDENTITY`, `ERP_SCREENSHOT`; cancellation/deadline: `ERP_STOP_FILE`, `ERP_TIMEOUT_MS` (30-minute default); build output: `ERP_BUILD_DIR`. Keep at most one Next server, one API and one Vitest tree running. The [delivery record](../../docs/releases/unreleased/restructure-phase-6c-1-2026-10-23.md) identifies exact checks and limits.

## Structure and routes

`src/navigation.ts` defines both header modules, their own sidebar groups, 114 page definitions and preferences. `src/renderer.tsx` uses the public page-renderer registry. `src/modules/keystone` holds ERP metadata, field/API mappings and workflow composition; `src/modules/erp1` and `erp2` select the shared catalogue and retain module contracts. [Source mapping](source-mapping.md) lists the engine replacements and remaining specialized views. Runtime code imports only public `@pepbits/*` exports.

Both modules use `/{erp1|erp2}/{section}/{slug}`. ERP1 opens and edits a record within its current page. ERP2 adds `/:id`, `/new` and `/:id/edit` where permitted: **46 record, 44 create and 42 edit patterns**. Refresh retains ERP2 record identity. Previous/next follows the most recently loaded worklist page within the authenticated module scope; a fresh direct link has no previous list memory. Columns uses the shared worklist layout/reset behaviour and follows the effective browser/account storage preference; account storage uses the existing scoped view-state API. `/preferences` uses the shared shell settings page. Unknown or malformed paths show not-found. `/` honours the accepted default module. AI is off.

## Host, data and preferences

The public ApplicationProviders chain is SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider/EnterpriseShell. Healthcare and ERP both use this extracted host, HTTP transport and preference adapter. Preferences have one serialized update path with accepted revisions, tenant locks, allowed values and policy refresh. Runtime localization loads the canonical API catalog; generated literal-to-key aliases contain no translated catalog copy. Unmapped source wording remains readable English. Arabic/RTL automation does not establish human language review.

The API adapter maps relative calls to `/reference-modules/erp1/api/...` or `/reference-modules/erp2/api/...`, using existing `nexora` product metadata and authenticated branch/module headers. Resource caches and view state are scoped by tenant, user, role, branch and module. Source lookups come from HTTP before a page renders. No frontend business-data fallback exists; frozen fictional data is confined to tests.

Effective theme, font/scales, density, radius, table wrapping/stripes/sticky header, page size, date/number/currency formatting, motion and keyboard preferences come from the host. Native date machine values and financial cell calculations retain domain meaning. Lists configure WorklistPage; records configure RecordPage/TemplateFields/FieldRows; matrix cells configure EditableMatrix; ledger/report output configures TemplateReport; dashboards use shared cards/charts. The API owns validation, row versions and command authority. Failed record saves retain input; identical ambiguous retries retain their operation ID. A conflict requires an explicit reload. No durable draft API is invented.

## Completion boundary

All catalogue destinations render and query their own API data. Shared list/record layouts replace the original generic renderers. Specialized source presentation remains deferred: tree canvas, booking calendar/resource timeline, board grouping/dragging, profile-specific split views, exact invoice print geometry, source report period/pivot controls and richer source dashboard composition. Those destinations currently offer the shared list/record or report views, not full visual/workflow parity. The original personal-view API is incompatible with the richer library protocol, so that control is hidden; column persistence/reset is available. Cross-route unsaved-edit recovery, durable drafts, physical printing, detailed accounting/approval acceptance and human accessibility/localization review are not claimed.

All 38 original source cases are retained with public-provider adaptations. Added tests cover adapter errors, accepted preference updates, save-refresh/retry and every static/ERP2 record pattern under default, Arabic RTL, reduced-motion and locked-density profiles. Real HTTP checks are separate from mocked component checks. Original desktop/backend/deployment files are unchanged; no commit, push, publication or deployment is part of this run.

Finance-specific entity-grant presentation remains deferred: the app enables writes for the API's admin/enterprise-admin/operations/operations-analyst roles; finance/accountant sessions currently receive read-only controls. The server still enforces every command. Live write evidence uses the fixture administrator.

The Next root layout owns the ERP client/provider host so navigation between a worklist and its record keeps scoped neighbour memory. Catch-all pages supply route identity without remounting that host. A browser refresh still starts a new in-memory scope.
