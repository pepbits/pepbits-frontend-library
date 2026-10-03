# Pharmacy-1 reference module

`@pepbits/reference-pharmacy` renders the Phial pharmacy SOURCE frontend (`reference/frontend/pharmacy-1/phial/frontend/src`, read only) through the authenticated host as the **Pharmacy-1** module (variant `pharmacy`).

- Export `ReferencePharmacyModule({ path, host })`; also `pharmacyRoutes` (the 13 original static routes: `/ /workbench /counter /orders /sales /inventory /purchasing /authorizations /claims /remittance /patients /audit /settings`), `pharmacyNavigation` (the 13 destinations: the 12 source sidebar items in the source's four groups, plus Settings, the source's footer entry, in a Configuration section), `pharmacyPaths` (deep links with the query parameters the pages read: open Rx `?rx=`, `?stage=`, `?claim=`, `?po=`, `?ra=`, `?id=`, `?product=`, `?tab=`, `?status=`...), `resolvePharmacyRoute`, `createPharmacyClient`, `planThemeToggle`, `./styles.css`, `./pharmacy-copy.json`.
- The host owns the enterprise header and sidebar. The module renders only the page body plus a toolbar with the parts of the source top bar that belong to the page (command palette entry, **New prescription**) and a "Demonstration data" notice. No source AppShell, sidebar, top bar, user menu or sign-in.
- Pages are the real source views (`src/components/views/*`, `src/components/rx/*`, `src/components/ui/*`), ported with the same layouts, classes, icons, shortcuts and endpoints.

## Backend contract

All calls go through `host.request` with module-relative paths (`/meta`, `/dashboard`, `/prescriptions?stage=intake`, ...). The host adds `/api`, the namespace `/reference-modules/pharmacy`, credentials and scope headers; the module never builds an `/api` URL, stores a token or calls `fetch`.

- **Identity** is the host session: `GET /meta` returns `{ settings, users, payers, doctors, currentUser }`. `currentUser` is the signed-in user; `users` holds that user plus the trusted source actor directory rows that history and ledger rows refer to. `ShellContext.user` is `currentUser`; `setUserId` is kept for source call sites and **cannot** change who acts. There is no user switcher and no `x-user` header.
- **Mutations** (POST/PATCH) carry `Idempotency-Key` (`crypto.randomUUID()` per call). Pass `operationKey` to `api.post/patch(path, body, { operationKey })` (or use the one `useAction().run` hands each attempt) to reuse a key for an explicit retry of the same operation.
- **Errors** keep the source's nested shape: `{ error: { code, message, details } }` becomes `ApiError(status, code, message, details)`; transport failures are `ApiError(0, "network", ...)`.
- **Request lifecycle**: SWR is replaced by `useApi()` over a scope-keyed `DataStore` (`src/lib/api.ts`). One store lives inside one authenticated scope (the host remounts the module on a tenant/branch/user/role change, and the module keys the store by `referenceScopeKey(host.scope)` as well), reads abort on unmount and when no component listens any more, a response that lost a race is discarded, fresh results are deduplicated for 1.5 s, and `refreshAll()` refetches every mounted key after a mutation. Nothing is cached at module level, so nothing can leak between tenants, branches or users.
- Every list, count and figure comes from the server. The package holds no business fixtures or client mocks (tests use fictional fixtures and an in-memory host).

## Presentation and preferences

- Controls: `SourceButton/Input/Select/Textarea/DateInput` and the shared `Table` family and `Card` (via `src/components/ui/controls.tsx`), `Dialog` on the shared `Modal`/`Drawer` (bodies and footers carry the module scope class and theme so scoped utilities reach them), `PrintDocument` for the receipt. The source primitives keep their exported names and prop signatures (`Button`, `IconButton`, `Segmented`, `Panel`, `Th`, `Td`, ...) and class strings. The command palette keeps a native `<dialog>` on purpose (combobox/listbox overlay without dialog chrome).
- Formatting (`usePharmacyFormat`): dates, times, numbers, percentages, amounts and relative times follow the host's effective preferences (date/time format, number locale, language, decimals, currency display, negative style). **The currency code is the pharmacy's `settings.currency` from the server**; everything else about money is the host's. The source's fixed en-US/en-GB/AED are gone. Record values (names, codes, notes, batch numbers) are never transformed.
- Theme: the host preference. Settings > Appearance and `toggleTheme` go through `host.preferenceHost.onPreferenceChange("theme", ...)`, are disabled when the tenant policy locks the theme (or restricts it so no theme of the other polarity is allowed) or the host cannot save preferences (`planThemeToggle`). The source's `localStorage`/`document.documentElement` theme handling is gone. Dark host themes (midnight, graphite, plum, nord) get the source's dark status palette.
- Font family, the three type scales, corner radius, density/zebra/sticky tables, table page size (Audit paging step), toast position/duration/count, reduced motion, direction and keyboard-shortcut enablement all come from the host (`usePageSize`, `useHotkeys`, `ToastProvider`, the scoped CSS).
- Hotkeys (`Ctrl/Cmd+K`, `/`, `N`, workbench `J K 1-6 F`, `Ctrl/Cmd+Enter`, counter `F2`) are bound only while the host's keyboard-shortcut preference is on.
- Page height: the source pages are full-viewport panes. The module gives them a definite-height stage (`max(36rem, 100dvh - var(--pharmacy-chrome, 7.5rem))`); a host with a taller header can set `--pharmacy-chrome`.

## Styles and copy

- `src/styles.css` is generated: `node scripts/pharmacy/styles.mjs [--check]` (Node 24; Tailwind 4 from the repository; `scripts/pharmacy/source-design/globals.css` is the byte-exact source design). Every selector is under `.reference-pharmacy` / `:where(.reference-pharmacy)`; layers flattened, `@property`, `@page` and the source's document-wide `@media print` block removed (printing is the shared `PrintDocument`), keyframes `pharmacy-*`, fonts/scales/radii follow host tokens. The source `:root` palette is re-expressed (canvas, lines, ink and the action colour follow host tokens with the source hex as fallback; host-owned `--surface*`/`--danger` are never redefined; the source's dark values apply under dark host themes).
- All presentation copy goes through `LocalizedText` / `t()` / the controls. `pharmacy-copy.json` (`node scripts/pharmacy/copy.mjs [--check]`) maps each English literal to `ui.reference.pharmacy.copy.<words>.<hash8>` (reusing a canonical `ui.<words>.<hash8>` key when the catalog already holds the identical text) for the root to merge into the catalogs; `LocalizationAliasProvider` resolves text -> key. Until merged, `t()` returns the English text.
- Review aids: `node scripts/pharmacy/scan.mjs` (raw JSX copy, template literals in copy props, raw controls, fixed locales, direct network), `node scripts/pharmacy/fidelity.mjs` (class/icon/endpoint comparison with the source).

## Checks

`npx vitest run packages/reference-pharmacy`, `npx tsc -p packages/reference-pharmacy --noEmit`, `node scripts/pharmacy/styles.mjs --check`, `node scripts/pharmacy/copy.mjs --check`, `node scripts/pharmacy/scan.mjs`, `node scripts/verify-form-controls.mjs`.

## Limits

Physical left/right utilities are kept (Arabic gets `dir="rtl"` from the host but layouts are not mirrored); long hi/ml strings are unchecked; catalog presence is not native-speaker review. Tests use an in-memory host, not a browser or a deployed backend. The receipt prints through the host print surface at the browser's page size (the source's 80 mm `@page` is document-wide and was dropped).
