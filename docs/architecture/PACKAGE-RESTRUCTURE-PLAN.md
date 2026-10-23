# Library restructure plan

Status: **phases 0–3, phase 4a priorities 1–2, phase 4b generic engines, phase 5 priorities 1–6 and phase 5b AI/preferences/login implemented; phase 6a showcase implemented inside the full shell, including Shell and AI simulation pages. Priority 3 patterns and the remaining phase 6 demos onward remain future work.** Revised 23 October 2026 against `main` `88f5555`. See [Phase 0](#phase-0-status), [Phase 1](#phase-1-status), [Phase 2](#phase-2-status), [Phase 3](#phase-3-status), [Phase 4a](#phase-4a-status), [Phase 4b](#phase-4b-status), [Phase 5](#phase-5-status) and [Phase 5b](#phase-5b-status). Phases 1–5b follow the owner's copy-only decision; consumer migration and publishing remain future work.

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
| `DcpRuntimeFields`, `DcpSectionFields`, `DcpFieldRenderer` (`/dcp-fields`) | Healthcare | `packages/patterns` `./dcp-fields` (copied in 4a) |
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
| `erp-config` lifecycle contracts/guards/model/HTTP/source mapping and DCP v1 runtime | Copied to `patterns` in phase 4a; no authoring catalog or product registry |
| `erp-config` designer/catalog/rules, product import/classification/label/device/inbox configuration | Priority 3 authoring deferred; product registries excluded. Generic form/export rules are included in 4b below. |
| `erp-config` generic page/template/schema/filter/form/export contracts and localization helper | Copied to `packages/page-engines` in 4b; classification metadata is host-defined. Product instances/catalogues omitted; navigation types are included in shell phase 5 priorities 1–3. |
| `erp-config` product definitions (clinical, pharmacy, RCM, school…) | the matching `demo-apps/*` |
| `erp-data` records/editor, shared drafts/center, CSV import, approvals, record panels; `erp-config` draft policy | Copied to `packages/data` in phase 3; host request callbacks, structured failures and additive volatile memory transport |
| `erp-data` report-data and mock datasets | Not copied: branch metrics and registry-driven product data belong in phase 6 demos |
| `erp-data` product adapters (clinic billing, triage, OP registration…) | the matching `demo-apps/*/adapters` |
| `erp-screens` record/layout, worklist, records/forms, template engines, renderer | Copied to `packages/page-engines` in 4b with typed configuration/adapters and renderer registration; no product/showcase imports |
| `erp-screens` approvals, drafts, imports/options/worker | Copied to `packages/patterns` priority 2 during 4b; lower-layer data ports and explicit host inputs |
| `erp-screens` standalone reports, dashboard, inbox, billing | Product data/registries remain embedded; phase 6 matching demos, with reusable template equivalents already in page-engines |
| `erp-screens` DCP designer, label printing, device and identity screens, spreadsheet | Deferred patterns work; no Library demo pages copied |
| `erp-screens` DCP fields, lifecycle, master transfer, pricing expression input | Copied to `packages/patterns` in phase 4a; mandatory phase 4a exports complete |
| `erp-screens` record page and generic record layout | Copied to `packages/page-engines` in 4b (used by products; see [What products import today](#what-products-import-today)) |
| `erp-screens` patient query (`ClinicalPatientWorkspace`) | Healthcare repository, `frontend/packages/healthcare-ui` |
| `erp-screens` other product screens (clinical, consultation, billing, OP registration, care pages) | `demo-apps/healthcare` |
| `erp-screens` page library | Recreated as fictional typed engine examples in `demo-apps/showcase`; product launchers excluded |
| `erp-screens/library` catalog, demos and reference pages | Showcase catalog, individual example files, Foundations and policy playground |
| `erp-screens/templates/template-library.tsx` and example generators | Showcase template selector and source-identical snippet generator |
| Thirteen `erp-screens/*/library-page.tsx` launchers | [Explicit per-source map](../../demo-apps/showcase/source-mapping.md); product launchers go to later demos, unported designer/device/label areas remain deferred |
| `workspace-core` | Copied to `packages/shell` `./workspace` in phase 5 priorities 1–3; all seven core suites retained; part 2 adds the shell workspace UI and all eight UI suites. |
| `erp-shell` | Context/ScreenHost, services, full header/sidebar/footer/frame, clock/palette, workspace tabs/split/MDI/window ports, command palette and documentation/non-AI help copied to `packages/shell`. Preferences/login are copied in phase 5b below. |
| `erp-config` generic shell configuration | Navigation/module/page types, product helpers, shortcut mechanics, documentation/tour types copied to shell in phase 5; catalogs, brands, branches/roles/time zones, guides and tours stay host-owned and are consumed by the completed chrome/layers. |
| `auth` session, recovery, Sentinel | Copied to `packages/platform` in phase 3; host URL/fetch, generic browser namespace, no demo accounts; `RequestFailure` extracted to data |
| `platform-ports` devices, navigation, windows | Generic ports copied to `packages/platform` in phase 3; patient identity capture and School host routing excluded |
| `ai-config`, `ai-client`, `ai-ui` | Copied in phase 5b to `packages/ai` config/client/ui subpaths; host catalogue/classifier/transport and optional shell extension |
| `erp-screens/src/preferences` | Copied in phase 5b to shell `./preferences-page`; existing PreferenceHost and explicit policy-service capability |
| `erp-screens/src/login` | Copied in phase 5b to shell `./login`; platform session and host brand, no demo accounts |
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

**Phases 1–5 copy code into the independent workspace.** The owner explicitly required the original workspace and deployment paths to remain unchanged, with no imports back into them. The foundation implementations temporarily coexist. The proposed later migration uses `git mv` where applicable and updates consumer dependencies in the same change; renamed/split packages can retain deprecated re-export shims until consumers are re-pointed. Those consumer changes are outside phases 1–5.

## Order of work

| Phase | Work | Behavior change |
| --- | --- | --- |
| 0. Foundation | Add a new, independent npm workspace at the repository root covering only `packages/*`, `demo-apps/*` and `tooling/*`, with its own lockfile, `turbo.json`, `tsconfig.base.json` and shared TypeScript settings in `tooling/tsconfig`. Add the dependency-boundary check. `desktop-clients/` stays a separate npm project and is not edited. See [Phase 0 status](#phase-0-status). | None |
| 1. Foundations | Copy `tokens`; extract independent `icons`, `i18n`, `preferences` mechanisms from existing sources. See [Phase 1 status](#phase-1-status). | No existing application changes; new host APIs |
| 2. UI | Copy `ops-ui` into `ui` and `components`, with localization in `i18n/react`; no shim or consumer migration in this increment. See [Phase 2 status](#phase-2-status). | No existing application changes; host catalogs/formatters required for new imports |
| 3. Services | Copy generic `erp-data` plus draft policy → `data`; `auth` and generic `platform-ports` → `platform`. See [Phase 3 status](#phase-3-status). No AI port. | No existing application changes; new host API configuration |
| 4a. Patterns | Required lifecycle/master-transfer/DCP-field subset copied to `patterns`; other patterns deferred. See [Phase 4a status](#phase-4a-status). | No existing application changes; new provider boundary |
| 4b. Engines | Complete patterns priority 2; generic record/layout, worklist, forms/records, templates/configuration and registry renderer → `page-engines` | Independent host contracts; existing applications unchanged |
| 5. Shell | `erp-shell` + `workspace-core` + generic shell configuration → `shell`. Priorities 1–6 delivered in two parts; preferences/login and AI delivered in phase 5b. See [Phase 5 status](#phase-5-status). | Independent host API and fail-closed UI action grants; original applications unchanged |
| 5b. AI and optional shell pages | Copied AI config/client/UI → `ai`, shell preferences/login, gate tests and Arabic physical-sidebar regression. See [Phase 5b](#phase-5b-status). | Independent host APIs; existing applications unchanged |
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

### Phase 4a status

Implemented the mandatory subset on 22 October 2026 alongside the original workspace, based on `3a34eb4`. One additional unpublished source package brings the library to nine packages. The owner explicitly allowed stopping after a smaller complete package: priorities 2 and 3 were deferred in that record. **Phase 4b now completes priority 2** (approvals, drafts, imports/options/worker); priority 3 remains deferred.

| Added | Public surface |
| --- | --- |
| [patterns](../../packages/patterns/README.md) `./lifecycle` | Complete generic lifecycle administration UI, CSS module, contract/guards/model/HTTP adapters/source registry and mapping helpers |
| `./master-transfer` | Master transfer panel/ports, pricing expression input, CSV/XLSX readers/exporters and limits |
| `./dcp-fields` | Runtime and section field rendering, extension renderer type, DCP v1 wire types/guards/writable-patch helpers |
| `./screen-host` and root barrel | ScreenHost provider/hook and typed context; memoized effective-preference formatters |

ScreenHost is a small, controlled host boundary: localized notification callback, fail-closed UI capability check, opaque optional module/branch scope, document identity/focus/transient draft state and no-op write/dirty callbacks. Optional opaque inline-action/source-publication slots are absent by default; AI can implement them after phase 5. The shell implements document ownership in phase 5. Selected screens do not need monitor/documentation/tour/dashboard slots. No AI, shell or page-engine code is imported, and `LAYERS` is unchanged.

Preferences come from the existing single `PreferenceHost`. Lifecycle removes its old preference props, uses effective table/list settings and forwards absent notification/dirty callbacks to ScreenHost; explicit callbacks retain precedence. Read-only DCP numbers/dates use effective formatters; editing and wire values are unchanged. All other APIs, markup, CSS, ARIA, keyboard, retry/conflict and operation identity semantics remain. The package guide enumerates every API difference and CSS-module/Tailwind/token/provider requirements.

Scope update in phase 4b: approvals now accept adapter/actor/role choices; shared drafts use an explicit authenticated DraftHost; draft center receives host page metadata and workflow rendering; imports receive adapter and structural definition. Their six suites are ported. Generic form rules and export policy/tests now live in page-engines. Product import lookup and field-classification catalogues remain excluded. Spreadsheet, remaining designer authoring/catalog/rules/repeating logic, label printing and identity/device screens plus tests remain priority 3 follow-up; their product mappings/subjects stay with hosts. All Developer-Library pages remain showcase phase 6. The earlier [4a record](../releases/unreleased/restructure-phase-4a-2026-10-22.md) is preserved unchanged.

Dependency decision: master transfer requires the exact source XLSX tarball at version 0.20.3; no DnD dependency is needed. Known npm XLSX advisory history remains a documented dependency-review follow-up; no silent upgrade or unrelated package dependency is added. Test-only fixture namespaces are neutralized and generic catalog messages are supplied by the test host, never exported as a runtime fallback.

Verification: eight original generic suites retain all **82 expanded cases**, with **8 additional host/preference cases**; all **90 patterns tests** pass. The complete root suite totals **619 tests in 60 files**, with **19 tooling tests**, **9 typechecks**, boundaries for **9 packages / 0 demo apps** and **0 executable build tasks**. Exact commands, per-file port/defer inventory, source digest and local evidence are in the [phase 4a delivery record](../releases/unreleased/restructure-phase-4a-2026-10-22.md). No browser/native/live-provider acceptance is claimed.

Isolation: copy-only. Protected workspace/backend/deployment/CI paths remain unchanged; no imports back, shim, consumer migration, catalog/example regeneration, publication, commit, push or deployment.

### Phase 4b status

Implemented 22–23 October 2026 alongside the protected original workspace, based on `227173ba0fe84b61ad63a2096e18be41b834ffa7`. Ten unpublished source packages now exist. [Package guide](../../packages/page-engines/README.md); [delivery record and per-file test inventory](../releases/unreleased/restructure-phase-4b-2026-10-23.md).

| Area | Outcome |
| --- | --- |
| Patterns priority 2 | Approval workspace/record approval, draft center/shared drafts, CSV dialog/options/workbook worker and six source suites copied to patterns with explicit adapters and host metadata. Priority 3 still deferred. |
| Record page/layout | Product-consumed RecordPage/identity/notice/actions and generic section layout copied with identical CSS. Effective preferences come from PreferenceHost. |
| Core configuration | Generic page/column/filter/entity/template types, form rules, schema localization, filter partition/storage and export review/audit. No entity/schema/template/module/navigation instances. |
| Worklist | Table/cards, filters, preview, personal/saved views, column scope, search and safe export; explicit WorklistAdapter/configuration; default-unclassified column/filter metadata. |
| Records/forms | Data editor and panels, dynamic schema form and navigation; ScreenHost document ownership, explicit authenticated adapter identity and related-page configuration. |
| Templates/renderer | Generic template state/parts/engines/configured and registry presentation. Hosts provide resources, slots, schedule labels and roles. No sample generator/runtime fixtures. Renderer maps template ID then kind to host registrations; unknown kinds use shared EmptyState. Built-in registrations cover only included engines. |

ScreenHost adds only optional `document.subscribeClose` and the `useScreenDraftState` helper over existing transient state. This preserves suspension versus explicit closure without importing shell. Shared test wiring is exported via patterns `./testing`. AI remains the existing opaque extension slots. Shared Pagination adds optional allowed page sizes; icons exports the 39 additional names required by engines. Layer rules are unchanged.

Destinations updated by phase 5: preferences → shell phase 5b follow-up; login → shell/platform phase 5b follow-up; reference-modules → replaced by demo-app routing phase 6; consultation, op-consultation, op-registration, clinical-*, comprehensive-consultation, clinic-billing and care-pages → Healthcare repository / healthcare demo phase 6. Developer-Library `library/`, `page-library/`, template-library/template-demo/generated example → showcase phase 6. Standalone reports/dashboard/inbox/billing contain product fixtures or registries and go to their matching demos (reports/ERP/healthcare); generic template report/dashboard rendering is included. `specialized-editors.test.tsx` tests excluded billing/consultation screens and stays with them. Product application-config/data-classification suites stay with demos or shell routing, not generic engines.

Verification and exact totals are recorded in the 4b delivery record. No original workspace, backend, deploy scripts, CI definitions, canonical catalog or generated example is modified. Root build is source-only with zero executable tasks; no live/native/browser acceptance, publication, commit or push is claimed.

### Phase 5 status

**Priorities 1–6 implemented**, 23 October 2026. Part 1 delivered the foundation from `aba0e4e`; part 2 completes chrome, workspace UI and non-AI layers from committed part 1 `6c73e50e85280a86d359ab5473a0b346dfe0ed64`. Eleven unpublished source packages exist. [Shell guide](../../packages/shell/README.md); [delivery record with preserved part 1 and new part 2 evidence](../releases/unreleased/restructure-phase-5-2026-10-23.md#part-2).

| Priority | Outcome and destination |
| --- | --- |
| 1. Workspace core | Part 1 document identity/manager/policy, split/detach state, transient drafts, dirty guards, restore/security metadata and React bindings retained. All seven suites and 141 cases remain. |
| 2. Generic configuration | Explicit navigation/page/module catalog, product helpers, shortcuts and documentation/tour types retained. No product data added. |
| 3. Host and services | ShellProvider/useShell/useERP, effective appearance, ScreenHost/document bridge, toast viewport, session lock, ErrorMonitor and Sentinel retained. Existing preference/localization/session providers remain authoritative. |
| 4. Chrome | Header with host branch clock/quick pages, sidebar, footer, EnterpriseShell, WorkspacePage, chrome palette and two unchanged CSS modules delivered. Real pin controls honor locks/allowed values; hover/click/focus/pin dismissal and physical RTL placement covered in jsdom. |
| 5. Workspace UI | Tabs, split canvas, MDI frame geometry/taskbar/hooks, explicit-catalog target/navigation bridge, platform detached-window reconciliation and WorkspaceShell composition delivered. Dirty confirmation and per-pane ScreenHost ownership are connected. Native runtime/child-window application wiring → phase 6 desktop host. |
| 6. Layers | Command palette, documentation article/center/drawer/launcher/notices/session cache, non-AI help/tours/shortcut reference delivered. ShellLayers composes these with toasts; EnterpriseShell mounts them once. Host transport/content/releases remain required. |
| 7. Optional pages | Preferences → shell phase 5b follow-up; login → shell/platform phase 5b follow-up. No placeholders exported. |
| AI | `ai-config`, `ai-client`, `ai-ui` → separate phase 5b above shell. Existing opaque ScreenHost extension slots remain optional. |

ScreenHost still maps notifications to toasts, actions to explicit grants with session-role/expiry checks, scope to the owning document and draft/dirty/focus/close callbacks to workspace. Canvas now applies ShellDocumentProvider to every warm/split/MDI screen without reparenting. Actual page-engine form and patterns lifecycle pages are tested inside the full frame. This is transient document state, not durable recovery or server authorization.

Host boundaries remain explicit: no default product/branch/zone/guide content, no second preference store or locale loader. Workspace navigation takes the role-filtered product before ShellProvider mounts; documentFromTarget takes page metadata. The host resolves workspace policy from effective preferences; `setPolicy` preserves existing documents. Chrome uses host brand/roles, optional inbox/status slots and available window ports. Documentation keeps a bounded per-hook session-memory cache; denied, aborted or changed-identity requests never receive fallback content. The shell guide enumerates API/storage/event differences.

Part 2 verification: **384 shell tests / 29 files**, including **141 original core cases**, **119 workspace UI cases**, **14 clock/palette cases**, **25 generic sidebar expansions** and **3 adapted product composition cases**. Root CI passes **1,292 tests / 115 files**, **19 tooling tests**, **11 typechecks**, boundaries for **11 packages / 0 demo apps**, and **0 executable build tasks**. Original preference transport/race/cache and three boot-hint cases stay with phase 6 hosts; six old chrome routing/default assertions are replaced by the explicit-catalog part 1 helper/host tests. Product role-header tests and all product content stay product-owned. Local jsdom is not browser/native/live-service acceptance.

Isolation: copy-only; protected workspace/backend/deployment/CI paths unchanged, exact required source grep zero matches. No canonical catalog/generated example changes, consumer migration, publication, commit, push or deployment. Phase 4a priority 3 remains independent deferred patterns work.

### Phase 5b status

Implemented 23 October 2026 alongside the protected workspace, based on `a5f49fba4f1089b1086d0dfd8643ffcbb67a2cbd`. Twelve unpublished source packages now exist. [Delivery record](../releases/unreleased/restructure-phase-5b-2026-10-23.md); [AI guide](../../packages/ai/README.md); [shell additions](../../packages/shell/README.md#phase-5b-preferences-and-login).

| Area | Outcome |
| --- | --- |
| AI config | Generic access/policy/context/admin/use-case contracts and host catalogue validation. Product use-case/page/classification registries excluded. |
| AI client | Assembly, shape masks, classified-field dispatch guard, transport/admin/usage and policy caching. Required host classifier and platform base URL or authenticated request; source publication uses shell document ownership. |
| AI UI | Administration, panel, inline, terminal, transparency and one assistant engine. Explicit management/user capabilities, effective formatting and host localization. |
| Shell integration | Generic ShellExtensionsProvider allows AI to fill ScreenHost inline/publication and help-layer slots from above shell. A shell without AI remains unchanged. |
| Preferences/login | Optional public subpaths, existing PreferenceHost and platform session; host services/grants/brand; no preference persistence copy or product/demo data. |
| Verification | All 13 original AI suites (378 cases), generic preference/login/preview/access/service tests, eight gate-file mappings, and real Chromium left/right bounds/focus/keyboard tests in Arabic RTL. Exact final counts and server-only exclusions are in the delivery record. |

No LAYERS change: AI may depend on shell; shell never depends on AI. Config remains pure; the client subpath depends on shell only for workspace source ownership. Policy cache instances/generations prevent cross-host/stale-response reuse. API differences, generic capability replacement, preference metadata, boolean allowed-value projection, retained policy constraints and host wiring are enumerated in the package guides.

The backend admission/default-limit checks, credential storage/canary/log checks, server hardening checks and isolated backend launcher remain protected-source host acceptance, not library tests. New client response checks explicitly do not certify backend controls. N1 managed vault, N7 approved restricted-data providers and N9 production authorization remain host obligations.

Phase 6 remains demonstration applications (showcase first), product/page/catalogue/branch content, mock API migration, boot preferences/routing, native window/bootstrap wiring and full browser/live-service acceptance. Phase 4a priority 3 patterns remain independent deferred work; registry publication/consumer migration/removal are phases 7–8. No original workspace/backend/deployment/CI source changes, shim, catalog regeneration, commit, push or deployment.

### Phase 6a status

Implemented in the separate `restructure/phase-6a` worktree from `6c73e50` (phase 5 part 1), 23 October 2026. [Showcase guide](../../demo-apps/showcase/README.md), [feature contract](../features/showcase.md), [delivery evidence](../releases/unreleased/restructure-phase-6a-2026-10-23.md).

The first independent Next.js app is `@pepbits-demo/showcase` (private). Eight destinations cover Foundations, UI primitives, Components, Patterns, Page engines, preferences/policy, and Shell/AI simulation pages. Examples use public exports, fictional data and volatile adapters. Displayed code is generated from the executable files. Host preferences follow the central guarded update path; four-language catalogs, Arabic direction and reduced motion are wired.

**Full-shell follow-up on merged main:** `src/app-frame.tsx` is now a thin `WorkspaceShell` wrapper, with catalog-driven sidebar/quick-page/command navigation and one controlled session/preference/localization chain. Ten new Shell examples cover tabs/split/MDI, fictional detached windows, command palette, documentation, help/tours, toasts, session lock, preferences and login. Three AI examples cover source publication/inline actions, transparency and read-only administration; `AiShellExtension` supplies the assistant panel/terminal. AI starts off and uses explicit browser echo plus in-memory policy/configuration/usage ports. The catalog has 55 source-identical examples. UI locks and simulated quotas are not server authorization (PREF-08). New library gaps, exact counts and retained evidence are listed in the [follow-up receipt](../releases/unreleased/restructure-phase-6a-2026-10-23.md#follow-up--full-shell-and-ai-pages).

Small library additions: a controlled value mode on platform SessionProvider and data’s volatile shared-draft adapter. Any accessibility corrections discovered during composed testing are itemized in the phase 6a record and package guides. Protected applications/backend/deploy/CI files remain unchanged. Root CI now has a real showcase Next build task. Evidence is local, not deployment or native execution. No commit or push.

Owner-decided remaining demo order, one independent app at a time: **healthcare, erp, school, reports, tenant-admin, onboarding, settle, caregrid, allyvora-patients, desktop**. Phase 4a priority 3 authoring/device/label patterns remain independently deferred.

## Gate for every port

For the independent phase 1–5 copies, the authorized gate is root `npm install`, `npm run ci`, documentation validation (using the existing `jiti` runner if Node cannot load `.ts` imports), and empty diffs/status for protected paths. Existing application, API, native and deployment suites are not repeated because no consumer or protected source changes. The following broader gate remains the proposal for later consumer migrations.

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

1. **Demo hosting — decided.** One Next.js app per demo, built one at a time, starting with showcase.
2. **Registry.** GitHub Packages under `pepbits`, or another private npm registry.
3. **Package names.** Confirm `tokens`, `icons`, `i18n`, `preferences`, `ui`, `components`, `patterns`, `page-engines`, `shell`, `data`, `platform`, `ai`, `testing`.
4. **Component docs — decided for phase 6a.** Standalone custom gallery with snippets generated from executable example files.
5. **Shim lifetime.** One library release after the last consumer moves, or a fixed date.
