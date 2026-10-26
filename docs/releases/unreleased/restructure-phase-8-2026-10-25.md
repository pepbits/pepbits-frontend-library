# Library phase 8 — root workspace retirement

Status: unreleased working tree. Date: 25 October 2026 UTC. Base:
`3558a131f0fd443693eae0dfc678e3b258b480c1`, branch `restructure/phase-8`.
No commit, tag, push, merge, publication or deployment. Packages remain 0.1.0.
Testing guide: [1.0.0](../../testing/v1.0.0/PRE-COMMIT.md). Executor: Codex;
human review and hosted Jenkins/GitHub runs remain pending.

## Changes and compatibility

Removed the old workspace (1,961 tracked files; 39,392 KiB allocated) and its temporary API
compatibility symlink. No old-name package shims existed. Original source/design inputs are
unchanged. The root `package-lock.json` is unchanged from the base commit; reviewer
verification ran `npm ci` (npm 11.19.0, Node 24.21.0) against it successfully. No original
input under `source/` was changed.

The API owns 35 required catalog/contract/data files with [provenance](../../../mock-api/contracts/provenance.json),
serializable navigation and a server-only Sentinel sanitizer. Runtime builders and HTTP test
support moved inside the API. No frontend module is imported by the backend. Routes, storage
schemas, fixture identities, localization and preference/permission behavior are preserved.

[Root operations](../../development/TEST-SITE.md) documents all breaking entry points,
service aliases/ports, old gate replacements, production builds, archive schema and required
external receiver changes. `run_all.sh` still delegates; `run.sh` preserves actions while
stopping only its owned process groups. Jenkins and GitHub run root package/demo checks,
backend/docs/deployment checks and production browser journeys. Native checks are configured
separately and have not been run locally. Original-source visual generators are retired;
existing baselines and evidence hashes are preserved. Historical source links target the
immutable base commit.

## Verification

The local source manifest is [compressed with the CI input manifest](evidence/restructure-phase-8-2026-10-25/source-manifests.json.gz).
Final working-tree digest: `1c6f0509f4be81cb27a602f282e97da4c82aafdcc9c429f5e18debb5faa15fbe`.
It covers 5,034 existing/deleted file entries, excluding release records/output to avoid
self-reference. The 2,031 tracked non-Markdown package/demo inputs to the forced CI run
are retained at digest `5dd07ffbc8752b879ed7655d426d74592fb7e83af20e8cc9245d428fac58443f`.
Later changes are operations documentation, the CI diagnostic artifact glob and one ERP browser-helper wait. Production
and unit-test inputs remain unchanged. The full ERP live rerun covers that helper; the first
failure is retained in [its receipt](evidence/restructure-phase-8-2026-10-25/erp-first-attempt.json).
New native/tooling files have their separately stated checks.

| Check | Local result |
| --- | --- |
| Root clean install | PASS: 500 packages; no NPM_TOKEN. Minimal local-link lock repair; other pre-existing metadata retained |
| Backend clean installs | PASS: API plus access, diagnostics, Quality source/runtime and Pharmacy runtime |
| Forced `npm run ci` | PASS: 69/69 tasks, **0 cached**, 6,753 tests in 23 workspaces, 44m33.021s; all typechecks and eleven demo production builds |
| Configured build follow-up | PASS: Settle/CareGrid rebuilt with explicit public proxy paths; all eleven build stamps accepted |
| Shell Chromium | PASS: 18/18; local supplied browser runtime/libraries |
| Baseline JavaScript API | **324/331**, same seven missing-simulator failures; `node --test --test-concurrency=1 *.test.mjs` under Node 24.21.0 |
| Configured JavaScript API | PASS: **336/336**, no skips, pinned simulator `5ced4f8b021aa317859e6999d7c96ef14af63ee1`; extra cases load once the two previously failing test files can start their simulators |
| Clinical TypeScript API | PASS: 34/34, with clinical compilation |
| API preparation/typechecks | PASS: 98 diagnostic, 16 Quality and 21 Pharmacy files transpiled; five access services built; clinical/Quality/Pharmacy typechecks. Diagnostic transpilation is not a full diagnostic typecheck |
| Root boundaries/tooling | PASS: 12 packages/11 demos; 23 tooling tests |
| Docs | PASS: 224 Markdown files, six tool tests, 700 page lifecycle registrations; 2,268 existing authoring/review backlog items remain explicit |
| Deployment contracts | PASS: 14/14 lifecycle, assets, immutable release and rollback tests |

Detailed counts and prior failed attempts are in [checks.json](evidence/restructure-phase-8-2026-10-25/checks.json),
[root-ci.json](evidence/restructure-phase-8-2026-10-25/root-ci.json) and
[the baseline failure list](evidence/restructure-phase-8-2026-10-25/api-baseline.json).
The default simulator directory is missing; the ENOENT comes from its spawn cwd, not a missing
Python executable. With that directory configured, every API test passes. Initial cache
permissions, the missing public-URL stamp configuration and the pre-existing invalid local
lock link were corrected and their dependent checks repeated.

Production Chromium/axe journeys used one demo/API/browser at a time and isolated fictional data:

| Demo | Workflows | Route scans | Other checks | Unexpected errors / axe violations |
| --- | ---: | ---: | --- | --- |
| Reports | 22 | 49 | — | 0 / 0 |
| School | 36 | 33 | Six role portals | 0 / 0 |
| Tenant Admin | 18 | 37 | Governed writes and expected refusals | 0 / 0 |
| Healthcare | 86 | 264 | 91 presentation checks | 0 / 0 |
| ERP | 122 | 114 | 15 panel states, 27 visual checks | 0 / 0 |
| Desktop | 16 | 13 | Vite browser mode only | 0 / 0 |

