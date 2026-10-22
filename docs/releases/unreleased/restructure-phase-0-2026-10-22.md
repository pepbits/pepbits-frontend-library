# Library restructure phase 0 — 22 October 2026

Status: implemented, locally verified. Date: 2026-10-22. Base: `1ed8613`. No tag, package version or deployment. [Restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-0-status).

## Changes and user impact

Adds a new, independent npm workspace at the repository root for the restructured library: `packages/*`, `demo-apps/*` and `tooling/*`. It contains no library code yet, only shared tooling:

- `package.json` (`pepbits-frontend-library`, `packageManager` `npm@11.13.0`), `package-lock.json` (lockfile version 3), `turbo.json` and `tsconfig.base.json`.
- `tooling/tsconfig` (`@pepbits/tsconfig`): `base.json`, `react-library.json` and `nextjs.json`. `types` is explicit so ambient types never leak in from another `node_modules` folder.
- `tooling/scripts/check-boundaries.mjs`, the dependency-boundary check, and its 14 tests.
- `packages/README.md` and `demo-apps/README.md`, stating the rules for each folder.

There is no change for users of any application. Every current app, package and script still builds and runs from `desktop-clients/` exactly as before.

## Boundary rules now enforced

`npm run check:boundaries` fails on: a layer depending on a layer above it; library packages using demo apps; demo apps using each other; relative imports that leave a package; imports into another package's `src/`; `@pepbits/*` imports not declared in `package.json`; `@pepbits/testing` outside tests, stories and devDependencies; tooling packages outside devDependencies; `mock-api` importing frontend packages; package folders that are not a layer or whose name does not match the folder; non-private demo apps. Any `@pepbits/*` name that is not a layer (such as `ops-ui`, `erp-screens` or `reference-*`) is rejected, so new code cannot depend on existing code.

## Isolation from existing code

`desktop-clients/`, `dummy-api/`, `Jenkinsfile`, `deploy/`, `run.sh`, `run_all.sh` and `.github/` are unchanged (`git diff` empty for those paths). `desktop-clients` is not in the root workspace globs, so npm and Turborepo still treat it as its own project:

| Check, run in `desktop-clients/` | Before root install | After root install |
| --- | --- | --- |
| `npm prefix` | — | `desktop-clients` (not the repository root) |
| Turborepo workspace graph (`turbo run build --dry=json`) | 34 workspaces | 34 workspaces, identical list |
| `npm run typecheck` | passed | passed |
| `npx vitest run` | 231 files passed, 2 skipped; 2,606 tests passed, 7 skipped | first run: 1 failed, 2,605 passed, 7 skipped; full rerun: 231 files passed, 2 skipped; 2,606 tests passed, 7 skipped |

The single first-run failure was `packages/reference-medband/src/flows.test.tsx` › "the new-encounter form for each visit type, on each of its steps", which timed out at 5,187 ms against its 5,000 ms limit. The same test took 2,812 ms in the baseline run and passed three times out of three when run alone after the root install (2,295–2,441 ms). A second full run, with the root workspace still installed, matched the baseline exactly. The timeout is treated as load-dependent and is not a regression; the test's 5,000 ms limit has little headroom under a full parallel run.

Root install adds only `turbo` 2.11.10 and `typescript` to a root `node_modules`; no `@types` packages are installed there. Running `turbo` inside `desktop-clients/` writes an untracked `desktop-clients/AGENTS.md` (Turborepo agent rules); the file produced by this verification was deleted and is not part of the change.

## Verification and limits

From the repository root, after `npm install`: `npm run ci` passed (boundary check: 0 packages, 0 demo apps; tooling tests 14/14; Turborepo typecheck, test and build ran with no tasks because no package exists yet). `node docs/tools/check-docs.mjs` passed.

Not run: browser journeys, API tests, `verify:*` gates and builds in `desktop-clients/`, because no file under it changed; GitHub Actions and Jenkins, which still build only `desktop-clients/`. The root workspace is not yet wired into any hosted CI. Node is 22.22.1 locally; npm is 9.2.0 locally although `packageManager` declares 11.13.0, matching `desktop-clients`.

## Upgrade, rollback and publication

Nothing is published or deployed. Rollback is reverting the source commit; no running site or consumer is affected, since products pin their own vendored snapshots.
