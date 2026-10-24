# Tenant Admin demo

Private `@pepbits-demo/tenant-admin`: Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phase 6e-2 ports the Allyvora Tenant Admin reference (Overview, Approvals inbox, Activity log and the 30 registry-driven configuration pages) onto the shared Pepbits host through public `@pepbits/*` exports. Every tenant, record, user, approval and audit entry is **fictional demonstration data** from the existing demo HTTP API. This is a local build/run, not a deployment, production configuration service or financial/regulatory acceptance.

## Run locally

From the repository root:

```sh
npm install
# In another terminal, with Node 24 and the API runtime dependencies available:
node dummy-api/server.mjs
NEXT_PUBLIC_API_URL=http://localhost:3330 npm run dev -w @pepbits-demo/tenant-admin
```

Use the actual API port/origin from the [API guide](../../dummy-api/README.md). Dev/start use port **3360**. Sign in with a Tenant Admin role account from the local API fixtures (`tenant-config-admin`, `-editor`, `-approver`, `-viewer` or an enterprise administrator); credentials are deliberately absent from this guide and from evidence. The optional same-origin proxy accepts these settings in an ignored app `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=/api
TENANT_ADMIN_API_URL=http://127.0.0.1:3330
```

`NEXT_PUBLIC_API_URL` is build-time configuration; `TENANT_ADMIN_API_URL` is server-only proxy configuration and never reaches a component. The proxy forwards only the API contract headers and does not follow redirects.

```sh
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/tenant-admin
npm run typecheck -w @pepbits-demo/tenant-admin
npm test -w @pepbits-demo/tenant-admin
npm run test:integration -w @pepbits-demo/tenant-admin
```

Build before integration. The shared launcher (`tooling/scripts/run-demo-integration.mjs`) starts one demo API, one production Next server and Chromium on free loopback ports with temporary API storage, and stops its own process groups on success, failure, cancellation or deadline. Set `TENANT_ADMIN_API_NODE` to a Node 24 executable. If generated API runtimes are missing, `TENANT_ADMIN_RUNTIME_ARTIFACTS` may name a source-identical existing `dummy-api` checkout: every tracked API source is compared before reuse and runtime hashes are recorded. This is not an API rebuild. Optional receipts: `TENANT_ADMIN_RESULT`, `TENANT_ADMIN_IDENTITY`, `TENANT_ADMIN_SCREENSHOTS_DIR`; cancellation/deadline: `TENANT_ADMIN_STOP_FILE`, `TENANT_ADMIN_TIMEOUT_MS`; build output: `TENANT_ADMIN_BUILD_DIR`. `TENANT_ADMIN_CAPTURE=<file>` additionally writes the API responses used as frozen fixtures by the mocked component tests (`src/test/api.json`), before any workflow changes data. On this machine Chromium needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`. Keep at most one Next server, one API and one Vitest tree running.

## Structure and routes

| Path | Page |
| --- | --- |
| `/` | Overview: billing readiness, activation path, waiting decisions, upcoming effective versions, recent activity |
| `/approvals` | Approvals inbox: for you to decide / your submissions / everything, approve or return with a reason |
| `/activity` | Activity log: append-only audit trail filtered by page, action and person |
| `/config/<resource>` | One of the 30 configuration pages listed by `GET /meta` (for example `/config/items`, `/config/tax-rules`, `/config/reimbursement-routes`) |
| `/config/<resource>?new=1` | The same page with a new-record drawer |
| `/config/<resource>?open=<id>` | The same page with that record's drawer (`?id=<id>` is read too) |
| `/preferences` | Shared shell preferences page |

Any other path shows the module's own not-found page. [Source mapping](source-mapping.md) lists every original file and its destination.

- `src/navigation.ts` maps addresses to pages and builds the product: Workspace entries, then every registry category with its pages in registry order. Configuration pages are **not listed in the frontend**: `src/providers.tsx` reads `GET /meta` for the signed-in scope and publishes it to the shared shell, so a page the server stops offering disappears. Before the registry answers (or when it is refused) only the workspace entries are shown; signing out or another identity clears it.
- `src/renderer.tsx` registers one `tenant-admin` renderer for every Tenant Admin route and the shared preferences page in the public page-engines renderer registry. The same renderer instance stays mounted across Tenant Admin routes, so the module's scope-keyed store (registry, counts, option lists) survives navigation.
- `src/modules/tenant-admin` is the ported module: one `ResourceWorkspace` list plus `RecordDrawer` draws all 30 pages from the registry field definitions; Overview, Approvals and Activity are their own components. `page.tsx` bridges the application host into the public `@pepbits/shell/reference-host` contract.
- `src/adapters/tenant-admin.ts` maps module-relative calls onto `/reference-modules/tenant-admin/...` through the configured authenticated request.

## Host, data and preferences

ApplicationProviders composes SessionProvider → PreferenceHost (API preferences and tenant policy, one serialized update path) → runtime LocalizationProvider (`/localization?productId=nexora`) → ShellProvider/EnterpriseShell with the authenticated branch and role. AI is off; no provider is configured.

`GET /meta` returns the registry and the signed-in user as the server maps it (`currentUser`, `hostManagedIdentity`). Without them nothing is shown. There is no actor header, actor switcher, demo sign-in or browser token store in the module. Module and branch headers are routing metadata; the API derives identity and authority from the session and enforces role access (`tenant-config-admin/editor/approver/viewer`, enterprise administrators), independent approval and row versions. UI locks and disabled buttons are presentation only (PREF-08).

Writes carry `Idempotency-Key`; an ambiguous failure (network, abort, 408, 502–504) retries under the same key. Errors keep the source shape `{ error: { code, message, fieldErrors } }`: field errors appear on their fields with the typed values kept, `STALE_VERSION` reloads the record and says so. Reads live in a store keyed by tenant, application, branch, module, user and roles; requests abort on unmount and scope change, late answers are discarded and mutations refresh every mounted read. Approval counts are polled every 20 seconds. No form values enter browser storage; an unsaved drawer asks before closing, but durable drafts are not provided by this API.

Dates, times, numbers and relative times use the effective formats. List page size is the managed table page size; density, stripes, sticky header and wrapping come from the shared Table. Toasts follow position/duration/count preferences. Ctrl/Cmd+K (Jump to a page) and Ctrl/Cmd+S (save an editable record) are bound only while keyboard shortcuts are enabled; inside Tenant Admin pages they take precedence over the shell's palette shortcut, whose header button remains available. Theme and density reach the scoped source stylesheet through `data-theme`/`data-density`; reduced motion stops the source animations.

## Limits

The scoped stylesheet and alias maps are frozen copies of the original generated files, verified by SHA-256; their generators stay with the protected desktop workspace. Physical left/right utilities are kept (Arabic gets `dir="rtl"` from the host; layouts are not mirrored). Long Hindi/Malayalam strings and native-speaker review are not checked; all aliases exist in the four canonical catalogs. The record drawer uses the shared Drawer width and title bar. Mocked component tests use frozen fictional API responses; separate real local HTTP checks are recorded in the [6e-2 delivery record](../../docs/releases/unreleased/restructure-phase-6e-2-2026-10-24.md). See the [feature guide](../../docs/features/tenant-admin-demo.md) for flows and acceptance IDs.
