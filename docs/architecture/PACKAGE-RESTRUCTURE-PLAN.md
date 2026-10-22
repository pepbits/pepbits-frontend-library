# Library restructure plan

Status: **proposal, not approved.** Revised 22 October 2026 against `main` `aa90bbe`. This revision replaces the 21 October draft (commit `3162a49`), which grouped product modules under `modules/` and kept vendored archives. Phase 0 is implemented (see [Phase 0 status](#phase-0-status)); nothing else is. The owner decides the open questions in the last section before any package moves.

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
│   ├── i18n/                     catalogs (generated), formatters, RTL, LocaleProvider
│   ├── preferences/              schema, defaults, tenant-lock resolver, PreferenceHost, themes, shortcuts
│   ├── ui/                       primitives: button, input, select, search-select, checkbox, radio,
│   │                             segmented, date-time, quantity-unit-field, scanner-input, otp,
│   │                             password, field, badge, avatar, skeleton, nav-link
│   ├── components/               table, pagination, card, card-grid, stat-card, tabs, dropdown,
│   │                             dialog, drawer, toast, calendar, stepper, empty-state, data-value,
│   │                             inline-edit, option-filter, reference-data, form-error-summary,
│   │                             recovery-notice, print-document
│   ├── patterns/                 form-layout, filter-bar, record-panels, csv-import, approvals,
│   │                             drafts, wizard, label-printing, identity-devices, spreadsheet,
│   │                             form-designer (DCP)
│   ├── page-engines/             core, master-record, worklist, query, order, booking, appointment,
│   │                             case-encounter, financial-transaction, billing, report, dashboard,
│   │                             workflow, scheduling, entity-360
│   ├── shell/                    app-shell, header, sidebar, footer, workspace (tabs, split, detach),
│   │                             command-palette, help, session-lock, navigation, context
│   ├── data/                     API client, structured errors, generic adapter contracts, cache
│   ├── platform/                 auth, drafts, monitoring (Sentinel), export, devices, windows
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
tokens, icons → i18n, preferences → ui → components → patterns → page-engines → shell → demo-apps
                                       data, platform ─────────┘
```

| Layer | May import from |
| --- | --- |
| `tokens`, `icons` | nothing |
| `i18n`, `preferences` | `tokens` |
| `ui` | `tokens`, `icons`, `i18n`, `preferences` |
| `components` | everything above |
| `data`, `platform` | `i18n`, `preferences` |
| `patterns` | everything above, plus `data` and `platform` contracts |
| `page-engines` | everything above |
| `shell` | everything above |
| `ai` | foundations, `ui`, `components`, `data`, `platform` |
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
| `ops-ui` primitives (button, inputs, badge, avatar, skeleton…) | `packages/ui` |
| `ops-ui` composites (table, card, tabs, overlay, calendar, pagination…) | `packages/components` |
| `ops-ui` localization and messages | `packages/i18n` |
| `erp-config` preferences, themes, shortcuts, formatting, i18n | `packages/preferences`, `packages/i18n` |
| `erp-config` page templates, navigation types, entity schemas | `packages/page-engines`, `packages/shell` |
| `erp-config` product definitions (clinical, pharmacy, RCM, school…) | the matching `demo-apps/*` |
| `erp-data` client, errors, CSV import, drafts, generic records | `packages/data`, `packages/platform` |
| `erp-data` product adapters (clinic billing, triage, OP registration…) | the matching `demo-apps/*/adapters` |
| `erp-screens` generic (records, worklist, imports, approvals, drafts, inbox, reports, dashboard, page renderer) | `packages/patterns`, `packages/page-engines` |
| `erp-screens` DCP designer, label printing, device and identity screens, spreadsheet | `packages/patterns` |
| `erp-screens` record page, DCP fields, lifecycle, master transfer, pricing expression input | `packages/page-engines`, `packages/patterns` (used by products; see [What products import today](#what-products-import-today)) |
| `erp-screens` patient query (`ClinicalPatientWorkspace`) | Healthcare repository, `frontend/packages/healthcare-ui` |
| `erp-screens` other product screens (clinical, consultation, billing, OP registration, care pages) | `demo-apps/healthcare` |
| `erp-screens` page library | `demo-apps/showcase` |
| `erp-shell`, `workspace-core` | `packages/shell` |
| `auth`, `platform-ports` | `packages/platform` |
| `ai-config`, `ai-client`, `ai-ui` | `packages/ai` |
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

**A port is a move, not a copy.** Each port uses `git mv` to keep history and updates workspace globs in the same change, so there is never more than one implementation. When a package is renamed or split, the old name remains as a thin deprecated package that re-exports the new ones (a *shim*), so existing imports and consumer archives keep working until they are re-pointed.

## Order of work

| Phase | Work | Behavior change |
| --- | --- | --- |
| 0. Foundation | Add a new, independent npm workspace at the repository root covering only `packages/*`, `demo-apps/*` and `tooling/*`, with its own lockfile, `turbo.json`, `tsconfig.base.json` and shared TypeScript settings in `tooling/tsconfig`. Add the dependency-boundary check. `desktop-clients/` stays a separate npm project and is not edited. See [Phase 0 status](#phase-0-status). | None |
| 1. Foundations | `tokens`; extract `icons`, `i18n`, `preferences` from `ops-ui` and `erp-config` | None |
| 2. UI | Split `ops-ui` into `ui` and `components`; `@pepbits/ops-ui` becomes a shim | None |
| 3. Services | `data`, `platform` (from `auth`, `platform-ports`, generic `erp-data`), `ai` | None |
| 4. Patterns and engines | Generic parts of `erp-screens`, `erp-config` and `registration-wizard` → `patterns` and `page-engines` | None |
| 5. Shell | `erp-shell` + `workspace-core` → `shell`; module contract replaces `reference-host` | None |
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

Consequence for later phases: because the two workspaces are independent, a port cannot be a single `git mv` that both projects see at once. Each later phase moves a package into the new workspace and switches `desktop-clients` to consume it (through a shim or a `file:` dependency) in the same change, so there is still only one implementation. The new `@pepbits/tokens` name does not clash with the existing one until then, because the two workspaces never install each other.

## Gate for every port

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
