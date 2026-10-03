# SurgiSuite: normal-terminal build and acceptance

Run these commands in your normal SSH terminal. Node v24.21.0 and npm 11.19.0 are already working there. Do not change server DNS. This guide does not deploy or replace live stores. Commands use existing locked dependencies, loopback ports and a new owned synthetic API data directory.

## Verified status and error classification

- Application validation passed locally: 67 focused frontend tests (20 SurgiSuite), three actual service/configuration tests, six affected TypeScript targets, localization checks and the Vite browser build.
- The subsequent normal-terminal build confirmed a shared-font URL resolution defect. It is corrected in packages/tokens/src/reference-fonts.css using stylesheet-relative URLs. Both real host stylesheets now pass Tailwind plus Next CSS-loader asset-bundling regression checks. The user subsequently supplied a successful complete Next 16.3.3 Webpack build, including TypeScript and page generation. Authenticated runtime/browser acceptance and public deployment remain pending; confirm the build-time API URL before starting isolated services. Assess any further failures from their actual output, rather than assuming session restrictions.
- Agent-session restrictions: npm EAI_AGAIN, Python socket EPERM, actual API listen EPERM and Node spawnSync EPERM. The Next TypeScript --showConfig error occurred in that restricted context. These are not evidence that your normal SSH terminal or deployed site is broken.
- npm successfully wrote debug logs using writable cache/log overrides. The normal-terminal commands below use a writable cache without changing the system npm directories.
- Canonical Arabic/Hindi/Malayalam UI content and nine guide translations are complete drafts. Native-language and clinical/domain review remains pending.

## 1. Install and prepare — terminal 1

Exact project directory: `/home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients`.

The subshell stops at the first failure without closing your interactive SSH shell. Runtime installs include the existing diagnostic/pharmacy modules because the demo API hosts them alongside SurgiSuite. Diagnostic install scripts are enabled for its pinned native SQLite dependency. No package versions or locks are updated by npm ci.

```bash
(
  set -euo pipefail
  cd /home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients
  export PATH=/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin:$PATH
  export NPM_CONFIG_CACHE=/home/pepadmin/.cache/agent-tmp/npm-surgisuite
  mkdir -p "$NPM_CONFIG_CACHE"
  npm ci --no-audit --no-fund
  for surgisuite_runtime in ../dummy-api ../dummy-api/access-runtime ../dummy-api/diagnostics-runtime ../dummy-api/pharmacy-runtime; do
    npm ci --prefix "$surgisuite_runtime" --no-audit --no-fund
  done
  npm run prepare:access
  node scripts/diagnostics/build-backends.mjs
  npm run prepare:quality
  npm run prepare:pharmacy
  npm run styles:surgisuite
  npm run localization:sync
  npm run verify:localization
  npm run typecheck
  npm run test:surgisuite-api
  npm run test:reference-fonts
  node node_modules/vitest/vitest.mjs run packages/reference-surgisuite/src/module.test.tsx packages/reference-medband/src/module.test.tsx packages/reference-rcm/src/module.test.tsx packages/erp-config/src/reference-modules.test.ts --pool=threads --maxWorkers=1
)
```

## 2. Build — terminal 1

Build against the isolated local API, not the deployed services. The API URLs are build-time values: setting them only during next start does not change an existing bundle. Direct Next CLI invocation puts --webpack on the Next command and preserves TypeScript checks. The stamp records the matching API URL. The normal desktop workspace build includes its own typecheck and API stamp.

```bash
(
  set -euo pipefail
  cd /home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients
  export PATH=/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin:$PATH
  export NEXT_PUBLIC_API_URL=http://127.0.0.1:45120
  export VITE_API_URL=http://127.0.0.1:45120
  node node_modules/next/dist/bin/next build apps/web --webpack
  node scripts/stamp-api.mjs NEXT_PUBLIC_API_URL apps/web/.next
  npm run build --workspace=desktop
  npm run verify:bundle
  node ../docs/tools/check-docs.mjs
)
```

If an application compile/type error appears here, retain the complete output and stop before starting/deploying that build. Do not ignore build errors.

