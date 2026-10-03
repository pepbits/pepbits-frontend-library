# RCM reference module

`@pepbits/reference-rcm` renders the Allyvora RCM workspace SOURCE frontend (`reference/frontend/rcm-app/workspace-app/web`, read only) through the authenticated host: billing home, aging, reports, the approvals inbox and the 36 registry worklists (queue, ledger, board and live-monitor layouts).

- Export `ReferenceRcmModule({ path, host })`; also `rcmRoutes` (`/ /aging /reports /approvals`), `rcmDynamicRoutes` (`/w/[resource]`), `resolveRcmRoute`, `rcmPaths` (deep links: `?new=1`, `?open=<id>|first`, `?status=A,B`, `?q=`, `?overdue=1`), `rcmNavigation(meta)` (host navigation from the backend registry), `safeRcmHref`, `createRcmClient`, `./styles.css`, `./rcm-copy.json`.
- The 40 pages are not listed in the frontend: `GET /meta` returns `categories[].pages` and `resources`, and one renderer (`ResourcePage` + `DetailPane` + `CreatePanel`) draws every worklist.
- The host owns the enterprise header and sidebar. The module renders the page body, a compact toolbar (page icon and title, "Jump anywhere", the source scope filter, Approvals with its count, the signed-in user) and the status strip (source footer). No source rail, user menu or demo sign-in.

## Backend contract

Calls go through `host.request` with module-relative paths (the source paths without `/api`); the host adds `/api`, the `/reference-modules/rcm` namespace, credentials and its scope headers. The module never builds an `/api` URL, stores a token or calls `fetch`.

- `GET /meta` -> `{ tenant, branches, categories, resources, users, currentUser, hostManagedIdentity, demo? }`. Without `currentUser`, or with `hostManagedIdentity: false`, nothing is shown. No actor header, no `localStorage` actor, no switcher.
- `GET /pending` (polled every 20 s), `/dashboard/home|aging|reports`, `/approvals`, `/options/<source>?q=`, `GET|POST /records/<resource>`, `GET|PUT /records/<resource>/<id>`, `POST /records/<resource>/<id>/actions/<action>`.
- Scope filter: `x-rcm-scope: ALL:<currency>|<branch>` on every call after `/meta`. It narrows the result inside the branches the host authorized and is never authority.
- Writes carry `Idempotency-Key`; a write whose outcome was lost (network, 408, 502-504, abort) is retried under the same key. Errors keep the source shape `{ error: { code, message, fieldErrors } }`.

## Presentation and preferences

- Source controls become `SourceButton/Input/Select/Textarea/DateInput` with the source's `btn-*`/`input`/`panel` classes, shared `Table` family with the source's worklist presentation, shared `Drawer` ("New ...") and `Modal` (action/reason dialogs). The command palette keeps a native `<dialog>`.
- Default look is the original: palette, **Public Sans / Bricolage Grotesque** families (no font files are shipped; the stack names are the original's), sizes, radii and control geometry, which the generated styles protect from the host's global `.library-preferences` utilities with a doubled scope class and from the host's `!important` managed-table cell rules by handing the source cell geometry back while density/wrapping are at their defaults. The host font applies only for a non-default font preference (`data-rcm-font="host"`). Dark host themes route only the neutrals through host tokens; brand and tone colours never change.
- Dates, times, numbers, amounts and relative times use the host formats (amounts keep at least two decimals). The list page size is the host's managed page size. Density, wrapping, sticky header and stripes come from the managed `Table`. Shortcuts (Ctrl/Cmd+K, ↑↓/j/k, N, /, Esc) are bound only while the host's shortcut preference is on.
- Styles: `node scripts/rcm/styles.mjs [--check]`. Copy: `node scripts/rcm/copy.mjs [--check]` writes `rcm-copy.json` for the root to merge. Review aid: `node scripts/rcm/scan.mjs`.

## Browser parity

`RCM_BROWSER_PARITY=1 FONTCONFIG_FILE=… LD_LIBRARY_PATH=… PLAYWRIGHT_BROWSERS_PATH=… npx vitest run packages/reference-rcm/src/browser-parity.test.ts` (or `node scripts/rcm/parity/run.mjs`) mounts the real module over the host stylesheet in Chromium and compares every classed element (pages, open dialogs/drawers/menus/palette/combobox, hover/focus) with the original Tailwind 3 + globals, with no exception list; plus theme, radius, scale, font opt-in and table preference checks.

## Checks

`npx vitest run packages/reference-rcm`, `npx tsc -p packages/reference-rcm --noEmit`, `node scripts/rcm/styles.mjs --check`, `node scripts/rcm/copy.mjs --check`, `node scripts/rcm/scan.mjs`.

## Limits

Tests use a fake host transport and jsdom, not a browser or a deployed backend. Arabic mirroring, long Hindi/Malayalam strings and the visual match against the source are unchecked in a browser; catalog presence is not native-speaker review.