[Live receipts](evidence/restructure-phase-8-2026-10-25/live-demos.json) preserve errors,
expected refusals, axe incomplete results and cleanup identities. Zero violations does not
resolve axe's incomplete/manual-review results. All browser, Next/Vite and API process groups
were confirmed stopped. The first ERP attempt failed before the route sweep; the full rerun
passed after its test-only asynchronous wait correction. These runs are separate, not summed.

`run.sh` smoke passed for API + Reports: isolated loopback ports, production HTML, API health,
host API proxy, owned-process stop and both ports released. See [the launcher receipt](evidence/restructure-phase-8-2026-10-25/run-smoke.json).

Local archive **`20261025193640687-3558a131`** passed packaging and extraction validation:
46,519 inventoried files, **315,420,499 bytes**, below the receiver's 2 GiB transfer limit.
SHA-256: `68f8d2bf82e602bb0d37d2a7a503744a3a8df6204a99a5bab30814c36c2ac3da`. The packaged API passed outside the workspace; all eleven
packaged demos passed HTML/assets/marker smoke, and nine Next host API proxies passed.
All inventory digests and every demo marker matched. [Local archive receipt](evidence/restructure-phase-8-2026-10-25/archive-receipt.json).
The ignored archive remains under root `release/` for review. This is not a receiver activation receipt.

Jenkins is unavailable. Five embedded shell blocks pass `bash -n`; delimiters and declarative
structure were reviewed, and workflow YAML parses. This is **not** a Groovy/Jenkins lint result.
The local stage equivalents are recorded explicitly:

| Jenkins stage | Local execution / limitation |
| --- | --- |
| Checkout | Supplied phase 8 worktree/base identity verified; no Jenkins `checkout scm` execution |
| Pinned simulators | Local shared clone checked out and verified at the exact pin; Jenkins credentialed fetch not tested |
| Install | Root `npm ci` and every prefix install in `install-api.sh` passed |
| Gates | Root CI, stamps, docs/tools/lifecycle, API builds/types/tests/clinical, deployment and shell browser checks passed; all six sequential demo checks passed. Local Chromium and supplied libraries replace the hosted privileged OS dependency install |
| Package test site | PASS: local production archive, packaged API/all eleven demos, safe extraction, complete digests and receiver identity contract |
| Deploy test site | **Not run**, as instructed; no remote marker/receiver/SSH check or activation |

Hosted Jenkins/GitHub and native Tauri/WebKit checks remain pending. Browser-rendered desktop
results cannot establish native executable acceptance. No prior historical evidence hash was
rewritten; 45 unique immutable old-source link targets were checked against local Git objects.
Remaining old-tree names are justified line by line in the [reference audit](evidence/restructure-phase-8-2026-10-25/remaining-references.tsv);
they are historical records, source provenance, immutable links or the prior receiver's rollback
contract, with no executable references. The [static audit](evidence/restructure-phase-8-2026-10-25/static-audit.json) also records zero requested secret-pattern matches, no protected-input changes and the deletion size. `git diff --check` passes.

## Owner rollout and remaining dependencies

Confirm School's parallel registry migration and provenance checks before the coordinated
merge. Owner-supplied completed consumer identities: Platform `33e4424`, Healthcare
`c0530df9`/`58cffbeb`/`c92b8a0b`, ERP `6f332b6`; these were not re-tested here.

Before first deployment, apply the external Compose API/start-path changes and a schema-aware
rollback selector described in [the receiver contract](../../development/TEST-SITE.md#archive-and-receiver-contract).
Jenkins retains `github-app` simulator read access and `frontend-test-deploy` SSH credentials;
root installs need no NPM_TOKEN. GitHub Actions needs private simulator read access through
`MOCK_SERVICES_READ_TOKEN` or an equivalent repository token. Ensure the Jenkins Docker agent
can perform the Playwright OS dependency install, or provides those dependencies in its image;
the local run used the supplied Chromium libraries instead. Review required-check names and
obtain hosted/native results before merge. Strict host keys and forced-command transport stay unchanged.
`DEPLOY_TEST_SITE` defaults false. Only the owner enables it after reviewing the receiver
rollout, configures additional demo hostnames/backends, and verifies the public release marker,
API health, receiver receipt and rollback. No deployment host was contacted by this task.

## Reviewer verification (25–26 October 2026, local, not a deployment)

Independent rerun in this worktree under Node 24.21.0: root `npm ci`; `tooling/scripts/install-api.sh`;
`tooling/scripts/ci-gates.sh` exit 0 (forced CI 69/69 tasks, 0 cached; docs tools 6/6; API 336/336 with
`HC_RCM_MOCK_REPO` at the pinned simulator; clinical API 34/34; deployment 14/14); shell browser 18/18;
production live checks for reports (22 workflows, 49 routes) and erp (122 workflows, 114 routes) with
0 errors, console errors, HTTP errors and axe violations; `run.sh start|status|stop api reports` on
loopback ports with `/health` ok and no listener left. The test-site archive was not rebuilt by the reviewer.

*Update 26 October 2026:* School's registry migration was merged as `86a72ba` before this phase was merged to library `main` as `7cdc9e8`.
