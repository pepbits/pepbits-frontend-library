# AllyVora Quality reference module

`@pepbits/reference-quality` renders the AllyVora Quality SOURCE frontend (`reference/frontend/allyvora-quality/allyvora-quality/web`, read only) through the authenticated host.

- Export `ReferenceQualityModule({ path, host })`; also `qualityRoutes` (15: 13 static incl. `/reports/designer`, plus `/indicators/[id]` and `/reports/[id]`), `qualityNavigation` (the 12 source sidebar items with group and permission hint), `qualityPaths`, `resolveQualityRoute`, `createQualityClient`, `./styles.css`, `./quality-copy.json`.
- The host owns the enterprise header and sidebar. The module renders only the page body plus a small toolbar (demonstration-data notice and the "waiting for you" task menu). No source sidebar/header/login/sign-out.

## Backend contract

All calls go through `host.request` (JSON) / `host.fetch` (CSV downloads) with module-relative paths (`/auth/me`, `/meta`, `/indicators`, ...). The host adds `/api`, the namespace `/reference-modules/quality`, credentials and scope headers. There is no token, localStorage, login or browser role switching: `AuthProvider` loads `GET /auth/me` (`{user, permissions}`) and `GET /meta`; `can()` only mirrors server grants and the server maps the host role onto `admin, quality_manager, data_steward, verifier, approver, viewer` and authorizes every request.

- Every POST/PUT/PATCH/DELETE carries `Idempotency-Key` (`crypto.randomUUID()` per call; pass `operationKey` to `api()` to reuse a key for an explicit retry of the same operation).
- Result corrections send the loaded `version`; a stale version (409) keeps the typed correction on screen with the server's message.
- Reads abort on unmount/scope change and late responses are discarded; the workspace is keyed by the authenticated scope, so a tenant/branch/user change remounts it.
- Users page: `host-*@quality.invalid` rows are host identity projections: read-only, with an explanation. The directory never grants platform access; roles come from the host.

## Presentation

- Pages and components are the real source pages (`src/app/(app)/**`, `src/components/**`) mechanically imported by `scripts/quality/import.mjs`, then hand adapted (next/link and navigation -> host hooks, `@/` aliases, host formatters through `useQualityFormat`).
- Controls: `SourceButton/Input/Select/Textarea/DateInput`, shared `Table`/`TableContainer`, `Card` (panels), `Modal`/`Drawer` (body and footer are wrapped in the module scope so scoped utilities also reach portaled overlay content), `ConfirmDialog`, `PrintDocument` (report print). Tabs keep the source markup on `SourceButton` to preserve its look.
- Dates, times, numbers, periods and relative times follow the host preferences (`useQualityFormat`); the source's fixed en-GB/Asia-Dubai are gone (viewer's zone). Page size follows the preference. Density/zebra/sticky come from the shared Table; font scales, radius, theme, reduced motion from the host tokens.
- `src/styles.css` is generated: `node scripts/quality/styles.mjs [--check]` (Node 24; Tailwind 4 from the repository, `scripts/quality/source-design/globals.css` is the byte-exact source theme). Every selector is under `.reference-quality`/`:where(.reference-quality)`; layers flattened, `@property`/`@page` removed, keyframes `quality-*`, fonts/radii/neutrals follow host tokens (`--bg`->surface, `--surface`->panel, `--text`, `--border`...) with the source hex as fallback, source status colors kept; soft tints re-derived for dark host themes. Contrast of source accents on dark themes is not reviewed.
- Copy: all user copy goes through `LocalizedText`/`t()`. `quality-copy.json` (`node scripts/quality/copy.mjs`) maps English literals to `quality.*` keys for the root to merge; `scripts/quality/localize.mjs` was the one-time JSX wrapper, `scan-copy.mjs` a review aid. Values from the server (names, API error messages) pass through.

## Limits

Physical left/right utilities are kept (Arabic gets `dir="rtl"` but layouts are not mirrored); long hi/ml strings unchecked. The report print shows the report through `PrintDocument`; A4 page size/margins are left to the browser (the source `@page` is document-wide). Schedules run only while the backend worker is awake. Tests use fictional fixtures and an in-memory host, not a browser or deployed backend.

## Checks

`npx vitest run packages/reference-quality`, `npx tsc -p packages/reference-quality --noEmit`, `node scripts/quality/styles.mjs --check`, `node scripts/quality/copy.mjs --check`, `node scripts/verify-shared-components.mjs`.
