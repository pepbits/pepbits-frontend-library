# Package restructure plan

Status: **proposal, not approved.** Drafted 21 October 2026 against `main` `01b6578`. Nothing described here is implemented. The owner decides the open questions in the last section before any package moves.

## Summary

The shared packages are sound, but the layout still reflects the first ERP prototype ("Nexora Enterprise ERP"). Every shared package and both shells live under `desktop-clients/`, generic packages carry an `erp-` prefix, and one package (`@pepbits/erp-screens`) imports every product module. This plan builds the intended structure next to the existing one, ports packages one at a time with the build green after each step, and removes the old layout only when nothing uses it.

## Problems this solves

| Problem | Evidence on `main` `01b6578` | Effect |
| --- | --- | --- |
| The library is filed under one shell | The npm workspace root is `desktop-clients/package.json`, named `nexora-monorepo`, and holds `apps/web`, `apps/desktop` and all 31 packages | The path suggests a desktop client; new contributors and consumers cannot tell the shared library from the shells |
| One package bundles every product | `erp-screens` depends on `reference-host` and 16 module packages; `src/reference-modules/library-page.tsx` lazy-imports each module | A Healthcare shell build contains School, ERP, laboratory and every other module, and a change in one product module touches every shell |
| Product knowledge inside shared configuration | `@pepbits/erp-config` exports `REFERENCE_PAGE_BY_ID`, `schoolRoleView` and `legacySchoolModuleAlias`; the web routes special-case `reference-school` | Shared packages must change whenever a product changes |
| Generic packages named after one product | `erp-config`, `erp-data`, `erp-shell` and `erp-screens` are used by Healthcare, School, ERP and Platform | The names mislead and invite ERP-only assumptions |
| Products and building blocks in one flat list | 31 folders in `desktop-clients/packages`: 13 foundation and shell packages and 18 product module packages | No visible ownership; no place to put product-specific shared code |
| Tooling mixed with the library | `dummy-api` (483 files), `demo-pages`, `run.sh` and `run_all.sh` sit at the repository root | Demo and mock material can be mistaken for library contracts |

## Approach: build alongside, port one by one, remove last

1. Create the new structure next to the existing one. The existing layout keeps working throughout.
2. Port one package at a time, in dependency order (leaves first). After each port the full gate passes and the change is merged on its own.
3. When every package, app and tool has been ported and every consumer has moved, remove the old layout and the compatibility shims.

**A port is a move, not a copy.** Two live copies of the same package would drift as soon as anyone fixes a bug in one of them. Each port therefore moves the package with `git mv` (keeping its history) and updates the workspace globs in the same change, so there is only ever one implementation.

- If the package keeps its npm name, nothing else changes for consumers.
- If the package is renamed, the old name stays as a thin, deprecated package that re-exports the new one (a *shim*), so existing imports and consumer archives keep working until they are re-pointed.

## Target layout

```
pepbits-frontend-library/
  package.json              npm workspace root (moved up from desktop-clients/)
  packages/
    core/                   tokens, ui, auth, platform-ports, workspace-core
    shell/                  config, data, shell, screens
    ai/                     ai-config, ai-client, ai-ui
    module-host/            the shell-to-module contract
  modules/
    healthcare/             suite, lis1, lis2, ris1, diagnostics, pharmacy, medband,
                            medslot, rcm, surgisuite, teleconsult, quality
    school/                 school
    erp/                    erp1, erp2, keystone-core
    platform/               tenant-admin, reports
  apps/
    web/                    Next.js shell
    desktop/                Vite + Tauri shell
  tooling/
    mock-api/               today's dummy-api
    e2e/
    scripts/
  demos/
    orvia-health-onboarding/
  docs/
```

Rules the layout enforces (checked by a dependency test added in phase 0):

- `packages/**` never imports `modules/**` or `apps/**`.
- A module imports only `packages/core/**` and `packages/module-host`, plus modules of its own product.
- `apps/**` choose which modules they include.

