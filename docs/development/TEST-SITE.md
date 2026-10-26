# Root workspace services and test-site delivery

Phase 8 replaces the old combined shells with eleven independent demos. Products install
published packages; this repository no longer generates product source archives. Historical
archive hashes and visual comparison evidence remain in Git and release records.

## Local services

Use Node 24.21 or newer. From the root run `npm ci`,
`bash tooling/scripts/install-api.sh`, and `npm run build:api`. Root workspace installs link
all twelve local libraries and need **no NPM_TOKEN**. Published-package consumers and manual
publication still need their own registry credentials.

Build with `NEXT_PUBLIC_API_URL=/api VITE_API_URL=/api npm run ci`, or build one app with
`./run.sh build reports`. `./run.sh start api reports` starts production
servers on loopback. `./run.sh stop reports api` stops only process groups owned by this
checkout and its state directory. Existing unrelated listeners are never killed. A busy port
fails the start. State defaults to `.run`; use `NEXORA_RUN_DIR` for isolation. The controller
requires Linux `/proc` to verify process identity. `run_all.sh` remains a delegating wrapper.
`install`, `build`, `start`, `stop`, `restart`, `status` and `logs <service>` remain available;
`MODE=dev` selects development mode. Production starts require a prior build.

| Service | Default port | Replacement / notes |
| --- | --- | --- |
| api | 3200 | `mock-api/server.mjs`, Node 24 |
| showcase | 3300 | `web` alias; component and engine gallery |
| healthcare | 3310 | Healthcare reference modules |
| erp | 3320 | Both `nexora` and `vantage` alias this demo |
| school | 3340 | Scholaris |
| reports | 3350 | Lumen Reports |
| tenant-admin | 3360 | AllyVora Tenant Admin |
| onboarding | 3370 | Orvia over the common mock API |
| settle | 3380 | Separate billing API remains applicable |
| caregrid | 3390 | Separate scheduling API remains applicable |
| allyvora-patients | 3400 | Separate patient registration API remains applicable |
| desktop | 3410 | Desktop demo web mode; native executable is a separate build |

Override `<SERVICE>_PORT` (hyphens become underscores) and `RUN_HOST` as needed.
`<DEMO>_API_URL` supplies the server-side host API proxy, defaulting to the local API port. Settle uses `SETTLE_HOST_API_URL` and patient registration uses `ALLYVORA_HOST_API_URL`, preserving their separate business API variables. CI and controller builds supply `/settle-api` and `/caregrid-api` as the two additional public proxy paths.
Additional demo-specific backend endpoints remain documented in each demo README. Merely
starting the common mock API does not start those separate source backends. No source backend
was moved or modified in phase 8.

## CI gates and retired gates

Jenkins and GitHub run the same root `tooling/scripts/ci-gates.sh`, then shell Chromium and
sequential production demo integration. The pinned simulator checkout is
`5ced4f8b021aa317859e6999d7c96ef14af63ee1`. API tests fail if its Python modules are absent;
CI supplies `HC_RCM_MOCK_REPO`. There is no allow-failure path for those tests.

| Former gate | Current coverage / deliberate retirement |
| --- | --- |
| Typecheck, Vitest, both shell builds | Forced root `npm run ci`: all packages and all eleven demos, concurrency 1 |
| API and clinical tests / diagnostic, Quality, Pharmacy, access preparation | Own API dependency installs, `npm run build:api`, `test:api`, `test:clinical-api` |
| Documentation links/contracts, `verify:documentation`, impact/revisions | Root plain Node `docs:check`, docs tool tests, documentation lifecycle check; canonical server catalog |
| `test:e2e-registry`, `verify:e2e-registry`; feature/navigation browser jobs | Explicit production demo driver selection: reports, school, tenant-admin, healthcare, erp, desktop; each owns route/workflow/axe assertions. Old combined-shell selectors are retired, not asserted equivalent case for case |
| `test:deployment`, `verify:deployable` | Ported 14 lifecycle/asset/rollback tests, API build stamps, standalone packaging, all-demo packaged asset/marker smoke, archive inventory and receiver receipt validation |
| `verify:ai-gates`, `ai-modes`, `ai-context`, `ai-limits`, `ai-egress`, `ai-hardening` | Public AI package gate/policy/client tests plus backend AI security/HTTP suites; removed old shell-specific opt-in driver paths |
| `verify:em-levels`, `filter-safety`, `export-safety` | Clinical E/M scoring tests, typed page-engine/data contracts and demo/backend regression suites; no old combined-shell bundle remains |
| `verify:contrast`, `form-controls`, `shared-components`, `library-preferences` | Shared UI/component/shell and per-demo route/profile tests; real Chromium/axe journeys; root dependency boundary rejects private imports |
| `verify:localization`, `library`, `templates` | Canonical API catalogs; package/demo tests and showcase snippet generation/check in its build/tests. Old generated combined-shell examples and scanners retired with their renderer |
| `verify:parity`, `bundle`; old `test:reference-fonts` and `test:catalog-chunks` | Production builds and live route/asset checks of current apps; old aggregate-shell class/chunk assumptions retired. Original-source ERP/School comparison generators retired; historical baselines retained |
| Linux native job | Desktop demo Tauri build and native WebDriver login/bridge/language checks. Separate hosted gate; local web-mode tests do not establish native success |

The archived 159-destination inventory describes the preserved API catalog. Current demo
routes and acceptance belong to their app suites. Impact receipts now inventory packages,
demos and backend sources; removed-source receipts remain explicit historical records.

## Archive and receiver contract

