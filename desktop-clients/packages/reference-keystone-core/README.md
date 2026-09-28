# @pepbits/reference-keystone-core

Shared layer for the Keystone reference frontends (`@pepbits/reference-erp1`, `@pepbits/reference-erp2`). It owns everything the two source families had in common so neither variant keeps a copy (CMP-03). It holds **no page registry** and never imports a variant; each ERP module passes its own pages, sections, templates and `records` flag through `KeystoneVariantProvider`.

## What it provides (public exports only)

- **Primitives:** `components/ui.tsx` adapters over `@pepbits/ops-ui` with the source prop API. This covers Button, IconButton, Input, Date/Time/Month/DateTime inputs, Select (option children bridged), Textarea, Checkbox, Switch, Badge, Avatar, Drawer (follows `previewMode`), Modal, Tabs, Segmented, Skeleton, Empty, ErrorNote, Panel, `PrintTable` (shared Table with presentation preferences cleared), `LocalAttachments` (FilePicker, in memory only) and the toast queue (monotonic ids).
- **Engines:** `RecordForm`/`FieldInput`, `LinesEditor`/`lineTotals`/`blankLine`, the `WorkList` engine, the template frame parts `Frame`/`Card`/`Stat`, and `KeystoneInvoice`.
  - ERP1 (`records: false`) keeps the source callback and dialog behaviour.
  - ERP2 (`records: true`) adds default row → record navigation, New → create page, new-tab via the host, previous/next record memory and the column reset.
- **Renderers:** Ledger, Matrix, Settings, Dashboard and Report templates, plus the shared page shells `KeystoneRegistryPage`, `KeystoneLoginPage` and `KeystoneNotFound`.
- **Data boundaries:** `ReadyPage`, `CompanyGate`, `RecordActivity` and `RecordDocuments`.
- **Hooks:** `useEntityApi`, `useFetch`, `useScopedResource`, `usePageDefinition`, `useEntitySupport`, `useCompanyProfile`, `useProcessRunner` + `playProcessEvents`, `useStoredState` (optional account persistence), `useManagedPreference`, `useFormat`, `useExport`, `useAuth`, and the navigation hooks.
- **Helpers:** registry helpers (`pagePath`, `recordPath`, `newPath`, `nounOf`, `primaryField`, `listFields`, `defaultHidden`, `approverAt`, `findPageIn`, `ownerDefIn`), route matching (`matchReferencePath(path, { records, pages })`, `buildRouteManifest(pages)`) and `styles.css`, scoped to `.reference-keystone`.

## API contracts (all through `host.request`)

| Endpoint | Used for | Failure behaviour |
| --- | --- | --- |
| `GET /api/lookups?entity=<entity>&page=<section>/<slug>` → `{fields, lines, params?, sections?, resources?, balances?, approvers?}` | Hydrates every field marked `lookupKind` (`options` / `pool`), including line, param and settings-section fields, plus booking resources, leave/expense balances and request approvers. | `ReadyPage` shows the shared skeleton, then a retryable error. It never renders stand-in lists; missing/non-string arrays for marked fields are errors, while server-provided empty arrays are valid. |
| `GET /api/entities/:entity/:id/support` → `{activities, documents, processEvents?}` | Profile/document activity timelines, profile/inbox stored documents and historical process events. | Skeleton, retryable error, honest empty state. |
| `GET /api/company-profile` → `{company, address, taxId, email, bank, account, ifsc, swift, paymentTerms, invoiceTerms}` | Invoice header, bank details, terms and signatory; sign-in company label. | Print waits (the print button is disabled) and shows a retryable error. The sign-in page shows no company name until it loads. |
| `POST /api/processes/:entity/run` (body = run parameters) → `{row, events}` | Payroll and depreciation runs. The server computes values and creates the row; the UI only plays back the returned events and log. | The failure is logged in the run log with a toast; parameters are kept. |
| `GET /api/view-state?key=…` / `PUT /api/view-state {key,value}` | `keystone.cols.<slug>` is persisted only when `columnLayoutScope === 'account'`. `keystone.views.<slug>` and `keystone.mode.<slug>` are persisted only when `rememberFilters` is on. | Values are kept locally; the status and retry are shown in the column/view/layout controls. |
| `/api/dashboard`, `/api/entities/:entity[/:id]`, `/api/auth/login` | Source contract, unchanged. | — |

