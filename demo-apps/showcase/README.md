# Showcase

An independent Next.js 16.3.3 / React 19.2 / Tailwind 4.1 component gallery. All runtime library imports use public `@pepbits/*` exports. [src/app-frame.tsx](src/app-frame.tsx) is a thin `WorkspaceShell` composition. The library owns its header, sidebar, footer, document canvas, tabs and layers. Eight routes contain 61 executable examples, including ten Shell and three AI examples.

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

Open Foundations, UI primitives, Components, Patterns or Page engines. Search by export name. Each example has a reset button and an expandable source block with clipboard copy and a manual-copy fallback. Code identifiers and fictional record values remain literal. The compact page controls change effective language, theme, density, motion and shortcuts. The preferences/policy page also exposes independent shell/form/result scales, font, radius, formats, table settings and simulated locks/allowed page sizes.

Change language to Arabic to test RTL without losing example values. Hindi and Malayalam are available. The demo catalog has all four languages; existing shared messages come from a generated subset of the canonical catalogs. Generated translations are not native-speaker acceptance.

## Examples and snippets

[src/examples](src/examples) contains one executable TSX file per example. Each file imports only React and public library exports and includes its adapter/definition where needed. [src/catalog.ts](src/catalog.ts) assigns files to areas and lists their exports. [scripts/generate-snippets.mjs](scripts/generate-snippets.mjs) reads those exact files before dev/build/typecheck/test; it rejects non-public imports. Displayed source is never a second handwritten implementation.

To add an example, create a TSX file with an exported component, register it in the catalog, and run the generation/typecheck/test scripts. Include effective hooks, policy guards and real adapter wiring. Place reusable missing controls or variants in their library package with tests and a package-guide update. Tests check every snippet and all primitive/component runtime export names.

[scripts/generate-catalogs.mjs](scripts/generate-catalogs.mjs) selects shared messages from the protected canonical source without changing it. Run this script after adding message keys or changing their canonical source, then regenerate snippets. New app navigation copy belongs in [src/catalogs.ts](src/catalogs.ts) with en/ar/hi/ml entries. Do not hand-edit generated catalogs.

## Host and limits

[src/providers.tsx](src/providers.tsx) composes controlled `SessionProvider` → `PreferenceHost` → `LocalizationProvider` → `ShellProvider`, which mounts `ScreenHostProvider` through its public bridge. The shell supplies effective `PresentationProvider` for composites; `AiShellExtension` fills the public extension slots from above shell. Shell applies language, direction, theme, font scales, radius and reduced motion. The single preference update callback accepts valid editable patches in memory; there is no second preference store.

The identity, roles, tenant and records are fictional. No credential, backend or production endpoint is configured. Preference and policy changes disappear on reload. Record/draft adapters are isolated session memory, with explicit recovery and version checks; no durable draft claim is made. Local policy controls demonstrate presentation guards and are not authorization.

Lifecycle permits illustrative draft editing/validation; independent approval/publication/activation are disabled because there is no server or second actor. Approval and import adapters simulate only the displayed workflows. The worklist transport handles relative requests in memory. Native devices, production services, deployment and native-speaker acceptance are outside this app. Shell examples operate the actual workspace and its layers. AI is an explicit echo simulation, off by default. Phase 4c adds spreadsheet, form designer, label printing, identity devices and device integrations on Patterns, with explicit in-memory adapters and platform port simulations.

See the [feature guide](../../docs/features/showcase.md), [source mapping](source-mapping.md) and [phase 6a record](../../docs/releases/unreleased/restructure-phase-6a-2026-10-23.md) for acceptance evidence and pending work.

## Full shell and AI examples

Navigate through the sidebar, header Shell/AI quick pages, workspace tabs or command palette. Confirmed workspace changes update the local route; browser back/forward opens the corresponding document. Preferences remain in the same host. Use the playground to change physical sidebar placement, hover/click expansion, pin/focus behavior or simulate locks; the public preferences page follows those locks too. The profile menu opens preferences or signs out into the controlled login.

