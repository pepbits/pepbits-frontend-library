# AllyVora front desk pages — 26 October 2026

Status: **frontend copy merged; served on the hub test instance (port 3510); owner approved commit and push**. Deployed to the test site (see below).

## Changes and user impact

AllyVora Patients gains two front-desk pages copied from the AllyVora clinical workspace (repository `pepbits/dev`, commit `1ede87f`, `healthcare/allyvora-consulation/allyvora/frontend`):

- **Start a visit** at `/allyvora-patients/visits/new` (optional `?patient=<id>`): find patient → choose service → visit details → done.
- **Emergency registration** at `/allyvora-patients/emergency`: unknown or unverified patients with alias and temporary MRN.

Both appear under Patients in the module navigation. Existing register, new, edit and view pages are unchanged. Markup, classes and the CSS module are copied; source colour names map to library theme tokens, so the pages follow the user's theme and dark mode. Links to screens absent from this demo are shown disabled. The provenance, file hashes and the exact API contract the pages expect are in `demo-apps/healthcare/src/modules/registration/front-desk/provenance.json`.

## Data and limits

Frontend only, by owner decision: the backend is built in a separate session. The pages call the source paths (`/patients?q=`, `/front-desk/overview`, `/patients/{id}/visit-context`, `POST /patients/{id}/visits`, `/services`, `/identity-policy/library`, `POST /patients/duplicates`, `POST /patients`) at `NEXT_PUBLIC_ALLYVORA_FRONT_DESK_API_URL` (default `/api`, read at build time). Without that backend they show their empty and error states. English only; Arabic, Hindi and Malayalam catalogues are a follow-up. `lucide-react` is declared for five icons `@pepbits/icons` does not export.

## Verification

Node 24.21.0, worktree `feature/allyvora-front-desk` from main `13354a1`. Healthcare typecheck passed; module `routes.test.tsx` 50/50 (new routes in four preference profiles with axe), `workflows.test.tsx` 19/19, navigation tests passed; the app-level AllyVora route cases 28/28 after the wait update (the remaining app route cases passed before that edit and were not rerun). `check-boundaries.mjs` passed; `git diff --check` clean. Production build of the healthcare demo served on the hub test instance with the instance's mock API and AllyVora API; both pages rendered after demo sign-in with no page errors (reviewer screenshots). Full CI, live integration and test-site packaging were not run for this change.

## Test-site deployment

26 October 2026 23:41Z (27 October 03:41 UAE): release `20261026233735142-3a097902` from main `3a09790` (sha256 `8dce0a7ef7f8277623b35f06245aafc49ea7375191a6b0d09db901283157e4f9`, `verify-test-site.mjs` passed) deployed to https://frontend.test.pepbits.com through the pb-srv5 receiver after owner approval (previous `20261026143049475-bc1b6413`). `__nexora-release.json` reports the new id; register, new, view, edit, legacy `?mode=view`, Start a visit and Emergency registration return 200. Test site only, not production.

## Rebuilt on @pepbits components — 27 October 2026

Owner feedback: the copied pages did not follow the @pepbits components. Both pages are rebuilt the way the rest of AllyVora Patients is built; routes, steps, fields, validation, API calls and payloads (`lib.ts`, unchanged), empty and error states and the disabled links to screens absent from the demo are unchanged.

- Controls: `@pepbits/ui` `Button`, `IconButton`, `Input`, `DateInput`, `Select`, `Textarea`, `Checkbox`, `Radio`, `Segmented` (visit type, walk-in/referred, priority, administrative sex, known/unknown patient), `Badge`, `Avatar`, `Skeleton`; `@pepbits/components` `EmptyState` and `ErrorState`; the module's shared `Notice` for alerts and problem lists.
- Progress: the `@pepbits/patterns/wizard` `WizardStepper`, read-only and laid out as one row, for find patient → choose service → visit details → done.
- Icons: all from `@pepbits/icons`; the five icons it does not export are replaced by the nearest ones (Activity, FolderHeart, Truck, CircleHelp, UserRound).
- Theme and preferences: semantic tokens and `--fs-scale` text sizes, so theme, dark mode, font scale and radius apply; field gaps follow density; times use the host time format; the `/`, number-key and Ctrl/⌘+Enter shortcuts and their key hints follow the keyboard-shortcut preference.
- Removed: the copied `ui.tsx` and `kit.tsx`, `start-visit.module.css`, the generated `styles.css` with its generator `scripts/allyvora-front-desk-styles.mjs` and its `globals.css` import, and the `lucide-react` dependency of the healthcare demo (lockfile updated offline; `@pepbits/icons` still depends on it). `clsx` stays because other healthcare modules use it.
- `provenance.json` records the rebuild and keeps the API contract.

Verification (Node 24.21.0, worktree `feature/front-desk-pepbits-components` from main `90a7804`, uncommitted working tree): healthcare `tsc --noEmit` passed; vitest `src/modules/registration/routes.test.tsx` 54/54, `workflows.test.tsx` 19/19, `navigation.test.ts` 24/24, new `front-desk/front-desk.test.tsx` 4/4 (visit steps advance with the unchanged POST payload, referral validation, emergency validation and unknown-patient payload, axe on the visit details and consent forms), `src/routes.test.tsx` 904/904; `check-boundaries.mjs` passed; `check-docs.mjs` passed; `git diff --check` clean. Tests use a mocked front desk API. Not run: production build, browser rendering on the test instance, full CI, test-site deployment.