- **Scope isolation:** all caches (lookups, support, company, reference dropdowns, view state) live in a store keyed by `referenceScopeKey(scope)`, including `moduleId`. The ERP modules force `moduleId` to `reference-erp1` or `reference-erp2` and remount their subtree on that key. The server derives authority and the view-state namespace from authenticated host metadata; the client sends no scope query.
- **View-state writes:** there is no PUT on mount. A late GET never overwrites a user change, and PUTs are serialized per key with a generation guard.

## Checks run (28 Sep 2026, Node 24.21.0, from `desktop-clients`, against this working tree)

- `node node_modules/typescript/bin/tsc -p packages/reference-keystone-core --noEmit`: no errors, using normal workspace resolution.
- `npx vitest run` over this package and both variants: 3 files, 38 tests passed. This package's 20 cover the API contract, cache isolation, `useFetch`, managed preferences, export, formatting, option/class bridges, lookup hydration, `ReadyPage` error/retry, view state (delayed GET, no initial PUT, save failure/retry, tenant/variant isolation, StrictMode cancellation) and process run playback.
- `node scripts/verify-form-controls.mjs`: passed.
- `node scripts/verify-shared-components.mjs` (includes this package): passed.

**Browser checks:** Chromium against the isolated Vite shell (`127.0.0.1:4322`) and dummy API (`127.0.0.1:4320`): customer creation/editing in both variants, ERP1 inline invoice saving, ERP2 routed invoice saving and print preview, ERP2 record/edit/cancel/back-link/middle-click navigation. Mutations returned HTTP 200 and temporary test records were deleted. Print paper stayed white with dark ink in the midnight theme. These are representative development-runtime checks, not native, deployed or exhaustive business-flow acceptance. Browser evidence: `/tmp/erp-browser-links/result.json`, `/tmp/erp-browser-docs/result.json`, `/tmp/erp-browser-workflows/result.json` (the first workflow run ended on a selector mismatch after successful customer checks; later focused runs completed; customer cleanup confirmed in `/tmp/erp-browser-cleanup.json`).

**Not verified here:** production builds, native Tauri execution, deployment and native-speaker wording acceptance. Full navigation sweep and host-global visual review belong to integration verification.

## Specialized markup (CMP-04)

The following keep their source markup because they express behaviour no shared primitive covers: Popover/MenuItem, Stepper, Progress, Spinner, Kbd, matrix cell inputs, chart bars, interactive worklist row cards (inside the shared CardGrid), and print layouts. They use semantic tokens and native focusable elements.

## Presentation preferences

All source numeric font classes apply the effective host scale. Field grids and control fonts use `fontSizeForm`; result tables, cards, dashboard and record statistics use `fontSizeResult`; other page copy uses `fontSizeBase`. Standard rectangular radii and numeric icon-control radii use the host radius, while avatar/status circles retain their geometry. Loading boundaries honor `loadingSkeletons` and show accessible loading text when skeletons are disabled. Smooth scroll uses `reducedMotion`; CSS motion is scoped by the host. Presentation copy uses the shared localization layer, including metadata headings, labels, named-value messages and toasts. Option parsing reads the original English `LocalizedText.message` so localized labels never change service values.

## Source preservation and import boundary

Read-only origins: `/home/pepadmin/pb/saas/reference/frontend/erp1/keystone-erp` and `/home/pepadmin/pb/saas/reference/frontend/erp2/keystone-erp`. Each variant retains 57 definitions and 20 template keys. Variant tests verify page/field identity hashes against those source catalogs after removing server-owned generation data. Five common template renderers and all shared forms, list controls, hooks, printing and primitives are implemented once here; variant-specific dialog and routed record behavior stays in the two ERP packages. Runtime exports import neither source directories nor server/fixture/mock files, filesystem modules or test helpers.

The independent full-schema comparison against both read-only source registries matches normalized SHA-256 `53a7c793a64f1a25b76b092bfefbdb18158ab3f335a51a9c49dcfe22ea6458cc`. Normalization excludes server-owned generation keys and lookup markers/non-status value lists; it retains icons, descriptions, checks, matrix configuration and every remaining field flag. Runtime code counts are core 33, ERP1 18 and ERP2 27; the only byte-identical variant code is the template registration index.

Invoice previews retain a white paper palette inside the host theme so dark mode does not make printed content illegible. The invoice amount-in-words formatter retains the source English number spelling; its currency unit uses the effective currency code. API business/legal text is displayed as supplied by the service.
