# Verification guide 1.0.0

Applies to the Library preference delivery and subsequent changes until replaced by a new accepted testing-document version.

## Documentation-only changes

From the repository root, run:

```sh
node docs/tools/check-docs.mjs
node --test docs/tools/check-docs.test.mjs
```

Check feature/release status, links, inventory and historical evidence. Do not rerun application tests merely to assign today's date to an unchanged result. If documentation tooling or CI wiring changes, validate the tool and the wiring.

## Application changes

Use Node 24.21+ from the repository root:

```sh
npm ci
bash tooling/scripts/install-api.sh
NEXT_PUBLIC_API_URL=/api VITE_API_URL=/api npm run ci
npm run build:api
npm run test:api
npm run test:clinical-api
npm run test:deployment
npm run docs:check
node --test docs/tools/*.test.mjs
node docs/tools/documentation-lifecycle.mjs check
```

CI supplies the pinned mockpay checkout via `HC_RCM_MOCK_REPO`. Local unconfigured baseline
failures must be reported, not skipped. Showcase builds regenerate snippets; canonical backend
catalog changes need the owning demo fallback update and relevant tests. See the
[gate mapping](../../development/TEST-SITE.md#ci-gates-and-retired-gates).

## Browser checks

Build production output with the same-origin `/api` configuration, then run shell Chromium
and the demo integration driver sequentially:

```sh
npm run test:browser -w @pepbits/shell
node tooling/scripts/run-demo-integration.mjs reports
node tooling/scripts/run-demo-integration.mjs school
node tooling/scripts/run-demo-integration.mjs tenant-admin
node tooling/scripts/run-demo-integration.mjs healthcare
node tooling/scripts/run-demo-integration.mjs erp
node tooling/scripts/run-demo-integration.mjs desktop
```

The driver starts fresh API storage and one app/browser at a time on free loopback ports and
cleans up. Use `<DEMO>_API_NODE` for Node 24, and `<DEMO>_RUNTIME_ARTIFACTS` only for a verified
source-identical backend build. Shell and per-demo component/profile tests cover preferences
and locks. Old combined-shell selectors are retired; earlier release evidence keeps its original
scope. A native Tauri executable requires the separate Linux native job; browser mode cannot
satisfy it. On the shared server wrap heavy commands in its `pepbits-heavy.lock` flock and set
the provided Chromium library path. Never start/stop a shared live development server to test
these changes.

## Evidence and decision

Record commands, result markers/exit status when retained, suite/case counts, source/diff identity, environment, changed files after tests and pending checks using the [evidence template](../../releases/templates/test-evidence.md). Keep screenshots fictional and scoped. Do not infer a hosted CI result from the presence of `.github/workflows/ci.yml`.
