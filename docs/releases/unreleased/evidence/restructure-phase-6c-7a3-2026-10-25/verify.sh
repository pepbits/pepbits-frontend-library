#!/usr/bin/env bash
# Run from the repository root under the shared heavy lock. No Git metadata writes.
set -euo pipefail
export PATH="$HOME/.local/opt/node-v24.21.0-linux-x64/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PYTHONDONTWRITEBYTECODE=1
export HC_RCM_MOCK_REPO=/home/pepadmin/pb/repos/saas/tool/pepbits-mocking-app
receipt_dir="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-7a3-2026-10-25"
result_dir="$receipt_dir/post-phase8/final"
mkdir -p "$result_dir"
node "$receipt_dir/write-manifest.mjs"
cp "$receipt_dir/../../manifest-restructure-phase-6c-7a3-2026-10-25.json" "$result_dir/ci-source.json"
export NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_SETTLE_API_URL=/settle-api NEXT_PUBLIC_CAREGRID_API_URL=/caregrid-api VITE_API_URL=/api NEXT_TELEMETRY_DISABLED=1
if [[ "${ERP7A3_REUSE_BUILD:-0}" != 1 ]]; then
node_modules/.bin/turbo run build --filter='./packages/*' --concurrency=1 > "$result_dir/package-build.log" 2>&1
npm run build:api > "$result_dir/api-build.log" 2>&1
npm run build -w @pepbits-demo/erp > "$result_dir/erp-build.log" 2>&1
fi
export ERP_API_NODE="$HOME/.local/opt/node-v24.21.0-linux-x64/bin/node"
export ERP_RUNTIME_ARTIFACTS="$PWD/mock-api"
export ERP_IDENTITY="$result_dir/identity-final.json"
export ERP_RESULT="$result_dir/browser-final.json"
export ERP_RICH_SCREENSHOT_DIR="$result_dir"
unset ERP_VISUAL_SCREENSHOT_DIR ERP_SCREENSHOT ERP_STOP_FILE
cp "$result_dir/ci-source.json" "$result_dir/browser-source.json"
node tooling/scripts/run-demo-integration.mjs erp > "$result_dir/integration.log" 2>&1
printf 'Integration exit 0: %s\n' "$(date -u +%FT%TZ)"
printf 'CI started: %s\n' "$(date -u +%FT%TZ)"
bash tooling/scripts/ci-gates.sh > "$result_dir/ci.log" 2>&1
printf 'CI exit 0: %s\n' "$(date -u +%FT%TZ)"
npm run test:browser -w @pepbits/shell > "$result_dir/shell-browser.log" 2>&1
printf 'Shell browser exit 0: %s\n' "$(date -u +%FT%TZ)"
# Check the final production artifacts after CI, retaining the preliminary integration receipt.
mkdir -p "$result_dir/before-ci"
cp "$result_dir/browser-final.json" "$result_dir/identity-final.json" "$result_dir/browser-source.json" "$result_dir/before-ci/"
node "$receipt_dir/write-manifest.mjs"
cp "$receipt_dir/../../manifest-restructure-phase-6c-7a3-2026-10-25.json" "$result_dir/browser-source.json"
node tooling/scripts/run-demo-integration.mjs erp > "$result_dir/integration-final.log" 2>&1
printf 'Final production integration exit 0: %s\n' "$(date -u +%FT%TZ)"