`npm run package:test-site -- <pinned-mock-repo> <output-dir>` builds a local archive from
already built production output. The shared `ci-gates.sh` builds and writes `BUILD_API`
stamps with all four explicit public API variables; packaging rejects unstamped output.
`npm run verify:test-site -- <output-dir>` extracts it
locally with Python's safe data filter, verifies every content digest, marker and receiver
identity field, and removes its temporary extraction. The packager tests every packaged
server's HTML, assets and marker, plus the nine Next host API proxies, sequentially on free
loopback ports. Showcase uses local fixtures. The static desktop host requires the ingress
to forward `/api` to the API service. Packaging never deploys.

The transport remains `frontend-test-<17-digit-time>-<8-hex-source>.tar.gz` plus `.sha256`.
The archive contains one release directory, `BUILD.json`, `src/`, `web/`, and `mock/`.
`BUILD.json` retains `release`, `frontendCommit`, `mockServicesCommit`, `node`, and `built`;
it adds schema, working-tree/source identity and a content-hash inventory. `web/release.json`
retains `id`, `webApiUrl: /api`, `desktopApiUrl: /api`, and adds `schemaVersion: 2` and demos.
Every demo serves `__nexora-release.json` containing that exact `id`. Simulator pins are
unchanged. No runtime copy of the root workspace or source-package dependency links is needed.

Before enabling the Jenkins deployment parameter, the owner must update and review the
external **pepbits-shared-document** `documents/cicd/common/deployment/config/stacks/pb-srv5/frontend-test`
configuration (local checkout inspected; live receiver state not inspected):

1. API `working_dir` becomes `/release/src/mock-api`; command remains `node server.mjs`.
2. Web `working_dir` stays `/release/web`; command becomes `node start-demo.mjs showcase`.
   `HOSTNAME`, `PORT=33410`, API port 33412, persistent data mounts and provider secrets remain.
3. Configure each hosted demo separately with `node start-demo.mjs <demo>`, its own port,
   the host API variable from the table above set to `http://127.0.0.1:33412`, and a host/proxy route. Demos use root-relative
   assets and paths, so use separate hostnames, not an unconfigured URL prefix. Supply the
   extra source backends for settle/caregrid/patient registration before exposing
   their business workflows. The initial site may serve showcase only; the archive includes all eleven.
4. Keep the receiver's forced-command `deploy <id> <sha256>`, safe extraction, 2 GiB limit,
   identity check, health check, immutable release retention and activation receipts. Schema 2
   still passes its identity check. Preserve Node 24 and the Python simulator services.
5. Make Compose select the start command/API directory **per release schema**, or retain a
   tested legacy Compose override. Old releases use the former API directory and shell start
   command: simply changing global Compose paths would break rollback to them. Verify both
   schema branches locally/on the deployment stack before first activation. Do not remove the
   previous release or its persistent state.

The receiver can implement rollback selection atomically in its existing `set_release` function:
read the selected release’s `web/release.json` (an absent `schemaVersion` means legacy schema 1); set `FT_API_DIRECTORY=mock-api`,
`FT_WEB_ENTRY=start-demo.mjs`, `FT_WEB_DEMO=showcase` for schema 2, and the prior
`FT_API_DIRECTORY=dummy-api`, `FT_WEB_ENTRY=web/apps/web/server.js`, and an empty
`FT_WEB_DEMO` for schema 1 (these names describe retained older release artifacts only). Update those variables together with
`FT_RELEASE` in the same temporary-file rename. Compose then uses
`working_dir: /release/src/${FT_API_DIRECTORY}` and
`command: [node, "${FT_WEB_ENTRY}", "${FT_WEB_DEMO}"]`. The schema 1 entry ignores
the extra empty argument. Reject unknown schemas before changing `.env`. The rollback
call must run the same selector for the prior release, preserving all other secret values.

GitHub Actions needs `MOCK_SERVICES_READ_TOKEN` with access to the private pinned simulator repository (or equivalent repository-token access). Jenkins needs existing `github-app` read access for the pinned simulators and
`frontend-test-deploy` for SSH. No package registry token is required for root `npm ci`.
Review protected-branch required checks: the former `browser` and `feature-browser` jobs
are consolidated into `check`; `native-linux` stays separate. No branch-protection setting
was changed locally. Obtain actual hosted results before treating these jobs as accepted.
Keep [known_hosts](../../deploy/pb-srv5/known_hosts) and strict host checking. Deployment is
controlled by `DEPLOY_TEST_SITE` (main-only; default true since 26 October 2026, false before). The first owner-authorized
deployment must confirm the public marker, API health, configured demo/API proxy, receiver
receipt and rollback. None of these remote operations is performed by local packaging.

## Rollout status (26 October 2026)

The owner-authorized receiver/Compose change is installed on pb-srv5 (`pepbits-shared-document` `534dc8fb`): `bin/ci-receive` selects the API directory, web entry and demo per release schema in the same atomic `.env` rename as `FT_RELEASE`; optional `FT_DEMO` (default `showcase`) chooses the served demo. First schema 2 release `20261026015233819-e04d5f77` from `main` `e04d5f7` was packaged locally (production build, stamps, `package-test-site.mjs`, `verify-test-site.mjs`) and deployed manually through the receiver. Verified: public `__nexora-release.json` id, `/api/health` ok, showcase home 200, healthy containers, rollback to the schema 1 release and forward again. The full CI gate ran on the same code before merge (69/69 tasks); the packaging run used the production build only. `DEPLOY_TEST_SITE` now defaults to true, so the next successful Jenkins `main` build deploys automatically. Hosted Jenkins has not yet run this pipeline.
