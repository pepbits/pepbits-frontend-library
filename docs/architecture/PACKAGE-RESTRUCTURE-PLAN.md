# Library restructure plan

Status: **phases 0–3 implemented; later phases remain a proposal.** Revised 22 October 2026 against `main` `e18c01d`. This plan replaces the 21 October draft (commit `3162a49`), which grouped product modules under `modules/` and kept vendored archives. See [Phase 0 status](#phase-0-status), [Phase 1 status](#phase-1-status), [Phase 2 status](#phase-2-status) and [Phase 3 status](#phase-3-status). Phases 1–3 follow the owner's copy-only decision; subsequent moves, shims, consumer migration and open questions remain future work.

## Summary

This repository becomes two things with a hard line between them:

- **`packages/`, the library.** Reusable UI, page engines, shell and platform services, with no product data or product rules. Products install these packages.
- **`demo-apps/`, the proof.** Applications built only from the public `@pepbits/*` packages and running against a mock API. They demonstrate and test the library the same way a real product would use it.

Products (Healthcare, ERP, School, Platform) keep their own screens in the `frontend/` folder of their own repositories and install versioned `@pepbits/*` packages from a private registry instead of copying archives.

## Problems this solves

| Problem | Evidence on `main` `aa90bbe` | Effect |
| --- | --- | --- |
| The library is filed under one shell | The npm workspace root is `desktop-clients/package.json` (`nexora-monorepo`) and holds both shells and all 32 packages | Consumers and new contributors cannot tell the shared library from the shells |
| Library and products mixed in one list | `desktop-clients/packages` holds 13 shared packages next to 19 `reference-*` product packages | No visible ownership; product changes touch the library |
| One package bundles every product | `erp-screens` depends on 17 `@pepbits/reference-*` packages | Every shell build carries every product |
| Product knowledge inside shared configuration | `erp-config` holds generic preferences and formatting next to clinical, pharmacy, school and RCM definitions | Shared packages change whenever a product changes |
| One primitive package does everything | `ops-ui` holds buttons and inputs next to tables, dialogs, calendars and printing | No layering; hard to version or document |
| Generic packages named after one product | `erp-config`, `erp-data`, `erp-shell` and `erp-screens` are used by every product | Names invite ERP-only assumptions |
| Demos scattered | `demo-pages/`, `source/settle`, `source/caregrid`, `source/allyvora-patients` and `dummy-api` sit at the root with their own setups | Demo material can be mistaken for library contracts |
| Consumers copy archives | Healthcare, ERP and School each vendor `.tgz` files, and one repository holds three builds of `@pepbits/ai-client` (`hc074.2`, `hc096.1`, `hc.fa36d76.1`) | Version drift and manual upgrades |

## Target layout

```
pepbits-frontend-library/
├── package.json                  npm workspace root (moved up from desktop-clients/)
├── turbo.json
├── tsconfig.base.json
├── .changeset/                   versions and changelogs for published packages
│
├── packages/                     THE LIBRARY: reusable only, published as @pepbits/*
│   ├── tokens/                   colors, typography, spacing, radius, motion, themes, fonts
│   ├── icons/
│   ├── i18n/                     host catalogs, core messages, formatters, RTL; ./react localization
│   ├── preferences/              schema, defaults, tenant-lock resolver, PreferenceHost, themes, shortcuts
│   ├── ui/                       primitives: button, input, select, search-select, checkbox, radio,
│   │                             segmented, date-time, quantity-unit-field, scanner-input, option-filter, otp,
│   │                             password, field, badge, avatar, skeleton, nav-link
│   ├── components/               table, pagination, card, card-grid, stat-card, tabs, dropdown,
│   │                             dialog, drawer, toast, calendar, stepper, empty-state, data-value,
│   │                             inline-edit, reference-data, form-error-summary,
│   │                             recovery-notice, print-document
│   ├── patterns/                 form-layout, filter-bar, record-panels, csv-import, approvals,
│   │                             drafts, wizard, label-printing, identity-devices, spreadsheet,
│   │                             form-designer (DCP)
│   ├── page-engines/             core, master-record, worklist, query, order, booking, appointment,
│   │                             case-encounter, financial-transaction, billing, report, dashboard,
│   │                             workflow, scheduling, entity-360
│   ├── shell/                    app-shell, header, sidebar, footer, workspace (tabs, split, detach),
│   │                             command-palette, help, session-lock, navigation, context
│   ├── data/                     records, drafts/policy, imports, approvals, panels, structured failures
│   ├── platform/                 auth, monitoring (Sentinel), export, devices, navigation, windows
│   ├── ai/                       config, client, ui
│   └── testing/                  render helpers, a11y checks, preference fixtures (dev only)
│
├── demo-apps/                    DEMOS: built only from @pepbits/* public exports
│   ├── showcase/                 component gallery; replaces the Developer Library
│   ├── healthcare/               patients, registration, triage, consultation, billing, LIS, RIS,
│   │                             pharmacy, RCM, teleconsult, quality, surgisuite, medband, medslot
│   ├── erp/                      ERP1, ERP2, Keystone
│   ├── school/
│   ├── reports/
│   ├── tenant-admin/
│   ├── onboarding/               Orvia landing, workspace finder, sign-in, registration
│   ├── settle/
│   ├── caregrid/
│   ├── allyvora-patients/
│   └── desktop/                  Tauri wrapper that hosts a demo
│
├── mock-api/                     fake backend: routes, stores, simulators, fictional data,
│                                 canonical localization catalogs
├── tooling/                      tsconfig, eslint (boundary rules), vitest config,
│                                 verify gates, codegen, deploy scripts
├── e2e/                          browser tests against the demo apps
├── deploy/
└── docs/
```

### Inside a package

```
packages/components/
├── src/
│   ├── table/
│   │   ├── Table.tsx             implementation
│   │   ├── Table.types.ts        public props
│   │   ├── Table.css             token-based styles only
│   │   ├── parts/                header, row, cell
│   │   ├── useTable.ts           behavior, separate from markup
│   │   ├── Table.test.tsx        behavior and a11y tests
│   │   ├── Table.stories.tsx     states, density, RTL, locked preferences
│   │   └── index.ts              the only file other packages import
│   └── index.ts                  public exports
├── package.json                  "@pepbits/components", "exports", peerDependencies
└── CHANGELOG.md
```

### Inside a demo app

```
demo-apps/healthcare/
├── src/
│   ├── app/                      routes
│   ├── modules/
│   │   └── patients/
│   │       ├── patient-list.config.ts     worklist engine configuration
│   │       ├── patient-record.config.ts   master-record engine configuration
│   │       └── PatientSummary.tsx         demo screen built from components
│   ├── adapters/                 page-engine adapters → mock-api
│   └── navigation.ts
└── package.json                  depends on @pepbits/* only
```

## Dependency rules

```
tokens, icons → i18n, preferences → ui → components → patterns → page-engines → shell → ai → demo-apps
                     └────────→ data → platform ─────┘

Arrows show lower-to-higher layering; the table lists exact allowed imports.
Testing may import every layer and remains dev-only for consumers.
```

| Layer | May import from |
| --- | --- |
| `tokens`, `icons` | nothing |
| `i18n` | `tokens` |
| `preferences` | `tokens`, `i18n` |
| `ui` | `tokens`, `icons`, `i18n`, `preferences` |
| `components` | everything above |
| `data` | `i18n`, `preferences` |
| `platform` | `i18n`, `preferences`, `data` |
| `patterns` | everything above, plus `data` and `platform` contracts |
| `page-engines` | everything above |
| `shell` | everything above |
| `ai` | foundations (`tokens`, `icons`, `i18n`, `preferences`), `ui`, `components`, `data`, `platform`, `patterns`, `page-engines`, `shell` |
| `testing` | every layer except itself; usable by others only from tests and stories, as a devDependency |
| `demo-apps/*` | any `@pepbits/*` public export; never another demo, never a `src/` deep path |
| `mock-api` | nothing from the frontend |

A dependency-boundary check, added in phase 0 (`tooling/scripts/check-boundaries.mjs`), fails the build on any violation. Packages expose their API only through `package.json` `"exports"`.

Placement rule: **if two products need it, it belongs in `packages/`; if only one product needs it, it belongs in that product's repository.**

## How products consume the library

Packages are published from this repository to a private registry (GitHub Packages under the `pepbits` organization is the default; see open questions) with semantic versions managed by Changesets. Each product repository installs them like any npm dependency:

```
pepbits-healthcare-enterprise/frontend/
├── package.json                  pins one @pepbits/* version for the whole frontend
├── .npmrc                        @pepbits:registry=https://npm.pkg.github.com
├── apps/
│   ├── provider-web/
│   │   └── src/{app,modules,adapters,navigation.ts}
│   ├── patient-web/
│   ├── tenant-admin-web/
│   ├── platform-admin-web/
│   ├── registration-web/
│   ├── external-web/
│   └── tenant-desktop/
├── packages/                     product-only shared code
│   ├── healthcare-domain/        types and rules
│   ├── healthcare-api/           client for the real backend
│   └── healthcare-ui/            product-only widgets built from @pepbits/components
└── e2e/
```

| In this repository | In each product's `frontend/` |
| --- | --- |
| Primitives, components, patterns | Patient, invoice and student screens |
| Page engines | Page configurations that use them |
| Shell, preferences, i18n, platform services | Product navigation and menus |
| Generic adapter contracts | Adapters for the real backend |
| Demo apps and mock API | Real API clients, authentication, deployment |

Today the products vendor archives from a pinned snapshot:

| Consumer | Packages vendored today |
| --- | --- |
| Healthcare | `ai-client`, `ai-config`, `ai-ui`, `auth`, `erp-config`, `erp-data`, `erp-screens`, `erp-shell`, `ops-ui`, `platform-ports`, `tokens`, `workspace-core` |
| ERP | Same set |
| School | Same set |
| Platform | `auth`, `erp-config`, `erp-shell`, `ops-ui`, `platform-ports`, `tokens`, `workspace-core` |

Because each product pins a snapshot, the restructure does not affect a product until that product moves to the registry (phase 7).

### What products import today

Demo apps are never published, so products cannot depend on them. Product source (excluding `vendor/`, `node_modules/` and build output) was checked on 22 October 2026:

- No product imports any `@pepbits/reference-*` package, so moving those packages into `demo-apps/` removes nothing the products use.
- Products import these exports from `@pepbits/erp-screens`:

| Export | Used by | Target |
| --- | --- | --- |
| `RecordPage`, `RecordIdentity`, `RecordNotice` (`/record-page`) | Healthcare | `packages/page-engines` |
| `DcpRuntimeFields`, `DcpSectionFields`, `DcpFieldRenderer` (`/dcp-fields`) | Healthcare | `packages/patterns/form-designer` |
| `LifecycleConfigurationPage` (`/lifecycle`) | Healthcare, ERP, School | `packages/patterns` |
| `MasterTransferPanel` and its port types, `PricingExpressionInput` | School | `packages/patterns` |
| `ClinicalPatientWorkspace` (`/patient-query`) | Healthcare | Healthcare repository, `frontend/packages/healthcare-ui`; generic parts it relies on go to `packages/page-engines` |

`ClinicalPatientWorkspace` is the only product-specific screen a product consumes. It moves to the Healthcare repository because Healthcare is its only consumer. Until Healthcare adopts it there, the `@pepbits/erp-screens` shim keeps exporting it.

## Where today's folders go

| Today | Target |
| --- | --- |
| `desktop-clients/packages/tokens` | `packages/tokens` |
| `ops-ui` primitives (button, inputs, choice/date/quantity/scanner controls, option-filter, selection, badge, avatar, skeleton, nav-link, cn) | Copied to `packages/ui` in phase 2; `formatCurrency` omitted |
| `ops-ui` composites (table, cards, tabs, dropdown, overlay, calendar, pagination, presentation, values, editing, references, printing, recovery/error mapping) | Copied to `packages/components` in phase 2; pure error-shape mapping stays with recovery |
| `ops-ui` localization context | Copied to `packages/i18n` `./react` in phase 2; English core/literal fallback, host-supplied catalogs |
| `ops-ui` generated `messages.en.ts` | Not copied; product catalogs remain host-owned |
| `ops-ui` source-controls/source-dialog | Not ported: imported reference-design parity controls and their gallery demos |
| `erp-config` preferences, themes, shortcuts, formatting, i18n | `packages/preferences`, `packages/i18n` |
| `erp-config` page templates, navigation types, entity schemas | `packages/page-engines`, `packages/shell` |
| `erp-config` product definitions (clinical, pharmacy, RCM, school…) | the matching `demo-apps/*` |
| `erp-data` records/editor, shared drafts/center, CSV import, approvals, record panels; `erp-config` draft policy | Copied to `packages/data` in phase 3; host request callbacks, structured failures and additive volatile memory transport |
| `erp-data` report-data and mock datasets | Not copied: branch metrics and registry-driven product data belong in phase 6 demos |
| `erp-data` product adapters (clinic billing, triage, OP registration…) | the matching `demo-apps/*/adapters` |
| `erp-screens` generic (records, worklist, imports, approvals, drafts, inbox, reports, dashboard, page renderer) | `packages/patterns`, `packages/page-engines` |
| `erp-screens` DCP designer, label printing, device and identity screens, spreadsheet | `packages/patterns` |
| `erp-screens` record page, DCP fields, lifecycle, master transfer, pricing expression input | `packages/page-engines`, `packages/patterns` (used by products; see [What products import today](#what-products-import-today)) |
| `erp-screens` patient query (`ClinicalPatientWorkspace`) | Healthcare repository, `frontend/packages/healthcare-ui` |
| `erp-screens` other product screens (clinical, consultation, billing, OP registration, care pages) | `demo-apps/healthcare` |
| `erp-screens` page library | `demo-apps/showcase` |
| `erp-shell`, `workspace-core` | `packages/shell` |
| `auth` session, recovery, Sentinel | Copied to `packages/platform` in phase 3; host URL/fetch, generic browser namespace, no demo accounts; `RequestFailure` extracted to data |
| `platform-ports` devices, navigation, windows | Generic ports copied to `packages/platform` in phase 3; patient identity capture and School host routing excluded |
| `ai-config`, `ai-client`, `ai-ui` | `packages/ai` in phase 5 after shell: client sources use workspace context and assistant UI uses shell |
| `registration-wizard` | generic stepper and wizard → `packages/patterns/wizard`; Orvia screens → `demo-apps/onboarding` |
| `reference-host` | replaced by demo-app routing; the module contract moves to `packages/shell` |
| `reference-healthcare-suite`, `lis1`, `lis2`, `ris1`, `diagnostics`, `pharmacy`, `medband`, `medslot`, `rcm`, `surgisuite`, `teleconsult`, `quality` | `demo-apps/healthcare/src/modules/*` |
| `reference-erp1`, `reference-erp2`, `reference-keystone-core` | `demo-apps/erp/src/modules/*` |
| `reference-school` | `demo-apps/school` |
| `reference-reports` | `demo-apps/reports` |
| `reference-tenant-admin` | `demo-apps/tenant-admin` |
| `desktop-clients/apps/web` | per-demo hosts (see open question 2) |
| `desktop-clients/apps/desktop` | `demo-apps/desktop` |
| `desktop-clients/scripts` | `tooling/scripts` |
| `desktop-clients/e2e` | `e2e/` |
| `dummy-api` | `mock-api` |
| `demo-pages/*.html` and previews | `docs/design-references/` |
| `demo-pages/orvia-health-onboarding` | `demo-apps/onboarding` |
| `source/settle`, `source/caregrid`, `source/allyvora-patients` | `demo-apps/settle`, `demo-apps/caregrid`, `demo-apps/allyvora-patients` |

## Approach: build alongside, port one by one, remove last

1. Create the new structure next to the existing one. The existing layout keeps working throughout.
2. Port one package at a time, leaves first. After each port the full gate passes and the change merges on its own.
3. Remove the old layout and compatibility shims only when nothing uses them.

**Phases 1–3 copy code into the independent workspace.** The owner explicitly required the original workspace and deployment paths to remain unchanged, with no imports back into them. The foundation implementations temporarily coexist. The proposed later migration uses `git mv` where applicable and updates consumer dependencies in the same change; renamed/split packages can retain deprecated re-export shims until consumers are re-pointed. Those consumer changes are outside phases 1–3.

## Order of work

| Phase | Work | Behavior change |
| --- | --- | --- |
| 0. Foundation | Add a new, independent npm workspace at the repository root covering only `packages/*`, `demo-apps/*` and `tooling/*`, with its own lockfile, `turbo.json`, `tsconfig.base.json` and shared TypeScript settings in `tooling/tsconfig`. Add the dependency-boundary check. `desktop-clients/` stays a separate npm project and is not edited. See [Phase 0 status](#phase-0-status). | None |
| 1. Foundations | Copy `tokens`; extract independent `icons`, `i18n`, `preferences` mechanisms from existing sources. See [Phase 1 status](#phase-1-status). | No existing application changes; new host APIs |
| 2. UI | Copy `ops-ui` into `ui` and `components`, with localization in `i18n/react`; no shim or consumer migration in this increment. See [Phase 2 status](#phase-2-status). | No existing application changes; host catalogs/formatters required for new imports |
| 3. Services | Copy generic `erp-data` plus draft policy → `data`; `auth` and generic `platform-ports` → `platform`. See [Phase 3 status](#phase-3-status). No AI port. | No existing application changes; new host API configuration |
| 4. Patterns and engines | Generic parts of `erp-screens`, `erp-config` and `registration-wizard` → `patterns` and `page-engines` | None |
| 5. Shell and AI | `erp-shell` + `workspace-core` → `shell`; module contract replaces `reference-host`. Then port `ai-config`, `ai-client`, `ai-ui` → `ai`. `ai-client/src/sources.tsx` uses workspace-core and `ai-ui/src/assistant-panel.tsx` uses erp-shell, both becoming shell, so AI must follow it. | None |
| 6. Demo apps | `showcase` first, then one demo per change: healthcare, erp, school, reports, tenant-admin, onboarding, settle, caregrid, allyvora-patients, desktop. Product code leaves `erp-screens`, `erp-config` and `erp-data`. `dummy-api` → `mock-api`. | Yes: routes and hosts change |
| 7. Publishing and consumers | Changesets and a registry publish job; Healthcare, ERP, School and Platform move from vendored archives to registry versions one at a time, in their own repositories under their own rules. Healthcare also takes `ClinicalPatientWorkspace` into `frontend/packages/healthcare-ui`. | Per consumer |
| 8. Removal | Delete shims and the empty `desktop-clients/` tree | None |

Phase 0 comes first because the new top-level folders need a workspace root of their own before any package can live there.

### Phase 0 status

Implemented 22 October 2026. The owner required that existing code must not affect the new structure, so phase 0 builds the new workspace **alongside** `desktop-clients/` instead of moving its root:

| Added | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | Root workspace `pepbits-frontend-library`; workspaces `packages/*`, `demo-apps/*`, `tooling/*` only; `turbo` and `typescript` |
| `turbo.json`, `tsconfig.base.json` | Task pipeline and TypeScript base for new packages |
| `tooling/tsconfig/` | `@pepbits/tsconfig`: `base.json`, `react-library.json`, `nextjs.json`. `types` is explicit, so no ambient types leak in from other `node_modules` folders |
| `tooling/scripts/check-boundaries.mjs` | Dependency-boundary check (`npm run check:boundaries`), with tests (`npm run test:tooling`) |
| `packages/README.md`, `demo-apps/README.md` | Placeholders stating each folder's rules |

The boundary check enforces the [dependency rules](#dependency-rules), rejects relative imports that leave a package, imports into another package's `src/`, undeclared `@pepbits/*` imports and any use of a demo app by the library or by another demo. It also rejects every `@pepbits/*` name that is not a layer, so new code cannot depend on `ops-ui`, `erp-*`, `reference-*` or anything else under `desktop-clients/`.

Isolation: `desktop-clients/`, `dummy-api/`, `Jenkinsfile`, `deploy/`, `run.sh`, `run_all.sh` and `.github/` are unchanged. `desktop-clients` is not listed in the root workspaces, so npm and Turborepo inside it still treat it as its own project. Verification is recorded in the [phase 0 delivery record](../releases/unreleased/restructure-phase-0-2026-10-22.md).

The original phase 0 expectation was to move each later package and switch `desktop-clients` through a shim or `file:` dependency in the same change. The owner's phase 1 copy-only decision supersedes that expectation for this increment. The new `@pepbits/tokens` name does not clash with the existing one because the two workspaces never install each other.

### Phase 1 status

Implemented 22 October 2026 alongside the existing workspace, based on `21a3f0f`. Four source-export packages at version `0.0.0` now have public manifests, shared TypeScript settings, README integration guides and Vitest tests:

| Added | Public surface |
| --- | --- |
| [tokens](../../packages/tokens/README.md) | Unchanged CSS and font assets/licenses/provenance; 46 typed `TOKEN_NAMES`, `TokenName`, `tokenVar`; original stylesheet/font export paths |
| [icons](../../packages/icons/README.md) | The 16 Lucide icons used by primitives, `IconComponent` and a decorative-by-default `Icon` with accessible labels |
| [i18n](../../packages/i18n/README.md) | Four languages, direction, the verbatim 18-key core catalog in each language, host-owned translation/lazy loading, four message-localization helpers and preference-independent formatters |
| [preferences](../../packages/preferences/README.md) | Preference types/defaults/validation, policy parsing/effective values/locks, themes, formatter-option mapping and controlled React `PreferenceHost` hooks |

Decisions: CSS remains hand-written; no JSON token pipeline. Translation lookup and formatting retain their original semantics, but host-owned factories replace global product catalogs. Preferences may import `tokens` and `i18n` (for `LanguageKey`/`FormatOptions`); the reverse dependency remains forbidden, and no other layer rules change. The default theme ID remains `nexora`, matching CSS; its display name is `Blue` to remove the product name. React preference updates go through one host callback without local persistence or optimistic preference state. Compatible host property names and the change from `onPreferenceChange(key, value)` to `update(patch)` are documented in the package guide.

Intentionally excluded: generated product catalogs, product/module registries or icon maps, branch lists/labels/time zones and all navigation imports. The generic empty `defaultModule` setting and `clockZone` choice remain host-interpreted; no actual module IDs or branch mappings are supplied. The existing shortcut registry embeds dashboard/record-tab/shell navigation actions, so it stays for a later shell phase. Optional React locale bindings are deferred to phase 2. No shims, consumer rewiring, builds, registry publication or deployment are added.

Isolation: phase 1 copies sources; it does not modify `desktop-clients/`, `dummy-api/`, `Jenkinsfile`, `deploy/`, `run.sh`, `run_all.sh` or `.github/`. New packages have no dependencies on those trees. Root installation, boundaries, tooling tests, four package typechecks/tests, documentation and protected-path checks are recorded in the [phase 1 delivery record](../releases/unreleased/restructure-phase-1-2026-10-22.md). The root build command succeeds with zero build tasks because these packages expose source.

### Phase 2 status

Implemented 22 October 2026 alongside the existing workspace, based on `d8ddf36`. Two additional source-export packages at version `0.0.0` have single root barrels, React library TypeScript settings, unit/jsdom tests and integration guides:

| Added or extended | Public surface |
| --- | --- |
| [ui](../../packages/ui/README.md) | Fourteen primitive source groups: cn/compact formatting, buttons, fields, choices, dates, quantities, scanners, option filtering, search selection, segmented choices, badges, avatars, skeletons and navigation |
| [components](../../packages/components/README.md) | Seventeen composite source groups: cards/statistics, tabs/dropdowns, overlays, table/pagination/calendar, presentation, values, editing, references, form errors, printing and failure/recovery descriptors |
| [i18n/react](../../packages/i18n/README.md#react-localization-and-differences-from-ops-ui) | Controlled localization provider/hook, localized text, alias provider and types; English core then literal fallback, original interpolation/date-time defaults |

The requested implementation split needs no adjustment. `option-filter` belongs to `ui` so both selection layers can use it. Combined component/localization test files are split or hosted in the higher consuming layer, preserving boundaries. All icons already exist in the phase 1 icon surface. `presentationFromPreferences` projects effective preferences without persistence; table management still overrides local props, and the host connects the controlled pagination page size and lock/update guard.

Decisions: `formatCurrency` is omitted; hosts supply selected formatters. The generated product catalog is not copied; unchanged UI/recovery keys require host catalogs. Source controls and source dialog are excluded after inspecting their imported reference-design consumers and matching gallery demo/catalog. Error mapping consumes a plain error shape, not HTTP responses/envelopes, so it and recovery remain in components. Component markup, classes, keyboard/ARIA, RTL and reduced-motion behavior are preserved; strict TypeScript annotations erase at runtime. API differences and required Tailwind sources/tokens CSS are documented in both package guides.

Verification: 26 of 28 ops-ui test files are ported (311 of 316 expanded cases, including adapted host-catalog/formatter fixtures); source controls (3 cases) and source dialog (2 cases) are intentionally excluded. Six new localization/presentation cases bring the root suite to 428 tests in 38 files across six packages. The separate 16 tooling tests, six typechecks, boundaries and documentation validation pass locally. Build reports zero executable tasks because these are source packages. See the [phase 2 record](../releases/unreleased/restructure-phase-2-2026-10-22.md) for exact commands, failures/corrections, counts and source identity.

Isolation: this is a copy-only port. All protected sources and deployment files remain unchanged, with no new imports back into the original workspace. No shim, consumer rewiring, catalog/example regeneration, publication, commit, push or deployment is included.

### Phase 3 status

Implemented 22 October 2026 alongside the existing workspace, based on `e18c01d`. Two more unpublished source packages bring the library to eight packages:

| Added | Public surface |
| --- | --- |
| [data](../../packages/data/README.md) | Record snapshots, HTTP adapter and editor; additive volatile memory adapter; draft policy, filtering/merging, shared drafts/center; CSV imports, approvals, panels and structured failures |
| [platform](../../packages/platform/README.md) | Sessions and host session provider, authenticated request factory and recovery; Sentinel monitoring; generic device, navigation and window ports; root and area subpath exports |

Layer changes: platform may import i18n, preferences and data; data remains limited to i18n/preferences. AI moves above shell and can also import patterns/page-engines/shell. Testing still imports every layer. Boundary tests verify allowed edges and forbidden reverse imports. No AI source is ported: client workspace sources and assistant-panel shell dependencies require phase 5 to complete first.

Decisions: generic HTTP adapters retain injected request callbacks and wire/error/retry semantics. Draft policy moves to data; `RequestFailure` is extracted unchanged from auth and re-exported by platform. Display error mapping remains in components. Sessions require an explicit host URL, optionally injected fetch; the old standalone authenticated fetch becomes a configured factory. Generic `pepbits-*` browser keys/events replace product-branded identifiers without migrating tokens. The original frontend had no exported memory adapter; the new one is explicitly volatile, with version/replay checks and effective draft retention/exclusions.

Excluded: hardcoded report metrics, product mock data/fixtures, clinical/billing/registration/care/label/identity/device product adapters and all DCP adapters. The patient-specific identity-capture portion of devices, demo accounts and School host routing tests are omitted. Generic device/navigation/window ports remain host-injected without native imports. Wire-level draft kind `dcp` and CSV error key `designer.datasetLimit` remain for compatibility, with no DCP implementation.

Verification and completion: all generic suites are copied, with customer-schema and demo-account cases removed and host fixtures adapted. Added tests exercise HTTP envelopes, memory replay/conflict/retention, injected auth and shared failure identity. Package guides document every API difference, host setup, preferences/permissions, recovery flow and limits. Local CI passes 529 tests in 49 files across eight packages, eight typechecks and 19 tooling tests. The port retains 81 original cases and adds 20 cases; six whole source suites and three product-specific cases are excluded. Exact counts, exclusions, source identity and local checks are in the [phase 3 delivery record](../releases/unreleased/restructure-phase-3-2026-10-22.md). Root builds still have zero executable tasks; no live/native/product acceptance is claimed.

Isolation: copy-only; protected workspace, backend, deployment and CI paths remain untouched. No shim, consumer migration, canonical catalog/example changes, AI port, publication, commit, push or deployment.

## Gate for every port

For the independent phase 1–3 copies, the authorized gate is root `npm install`, `npm run ci`, documentation validation (using the existing `jiti` runner if Node cannot load `.ts` imports), and empty diffs/status for protected paths. Existing application, API, native and deployment suites are not repeated because no consumer or protected source changes. The following broader gate remains the proposal for later consumer migrations.

Each port is one reviewable change and passes, from the workspace root:

- `npm ci`, typecheck, the Vitest suite and the API, registry and deployment tests.
- The `verify:*` gates (form controls, shared components, localization, contrast, library, templates, bundle).
- Web and desktop builds.
- The dependency-boundary test.
- `node docs/tools/check-docs.mjs`, with moved documentation links updated.
- For phase 6 and any port touching routes or styles: the browser journeys for the affected demos.

Paths that ports must update, counted on `main` `01b6578`:

- 36 Tailwind `@source` lines in the two apps.
- The `transpilePackages` list in `apps/web/next.config.ts`.
- `tsconfig.base.json` path settings.
- 59 files under `desktop-clients/scripts` that reference `packages/`.
- 24 references to `desktop-clients` in `Jenkinsfile`, `deploy/`, `run.sh`, `run_all.sh` and `.github/`.

## Done when

- `packages/` contains only reusable code, and the boundary test enforces the dependency rules.
- Every demo app builds from public `@pepbits/*` exports only.
- Packages publish with versions and changelogs, and every consumer installs them from the registry instead of vendoring archives.
- Shims and `desktop-clients/` are gone, and the release record lists every rename as a breaking change with its replacement.

## Out of scope

- Visual or behavior changes beyond moving demos into their own hosts.
- Product repositories' internal restructuring beyond replacing vendored archives.
- Upgrading the dependencies of the imported demos (`orvia-health-onboarding`, `source/*`); they move as-is and adopt the packages later.

## Decisions

1. **Demo apps are not product code.** `demo-apps/healthcare`, `erp`, `school` and the other demos are never published; products install only `packages/`. Decided 22 October 2026.
2. **Product screens used by products.** Generic exports that products use move into `packages/`. The one product-specific screen a product uses, `ClinicalPatientWorkspace`, moves to the Healthcare repository's `frontend/packages/healthcare-ui`. Decided 22 October 2026, based on [What products import today](#what-products-import-today).

## Open questions for the owner

1. **Demo hosting.** One Next.js app per demo (recommended: independent, proves packages stand alone), or one shared host that loads demos as modules (closer to today, single deployment).
2. **Registry.** GitHub Packages under `pepbits`, or another private npm registry.
3. **Package names.** Confirm `tokens`, `icons`, `i18n`, `preferences`, `ui`, `components`, `patterns`, `page-engines`, `shell`, `data`, `platform`, `ai`, `testing`.
4. **Component docs.** Storybook inside `demo-apps/showcase`, or keep the custom Developer Library renderer there.
5. **Shim lifetime.** One library release after the last consumer moves, or a fixed date.
