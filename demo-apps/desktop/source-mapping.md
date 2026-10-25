# Desktop source mapping

Phase 8 note: original-tree paths below describe the historical import source at the recorded base. That tree is now retired; current runtime uses this demo and public root packages.

Phase 6e-7, base `5bbb130`. The source `desktop-clients/apps/desktop` (about 620 lines of TypeScript plus `src-tauri/`) is a read-only reference and is unchanged. [App guide](README.md), [feature contract](../../docs/features/desktop-demo.md), [delivery record](../../docs/releases/unreleased/restructure-phase-6e-7-2026-10-24.md).

| Original responsibility | Destination and treatment |
| --- | --- |
| `package.json` (`desktop`, port 3101, `@pepbits/erp-*`, `ops-ui`, `auth`, `platform-ports`, `workspace-core`, `ai-*`) | `@pepbits-demo/desktop`, private, port 3410; public `@pepbits/*` packages only, same React/Vite/Tauri API majors |
| `vite.config.ts` (dedupe, host, port, preview host allowlist, locale manual chunks) | Dedupe, strict port 3410, `src-tauri` watch exclusion, optional `/api` proxy from `DESKTOP_API_URL`; the production host allowlist and product locale chunks are not carried (no deployment, no bundled catalogs) |
| `index.html` (Google Fonts links) | Local `@fontsource` packages imported in `globals.css`, like the other demos; no external font origin |
| `globals.css` (`reference-*` styles, `ops-ui`/`erp-*` sources) | Tokens, fonts and Tailwind sources for the public packages only |
| `main.tsx` session gate, `SessionSplash`/`LoginScreen` | `ApplicationProviders` session → preference → catalog → shell chain and shared `LoginScreen` |
| `ApplicationProductProvider` (navigation/localization/preferences from the API) | `ApplicationProviders`: `/preferences` snapshot with policy and one serialized writer, `/localization` runtime catalog; navigation is the desktop's own `defineProduct` catalogue |
| `Workspace`: workspace policy from `openRecordsInTabs`, tabs, split, MDI taskbar, detach action, discard confirmation | Shell `ApplicationWorkspaceFrame` (new, opt-in via `workspace`) composing `createWorkspace`, `useWorkspaceNavigation`, `WorkspaceShell`; `defaultWorkspacePolicy` keeps the original modes, detach and three warm documents |
| `useDetachedWindows` | Retained inside `WorkspaceShell` (shell package) |
| `DetachedWindow` (document key, foreign-tenant AccessDenied, malformed-key ErrorState, local navigation) | Shell `ApplicationWorkspaceFrame` detached mode; the key comes from `detachedDocumentKey()` |
| `platform/tauri-windows.ts` and its three tests | `src/platform/tauri-windows.ts` (import changed to `@pepbits/platform/windows`); all three original cases retained with non-null index assertions for strict TypeScript, plus three added cases |
| `PageRenderer` from `erp-screens` and the `NEXORA_PRODUCT` catalogue | `@pepbits/page-engines/renderer` registry with desktop-owned pages (overview, customer/employee records, library examples, preferences, not-found). Product catalogues belong to their own demos/products and are not imported |
| `AiSourcesProvider` + `AssistantPanel` (always mounted) | `AiShellExtension` only when `VITE_AI_ENABLED=true`; explicit use cases and field classification |
| `GlobalLayers` | Mounted by `EnterpriseShell` (`ShellLayers`) |
| `src-tauri/` (Rust host, Sentinel marker commands, capabilities, icons, `detach-smoke` example, `Cargo.lock`) | Copied byte-for-byte except `tauri.conf.json` product name, identifier, window title and `devUrl` (3410). Not built or run in this phase |
| `scripts/stamp-api.mjs` (writes `dist/BUILD_API`) | Not carried: it lives under `desktop-clients/scripts` and records a deployment's API; this demo is not deployed. `VITE_API_URL` remains build-time configuration |

## Product screens the original hosted

`products/active.ts` selected `NEXORA_PRODUCT`: Finance, HR, Payroll, Sales, Supply chain, Healthcare, Pharmacy and Library modules plus the reference modules (Healthcare Suite, LIS/RIS, RCM, Teleconsult, Quality, SurgiSuite, MedBand, MedSlot, ERP1/ERP2/Keystone, School, Reports, Tenant Admin), rendered by `erp-screens`. Those screens are ported to the healthcare, ERP and later demos. The desktop demo shows its own screens built from public engines over the same generic API routes the original Finance/HR worklists used (`/worklists/search`, `/records`), and documents how a product plugs in its catalogue, renderers and adapters without changing the host.

## Deferred

Native Tauri build/run and native child-window verification; native Sentinel panic forwarding (`sentinel_pending_failure`/`sentinel-native-error` remain in Rust, but the shared host has no shell monitoring configuration yet); the original product catalogues; durable record drafts beyond the API record store's own draft endpoint.
