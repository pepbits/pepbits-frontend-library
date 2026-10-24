# Settle demo

Private `@pepbits-demo/settle`, using Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phase 6e-4 ports the **Settle patient billing desk** (`source/settle`): every screen of patient billing, receipts, advances and deposits — desk, bills, the bill workspace, patient accounts, receipts, approvals, day close, reports, audit trail, settings and the bill/receipt print layouts. All data is **fictional** and every rule is the unchanged Settle backend's. This is a demonstration built from the library, **not a billing, accounting or clinical acceptance**, and a local build/run, not a deployment.

Verification status: mocked tests and typechecking pass. Full CI, Next build, shell Chromium and Settle real-HTTP verification remain blocked by the shared heavy-check lock; see the [release record](../../docs/releases/unreleased/restructure-phase-6e-4-2026-10-24.md). Phase completion is pending.

## Run locally

The app needs two unchanged APIs: the shared demo host API (sign-in, preferences, tenant policy and localization catalogs, Node 24) and Settle's own Express + SQLite billing API. From the repository root:

```sh
npm install
# Host API (see dummy-api/README.md), on a free port:
PORT=3330 NEXORA_DATA_DIR=/tmp/settle-host-data node dummy-api/server.mjs
# Settle billing API, unchanged, per source/settle/README.md:
(cd source/settle/backend && npm ci && PORT=4100 SETTLE_DATA_DIR=/tmp/settle-data npm start)
```

Configure the app in an ignored `demo-apps/settle/.env.local`; both public URLs are build-time configuration and the two server URLs are server-only:

```dotenv
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SETTLE_API_URL=/settle-api
SETTLE_HOST_API_URL=http://127.0.0.1:3330
SETTLE_API_URL=http://127.0.0.1:4100
```

`/api/*` forwards to the host API and `/settle-api/*` to the Settle API's `/api/*` (same-origin, no CORS setup). A direct origin such as `NEXT_PUBLIC_SETTLE_API_URL=http://127.0.0.1:4100/api` also works because the unchanged backend allows any origin. Components never see a base URL; they receive a configured transport. Dev/start use port **3380**. Fixture credentials stay in the API fixtures and are omitted here.

```sh
npm run dev -w @pepbits-demo/settle
NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_SETTLE_API_URL=/settle-api npm run build -w @pepbits-demo/settle
npm run typecheck -w @pepbits-demo/settle
npm test -w @pepbits-demo/settle
SETTLE_API_NODE=$HOME/.local/opt/node24/bin/node npm run test:integration -w @pepbits-demo/settle
```

Run heavy checks and the entire local server/API/browser session under `flock /home/pepadmin/.cache/pepbits-heavy.lock <command>` when sharing this machine. Build before integration. `scripts/integration.mjs` starts the host API (Node 24 from `SETTLE_API_NODE`), the Settle API (the Node that installed its `better-sqlite3`), and the production Next server on free loopback ports with temporary storage, then runs `scripts/smoke.mjs` in Chromium. It cleans up on success, failure, signal (`SETTLE_STOP_FILE`) or deadline (`SETTLE_TIMEOUT_MS`, 30 minutes). Optional receipts: `SETTLE_RESULT`, `SETTLE_IDENTITY`, `SETTLE_SCREENSHOT`; build output: `SETTLE_BUILD_DIR`. Chromium on this machine needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`. Keep at most one Next server, one host API, one Settle API and one Vitest tree running. `scripts/write-fixtures.mjs` regenerates the frozen unit-test fixtures from the unchanged Settle API.

## Structure and routes

| Path | Purpose |
| --- | --- |
| `src/app` | Root layout, routed client, catch-all page and the two same-origin proxies |
| `src/providers.tsx` | Public `ApplicationProviders` (session → preferences → localization → shell) plus the Settle runtime |
| `src/navigation.ts` | 13 Settle page definitions, sidebar groups (Work, Money, Control, Admin), product profile, path ↔ target mapping |
| `src/renderer.tsx` | Public page-engine renderer registry: `settle` and shared `preferences` renderers |
| `src/adapters` | Host HTTP (shared demo API) and the Settle transport (base URL, `x-user-id`, error envelope, path validation) |
| `src/modules/settle` | Settle runtime, route host, ported screens, bill components and source design primitives |

Routes are the source routes: `/`, `/bills`, `/bills/:billNo`, `/patients`, `/patients/:mrNo`, `/receipts`, `/approvals`, `/day-close`, `/reports`, `/audit`, `/settings`, `/print/bill/:billNo` and `/print/receipt/:no`, plus `/preferences`. Query state (bill filters, receipt filters, `?open=`, `?id=`, `?r=`, `?s=`, `?detail=1`) is part of the deep link. Unknown or malformed paths show not-found. The shell sidebar replaces the source rail; the source header becomes a Settle desk bar above every screen.

## Host, data and preferences

Sign-in, accepted preferences, tenant policy and runtime localization come from the shared host chain against the demo API, exactly as in the healthcare and ERP demos. Billing data comes only from the Settle API over HTTP through the configured transport. The **desk user** switcher is the source demo's `x-user-id` user switch (Priya, Rahul, Anita, Suresh): it is tab-scoped routing metadata per signed-in host user, never a preference or an authorization grant. The Settle server checks every right for that user; the UI hides or disables what the server would refuse. Reads use public `ResourceScope`/`useFetch`; obsolete requests are aborted and fenced. A desk-user or host-user change clears query data and remounts desk editors. Successful writes quietly refresh the current data without unmounting editors.

Effective theme, font family and form/result scales, corner radius, density, page size, stripes, sticky headers, wrapping, date/time/number/currency formatting, export format, keyboard shortcuts and hints, loading skeletons, toasts and reduced motion come from the host. The source palette names (pine, marigold, ink, mist, …) are mapped onto semantic theme tokens. Amounts use the selected currency; the source's rupee-specific cash denominations and Indian-numbering amount-in-words apply to the content as data, and amount-in-words switches to English integer spelling with the currency code for non-INR currencies. Native date inputs keep ISO machine values.

Settle shortcuts (`/` search, `N` new bill; on a bill `A` add charge, `P` take payment, `F` finalize) exist only while shortcuts are enabled; the shell keeps ⌘K and `?`. Writes go through the Settle API; every successful write refreshes all visible Settle screens. Failed writes keep entered values and show the server's reasons.

## Completion boundary

All source screens, dialogs and drawers are ported with their workflows (see the [source map](source-mapping.md)). Deliberate differences: the shell sidebar/header/footer and command palette are the library's; Settle's desk bar holds counter, desk user, search and New bill. Host toasts are text-only, so the source toast actions (Print receipt) become a persistent "recorded — Print receipt" link beside the action. Settle copy has no canonical catalog keys: labels that already exist in the shared catalogs translate, the rest stays English; adding Settle keys needs a change to the protected canonical catalogs. Live sidebar badges are shown in the desk bar instead of the static shell sidebar. Bills, receipts and audit send the effective page size to their paginated APIs. The other source lists are bounded collections without page controls. The till chart, balance line, payment rail and printed documents retain Settle-specific geometry (CMP-04); ledger rows reuse public Table/TableRow. Exact source pixel parity has not been measured. Durable drafts are not added; source forms are mounted state. Physical printers, billing/accounting acceptance, native executables and human accessibility/localization review remain outside verification.
