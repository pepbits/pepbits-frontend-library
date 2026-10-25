# Library restructure phase 7b — first publication, 25 October 2026

Status: published. Date: 2026-10-25. Source: `60b1428` (phase 7a merged). Registry: GitHub Packages, `https://npm.pkg.github.com`, scope `@pepbits`. [Restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-7b-status) · [Publishing guide](../../development/PUBLISHING.md).

## What was published

All 12 library packages at **0.1.0**, built and packed by `npm run release:publish` from the main checkout on the shared development server, using an owner-provided classic token with `write:packages` (read from a local file outside the repository; never committed or logged):

`@pepbits/ai`, `@pepbits/components`, `@pepbits/data`, `@pepbits/i18n`, `@pepbits/icons`, `@pepbits/page-engines`, `@pepbits/patterns`, `@pepbits/platform`, `@pepbits/preferences`, `@pepbits/shell`, `@pepbits/tokens`, `@pepbits/ui`.

`@pepbits/tsconfig` and the demo apps remain private and were not published.

## Verification

| Check | Result |
| --- | --- |
| `npm whoami` against GitHub Packages before publishing | authenticated; `@pepbits/ui` returned 404 (not yet published) |
| `npm run release:publish` | exit 0; 12 `+ @pepbits/<name>@0.1.0` lines |
| `npm view @pepbits/<name> version` for all 12 | 0.1.0 for every package |
| Clean install in an empty folder outside the repository (`.npmrc` pointing `@pepbits` at GitHub Packages) of `ui`, `shell`, `page-engines`, `tokens` with React 19 | exit 0; npm resolved 11 `@pepbits/*` packages from the registry; ESM import of `@pepbits/i18n` returned 15 exports |

The Next.js and Vite consumer builds from the identical packed tarballs are recorded in the [phase 7a record](restructure-phase-7a-2026-10-25.md).

## Consumers, rollback and next steps

Consumers need an `.npmrc` with `@pepbits:registry=https://npm.pkg.github.com` and a token with `read:packages` (see the publishing guide). No product repository has been switched yet; that is phase 7c, one repository at a time with the owner's permission. A bad release is handled by publishing a fixed patch version and deprecating the bad one (`npm deprecate`); GitHub Packages allows deleting a private package version from the organization's package settings if required.
