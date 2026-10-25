# Library packages

The reusable `@pepbits/*` packages. Phase 7a of the [library restructure plan](../docs/architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-7a-status) prepares twelve packages at **0.1.0** for GitHub Packages. They are not published yet:

| Package | Purpose |
| --- | --- |
| [@pepbits/tokens](tokens/README.md) | Hand-written CSS, typed token names and opt-in licensed fonts |
| [@pepbits/icons](icons/README.md) | Primitive Lucide exports and an accessible icon wrapper |
| [@pepbits/i18n](i18n/README.md) | Host-owned catalogs, core translations, localization helpers, formatters and React localization |
| [@pepbits/preferences](preferences/README.md) | Defaults, validation, tenant policy, themes and a controlled React host |
| [@pepbits/ui](ui/README.md) | Primitives, controls, selection, status and navigation |
| [@pepbits/components](components/README.md) | Cards, tables, overlays, editing, presentation preferences and recovery |
| [@pepbits/data](data/README.md) | Record transports/editor, draft policy/storage, CSV imports, approvals, panels and failures |
| [@pepbits/platform](platform/README.md) | Host-configured sessions/recovery, monitoring, navigation, windows and device ports |
| [@pepbits/patterns](patterns/README.md) | Lifecycle, master transfer, DCP fields, approvals, drafts, imports and screen-host contracts |
| [@pepbits/page-engines](page-engines/README.md) | Typed record, worklist, form and template engines with host adapters and a renderer registry |
| [@pepbits/ai](ai/README.md) | Host-supplied AI configuration, redaction/transport, assistant modes and optional shell extension |
| [@pepbits/shell](shell/README.md) | Generic host/ScreenHost provider, full chrome, workspace tabs/split/MDI/window adapter, documentation/help layers, session lock and monitoring |

Run `npm install` and `npm run ci` from the repository root. Each package builds ESM JavaScript and declarations to `dist`, with CSS modules and font assets preserved. Workspace TypeScript, Next webpack, Vite and Vitest opt into `pepbits-source`; installed consumers use `types`/`import`/`default` exports and need no `transpilePackages`. Scan installed `dist` directories for Tailwind utilities, or workspace `src` during development. The root boundary check permits data to import i18n/preferences, platform to import i18n/preferences/data, and AI to import through shell. AI is implemented above shell in phase 5b.

- One folder per layer: `tokens`, `icons`, `i18n`, `preferences`, `ui`, `components`, `data`, `platform`, `patterns`, `page-engines`, `shell`, `ai`, `testing`.
- The folder name is the package name: `packages/ui` is `@pepbits/ui`.
- A package depends only on the layers below it. `npm run check:boundaries` enforces this.
- No product data, product rules or demo code. Code that only one product needs belongs in that product's repository.
- Packages here never import from `desktop-clients/`, `mock-api/` or the pre-restructure package names (`ops-ui`, `erp-*`, `reference-*`).

## Versioning and manual releases

See [Publishing](../docs/development/PUBLISHING.md) for Changesets, `release:version`, `release:build`, `release:pack`, token configuration and the manual-only `release:publish`. Pack creates twelve local tarballs and checks their file lists; it never writes to a registry. Private demos and `@pepbits/tsconfig` remain unpublished; `@pepbits/testing` is reserved and absent. The existing `@pepbits/patterns/testing` subpath remains available, with an optional `@testing-library/react` peer for test consumers.

CSS is marked as a side effect. No CommonJS build is provided. Relative JavaScript/declaration imports and worker URLs use `.js`; client directives survive. Internal package ranges are `^0.1.0`, React/React DOM stay host peers, and the package license is `UNLICENSED` (bundled fonts retain their OFL licenses). No component API, rendering behavior, preference policy or canonical catalog changes are part of this increment.