The Shell route demonstrates tabs and split canvas, MDI frame geometry, a fictional detached-window port with reattachment, command search, a fictional documentation drawer, help/tours, toasts, session expiry, `PreferencesPage`, and `LoginScreen`. Select Help → Tour → Play to visit the gallery/search anchors. The window port performs no OS operation or child-window bootstrap. The library may remember resized MDI dimensions by document type in browser storage; no record content is stored there. Login/renewal ignore arbitrary fictional input; no credential is configured, stored or transmitted.

In Preferences and policy, turn on **Enable AI simulation**, then choose **AI**. Inspect the displayed fictional item and classified owner, invoke the allowed inline action, and compare the assistant’s panel/terminal modes and transparency view. The blocked export action is removed by policy. Assembly masks the classified owner before review and echo dispatch. The read-only administration view shows fictional configuration and usage without a provider destination or credential. Turn AI off to remove these surfaces and stop policy/configuration/usage calls.

The explicit echo dispatch never calls its request port. Policy/configuration/usage responses come from [src/ai-simulation.ts](src/ai-simulation.ts), which performs no I/O and rejects every write. **This is a simulation: real servers enforce permissions, egress, redaction and limits (PREF-08).** Displayed quotas are illustrative. No provider, production integration, native executable or deployment is tested.

Tests cover all routes inside the full shell in four preference scenarios with axe, sidebar/command navigation with shortcuts on/off, shell interactions and enabled/disabled AI. The local production browser smoke lives in [scripts/smoke.mjs](scripts/smoke.mjs); its exact launcher, counts and source identity are in the [follow-up evidence](../../docs/releases/unreleased/restructure-phase-6a-2026-10-23.md#follow-up--full-shell-and-ai-pages). Run root `npm run ci` for fresh forced build/typecheck/test tasks and run the shell Chromium suite separately with `npm run test:browser -w @pepbits/shell`.

## Phase 4c pattern flows

Patterns includes five additional executable examples: edit/recalculate a costing spreadsheet and audit its export; edit/save a form draft and preview its fields; generate synthetic label artwork and inspect stock; start a fictional identity capture that always routes to manual review; and queue/dispatch a fictional label through the platform connector. All data and operation receipts are volatile. The designer example supports draft save/preview only; catalog mutation and release governance return a clear host-required rejection. The ported reusable designer includes those complete interfaces and UI for a real adapter.

The identity/device examples use `withIdentityConnector` and `withDeviceConnector` with in-memory `createIdentityDeviceConnector`/`createDeviceConnector` calls. No hardware, driver, provider, raw biometrics or production identity is involved. Labels use synthetic base64 SVG as an image resource; browser printing is explicit. Canonical identity localization keys are retained with generic subject wording supplied by this host. Catalog generation excludes dependency folders and includes dynamically composed designer/label/device message families.

`src/patterns-priority3.test.tsx` covers all five live flows. Existing whole-page axe scenarios include the new surfaces in default, Arabic RTL, reduced-motion and locked-density modes. Counts and source identity are in the [phase 4c record](../../docs/releases/unreleased/restructure-phase-4c-2026-10-23.md).

Phase 6b-3 adds Native controls on UI primitives: five public native-layout controls and AsyncLookup with fictional in-memory search. Form values and selection disappear on reload. Its executable source generates the copyable snippet; the existing four-profile gallery axe tests cover the card. See the [6b-3 record](../../docs/releases/unreleased/restructure-phase-6b-3-2026-10-23.md).

Phase 6b-9 extends that example with public SourceTimeInput and SourceDateTimeInput. Both retain native machine values and share the effective control presentation. See the [MedSlot record](../../docs/releases/unreleased/restructure-phase-6b-9-2026-10-23.md).

The phase 6c-1 Select example also exercises public `optionsFromChildren` and `splitFieldClasses` interoperability helpers. The generated source snippet is refreshed; no new showcase route is added.
