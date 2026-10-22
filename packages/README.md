# Library packages

The reusable `@pepbits/*` packages. Empty until phase 1 of the [library restructure plan](../docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md).

- One folder per layer: `tokens`, `icons`, `i18n`, `preferences`, `ui`, `components`, `data`, `platform`, `patterns`, `page-engines`, `shell`, `ai`, `testing`.
- The folder name is the package name: `packages/ui` is `@pepbits/ui`.
- A package depends only on the layers below it. `npm run check:boundaries` enforces this.
- No product data, product rules or demo code. Code that only one product needs belongs in that product's repository.
- Packages here never import from `desktop-clients/`, `dummy-api/` or the pre-restructure package names (`ops-ui`, `erp-*`, `reference-*`).
