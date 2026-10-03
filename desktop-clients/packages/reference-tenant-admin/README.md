# Tenant Admin reference module

`@pepbits/reference-tenant-admin` renders the Allyvora Tenant Admin SOURCE frontend (`reference/frontend/tenant-admin/tenant-admin/web`, read only) through the authenticated host (variant `tenant-admin`, host navigation id `reference-tenant-admin`).

- Export `ReferenceTenantAdminModule({ path, host })`; also `tenantAdminRoutes` (the three static routes `/ /approvals /activity`), `tenantAdminDynamicRoutes` (`/config/[resource]`), `resolveTenantAdminRoute`, `tenantAdminPaths` (deep links: `?new=1`, `?open=<id>`; `?id=<id>` is read too), `tenantAdminNavigation(meta)` (host navigation derived from the backend registry), `createTenantAdminClient`, `./styles.css`, `./tenant-admin-copy.json`.
- The 30 configuration pages are not listed in the frontend: `GET /meta` returns the registry (`categories`, `resources`, each with its field definitions) and one renderer (`ResourceWorkspace` + `RecordDrawer`) draws every page.
- The host owns the enterprise header and sidebar. The module renders the page body, a compact toolbar (page title, "Jump to a page", tenant block, Approvals with its pending count) and a status strip. No source AppShell, rail, user menu or demo sign-in.

## Backend contract

All calls go through `host.request` with module-relative paths; the host adds `/api`, the namespace `/reference-modules/tenant-admin`, credentials and scope headers. The module never builds an `/api` URL, stores a token or calls `fetch`.

- `GET /meta` -> `{ tenant, legalEntities, branches, currencies, categories, resources, users, currentUser, hostManagedIdentity, demo }`. `currentUser` is the signed-in host user; `users` is only the directory history, approval and audit rows refer to. Without `currentUser`, or with `hostManagedIdentity: false`, nothing is shown. There is no actor header, no `localStorage` actor and no switcher.
- `GET /pending` (polled every 20 s), `/overview`, `/approvals`, `/audit?...`, `POST /tools/route-test`, `GET|POST /resources/<key>`, `GET /resources/<key>/options`, `GET|PUT|DELETE /resources/<key>/<id>`, `POST /resources/<key>/<id>/<action>`.
- Writes carry `Idempotency-Key`; a write whose outcome was lost (network, 408, 502-504, abort) is retried under the same key. Errors keep the source shape `{ error: { code, message, fieldErrors } }` (`STALE_VERSION`, `VALIDATION`, ...).
- Reads live in a scope-keyed data store (`src/lib/api.ts`): the module is keyed by `referenceScopeKey(host.scope)`, requests abort on unmount and scope change, late answers are discarded, mutations refresh every mounted read. The source's module-level option cache is replaced by this store, so another tenant, branch or user never sees it.

## Presentation and preferences

- Source controls become `SourceButton/Input/Select/Textarea/DateInput`, shared `Table`/`TableContainer`, `Card`/`CardGrid`; the drawer, reason dialog and discard/unsaved confirmations use the shared `Drawer`/`Modal` (bodies and footers carry the module scope class and theme). The command palette keeps a native `<dialog>` on purpose.
- Dates, times, numbers and relative times use the host's effective formats. The list page size is the host's managed table page size (the source's fixed 25 is gone; there is no page-size control to disable). Density, stripes, sticky header and wrapping come from the managed `Table`.
- Ctrl/Cmd+K (palette) and Ctrl/Cmd+S (save, only while the form is editable and nothing else is open or running) are bound only while the host's keyboard-shortcut preference is on.
- Styles: `node scripts/tenant-admin/styles.mjs [--check]` compiles the source Tailwind 3 config and stylesheet; every selector is under `.reference-tenant-admin`, preflight is zero-specificity, keyframes are `tenant-admin-*`, fonts/radii/scales follow host tokens, the source neutrals follow host tokens under dark themes. Copy: `node scripts/tenant-admin/copy.mjs [--check]` writes `tenant-admin-copy.json` (English text -> `ui.reference.tenantadmin.copy.*` key) for the root to merge.

## Checks

`npx vitest run packages/reference-tenant-admin`, `npx tsc -p packages/reference-tenant-admin --noEmit`, `node scripts/tenant-admin/styles.mjs --check`, `node scripts/tenant-admin/copy.mjs --check`, `node scripts/tenant-admin/scan.mjs`.

## Limits

Tests use a fake host transport, not a browser or a deployed backend. Physical left/right utilities are kept (Arabic gets `dir="rtl"` from the host; layouts are not mirrored); long Hindi/Malayalam strings are unchecked; catalog presence is not native-speaker review. The record drawer uses the shared Drawer width, so the form is one column unless the drawer is wide enough; the shared drawer's title bar replaces the source drawer's header (code, status and the lifecycle track sit at the top of the body).