## 3. Start the isolated API — terminal 2

Leave this terminal running. The unique directory prevents touching existing demo/live data. Retain the printed path. Do not reset or remove an existing store. If port 45120 is occupied, select an unused port and consistently rebuild/update the commands instead of killing another application.

```bash
cd /home/pepadmin/pb/saas/lib/pepbits-frontend-library
export PATH=/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin:$PATH
mkdir -p /home/pepadmin/.cache/agent-tmp
surgisuite_demo_dir=$(mktemp -d /home/pepadmin/.cache/agent-tmp/surgisuite-demo.XXXXXX)
echo "$surgisuite_demo_dir"
PORT=45120 HOST=127.0.0.1 NEXORA_DATA_DIR="$surgisuite_demo_dir" node dummy-api/server.mjs
```

## 4. Start the built web app — terminal 3

Leave this terminal running.

```bash
cd /home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients
export PATH=/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin:$PATH
node node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 45100
```

## 5. Verify — terminal 1

The existing cached Playwright 1.58.2 package can be reused; installing Chromium here does not modify the frontend package/lock. Its CLI can report required OS libraries if they are absent. Install only those reported dependencies in the normal terminal before repeating browser verification.

```bash
(
  set -euo pipefail
  cd /home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients
  export PATH=/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin:$PATH
  curl --fail --show-error http://127.0.0.1:45120/health
  curl --fail --show-error --output /dev/null http://127.0.0.1:45100/
  export PLAYWRIGHT_PATH=/home/pepadmin/.cache/rcm-completion-20260927/cdi/scratch-web/node_modules/playwright
  node "$PLAYWRIGHT_PATH/cli.js" install chromium
  mkdir -p /home/pepadmin/.cache/agent-tmp
  surgisuite_artifacts=$(mktemp -d /home/pepadmin/.cache/agent-tmp/surgisuite-browser.XXXXXX)
  echo "$surgisuite_artifacts"
  E2E_BASE=http://127.0.0.1:45100 E2E_API=http://127.0.0.1:45120 E2E_ARTIFACTS="$surgisuite_artifacts" node e2e/surgisuite-reference.mjs
  cat "$surgisuite_artifacts/results.json"
)
```

If the existing Playwright directory has been removed, use a separate pinned tool directory, then set PLAYWRIGHT_PATH to its node_modules/playwright folder. Do not add it to the frontend package just to run browser checks:

```bash
mkdir -p /home/pepadmin/.cache/agent-tmp/surgisuite-browser-tool
npm install --prefix /home/pepadmin/.cache/agent-tmp/surgisuite-browser-tool --no-audit --no-fund playwright@1.58.2
export PLAYWRIGHT_PATH=/home/pepadmin/.cache/agent-tmp/surgisuite-browser-tool/node_modules/playwright
```

Expected acceptance: results.json reports PASS with no page errors. It covers module selection, eight sidebar destinations, all twelve case sections, actual case refresh, original booking drawer, trusted actor and viewer UI/API denial. Screenshots are saved in the printed directory. Compare them against the original source for compact controls, fonts, layout/scroll and overlays; automated route tests alone do not prove pixel parity.

For manual browser access, forward port 45100 to your machine through SSH. Sign in using the printed synthetic demo fixture admin/admin, select SurgiSuite in the header and inspect all sidebar pages. Existing Healthcare Suite, diagnostics, School, MedBand and RCM browser regressions remain separate acceptance checks.

## 6. Deployment completion gate

A passing localhost run is local acceptance, not public deployment. Follow [the isolated deployment runbook](frontend-test-deployment.md): build public artifacts against same-origin /api (not loopback API URLs), freeze matching frontend/API/config artifacts, stage/test with owned synthetic data, retain the current matching release/data backup, activate only frontend-test services, and execute public HTTPS identity/API/browser acceptance. Do not alter Healthcare Enterprise, ERP or School deployments.

Report deployed only after activation and public verification succeed with retained release identity and results. The currently documented release remains 20261001-rcm-01 until a new verified activation exists. This guide contains no operator credentials or authorization bypass.
