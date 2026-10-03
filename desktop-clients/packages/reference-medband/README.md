# @pepbits/reference-medband

MedBand patient access (today's desk, patient search and wristband record, registration, encounters, admission queues, episodes
and cases) rendered inside the authenticated host. Source: `reference/frontend/medband-patient-access-1/medband`. This package
holds the front end only; every record, master list and the trusted identity arrive through `host.request` from the backend
namespace `/reference-modules/medband` (`/bootstrap`, `/master`, `/patients`, `/episodes`, `/cases`, `/encounters`,
`/admission-requests`, `/audit/:entity/:id`). It contains no business fixtures.

```ts
import { ReferenceMedbandModule, medbandRoutes, medbandNavigation } from "@pepbits/reference-medband";
import "@pepbits/reference-medband/styles.css";
```

## Routes (module-relative)

`/`, `/patients`, `/patients/new`, `/patients/[id]`, `/encounters`, `/encounters/new`, `/admissions`, `/admissions/new`, `/episodes`.
`resolveMedbandRoute(path)` keeps the query string, captures the decoded `[id]` and rejects traversal, encoded separators and
control characters. The host registry registers the module as `reference-medband`, variant `medband`; this package adds no menu or grant.

## Adaptations

- Shared host header/sidebar replace the source header and rail; the working toolbar (quick search Ctrl/Cmd+K, Register, New
  encounter, counter switcher) stays. "Reset demo data" is removed (the backend blocks `/admin/reset` for embedded hosts).
- `lib/master-data` globals became a scope-bound registry (`createMaster`, `MasterProvider`, `useMaster`): one immutable
  registry per bootstrap, so a tenant/branch/user change never reads the previous masters.
- The store loads `/bootstrap` before any page, aborts every request on unmount, and is remounted under `referenceScopeKey(host.scope)`.
- Errors keep the backend `status`, `code`, `field` (`ApiRequestError`); network failure is status 0 `NETWORK`.
- Writes carry an `Idempotency-Key`; a write whose outcome was lost is replayed under the same key.
- Dates, times, ages and amounts use the host formatter; keyboard shortcuts follow the host preference; encounters list steps by
  the managed page size.
- Removed seed coupling: fixed counter/department ids, named demo patients, the invented call link, the fixed USD currency.

## Presentation: the reference skin is the default

The module shows the original MedBand skin (teal scrub palette, Public Sans, 16px type, source geometry and table cells) while the
effective host preferences are at their defaults. `medbandPresentation(preferences)` sets three switches on the module root:
`data-medband-palette` (`host` for any non-default theme: the palette is re-expressed on the host tokens), `data-medband-font`
(`host` for any non-default font family) and `data-medband-table` (`host` for non-default density or wrapping: managed table padding
and wrapping apply). Corner radius and the three font scales are always preference-driven (source geometry at the defaults).
Toast position/duration and the host's pointer cursor are host behaviour, not skin. The modal is the source markup with the shared
dialog behaviour (see `components/ui/overlay.tsx` for why it is not the shared `Modal`). `cx` reproduces tailwind-merge.

## Parity checks

`src/controls-parity.test.tsx` (source class strings, control/dialog/toast/multiselect behaviour, presentation switches),
`src/cx.test.ts` (merge semantics; differential against the real tailwind-merge when the reference's copy is present) and
`src/styles.test.ts` run with the normal suite. `src/browser-parity.test.ts` is opt-in (`MEDBAND_BROWSER_PARITY=1`, Chromium from the
diagnostics browser install): `scripts/medband/parity/run.mjs` mounts the real module over the host stylesheet and compares every
element's computed colour, border, radius, spacing, type, shadow and fixed size with the same class string on a page that carries
only the original stylesheet, on all routes, in open dialogs/popovers/toasts/validation, on hover/focus, and checks that managed
preferences still win.

## Scripts (from `desktop-clients`)

`node scripts/medband/styles.mjs [--check]` (Tailwind 4 design -> scoped `src/styles.css`), `node scripts/medband/copy.mjs [--check]`
(`medband-copy.json`, English message -> catalog key), `node scripts/medband/import.mjs` and `node scripts/medband/localize.mjs`
(the one-time mechanical import and its type-driven localization pass; the import is not re-runnable over the hand adaptation without `--force`).
