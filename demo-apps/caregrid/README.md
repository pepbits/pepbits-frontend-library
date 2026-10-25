# CareGrid demo

Private `@pepbits-demo/caregrid`, using Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phase 6e-5 ports **CareGrid**: network-wide appointment scheduling and resource planning with minute-by-minute availability, multi-resource bookings, exceptions with a reschedule queue and live updates over Server-Sent Events. All eleven source screens are available at their original paths. Every patient, resource and booking is **fictional demonstration data**; this is not clinical acceptance, a production integration or a deployment.

## Run locally

The app talks to two unchanged backends:

- the shared **demo host API** (`mock-api`) for sign-in, preferences, tenant policy and the runtime localization catalog;
- CareGrid's own **scheduling API** (`source/caregrid/backend`, Express + SQLite) for all scheduling data and the event stream.

From the repository root:

```sh
npm install
# Demo host API, using its documented Node 24 environment (see mock-api/README.md).
node mock-api/server.mjs
# Scheduling API, installed and run per source/caregrid/README.md (Node 20 or 22; seeds itself on first start).
npm --prefix source/caregrid/backend install
PORT=4000 npm --prefix source/caregrid/backend run dev
NEXT_PUBLIC_API_URL=http://localhost:3330 NEXT_PUBLIC_CAREGRID_API_URL=http://localhost:4000/api npm run dev -w @pepbits-demo/caregrid
```

Use the actual ports of your backends. Dev/start use port **3390**. Fixture credentials stay in the API fixtures and are omitted here. The optional same-origin proxies accept these settings in an ignored app `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_CAREGRID_API_URL=/caregrid-api
CAREGRID_API_URL=http://127.0.0.1:3330
CAREGRID_SCHEDULING_API_URL=http://127.0.0.1:4000/api
```

`NEXT_PUBLIC_*` values are build-time configuration; the two proxy targets are server-only. The scheduling proxy streams `text/event-stream` responses without compression and forwards **no credential**: the scheduling API has no authentication, so the host session token never leaves the app origin. Scripts are `dev`, `build`, `start`, `typecheck`, `test` and `test:integration`:

```sh
NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_CAREGRID_API_URL=/caregrid-api npm run build -w @pepbits-demo/caregrid
npm run typecheck -w @pepbits-demo/caregrid
npm test -w @pepbits-demo/caregrid
npm run test:integration -w @pepbits-demo/caregrid
```

Build before integration. `scripts/integration.mjs` starts the unchanged scheduling API on a free loopback port with a temporary, freshly seeded database, then hands over to the shared `tooling/scripts/run-demo-integration.mjs` launcher (demo host API, one production Next server, Chromium) and stops every process group afterwards, including on failure or signals. Set `CAREGRID_API_NODE` to a Node 24 executable for the host API, and `CAREGRID_RUNTIME_ARTIFACTS` when the host API's generated runtimes live in a source-identical checkout (sources are hash-compared first). Chromium on this machine needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`. Optional receipts: `CAREGRID_RESULT`, `CAREGRID_IDENTITY`, `CAREGRID_SCHEDULING_IDENTITY`, `CAREGRID_SCREENSHOT`; cancellation/deadline: `CAREGRID_STOP_FILE`, `CAREGRID_TIMEOUT_MS`; build output: `CAREGRID_BUILD_DIR`.

## Structure and routes

| Path | Destination | Deep-link parameters |
| --- | --- | --- |
| `/` | Command center | — |
| `/book` | Book | `patient`, `type`, `date`, `waitlist` |
| `/schedule` | Schedule board | `date`, `department`, `appt` |
| `/frontdesk` | Front desk | `tab=waitlist` or `tab=reminders` |
| `/exceptions` | Availability and blocks | `resource` |
| `/resources` | Resources | `id` |
| `/catalog` | Service catalog | `type` |
| `/patients` | Patients | `id` |
| `/pharmacy` | Pharmacy desk | — |
| `/insights` | Insights | `tab=util` |
| `/help` | Help center | — |
| `/preferences` | Shared preferences page | — |

`src/navigation.ts` defines the single CareGrid module, its sidebar sections (Today, Planning, Records, Analysis, Support), page definitions and route table. `src/renderer.tsx` uses the public page-engine renderer registry. `src/modules/caregrid` holds CareGrid configuration, live state, booking components and one screen per destination. `src/adapters/caregrid.ts` is the configured scheduling transport. Unknown paths show not-found. The [source mapping](source-mapping.md) lists every source file and its treatment. Runtime code imports only public `@pepbits/*` exports; it imports no other demo.

## Host, data and preferences

`ApplicationProviders` (SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider/EnterpriseShell) is configured with CareGrid's optional chrome: the Book quick action, contextual helper tours, a header inbox (live status, reschedule-queue shortcut and notifications) and API record search in the command palette. `CaregridLiveProvider` wraps the authenticated frame once, so the header and the page share reference metadata, the event stream and notifications. Events and reconnection trigger HTTP re-reads; the API is always the source of truth. Live resource refreshes preserve unsaved weekly-hours edits. Notifications become shell toasts through ScreenHost.

Effective theme, font and scales, density, radius, result view, page size, date/time/number formatting, reduced motion, keyboard shortcuts and helper/documentation switches come from the host. Lists that are ordinary result tables (service catalog, slot-length advice) use the shared CollectionView with the effective result view and managed page size. Timeline, board and day-strip canvases show complete days and ignore page size by design. Department/category colours are API data identifying service lines; they are darkened for white labels. Resource kinds use semantic tokens. The `B` shortcut is bound only while shortcuts are enabled and never while typing or inside a modal.

Writes (book, status changes, blocks, holidays, hours, rules, waitlist) are offered to scheduling roles only (`enterprise-admin`, `admin`, `operations`, `operations-analyst`, `medslot-admin`, `medslot-scheduler`). **This is presentation gating only (PREF-08):** the unchanged scheduling API performs no authentication or authorization, so a real deployment needs server-side authorization. Failed commands keep the current selection and show the server message; booking conflicts report the server's nearest alternatives.

## Completion boundary

All eleven source screens and their workflows are ported: command center, four-step booking with courses and waitlist, schedule board with click/keyboard booking and the appointment drawer (confirm, check-in, start, complete, no-show, undo, move, cancel), front-desk flow board with waitlist and reminders, blocks with impact preview, reschedule queue suggestions and automatic fixes, holidays, resource directory with the weekly-hours editor, service catalog rules, patient profiles, pharmacy desk, slot-length advice and utilization, and the help center. The source package has **no automated tests**; none could be ported. New tests are described in the [delivery record](../../docs/releases/unreleased/restructure-phase-6e-5-2026-10-24.md).

Deliberate differences: the source's fixed palette, hover-expanding sidebar, custom toasts, command palette and help drawer are replaced by the shared shell and semantic tokens; the sidebar queue badge became the header queue shortcut; toast "Open" links are reached from the notification panel; the source `/` search shortcut is the shell's `Ctrl K`; the front-desk board additionally accepts accessible board moves that map to valid lifecycle commands. Copy is English source wording passed through the host translator; the protected canonical catalogs have no CareGrid keys, so Arabic shows English CareGrid copy inside a translated, mirrored shell. No pixel comparison with the source was performed.
