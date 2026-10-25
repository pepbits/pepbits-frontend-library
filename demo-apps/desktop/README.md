# Desktop demo

Private `@pepbits-demo/desktop`: the replacement for `desktop-clients/apps/desktop`. It is a Vite 7 + React 19.2 + Tailwind 4.1 web app with the copied Tauri 2 host in `src-tauri/`. The same bundle runs in a normal browser (**web mode**) and, when built with the Tauri CLI, inside a native Tauri window. All data is fictional: records come from the unchanged demo API; the Library page supplies fixed example values. This is a local build/run, not a deployment.

**Native status:** the Rust/Tauri host is copied with only names and the dev URL adapted. In phase 6e-7 it was **not built, run or tested as a native executable**. Verification covers the web build (`vite build`), typecheck, unit tests (including the Tauri window port with the Tauri API mocked) and a real-HTTP Chromium check of the web build. See the [delivery record](../../docs/releases/unreleased/restructure-phase-6e-7-2026-10-24.md).

**Current verification:** the local web build and real-HTTP Chromium check pass: 16 workflows, 13 route/axe checks, zero script/page, console or non-auth API HTTP errors and zero axe violations. The follow-up also passes 82 desktop tests, typecheck and 35 focused inline-editor tests. The coordinator's earlier local CI reports 45/45 tasks with no cache; it was not rerun in this focused follow-up. Exact source, documentation validation and historical attempts are in the delivery record.

## Run locally

From the repository root:

```sh
npm install
# Start the unchanged API with Node 24 (see mock-api/README.md for its runtime environment).
node mock-api/server.mjs
VITE_API_URL=http://localhost:3200 npm run dev -w @pepbits-demo/desktop     # http://localhost:3410
```

A direct API origin must be in the API's `NEXORA_ALLOWED_ORIGINS` environment setting (the defaults name the original ports, not 3410). Simpler: use the same-origin proxy with `VITE_API_URL=/api` and `DESKTOP_API_URL=http://127.0.0.1:3200`; `vite` (dev) and `vite preview` (start) then proxy `/api` to the demo API without forwarding the browser `Origin`, like the other demos' API route and the original deployment's reverse proxy. `VITE_API_URL` is inlined at build time; without it the app shows a configuration alert instead of guessing a server. `VITE_AI_ENABLED=true` turns on the AI assistant (see below). Fixture credentials live in the API fixtures and are not repeated here.

