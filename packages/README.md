# Library packages

The reusable `@pepbits/*` packages. Phases 1 and 2 of the [library restructure plan](../docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-2-status) add six unpublished source packages alongside the existing workspace:

| Package | Purpose |
| --- | --- |
| [@pepbits/tokens](tokens/README.md) | Hand-written CSS, typed token names and opt-in licensed fonts |
| [@pepbits/icons](icons/README.md) | Primitive Lucide exports and an accessible icon wrapper |
| [@pepbits/i18n](i18n/README.md) | Host-owned catalogs, core translations, localization helpers, formatters and React localization |
| [@pepbits/preferences](preferences/README.md) | Defaults, validation, tenant policy, themes and a controlled React host |
| [@pepbits/ui](ui/README.md) | Primitives, controls, selection, status and navigation |
| [@pepbits/components](components/README.md) | Cards, tables, overlays, editing, presentation preferences and recovery |

Run `npm install` and `npm run ci` from the repository root. Packages expose TypeScript source and have typecheck/test scripts; there is no library build or publication step yet. The root boundary check permits preferences to depend on tokens and i18n; other layer rules are unchanged.

- One folder per layer: `tokens`, `icons`, `i18n`, `preferences`, `ui`, `components`, `data`, `platform`, `patterns`, `page-engines`, `shell`, `ai`, `testing`.
- The folder name is the package name: `packages/ui` is `@pepbits/ui`.
- A package depends only on the layers below it. `npm run check:boundaries` enforces this.
- No product data, product rules or demo code. Code that only one product needs belongs in that product's repository.
- Packages here never import from `desktop-clients/`, `dummy-api/` or the pre-restructure package names (`ops-ui`, `erp-*`, `reference-*`).