## Package map

Proposed names; the owner confirms them (see open questions).

| Today | Proposed location | Proposed name | Shim needed |
| --- | --- | --- | --- |
| `tokens` | `packages/core/tokens` | `@pepbits/tokens` | No |
| `platform-ports` | `packages/core/platform-ports` | `@pepbits/platform-ports` | No |
| `auth` | `packages/core/auth` | `@pepbits/auth` | No |
| `workspace-core` | `packages/core/workspace-core` | `@pepbits/workspace-core` | No |
| `ops-ui` | `packages/core/ui` | `@pepbits/ui` | Yes, `@pepbits/ops-ui` |
| `ai-config` | `packages/ai/ai-config` | `@pepbits/ai-config` | No |
| `erp-config` | `packages/shell/config` | `@pepbits/shell-config` | Yes, `@pepbits/erp-config` |
| `erp-data` | `packages/shell/data` | `@pepbits/shell-data` | Yes, `@pepbits/erp-data` |
| `erp-shell` | `packages/shell/shell` | `@pepbits/shell` | Yes, `@pepbits/erp-shell` |
| `ai-client` | `packages/ai/ai-client` | `@pepbits/ai-client` | No |
| `ai-ui` | `packages/ai/ai-ui` | `@pepbits/ai-ui` | No |
| `reference-host` | `packages/module-host` | `@pepbits/module-host` | Yes, `@pepbits/reference-host` |
| `erp-screens` | `packages/shell/screens` | `@pepbits/screens` | Yes, `@pepbits/erp-screens` |
| `reference-healthcare-suite`, `reference-lis1`, `reference-lis2`, `reference-ris1`, `reference-diagnostics`, `reference-pharmacy`, `reference-medband`, `reference-medslot`, `reference-rcm`, `reference-surgisuite`, `reference-teleconsult`, `reference-quality` | `modules/healthcare/<name>` | Unchanged at first | No |
| `reference-school` | `modules/school/school` | Unchanged at first | No |
| `reference-erp1`, `reference-erp2`, `reference-keystone-core` | `modules/erp/<name>` | Unchanged at first | No |
| `reference-tenant-admin`, `reference-reports` | `modules/platform/<name>` | Unchanged at first | No |

Module packages keep their `@pepbits/reference-*` names during the port; renaming them (for example to `@pepbits/healthcare-lis1`) is a separate, later decision because no product consumes them as archives today.

## Module registration instead of hard-wired imports

Today `erp-screens/src/reference-modules/library-page.tsx` lazy-imports 16 module packages, and `erp-config` carries their page tables and School role logic. The target design inverts that dependency:

- `@pepbits/module-host` defines a `ModuleRegistration` type: module id, page descriptors, a lazy component loader, and optional role-view and legacy-route hooks.
- Each module package exports its own registration, including its page descriptors (moved out of `erp-config`) and, for School, its role views (moved out of `erp-config` and out of the web routes).
- `@pepbits/screens` renders whatever registrations it is given and imports no module package.
- Each app passes its list, for example `registerModules([healthcareSuite, lis1, ...])`. The current demo web and desktop apps register every module, so their behaviour does not change; a product shell registers only its own.

This is the only step that changes runtime behaviour, so it is scheduled after the shared packages have moved and it carries browser journeys in its gate.

## Order of work

