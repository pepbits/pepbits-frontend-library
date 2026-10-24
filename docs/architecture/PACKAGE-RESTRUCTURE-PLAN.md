# Library restructure plan

Status: **phases 0–3, phase 4a priorities 1–3, phase 4b generic engines, phase 5 priorities 1–6 and phase 5b AI/preferences/login implemented; phase 6a showcase implemented inside the full shell, including Shell and AI simulation pages; healthcare phases 6b-1 through 6b-9 implemented (Suite/clinical, LIS1/LIS2/RIS1, Pharmacy, RCM, Teleconsult, Quality, SurgiSuite, MedBand and MedSlot). Phase 4c completes priority 3 patterns; phases 6c-1 through 6c-3 implement the ERP catalogue and specialized workflow subsets with remaining parity limits; phase 6d implements 26 Scholaris routes and six granted portals with explicit backend/visual parity limits; phase 6e-1 implements the reports demo (all 19 Lumen Reports routes); phase 6e-2 implements the Tenant Admin demo (Overview, Approvals, Activity and all 30 registry-driven configuration pages); phase 6e-3 implements the Orvia onboarding demo (landing, workspace lookup, sign-in with MFA, registration wizard); phase 6e-7 implements the desktop demo (web build and live check verified; the native Tauri executable is not built or tested); phase 6e-6 implements the AllyVora patient registration demo against its unchanged backend; later demos remain future work.** Revised 24 October 2026 for phases 6d, 6e-1 and 6e-2. See [Phase 0](#phase-0-status), [Phase 1](#phase-1-status), [Phase 2](#phase-2-status), [Phase 3](#phase-3-status), [Phase 4a](#phase-4a-status), [Phase 4b](#phase-4b-status), [Phase 5](#phase-5-status) and [Phase 5b](#phase-5b-status). Phases 1–5b follow the owner's copy-only decision; consumer migration and publishing remain future work.

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
| `erp-config` designer/catalog/rules, product import/classification/label/device/inbox configuration | Priority 3 generic authoring/device/label contracts completed in 4c; product registries excluded. Generic form/export rules are included in 4b below. |
| `erp-config` generic page/template/schema/filter/form/export contracts and localization helper | Copied to `packages/page-engines` in 4b; classification metadata is host-defined. Product instances/catalogues omitted; navigation types are included in shell phase 5 priorities 1–3. |
| `erp-config` product definitions (clinical, pharmacy, RCM, school…) | the matching `demo-apps/*`; school role grants, navigation and portal memberships copied into `demo-apps/school` in 6d. No Scholaris MasterTransferPanel/PricingExpressionInput usage exists; generic patterns remain public, separate School product integration is outside this source/API. |
| `erp-data` records/editor, shared drafts/center, CSV import, approvals, record panels; `erp-config` draft policy | Copied to `packages/data` in phase 3; host request callbacks, structured failures and additive volatile memory transport |
| `erp-data` report-data and mock datasets | Not copied: branch metrics and registry-driven product data belong in phase 6 demos |
| `erp-data` product adapters (clinic billing, triage, OP registration…) | Healthcare adapters ported to `demo-apps/healthcare/src/adapters` in 6b-1; remaining products deferred |
| `erp-screens` record/layout, worklist, records/forms, template engines, renderer | Copied to `packages/page-engines` in 4b with typed configuration/adapters and renderer registration; no product/showcase imports |
| `erp-screens` approvals, drafts, imports/options/worker | Copied to `packages/patterns` priority 2 during 4b; lower-layer data ports and explicit host inputs |
| `erp-screens` standalone reports, dashboard, inbox, billing | Product data/registries remain embedded; phase 6 matching demos, with reusable template equivalents already in page-engines |
| `erp-screens` spreadsheet, DCP designer, label printing, identity/devices | Phase 4c → patterns `spreadsheet`, `form-designer`, `label-printing`, `identity-devices`, `device-integrations`; no Library launchers or product data |
| `erp-config` DCP designer/rules/catalog/lifecycle/runtime/repeating, generic label/identity/device contracts | Phase 4c → data contracts, re-exported by patterns; product page maps excluded |
| `erp-data` DCP designer/host/runtime, label/identity/device adapters | Phase 4c → data with explicit endpoints and generic subject names; runtime demo wrapper excluded |
| `platform-ports` identity capture | Phase 4c → platform devices with `subjectReference`; explicit device/identity workflow bridges |
| `erp-screens` DCP fields, lifecycle, master transfer, pricing expression input | Copied to `packages/patterns` in phase 4a; mandatory phase 4a exports complete |
| `erp-screens` record page and generic record layout | Copied to `packages/page-engines` in 4b (used by products; see [What products import today](#what-products-import-today)) |
| `erp-screens` patient query (`ClinicalPatientWorkspace`) | Demo copy in `demo-apps/healthcare/src/modules/clinical-templates` in 6b-1; Healthcare product repository copy remains a separate step |
| `erp-screens` other product screens (clinical, consultation, billing, OP registration, care pages) | Clinical templates/triage/clinical-consultation/comprehensive/OP consultation/registration/billing/care/document ported in 6b-1; standalone `consultation` composer/recorder deferred; [source map](../../demo-apps/healthcare/source-mapping.md) |
| `erp-screens` page library | Recreated as fictional typed engine examples in `demo-apps/showcase`; product launchers excluded |
| `erp-screens/library` catalog, demos and reference pages | Showcase catalog, individual example files, Foundations and policy playground |
| `erp-screens/templates/template-library.tsx` and example generators | Showcase template selector and source-identical snippet generator |
| Thirteen `erp-screens/*/library-page.tsx` launchers | [Explicit per-source map](../../demo-apps/showcase/source-mapping.md); product launchers go to later demos; phase 4c supplies new public designer/device/label examples |
| `workspace-core` | Copied to `packages/shell` `./workspace` in phase 5 priorities 1–3; all seven core suites retained; part 2 adds the shell workspace UI and all eight UI suites. |
| `erp-shell` | Context/ScreenHost, services, full header/sidebar/footer/frame, clock/palette, workspace tabs/split/MDI/window ports, command palette and documentation/non-AI help copied to `packages/shell`. Preferences/login are copied in phase 5b below. |
| `erp-config` generic shell configuration | Navigation/module/page types, product helpers, shortcut mechanics, documentation/tour types copied to shell in phase 5; catalogs, brands, branches/roles/time zones, guides and tours stay host-owned and are consumed by the completed chrome/layers. |
| `auth` session, recovery, Sentinel | Copied to `packages/platform` in phase 3; host URL/fetch, generic browser namespace, no demo accounts; `RequestFailure` extracted to data |
| `platform-ports` devices, navigation, windows | Generic ports copied to `packages/platform` in phase 3; patient identity capture and School host routing excluded |
| `ai-config`, `ai-client`, `ai-ui` | Copied in phase 5b to `packages/ai` config/client/ui subpaths; host catalogue/classifier/transport and optional shell extension |
| `erp-screens/src/preferences` | Copied in phase 5b to shell `./preferences-page`; existing PreferenceHost and explicit policy-service capability |
| `erp-screens/src/login` | Copied in phase 5b to shell `./login`; platform session and host brand, no demo accounts |
| `registration-wizard` | generic stepper and wizard → `packages/patterns/wizard` (phase 6e-3: `useWizard`, `WizardStepper`, `WizardProgress`, `focusFirstInvalid`); Orvia screens → `demo-apps/onboarding` (ported from the Orvia source, see below); the desktop package itself is not imported |
| `reference-lis1`, `reference-lis2`, `reference-ris1`, `reference-diagnostics` | Ported to matching healthcare `src/modules` in 6b-2; configured HTTP transport and public engines/components; [source map](../../demo-apps/healthcare/source-mapping.md) |
| `reference-host` | replaced by demo-app routing; the module contract is public `@pepbits/shell/reference-host` (phase 6e-2), consumed by tenant-admin and the identical healthcare module hosts |
| `reference-healthcare-suite`, `lis1`, `lis2`, `ris1`, `diagnostics`, `pharmacy`, `medband`, `medslot`, `rcm`, `surgisuite`, `teleconsult`, `quality` | Suite static core ported in 6b-1; RCM workspaces and the other product modules remain later healthcare runs |
| `reference-erp1`, `reference-erp2`, `reference-keystone-core` | Phase 6c-1: `demo-apps/erp/src/modules/{erp1,erp2,keystone}` configurations over public engines; 57 destinations each, specialized source views deferred |
| `reference-school` | Phase 6d → `demo-apps/school/src/modules/school`: 26 routes, six dashboards and scoped domain workflows; backend/visual parity limits documented |
| `reference-reports` | Phase 6e-1: `demo-apps/reports/src/modules/reports`; all 19 source routes over the shared host, configured HTTP and public components/charts; [source map](../../demo-apps/reports/source-mapping.md) |
| `reference-tenant-admin` | Phase 6e-2: `demo-apps/tenant-admin/src/modules/tenant-admin`; registry-driven sidebar, one resource workspace plus record drawer for all 30 configuration pages, Overview/Approvals/Activity; [source map](../../demo-apps/tenant-admin/source-mapping.md) |
| `desktop-clients/apps/web` | per-demo hosts (see open question 2) |
| `desktop-clients/apps/desktop` | `demo-apps/desktop` (phase 6e-7: Vite web host on ApplicationProviders' opt-in workspace, ported Tauri window port and copied `src-tauri/`; [source map](../../demo-apps/desktop/source-mapping.md)) |
| `desktop-clients/scripts` | `tooling/scripts` (`stamp-api.mjs` not carried by the desktop demo: it records a deployment's API) |
| `desktop-clients/e2e` | `e2e/` |
| `dummy-api` | `mock-api` |
| `demo-pages/*.html` and previews | `docs/design-references/` |
| `demo-pages/orvia-health-onboarding` | `demo-apps/onboarding` (phase 6e-3: all four pages and not-found ported; [source map](../../demo-apps/onboarding/source-mapping.md); source unchanged) |
| `source/settle`, `source/caregrid`, `source/allyvora-patients` | `demo-apps/settle`, `demo-apps/caregrid`, `demo-apps/allyvora-patients` |
| `source/allyvora-patients/frontend` pages, form, layouts and layout designer | Phase 6e-6: `demo-apps/allyvora-patients/src/modules/registration` over public controls/engines; [source map](../../demo-apps/allyvora-patients/source-mapping.md) |
| `source/allyvora-patients/packages/shared` and `backend` | Consumed and run unchanged by the 6e-6 demo (package dependency and own API); moving them is later work |
| Source combobox type-and-Tab and signature pad | Phase 6e-6: `SearchSelect` `quickPick` and `SignaturePad` in `packages/ui` |

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
| 4a. Patterns | Lifecycle/master-transfer/DCP fields plus priority 2 and phase 4c priority 3 copied to `patterns`. See [Phase 4a status](#phase-4a-status). | No existing application changes; new provider boundary |
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

Implemented the mandatory subset on 22 October 2026 alongside the original workspace, based on `3a34eb4`. One additional unpublished source package brings the library to nine packages. The owner explicitly allowed stopping after a smaller complete package: priorities 2 and 3 were deferred in that record. **Phase 4b completes priority 2** (approvals, drafts, imports/options/worker); **phase 4c completes priority 3** on 23 October 2026 from `ec73bc3`. See the [4c record](../releases/unreleased/restructure-phase-4c-2026-10-23.md) for current evidence; earlier counts below remain historical.

| Added | Public surface |
| --- | --- |
| [patterns](../../packages/patterns/README.md) `./lifecycle` | Complete generic lifecycle administration UI, CSS module, contract/guards/model/HTTP adapters/source registry and mapping helpers |
| `./master-transfer` | Master transfer panel/ports, pricing expression input, CSV/XLSX readers/exporters and limits |
| `./dcp-fields` | Runtime and section field rendering, extension renderer type, DCP v1 wire types/guards/writable-patch helpers |
| `./screen-host` and root barrel | ScreenHost provider/hook and typed context; memoized effective-preference formatters |
| Phase 4c `./spreadsheet`, `./form-designer` | Costing workspace and complete generic authoring/catalog/rules/repeating/lifecycle/preview/host runtime, reusing DCP fields |
| Phase 4c `./label-printing`, `./identity-devices`, `./device-integrations` | Stock/artwork/print, generic subject/reader and device queue/scan/automation workspaces; explicit data adapters and platform ports |

ScreenHost is a small, controlled host boundary: localized notification callback, fail-closed UI capability check, opaque optional module/branch scope, document identity/focus/transient draft state and no-op write/dirty callbacks. Optional opaque inline-action/source-publication slots are absent by default; AI can implement them after phase 5. The shell implements document ownership in phase 5. Selected screens do not need monitor/documentation/tour/dashboard slots. No AI, shell or page-engine code is imported, and `LAYERS` is unchanged.

Preferences come from the existing single `PreferenceHost`. Lifecycle removes its old preference props, uses effective table/list settings and forwards absent notification/dirty callbacks to ScreenHost; explicit callbacks retain precedence. Read-only DCP numbers/dates use effective formatters; editing and wire values are unchanged. All other APIs, markup, CSS, ARIA, keyboard, retry/conflict and operation identity semantics remain. The package guide enumerates every API difference and CSS-module/Tailwind/token/provider requirements.

Scope update in phase 4b: approvals now accept adapter/actor/role choices; shared drafts use an explicit authenticated DraftHost; draft center receives host page metadata and workflow rendering; imports receive adapter and structural definition. Their six suites are ported. Generic form rules and export policy/tests now live in page-engines. Product import lookup and field-classification catalogues remain excluded. Phase 4c copies spreadsheet, designer authoring/catalog/rules/repeating logic, labels and identity/device screens with all thirteen deferred generic pattern/config/adapter suites; the runtime-fields suite was already ported. Product mappings/subjects stay with hosts. Shared data contracts avoid upward imports; native work uses platform ports. Five showcase examples use session-memory adapters. All Developer-Library pages remain showcase phase 6. The earlier [4a record](../releases/unreleased/restructure-phase-4a-2026-10-22.md) is preserved unchanged.

Dependency decision: master transfer requires the exact source XLSX tarball at version 0.20.3; the original subset needed no DnD dependency, while phase 4c adds the original pinned designer dependencies. Known npm XLSX advisory history remains a documented dependency-review follow-up; no silent upgrade or unrelated package dependency is added. Test-only fixture namespaces are neutralized and generic catalog messages are supplied by the test host, never exported as a runtime fallback.

Verification: eight original generic suites retain all **82 expanded cases**, with **8 additional host/preference cases**; all **90 patterns tests** pass. The complete root suite totals **619 tests in 60 files**, with **19 tooling tests**, **9 typechecks**, boundaries for **9 packages / 0 demo apps** and **0 executable build tasks**. Exact commands, per-file port/defer inventory, source digest and local evidence are in the [phase 4a delivery record](../releases/unreleased/restructure-phase-4a-2026-10-22.md). No browser/native/live-provider acceptance is claimed.

Isolation: copy-only. Protected workspace/backend/deployment/CI paths remain unchanged; no imports back, shim, consumer migration, catalog/example regeneration, publication, commit, push or deployment.

### Phase 4b status

Implemented 22–23 October 2026 alongside the protected original workspace, based on `227173ba0fe84b61ad63a2096e18be41b834ffa7`. Ten unpublished source packages now exist. [Package guide](../../packages/page-engines/README.md); [delivery record and per-file test inventory](../releases/unreleased/restructure-phase-4b-2026-10-23.md).

| Area | Outcome |
| --- | --- |
| Patterns priority 2 | Approval workspace/record approval, draft center/shared drafts, CSV dialog/options/workbook worker and six source suites copied to patterns with explicit adapters and host metadata. Priority 3 subsequently completed by phase 4c. |
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

Isolation: copy-only; protected workspace/backend/deployment/CI paths unchanged, exact required source grep zero matches. No canonical catalog/generated example changes, consumer migration, publication, commit, push or deployment. Phase 4a priority 3 is subsequently completed by phase 4c.

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

Phase 6 remains demonstration applications (showcase first), product/page/catalogue/branch content, mock API migration, boot preferences/routing, native window/bootstrap wiring and full browser/live-service acceptance. Phase 4a priority 3 patterns are completed by phase 4c; registry publication/consumer migration/removal are phases 7–8. No original workspace/backend/deployment/CI source changes, shim, catalog regeneration, commit, push or deployment.

### Phase 6a status

Implemented in the separate `restructure/phase-6a` worktree from `6c73e50` (phase 5 part 1), 23 October 2026. [Showcase guide](../../demo-apps/showcase/README.md), [feature contract](../features/showcase.md), [delivery evidence](../releases/unreleased/restructure-phase-6a-2026-10-23.md).

The first independent Next.js app is `@pepbits-demo/showcase` (private). Eight destinations cover Foundations, UI primitives, Components, Patterns, Page engines, preferences/policy, and Shell/AI simulation pages. Examples use public exports, fictional data and volatile adapters. Displayed code is generated from the executable files. Host preferences follow the central guarded update path; four-language catalogs, Arabic direction and reduced motion are wired.

**Full-shell follow-up on merged main:** `src/app-frame.tsx` is now a thin `WorkspaceShell` wrapper, with catalog-driven sidebar/quick-page/command navigation and one controlled session/preference/localization chain. Ten new Shell examples cover tabs/split/MDI, fictional detached windows, command palette, documentation, help/tours, toasts, session lock, preferences and login. Three AI examples cover source publication/inline actions, transparency and read-only administration; `AiShellExtension` supplies the assistant panel/terminal. AI starts off and uses explicit browser echo plus in-memory policy/configuration/usage ports. The catalog has 55 source-identical examples. UI locks and simulated quotas are not server authorization (PREF-08). New library gaps, exact counts and retained evidence are listed in the [follow-up receipt](../releases/unreleased/restructure-phase-6a-2026-10-23.md#follow-up--full-shell-and-ai-pages).

Small library additions: a controlled value mode on platform SessionProvider and data’s volatile shared-draft adapter. Any accessibility corrections discovered during composed testing are itemized in the phase 6a record and package guides. Protected applications/backend/deploy/CI files remain unchanged. Root CI now has a real showcase Next build task. Evidence is local, not deployment or native execution. No commit or push.

Owner-decided remaining demo order, one independent app at a time: **healthcare, erp, school, reports, tenant-admin, onboarding, settle, caregrid, allyvora-patients, desktop**. Phase 4c completes priority 3 authoring/device/label/spreadsheet patterns independently of the remaining demos.

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

### Phase 6b status

Phase **6b-1** implements the independent `@pepbits-demo/healthcare` Next.js scaffold, full shared shell/login/preferences, API-backed preferences/localization and Healthcare Suite core plus clinical screens. There are 37 static destinations, with patient/encounter/master and patient-specific clinical deep links. Generic master layouts, tables, tabs, exports and notifications use public engines/components; the small CollectionView addition, icon exports and state-title correction are listed in the [release record](../releases/unreleased/restructure-phase-6b-1-2026-10-23.md). See the [app guide](../../demo-apps/healthcare/README.md), [source mapping](../../demo-apps/healthcare/source-mapping.md) and [feature contract](../features/healthcare-demo.md).

This is an implemented subset with local test/build/HTTP/browser evidence, not a deployment or clinical acceptance. The standalone four-layer consultation composer and ambient recorder remain deferred. The merged shell profile-button naming fix passes the phase 6b-2 real-HTTP recheck: all 122 route cases have zero full-shell and page-content axe violations. Exact scope and receipts remain in its record. ClinicalPatientWorkspace is present as a demo module; moving the product copy into the Healthcare repository is separate work.

Phase **6b-2** adds `src/modules/{lis1,lis2,ris1,diagnostics}`, the configured diagnostic HTTP adapter, all 55 original menu destinations and 16 detail/viewer/print patterns. There are now 92 menu destinations in total. Product master/table layouts use public TemplateFields/CollectionView; shared UI and host preferences remain in their existing packages. Original diagnostic tests are ported with route, RTL, preference, failure/retry and axe coverage. See the [6b-2 record](../releases/unreleased/restructure-phase-6b-2-2026-10-23.md) for current verification. Phase 4c is now merged into this branch; adoption by those earlier diagnostic workflows remains follow-up work, without recreating the patterns.

Phase **6b-3** adds Pharmacy-1 under `src/modules/pharmacy`: all thirteen Phial destinations, strict query routes and the configured pharmacy HTTP adapter. The app now has **105 menu destinations**. Patient forms/audit collections configure public TemplateFields/CollectionView; shared controls, tabs, notifications and printing retain host preferences. Public AsyncLookup, small native-layout controls and icon exports are listed in the [6b-3 record](../releases/unreleased/restructure-phase-6b-3-2026-10-23.md), alongside original test ports and local HTTP workflow evidence. Base `79b545b` includes 6b-1/6b-2 and main through phase 4c; the backend and original desktop remain unchanged.

Phase **6b-4** adds `src/modules/rcm` and its configured HTTP adapter: all forty RCM Workspace destinations in eight categories, bringing the app to **145 menu destinations**. Metadata-driven forms and worklists configure public TemplateFields/CollectionView; reference lookups reuse AsyncLookup. Product documents, approvals, dashboards and command palette retain the unchanged API contracts. Small generic additions, source identity and exact local test/HTTP/browser evidence are listed in the [6b-4 record](../releases/unreleased/restructure-phase-6b-4-2026-10-23.md). This is a fictional demonstration, not clinical/financial acceptance or deployment.

Phase **6b-5** adds `src/modules/teleconsult` as exactly two header modules: Teleconsult Provider (server-granted Doctor/Nurse modes) and Teleconsult Patient. All nine sidebar destinations and three record routes use configured HTTP adapters, existing shared controls, TemplateFields and CollectionView. The app now has **154 menu destinations**. See the [6b-5 record](../releases/unreleased/restructure-phase-6b-5-2026-10-23.md) for the original test ports, route/preference/RTL/axe matrix, local HTTP workflows and remaining external acceptance boundaries.

Phase **6b-6** adds `src/modules/quality` and its configured HTTP adapter: all twelve original sidebar destinations, two record routes and the report designer. The app now has **166 menu destinations**. Authority/report metadata configure public form-designer fields/panels; shared lookup, controls, dialogs, tables, tabs, printing and notifications are reused. Analytical report sections and Quality workflows remain demo components with the unchanged API. The [6b-6 record](../releases/unreleased/restructure-phase-6b-6-2026-10-23.md) records all original test ports, preference/RTL/axe coverage, local HTTP workflows, five primitive icon additions and shared-table keyboard access. No Quality route is deferred; fictional tests do not establish regulatory, clinical/financial or native acceptance.

Phase **6b-7** adds `src/modules/surgisuite` and its configured HTTP adapter: all eight original sidebar destinations and the twelve-section dynamic case workspace, bringing healthcare to **174 menu destinations**. Cases configures CollectionView; patient/procedure forms configure TemplateFields; existing AsyncLookup, Source* controls, SourceDialog and ScreenHost are reused. Surgical timeline/chart geometry, dialogs and booking orchestration remain demo components. All original tests are ported with route/preference/RTL/axe and real-HTTP workflows. Three primitive icon additions and exact verification are recorded in the [6b-7 record](../releases/unreleased/restructure-phase-6b-7-2026-10-23.md). No SurgiSuite destination is deferred; fictional software checks do not establish clinical/financial/native acceptance or deployment.

Phase **6b-8** adds `src/modules/medband` and its configured HTTP adapter: all seven MedBand Patient Access sidebar destinations, admission-request creation and the dynamic wristband record. Healthcare now has **181 menu destinations**. Encounter columns configure CollectionView, registration contact fields configure TemplateFields, patient selection uses AsyncLookup, controls use Source*, dialogs use SourceDialog and notifications use ScreenHost. All thirteen original test files are ported, with route/preference/RTL/axe and real local HTTP coverage. Six primitive icon additions and exact verification are recorded in the [6b-8 record](../releases/unreleased/restructure-phase-6b-8-2026-10-23.md). Tenant Admin is excluded; MedBand has no deferred route. Fictional software checks do not establish clinical/financial/native acceptance or deployment.

Phase **6b-9** adds `src/modules/medslot` and configured HTTP: all twelve MedSlot sidebar destinations, Calendar, patient/resource details and booking. Healthcare now has **193 menu destinations**. Patient metadata/rows configure TemplateFields/CollectionView; patient/global lookup, native controls, overlays and notifications reuse AsyncLookup, Source*, SourceDialog and ScreenHost. Both original component test files and browser contracts are ported with route/preference/RTL/axe and real local HTTP coverage. Two temporal input wrappers, seven primitive icon exports, source identity and exact verification are recorded in the [6b-9 record](../releases/unreleased/restructure-phase-6b-9-2026-10-23.md). No MedSlot route is deferred; fictional software verification is not clinical/financial/native acceptance or deployment.

The healthcare module sequence through MedSlot is implemented. The mock-api move, consumer migration, publication and original workspace removal remain later phases. Phase 6b-2 builds on `02e8ef6` in the separate phase-6b worktree. It does not modify the backend, original desktop workspace, shell/AI/patterns/data packages or showcase, and does not commit or push.

### Phase 6c status

**Current 6c-6 working-tree boundary — verified composition subset:** Phase 6c-6 improves source composition at 35 destinations: ERP1 booking drawers retain the calendar and restore focus; ERP2 booking records show time/resource identity and a 340px schedule rail; profiles have source-sized avatars/statistic strips and ERP1 340/380px worklists; cases have subject/status/stage identity and avatar conversations, with ERP1 drawers retaining the board or list and refreshing acknowledged changes without losing search; ERP2 tree records have top breadcrumbs and 380px child context; all eight reports now support column layouts and named snapshots. Read-only fields use source-scaled stacked labels/values. Shared additions are opt-in plain RecordPage/RecordSectionLayout presentation and configurable ResourceTimeline geometry/resource/event slots, plus WorklistPage `refreshKey` for acknowledged external writes. Shared Avatar accent initials now use the effective text token after real-browser axe exposed insufficient contrast. Effective preferences, tenant locks, retry/version handling and source API boundaries remain authoritative.

The source audit maps all 114 destinations to original JSX/CSS and retains 84 source-file hashes. Local verification passes: forced CI has 6,097 Vitest tests with 42/42 tasks and zero cached; shell Chromium has 18 cases; real HTTP has 122 workflows, all 114 routes, 15 extra axe states and 27 geometry comparisons, with zero violations or application/HTTP/console errors. Source JSX/CSS was audited; the original desktop runtime was not rendered. **Exact visual parity is incomplete at all 114 destinations**: the ledger lists specific remaining differences and workflows. Durable cross-route drafts stay out of scope. Reports now raise personal-view coverage from 84 worklists to 92 destinations. No API, deployment or protected-source changes are required. See the [6c-6 record](../releases/unreleased/restructure-phase-6c-6-2026-10-24.md) and [114-destination ledger](../../demo-apps/erp/parity-status.md). The earlier phase paragraphs below describe their historical delivery boundaries.

Phase **6c-1** creates private `@pepbits-demo/erp` with the full API-backed session/preference/localization/shell chain. ERP1 and ERP2 each expose all **57 catalogue destinations** across the original 20 template keys. ERP1 retains an in-page editor; ERP2 adds 46 view, 44 create and 42 edit route patterns plus scoped previous/next memory and shared column reset. The public page registry composes library worklist, record, field/line, matrix, report, settings and chart engines. Generic host/HTTP/preference/resource behaviour is extracted to the appropriate packages, with healthcare consuming the shared host.

This is a functional catalogue/data-flow subset, **not complete source visual/workflow parity**. Tree/calendar/board/profile-specific views, invoice print geometry, report period/pivot controls, ledger date-range/opening-balance controls, matrix period navigation/bulk-fill and full source dashboard composition remain deferred. Those destinations use shared list/record/report views. The richer personal-view protocol and durable/cross-route draft recovery are not added. All 38 original source cases are retained, with route/profile/axe and separate real local HTTP verification. See the [app guide](../../demo-apps/erp/README.md), [source map](../../demo-apps/erp/source-mapping.md), [feature contract](../features/erp-demo.md) and [6c-1 record](../releases/unreleased/restructure-phase-6c-1-2026-10-23.md) for exact scope, counts and limits. Fictional financial behaviour is not accounting acceptance. No deployment, source removal, publication, commit or push.

Phase **6c-2** delivers a verified subset over the existing app: shared hierarchy canvases for all six tree destinations, grouped/draggable boards for all four case destinations, eight ERP1 list/detail profile compositions and finance-specific entity grants. Generic `tree`/`board` areas live in patterns; ERP owns configuration and commands. Platform types expose optional server-issued permissions. Direct tests cover the 6c-1 HTTP/preference/provider/field-helper extractions. Booking calendar/resource timelines, invoice print geometry, report period/pivot controls, ledger date-range/opening-balance controls, matrix period navigation/bulk-fill and full source dashboard composition remain deferred. Hierarchy canvas and board/profile main workflows are delivered, but ERP2 tree record breadcrumbs/delete/child-table composition, board discussion/history, source-specific profile statistics/activity layout and exact visual matching remain incomplete. Durable and cross-route unsaved recovery and the richer personal-view protocol also remain deferred. See the [6c-2 record](../releases/unreleased/restructure-phase-6c-2-2026-10-23.md) for exact validation and backend draft constraints. No full parity, publication or accounting acceptance is claimed.


Phase **6c-3** builds on that app without changing its host or route inventory. It replaces generalized views at **24 destinations**: four booking calendars/resource timelines, two A4 invoice views, eight reports, two customer ledgers, six matrices and two dashboards. Calendars provide day/resource controls, slot defaults, client overlap checks and status commands. Invoice identity and payment terms come from the API; copy/terms/zoom and isolated A4 browser printing follow the source document structure. Reports add periods, grouping, totals, export and ERP2 owner drill-downs; ledgers calculate opening/running/closing balances before search; matrices add periods, bulk fill, bounds, summaries and partial-save retry. Dashboards compose all source data panels and module-owned drill-downs with accessible chart inspection. Generic calendar, charts, report/matrix extensions, grid downloads and English integer spelling live in the appropriate public packages.

This remains a **verified subset, not full source visual/workflow parity**. ERP1 booking drawer/detail geometry, specialized ERP2 booking detail panels, exact source chart/widget geometry, exhaustive invoice pagination/source pixel comparison, report advanced filters/sorting/column and saved-view parity, ERP2 tree breadcrumbs/delete/child tables, board discussion/history and profile statistics/activity layouts remain. Richer personal views and durable cross-route record drafts are deferred. The unchanged draft API still lacks an ERP form contract; no business draft enters browser storage. Source report components have grouped lists and date filters, with no independent pivot designer; none is fabricated. The [6c-3 record](../releases/unreleased/restructure-phase-6c-3-2026-10-24.md) records final checks, exact counts and cleanup. No accounting acceptance, native executable, physical printer, production integration, publication or deployment is claimed.


Phase **6c-5** completes source analytical controls across the eight ERP1/ERP2 report destinations and audits both ledgers and six matrices against their source options. Typed multi-choice/reference, date/numeric range and person-text filters, three-state sorting, full-result group subtotals and CSV/XLSX exports use small additive page-engine contracts. No source pivot designer or comparison-period option exists; matrices have no source export. Both invoice destinations gain measured A4 pagination with repeated headers, carry totals, page/item numbering and one final summary. Public patterns adds pure measured row partitioning. The [6c-5 record](../releases/unreleased/restructure-phase-6c-5-2026-10-24.md) identifies source, validation and retained PDFs. Report saved views/column persistence, all record panels and durable drafts remain in the parallel 6c-4 scope; exact visuals remain separate. A single block exceeding page capacity is explicitly rejected. No protected source, backend or school file changes; no publication, deployment, commit or push.

Phase **6c-4** resumes the partial record work and delivers detailed context: grouped profile fields/statistics/change guidance, support metadata, case conversations/properties/assignee and board history, booking-day context, ERP2 tree breadcrumbs/children/deletion, document summaries, request/approval trails/notes/attachments/related records, process steps and inspection counts. States adds parent context/counts and New defaults. **84 worklist destinations** add account named search/filter/sort/column views and column-only sets, typed conditions, legacy source-view compatibility and failure/retry. Managed rememberFilters and columnLayoutScope choose storage; no preference store is duplicated. Generic RecordPage summary/aside and WorklistPage typed control slots live in page-engines. Patterns adds a browser unload warning. Source ERP forms contain no durable cross-route storage; that requested enhancement remains unimplemented pending an ERP draft service contract. The [6c-4 record](../releases/unreleased/restructure-phase-6c-4-2026-10-24.md) identifies verification; [the 114-destination handoff](../../demo-apps/erp/parity-status.md) names exact remaining composition/lifecycle/draft work. Parallel 6c-5 owns report/ledger/matrix controls and invoice pagination, untouched here. All visual matching remains for its later session. Protected sources and School are unchanged; no commit, push or deployment.

### Phase 6d status

Phase **6d** creates private `@pepbits-demo/school`, a separate Next.js app using the shared API/session/preference/localization/shell host. All **26 Scholaris route patterns** (24 static and two record routes), six role dashboards, sign-in and shared preferences are registered. Session-issued portal grants control the header and direct links; a `?role=` hint never adds authority. School pages, lookup policy, domain contracts and role metadata belong to the demo. CollectionView, WorkflowBoard, Calendar, charts, print surfaces, controls, overlays and resources use public library exports. Small generic additions expose verified account input to product resolution, explicit non-menu module page membership, named icons, metric charts and print snapshots.

This is **not complete source visual/workflow parity**. The unchanged backend denies academic collections to Librarian and Accountant: Librarian Students/Calendar/Notices and Accountant Students/Notices are withheld; unrestricted librarian new-borrower lookup, accountant invoice class labels and class filtering are deferred. All administrator destinations remain. The separate legacy Library student-master/school-fees template examples are deferred in protected source. Shared engine geometry differs from copied renderers. Mounted drafts/retry are preserved, but durable recovery, exhaustive media/canvas/physical printing, human language/accessibility/domain review and institutional acceptance remain outside the evidence. All 100 source tests and five school configuration cases are ported, with added route/profile/axe, host, policy and real HTTP checks. See the [app](../../demo-apps/school/README.md), [source map](../../demo-apps/school/source-mapping.md), [feature guide](../features/school-demo.md) and [6d local record](../releases/unreleased/restructure-phase-6d-2026-10-24.md) for exact counts and evidence. No protected original/ERP files, backend contract, publication, commit or deployment are changed.

Phase **6d-2** keeps the existing app and adds a per-route [parity handoff](../../demo-apps/school/parity-status.md), a read-only source comparison harness, compact line/donut chart options in components and collection-header metadata. School restores authored chart bounds/heights/fills/diameters/colours/centre captions and source table typography, separators and sorting indicators while preserving effective preferences and tenant locks. Calendar restores overflowing event counts and complete event titles. All 26 routes and six role dashboards remain covered; exact remaining states and current test/HTTP scope are in the [6d-2 record](../releases/unreleased/restructure-phase-6d-2-2026-10-24.md). This is a coherent visual subset, not complete source pixel parity. API restrictions and durable drafts remain explicit; no protected source/backend, publication, commit or push.

### Phase 6e-1 status

Phase **6e-1** creates private `@pepbits-demo/reports` (port 3350) and ports the Lumen Reports reference module into `src/modules/reports`: all **19 source page routes** plus the signed-download host adaptation, each one page in the public renderer registry with source deep links. The app uses the shared ApplicationProviders host (session, API preferences/tenant policy, runtime catalog, full shell), `@pepbits/platform/http` and the unchanged `/reference-modules/reports` API. Viewer, builder, dashboards, jobs, schedules, email requests, API keys and administration keep their source workflows over public controls, tables, dialogs, charts, `PrintDocument` and ScreenHost notifications. Generic additions are a tested `BarChart` in components (showcase example included), nine icon exports and `reports` in the shared integration launcher.

All 22 original source cases are retained; route/profile/axe, workflow, adapter, navigation and provider cases are added, with separate real local HTTP verification. See the [app guide](../../demo-apps/reports/README.md), [source map](../../demo-apps/reports/source-mapping.md), [feature contract](../features/reports-demo.md) and [6e-1 record](../releases/unreleased/restructure-phase-6e-1-2026-10-24.md) for exact counts and limits. Fictional data only; no original-source pixel comparison, deployment, publication, commit or push.

### Phase 6e-2 status

Phase **6e-2** creates private `@pepbits-demo/tenant-admin` (Next.js, port 3360) on the shared ApplicationProviders host: API session, API preferences and tenant policy through one update path, runtime catalog and shell. It ports the Allyvora Tenant Admin reference: Overview, Approvals inbox, Activity log and all **30 configuration pages**, which come from the API registry (`GET /meta`) and are drawn by one resource workspace plus record drawer, with `?new=1`/`?open=<id>` deep links. The sidebar follows the registry of the signed-in scope; there is no fixed page list in the frontend. One `tenant-admin` renderer in the public page-renderer registry serves every route and keeps the module's scope-keyed store across navigation.

Library additions are small and additive: public `@pepbits/shell/reference-host` (the generic host/module contract; four identical healthcare module copies now re-export it), 18 direct icon primitives and `tenant-admin` support in the shared integration launcher. All five original test files are ported (56 original cases) with route/profile/axe, provider and adapter coverage, plus separate real local HTTP workflows. The scoped stylesheet and alias maps are frozen copies verified by SHA-256. Exact source pixel parity, mirrored RTL layout and durable drafts are not claimed. See the [app guide](../../demo-apps/tenant-admin/README.md), [source map](../../demo-apps/tenant-admin/source-mapping.md), [feature contract](../features/tenant-admin-demo.md) and [6e-2 record](../releases/unreleased/restructure-phase-6e-2-2026-10-24.md). Fictional data only; no deployment, publication, commit or push.

### Phase 6e-3 status

Phase **6e-3** creates private `@pepbits-demo/onboarding` (port 3370) with the shared `ApplicationProviders` host: demo-API session, API preferences/tenant policy through one update path, runtime catalog and shell with one Orvia onboarding module. It ports the Orvia Health Cloud onboarding demo from `demo-pages/orvia-health-onboarding` (unchanged): landing (care pathway, facility explorer, compliance, workspaces), workspace lookup by address or email, workspace sign-in with SSO notice, 6-digit code and reset (`/sign-in`, source `/login` accepted), the registration wizard (6 steps, 7 for networks; `?type=`/`?structure=` deep links) and the not-found page. One route per page goes through the public renderer registry; AI is off.

Data choice: the unchanged API has no tenant directory, registration, Orvia sign-in or registration-draft contract, so these stay behind the demo's `OnboardingPort` with a fictional device-local adapter scoped by tenant/user, exactly mirroring the source seams; the password is never stored. Library additions are small and additive: public `@pepbits/patterns/wizard` (the generic stepper/wizard assigned from `registration-wizard`), `@pepbits/ui` `OtpInput` (executed in the Showcase control-states example) and optional `Segmented` presentation slots with RTL keys, seven `@pepbits/icons` primitives and an `onboarding` entry in the shared integration launcher. The Orvia vocabulary maps to effective theme/radius/font/scale tokens; most Orvia copy stays English because the protected canonical catalogs have no Orvia keys. The source has no tests; the app adds route/profile/axe, workflow, adapter, rule and provider tests, and a prepared real local HTTP driver. The resume passes 353 focused tests across 24 files; required forced CI/builds, shell Chromium and onboarding HTTP acceptance remain blocked by the shared heavy-check lock. See the [app guide](../../demo-apps/onboarding/README.md), [feature contract](../features/onboarding-demo.md) and [6e-3 record](../releases/unreleased/restructure-phase-6e-3-2026-10-24.md) for exact counts and limits. Fictional demonstration only; no tenant/identity/registration backend, native-speaker review, publication or deployment.

### Phase 6e-7 status

Phase **6e-7** creates private `@pepbits-demo/desktop` (Vite 7, React 19.2, port 3410), replacing `desktop-clients/apps/desktop`. `ApplicationProviders` gains an opt-in `workspace` option: the same session/preference/catalog chain renders `WorkspaceShell` with tabs, split, floating MDI frames, dirty-close/module guards, two-way address sync and a detached single-document mode that refuses foreign-tenant keys. The ported Tauri window port supplies separate native windows; browsers get the unavailable null port. A `useWorkspaceNavigation` fix keeps a record that targets the destination module's landing page when crossing modules. The shared integration launcher can now serve a Vite build with `vite preview`.

The desktop hosts demo-owned pages (workspace overview, Customer Master with record-store editing, read-only Employee Worklist, library examples, preferences, not-found) over the unchanged API's generic worklist/record routes, with AI off unless `VITE_AI_ENABLED=true`. The original `NEXORA_PRODUCT` catalogue is not imported; the [source map](../../demo-apps/desktop/source-mapping.md) records it and how a product plugs in its own catalogue, renderers and adapters. `src-tauri/` is copied with only names and the dev URL changed. **No native Rust/Tauri build, run or native window test was performed**; verification is the web build, typecheck, unit/route/axe tests with mocked APIs and Tauri, and a real local HTTP Chromium check of the web build. Native Sentinel panic forwarding is deferred because the shared host configures no shell monitoring yet. See the [6e-7 record](../releases/unreleased/restructure-phase-6e-7-2026-10-24.md). No commit, push, publication or deployment.

### Phase 6e-6 status

Phase **6e-6** creates private `@pepbits-demo/allyvora-patients` (port 3400) and ports AllyVora patient registration from `source/allyvora-patients`: the register with quick views, search, filters and paging; registration and editing in the five organisation layouts; the record view with gaps, masked activity and status change; and the administrator's form-layout designer with history and live preview. Source URLs are kept as deep links through the public page renderer. Patient data comes from AllyVora's own unchanged Express + SQLite API through a configured adapter and same-origin proxy; the shared demo API supplies sign-in, preferences/tenant policy and runtime catalogs through the shared ApplicationProviders host. The read-only `@allyvora/shared` form definition and rules are consumed unchanged, so the client and API apply the same rules.

Small additive library changes: `SignaturePad` and an optional `SearchSelect` `quickPick` in `@pepbits/ui`, with tests, README and a showcase example. The five arrangements, wristband band and section status parts remain demo-specific presentation (CMP-04), because AllyVora's arrangement is an organisation setting rather than the per-user `formNavigation` preference. Drafts are module memory only (cleared on reload, identity changes or leaving the module for Preferences); no patient values enter browser storage. Adapted or remaining: patient search, recents and layout actions in the global command palette; the header branch switcher; footer API status; reload-surviving drafts; keyboard drawing beyond the paper-form alternative; pixel comparison. The source has no tests to port. See the [app guide](../../demo-apps/allyvora-patients/README.md), [feature contract](../features/allyvora-patients-demo.md) and [6e-6 record](../releases/unreleased/restructure-phase-6e-6-2026-10-24.md). Fictional data; not clinical acceptance, deployment, commit or push.