| Script | Purpose |
| --- | --- |
| `dev` | Vite dev server on port 3410 (Tauri's `devUrl`) |
| `build` | Production web build into `dist/` (`DESKTOP_BUILD_DIR` overrides) |
| `start` | `vite preview` of the build on port 3410 |
| `typecheck`, `test` | TypeScript and Vitest (at most two workers) |
| `test:integration` | Real-HTTP browser check; build first with `VITE_API_URL=/api` |
| `tauri` | Tauri CLI, e.g. `npm run tauri dev -w @pepbits-demo/desktop` (needs Rust, WebKitGTK and the Tauri prerequisites; not run here) |

`test:integration` uses the shared launcher (`tooling/scripts/run-demo-integration.mjs desktop`): one demo API on a free loopback port with temporary storage, one `vite preview` proxying `/api`, and Chromium. It cleans up on success, failure, cancellation (`DESKTOP_STOP_FILE`) or deadline (`DESKTOP_TIMEOUT_MS`). Set `DESKTOP_API_NODE` to Node 24 and, if this checkout has no generated API runtimes, `DESKTOP_RUNTIME_ARTIFACTS` to a source-identical API checkout (sources are compared first). Receipts: `DESKTOP_RESULT`, `DESKTOP_IDENTITY`, `DESKTOP_SCREENSHOT`. Chromium here needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`.

On the shared verification machine, every build, CI run and server/API/browser session must hold `flock /home/pepadmin/.cache/pepbits-heavy.lock` for its whole lifetime. The [verification launcher](../../docs/releases/unreleased/evidence/restructure-phase-6e-7-2026-10-24/run-checks.sh) acquires no second lock; invoke it through `flock` as its header shows. Do not run a native build for this phase.

## What the desktop frame shows

The full enterprise shell from `@pepbits/shell`: header, sidebar, footer, command palette, help/documentation layers and toasts, with a **document workspace**. Records open as tabs, two documents can be split side by side (swap, resize, back to one pane), the floating-windows preference arranges documents as movable MDI frames with a taskbar, and closing or leaving a module with unsaved changes asks first. In the Tauri runtime, **Open in its own window** moves a document into a separate native window through the Tauri window port; closing that window brings it back. In a browser the port is unavailable and the action is not offered.

| Route | Page | Module |
| --- | --- | --- |
| `/overview` | Desktop workspace: runtime, window availability, layout preference, open/split/separate counts and shortcuts | Finance |
| `/` | Effective default module's home (Desktop workspace by default) | preferred module |
| `/finance/customers` | Customer Master worklist (`/worklists/search`, columns, views, export, inline credit-limit edit) | Finance |
| `/finance/customers/:id`, `/:id/edit`, `/new` | Customer record form over the demo API record store | Finance |
| `/library/components` | Library examples: formatted values, line chart and calendar with fictional values | Finance |
| `/hr/employees`, `/hr/employees/:id` | Employee Worklist and read-only employee record | Human Resources |
| `/preferences` | Shared preferences page, including tab, floating-window and language settings | shared |

Unknown or malformed addresses show not-found. The address bar follows the active document, and Back/Forward or a deep link opens or focuses its document (a fresh load builds the module home plus that document). Cancelling a guarded module change restores the active address and keeps the edited values. A child window opened by the Tauri port loads `index.html?document=<tenant>:<TYPE>:<entity>`: it shows that one document with no tab strip, and a key for another tenant is refused.

## Structure

```
src/
  main.tsx                 entry: one Tauri window port per process, detached-window key, env
  app.tsx                  ApplicationProviders (session → preferences → catalog → shell) in workspace mode
  navigation.ts            product, modules, pages, address ↔ target
  renderer.tsx             page-engines renderer registry: one registration per page kind
  adapters/                configured HTTP transport, worklist and record-store adapters
  platform/                Tauri window port (+ ported tests) and the history navigation port
  modules/workspace        desktop overview screen
  modules/records          worklist/record configuration and composition (customers, employees)
  modules/library          shared-component examples
  modules/ai               optional assistant wiring (off unless configured)
src-tauri/                 copied Rust host, tauri.conf.json, capabilities, icons, detach-smoke example
```

## Host, data, preferences and AI

`ApplicationProviders` from `@pepbits/shell/application-providers` owns the session against the demo API, the accepted preference snapshot with tenant policy and one serialized update path, the runtime localization catalog, and the shell. Phase 6e-7 adds its opt-in `workspace` option (tabs/split/MDI/detached windows; see the [shell guide](../../packages/shell/README.md#application-workspace-phase-6e-7)). The desktop supplies only its product, routes, page renderers, window port and optional AI wrapper.

Data uses the unchanged API routes the original desktop used for its finance/HR pages: `/worklists/search` (classified search bodies), `/layouts`, `/personal-views`, `/views`, `/exports`, `/worklists/{page}/{id}` and the `/records/{key}` store, all with product id `nexora` through the configured authenticated transport. Customer fields mirror the API's server-side customer validation; the record store keeps saved values and drafts, so a first edit must complete the required email and address fields. Employee records are read only: the page narrows create/edit grants and never widens them. Write controls depend on the session role (`enterprise-admin`, `finance-manager`); the API remains the authority.

Created customers reload through their generated record URL even before they appear in the API's synthetic worklist. The generated worklist and record store are separate API datasets: this demo does not claim list synchronization after a record save. Missing worklist rows fall back to a saved-record existence read through `ResourceScope`/`useFetch`; the shared record editor remains responsible for snapshot validation, drafts and saves. No new view-state writer is mounted.

Effective theme, typography/scales, density, radius, table settings, page size, formatting, motion, shortcuts, `openRecordsInTabs` (tabs or one document at a time) and `floatingWindows` come from the host. Desktop-owned labels are English literals passed through the host translator; the canonical catalogs are protected, so new wording falls back to English.

AI is **off** unless the build sets `VITE_AI_ENABLED=true`. Then `AiShellExtension` adds the assistant panel, inline actions and source publication with two explicit use cases on Customer Master (selected rows; saved record) and masked personal fields. Policy, limits, credentials and dispatch are the demo API's `/ai/*` routes. Enabling the assistant reads API policy/configuration; a provider answer requires server configuration. No provider was configured or called during verification.

## Plugging in product screens

The original desktop hosted the whole `NEXORA_PRODUCT` (Finance, HR, Payroll, Sales, Supply, Healthcare, Pharmacy, Library and the reference modules) from `erp-screens`. Ported product screens belong in their own demos/products; remaining product migrations are separate runs. Demos never import each other. A product repository supplies its product definition (`defineProduct` with modules/pages/access), page renderers (`createPageRenderer({renderers})` keyed by page kind), route mapping and adapters over its own API. The shared host and window port stay reusable. The [source mapping](source-mapping.md) lists the original responsibilities.

## Completion boundary

Delivered: web-mode desktop host, full shell, workspace tabs/split/MDI/dirty guards, history deep links, Tauri window port and detached-window rendering, demo-owned pages over the API, preferences, opt-in AI and the copied native host. Not delivered or not verified: a native Tauri build or run, native child-window/WebDriver checks (the original `detach-smoke` example is retained, not run), native Sentinel panic forwarding (the Rust commands are retained; `ApplicationProviders` configures no shell monitoring yet), the original product catalogues inside this host, and human accessibility/language review.