| Phase | Work | Behaviour change |
| --- | --- | --- |
| 0. Foundation | Move the npm workspace root, lockfile, `turbo.json`, `tsconfig.base.json` and Vitest configuration from `desktop-clients/` to the repository root, with workspace globs covering both `desktop-clients/{apps,packages}/*` and the new folders. Update scripts, Jenkins and deploy paths. Add the dependency-boundary test. | None |
| 1. Core | `tokens`, `platform-ports`, `auth`, `workspace-core`, then `ops-ui` → `ui` | None |
| 2. Shell | `ai-config`, `erp-config` → `shell-config`, `erp-data` → `shell-data`, `erp-shell` → `shell`, `ai-client`, `ai-ui`, `reference-host` → `module-host` | None |
| 3. Modules | Move the 18 module packages into `modules/<product>/`, one product group per change | None |
| 4. Registration | Introduce `ModuleRegistration`; move page tables and School role logic into their modules; `erp-screens` → `screens` without module imports; apps register modules | Yes |
| 5. Apps and tooling | `apps/web`, `apps/desktop`, `e2e`, `scripts`, `dummy-api` → `tooling/mock-api`, `demo-pages` → `demos` | None |
| 6. Consumers | Healthcare, ERP, School and Platform re-pin to a library commit that has the new names and switch their imports, one product at a time | Per consumer |
| 7. Removal | Delete the shims and the empty `desktop-clients/` tree once phase 6 is complete | None |

Phase 0 must come first: npm only links workspaces under its root, so the new top-level folders cannot join the build while the root stays in `desktop-clients/`.

## Gate for every port

Each port is one reviewable change and must pass, from the workspace root:

- `npm ci`, typecheck, the Vitest suite and the API, registry and deployment tests (`npm run ci`).
- Web and desktop builds.
- The dependency-boundary test.
- `node docs/tools/check-docs.mjs`, with moved documentation links updated.
- For phases 4 and 5, and for any port that touches routes or styles: the browser journeys, including `e2e/reference-modules.mjs`.

Paths that ports must update, counted on `main` `01b6578`:

- 36 Tailwind `@source` lines in the two apps.
- The `transpilePackages` list in `apps/web/next.config.ts`.
- `tsconfig.base.json` path settings.
- 59 files under `desktop-clients/scripts` that reference `packages/`.
- 24 references to `desktop-clients` in `Jenkinsfile`, `deploy/`, `run.sh`, `run_all.sh` and `.github/`.

## Consumers

The products consume this library as vendored npm archives built from a pinned snapshot, not from `main`:

| Consumer | Packages vendored today |
| --- | --- |
| Healthcare | `ai-client`, `ai-config`, `ai-ui`, `auth`, `erp-config`, `erp-data`, `erp-screens`, `erp-shell`, `ops-ui`, `platform-ports`, `tokens`, `workspace-core` |
| ERP | Same set |
| School | Same set |
| Platform | `auth`, `erp-config`, `erp-shell`, `ops-ui`, `platform-ports`, `tokens`, `workspace-core` |

Because each product pins a snapshot, the restructure does not affect a product until that product re-pins. Their packaging scripts read package folders by path, so each product's re-pin (phase 6) updates its packaging script and lock file in that product's repository, under its own rules. The shims let a product re-pin first and switch imports afterwards.

## Done when

- Every package, app and tool is in the target layout and `desktop-clients/` is gone.
- No package under `packages/` imports a module, enforced by the boundary test.
- Every consumer has re-pinned and imports only the new names.
- The shims are deleted, and the release record lists every rename as a breaking change with its replacement.

## Out of scope

- Behaviour or visual changes other than module registration.
- Publishing to an npm registry; distribution stays as vendored archives.
- Renaming the module packages (`@pepbits/reference-*`).
- The `orvia-health-onboarding` demo's own dependencies (Next 15, Node 18–22); it moves as-is.

## Open questions for the owner

1. Confirm the new package names, especially `ui`, `shell-config`, `shell-data`, `shell`, `screens` and `module-host`.
2. Confirm the top-level folders `packages/`, `modules/`, `apps/`, `tooling/` and `demos/`.
3. Keep `dummy-api` and the demos in this repository under `tooling/` and `demos/`, or move them to their own repositories.
4. How long the shims stay after the last consumer re-pins: one library release, or a fixed date.
5. Which session owns the work, given that the frontend library is maintained by its own session (`fix/central-navigation-review` worktree).
