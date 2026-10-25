# Demo API folder rename: dummy-api → mock-api — 25 October 2026

Status: implemented, locally verified. Date: 2026-10-25. Base: `ac6439c`. No tag, package version or deployment. [Restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#mock-api-rename-status).

## Changes and user impact

- The demo API folder `dummy-api/` is now `mock-api/` (483 tracked files, recorded by git as renames). Its package name changes from `nexora-dummy-api` to `nexora-mock-api`; no code in the API changes apart from comments and README command examples.
- A committed symbolic link `dummy-api → mock-api` stays at the repository root. `desktop-clients/`, `.github/workflows/ci.yml`, `Jenkinsfile` and `run.sh` still use the old path and are not edited; the link keeps them working. It is removed with `desktop-clients/` in phase 8.
- 101 files in `demo-apps/`, `tooling/`, `packages/README.md` and current documentation now say `mock-api`, including the integration launcher's runtime-artifact comparison and the boundary check's mock-api rule. Historical release records and their evidence keep the original path.

There is no change in behaviour for any application. Environment variables such as `<DEMO>_RUNTIME_ARTIFACTS` keep their names; point them at the `mock-api` folder (the old `dummy-api` path also resolves through the link).

## Verification and limits

| Check | Result |
| --- | --- |
| `npm run ci` (boundary check, tooling tests, forced Turborepo typecheck/test/build) | passed: 12 packages and 11 demo apps within boundaries; 57/57 tasks, 0 cached |
| API unit/HTTP tests, `node --test *.test.mjs` in `mock-api` (Node 24.21.0) | 324 of 331 pass. The same 7 tests fail identically on `main` in the original `dummy-api` folder: they spawn the `python3 -m mockpay` payment simulator, which is not installed on this host |
| Old path through the link: `node ../dummy-api/check-application-config.mjs --strict-navigation` from `desktop-clients/` | runs and reports the same localization review ledger; exits 1 exactly as on `main` (pre-existing catalog review items) |
| Live local HTTP checks against the renamed API (production build, Node 24 API, Chromium with axe) | Reports: 22 workflows, 49 routes; School: 36 workflows, 33 routes; Tenant Admin: 18 workflows, 37 routes. 0 page, console or HTTP errors and 0 axe violations. Runtime artifacts: 483 source files compared, 0 mismatches |
| `node docs/tools/check-docs.mjs` | passed |

Not run: `desktop-clients/` test suites, GitHub Actions and Jenkins. None of their files changed; they reach the API through the link. Healthcare, ERP, Settle, CareGrid, AllyVora, Onboarding and Desktop live checks were not rerun; they use the same launcher and runtime comparison exercised above.

## Upgrade, rollback and publication

Local checkouts: after pulling, move the ignored build output (`*/dist`, `node_modules`) from the old `dummy-api/` directory into `mock-api/`, or reinstall and rebuild there. Nothing is published or deployed. Rollback is reverting the merge commit.
