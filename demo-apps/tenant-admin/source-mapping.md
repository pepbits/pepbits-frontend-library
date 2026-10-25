# Tenant Admin source mapping

Phase 6e-2, base `5bbb13027d137ac31594ca9a1a3d47aac46653c9`. The original `desktop-clients/packages/reference-tenant-admin` (last changed in `22a994c14523aa8ff2c0dc2f214257f2157a1c24`) is a read-only reference; nothing under `desktop-clients/` or `mock-api/` is edited or imported. [App guide](README.md), [feature contract](../../docs/features/tenant-admin-demo.md) and [delivery record](../../docs/releases/unreleased/restructure-phase-6e-2-2026-10-24.md) state verification and limits.

| Original | Destination and treatment |
| --- | --- |
| `src/module.tsx` (`ReferenceTenantAdminModule`) | `src/modules/tenant-admin/module.tsx`, unchanged structure; mounted by `page.tsx`, which builds the host from the public session, preferences, request and navigation ports |
| `src/routes.ts` (static/dynamic routes, deep links, registry navigation) | `src/modules/tenant-admin/routes.ts` unchanged; `src/navigation.ts` maps app addresses onto it and builds the shell product from the API registry |
| `@pepbits/reference-host` (host contract, scope key, link, format, path hooks) | Public `@pepbits/shell/reference-host` (new, generic); four identical healthcare module host copies now re-export it |
| `src/lib/api.ts` (client, idempotency, scope-keyed store) | Same file; the host transport is `src/adapters/tenant-admin.ts` over the configured `@pepbits/platform/http` request |
| `src/lib/{format,hooks,navigation,types,icons}.ts(x)` | Same files on public exports; shortcuts listen in the capture phase so module bindings win over the shell's palette shortcut; `iconFor` added for registry navigation icons |
| `src/lib/cx.ts` (`clsx`) | Dependency-free string join with the same call sites |
| `components/shell/{TenantAdminShell,CommandPalette,context}` | Same files; the module body is a `div` (the shell already owns the `main` landmark) |
| `components/{overview,approvals,activity}` | Same files, imports moved to public packages |
| `components/resource/{ResourceWorkspace,RecordDrawer,RouteTester,LifecycleTrack,cells}` | Same files; field labels carry ids so the custom combobox is named by its visible label |
| `components/form/{FieldInput,LinesEditor,TagInput,useRefOptions}` | Same files; compact line-cell editors carry their column label as accessible name |
| `components/ui/{controls,dialog,ConfirmDialog,ReasonDialog,Toast,Switch,Combobox,StatusPill,Avatar}` | Source* controls from `@pepbits/ui`; Card/Table/Drawer/Modal from `@pepbits/components`; toast reads the effective preferences |
| `lucide-react` icons | `@pepbits/icons`; 18 missing primitives added there |
| `src/styles.css` (generated, scoped `.reference-tenant-admin`) | Byte-identical copy, SHA-256 `2ee7fe105248de100fdcbdb09bcd5922fba66b2e3b781637222a48baabbfb4c3`; host corrections go in `overrides.css` |
| `tenant-admin-copy.json`, `definitions-copy.json` (English → catalog key aliases) | Byte-identical copies, SHA-256 `ee2dab5c…fbe93` and `8137888c…e634`; every key resolves in the unchanged `en/ar/hi/ml` catalogs |
| `scripts/tenant-admin/{styles,copy,scan}.mjs` (generators/checks in the desktop workspace) | Not copied; frozen provenance hashes and catalog-coverage tests replace the "is current" generator checks |
| Host navigation ids `reference-tenant-admin-*` and catalog keys | Used as label/title keys for the sidebar and header when the canonical key exists |

## Tests

All five original test files are ported with their assertions: `routes.test.ts` (6), `api.test.ts` (14), `module.test.tsx` (23), `styles.test.ts` (8; the generator comparison becomes a SHA-256 provenance check) and `copy.test.ts` (5; the generator check becomes a provenance check plus a four-catalog coverage check). The fake host transport (`test-utils.tsx`) is unchanged apart from rendering inside the canonical English catalog, so the shared drawer's Close button resolves its catalog ID as it does in the app.

New app tests cover the HTTP adapter, address/navigation round trips, the registry-driven sidebar, the shared preference path, the preferences route and a route matrix: 36 routes (three workspace pages, 30 configuration pages, `?new=1`, `?open=<id>` and not-found) under default, Arabic RTL, reduced motion and locked density with jsdom axe. Their fixtures (`src/test/api.json`) are real responses of the unchanged demo API captured by `scripts/smoke.mjs` before any workflow wrote data.

## Behaviour retained and changed

Retained: registry-driven pages, governed lifecycle (draft → submit → approve/return → retire/new version; activate/deactivate for simple pages), independent approval explained before the server refuses, idempotent writes and lost-outcome retry, field errors with preserved values, stale-version reload, discard/unsaved confirmations, route tester, palette with New entries, history/revisions, 20-second pending poll, effective formats/page size/toasts/shortcuts.

Changed: the host is the shared Pepbits shell rather than the desktop reference host; the sidebar comes from the registry through the shell product; the drawer uses the shared Drawer title bar and width; accessibility corrections above. No exact source pixel comparison is claimed.
