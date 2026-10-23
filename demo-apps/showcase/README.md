# Showcase

An independent Next.js 16.3.3 / React 19.2 / Tailwind 4.1 component gallery. All runtime library imports use public `@pepbits/*` exports. The temporary header and side navigation live in [src/app-frame.tsx](src/app-frame.tsx); the full shell frame, shell demonstrations and AI demonstrations remain pending phase 5 part 2 / 5b after merging with `main`.

From the repository root:

```sh
npm install --cache /tmp/phase6a-npm-cache
npm run dev -w @pepbits-demo/showcase
npm run typecheck -w @pepbits-demo/showcase
npm test -w @pepbits-demo/showcase
npm run build -w @pepbits-demo/showcase
npm run start -w @pepbits-demo/showcase
```

Dev/start use port 3300. Dev and the production build use Webpack, matching the CSS-module and module-worker contracts of the public source packages. Root `npm run ci` includes this app’s real build, typecheck and tests. No nested desktop dependencies are installed.

## Browse and experiment

Open Foundations, UI primitives, Components, Patterns or Page engines. Search by export name. Each example has a reset button and an expandable source block with clipboard copy and a manual-copy fallback. Code identifiers and fictional record values remain literal. The persistent side controls change effective language, theme, density, motion and shortcuts. The preferences/policy page also exposes independent shell/form/result scales, font, radius, formats, table settings and simulated locks/allowed page sizes.

Change language to Arabic to test RTL without losing example values. Hindi and Malayalam are available. The demo catalog has all four languages; existing shared messages come from a generated subset of the canonical catalogs. Generated translations are not native-speaker acceptance.

## Examples and snippets

[src/examples](src/examples) contains one executable TSX file per example. Each file imports only React and public library exports and includes its adapter/definition where needed. [src/catalog.ts](src/catalog.ts) assigns files to areas and lists their exports. [scripts/generate-snippets.mjs](scripts/generate-snippets.mjs) reads those exact files before dev/build/typecheck/test; it rejects non-public imports. Displayed source is never a second handwritten implementation.

To add an example, create a TSX file with an exported component, register it in the catalog, and run the generation/typecheck/test scripts. Include effective hooks, policy guards and real adapter wiring. Place reusable missing controls or variants in their library package with tests and a package-guide update. Tests check every snippet and all primitive/component runtime export names.

[scripts/generate-catalogs.mjs](scripts/generate-catalogs.mjs) selects shared messages from the protected canonical source without changing it. Run this script after adding message keys or changing their canonical source, then regenerate snippets. New app navigation copy belongs in [src/catalogs.ts](src/catalogs.ts) with en/ar/hi/ml entries. Do not hand-edit generated catalogs.

## Host and limits

[src/providers.tsx](src/providers.tsx) composes controlled `SessionProvider` → `PreferenceHost` → `LocalizationProvider` → part-1 `ShellProvider`, which mounts `ScreenHostProvider` through its public bridge. It adds effective `PresentationProvider` for standalone composites. Shell applies language, direction, theme, font scales, radius and reduced motion. The single preference update callback accepts valid editable patches in memory; there is no second preference store.

The identity, roles, tenant and records are fictional. No credential, backend or production endpoint is configured. Preference and policy changes disappear on reload. Record/draft adapters are isolated session memory, with explicit recovery and version checks; no durable draft claim is made. Local policy controls demonstrate presentation guards and are not authorization.

Lifecycle permits illustrative draft editing/validation; independent approval/publication/activation are disabled because there is no server or second actor. Approval and import adapters simulate only the displayed workflows. The worklist transport handles relative requests in memory. Native devices, production services, deployment and native-speaker acceptance are outside this app. Shell and AI pages explicitly remain placeholders. Deferred phase 4a authoring/device/label screens are not exported by this worktree and therefore are not invented in the gallery.

See the [feature guide](../../docs/features/showcase.md), [source mapping](source-mapping.md) and [phase 6a record](../../docs/releases/unreleased/restructure-phase-6a-2026-10-23.md) for acceptance evidence and pending work.
