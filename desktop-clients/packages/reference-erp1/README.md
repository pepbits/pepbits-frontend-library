# @pepbits/reference-erp1

The Keystone **ERP1** reference frontend as a hosted React module. It is built on `@pepbits/reference-keystone-core`, which holds the shared primitives, hooks, forms, WorkList engine, common templates and page shells. The source is the read-only `reference/frontend/erp1/keystone-erp`.

## Public API

```ts
import { ReferenceErp1Module, referenceErp1Routes, referenceErp1Pages } from '@pepbits/reference-erp1';
// host imports once: '@pepbits/reference-host/styles.css' then '@pepbits/reference-keystone-core/styles.css'
<ReferenceErp1Module path="/masters/customers?q=acme" host={host} />
```

- **`ReferenceErp1Module({ path, host })`:** forces `scope.moduleId = 'reference-erp1'` and keys its subtree by `referenceScopeKey`. It supplies the variant (`records: false`, pages, sections, templates) through `KeystoneVariantProvider`, and renders page content only: no AppShell/Header/Sidebar, iframe or HTML injection.
- **`referenceErp1Routes`:** 59 entries: `/`, `/login` and 57 pages.
- **Other exports:** `referenceErp1Pages`, `referenceErp1Sections` and `referenceErp1Templates` (20 keys), plus type and helper re-exports for API fixtures (`referenceErp1LookupsUrl`, `hydrateReferenceErp1PageDef`, …).

## Routes

`/login`, `/`, `/[section]/[slug]` and not-found (4 source page routes). ERP1 has no record routes, so rows and New use the source dialogs and drawers.

## Page registry and data ownership

`lib/registry.ts` keeps all 57 source page definitions: titles, sections, groups, icons, templates, entities, field keys, labels, types, layout, required flags, references, status flows, steps, checks and matrix configuration. It was sanitized from the source with a TypeScript AST transform:

- **Removed:**
  - fixture seeds, counts, tree data, booking resources, balances and code prefixes
  - generator ranges (`min`, `max`, `past`, `future`)
  - the `lib/mock/pools.ts` import and file
  - every non-status `options`/`pool` value list: 131 fields, now marked `lookupKind`
- **Still identical to the source:** page and field identity, checked by SHA-256 digests in the tests.
- **Hydrated at runtime:**
  - `GET /api/lookups` fills the value lists, resources, balances and request approvers.
  - `GET /api/entities/:entity/:id/support` provides profile activity, documents and historical process events.
  - `GET /api/company-profile` provides invoice identity, bank details and terms, plus the sign-in company label.
  - `POST /api/processes/:entity/run` computes process runs; the UI only plays back the returned events.
- **Branding:** the product name (Keystone) and version remain in the client.

The client bundle contains no fictional business records, company identity, bank details, people or product names. The full API contract, failure behaviour and preference rules are in the core README.

## Variant-owned code

Variant-specific templates (Grid/Rate with inline edit, Booking, Case, Checklist, Dependent, Document, Inbox, Print, Process, Profile, Request, Structure, Tree). They compose core renderers and hooks and import only `@pepbits/reference-keystone-core`'s public exports.

## Preferences

The preference behaviour is shared through core. Worklists use the managed result view, density and page size (disabled when locked or when there is no central update path), and the host formatter and export format. Custom key listeners follow `keyboardShortcuts`. Drawers follow `previewMode`. Column layout persists when `columnLayoutScope === 'account'`; saved views and layout mode persist when `rememberFilters` is on.

## Checks run (28 Sep 2026, Node 24.21.0, from `desktop-clients`)

- `node node_modules/typescript/bin/tsc -p packages/reference-erp1 --noEmit`: no errors, using normal workspace resolution.
- `npx vitest run` (core + both variants): 38 tests passed. This package's 9 cover the 57-page identity digests, 20 template keys, no bundled fixture data, the manifest, route matching, lookups requested before render, and a scope switch that drops drafts and ignores the old tenant's pending response.
- `verify-form-controls.mjs` and `verify-shared-components.mjs`: passed.

**Browser checks:** Chromium against the isolated Vite shell (`127.0.0.1:4322`) and dummy API (`127.0.0.1:4320`): customer creation/editing in both variants, ERP1 inline invoice saving, ERP2 routed invoice saving and print preview, ERP2 record/edit/cancel/back-link/middle-click navigation. Mutations returned HTTP 200 and temporary test records were deleted. Print paper stayed white with dark ink in the midnight theme. These are representative development-runtime checks, not native, deployed or exhaustive business-flow acceptance. Browser evidence: `/tmp/erp-browser-links/result.json`, `/tmp/erp-browser-docs/result.json`, `/tmp/erp-browser-workflows/result.json` (the first workflow run ended on a selector mismatch after successful customer checks; later focused runs completed; customer cleanup confirmed in `/tmp/erp-browser-cleanup.json`).

**Not verified here:** production builds, native Tauri execution, deployment and native-speaker wording acceptance. Full navigation sweep and host-global visual review belong to integration verification.

**Known limitations:**
- Attachments picked by the user are listed in memory only; nothing is uploaded.
- `inline` preview mode uses the right drawer.
- Drawer `xl` maps to the shared `lg` width, and Modal widths snap to the shared sizes.
- Specialized calendar, kanban, tree, matrix and print layouts keep source markup (CMP-04).

Presentation copy uses shared localization; font categories, effective radius, reduced motion and loading skeleton preferences are inherited through core. Source layouts, schema identity and service values remain intact. No source fixture or data generator is imported into the client runtime.
