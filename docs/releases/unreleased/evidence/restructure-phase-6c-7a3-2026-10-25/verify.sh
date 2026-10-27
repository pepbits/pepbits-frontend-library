#!/usr/bin/env bash
set -euo pipefail
receipt_dir="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-7a3-2026-10-25"
printf 'Heavy lock acquired: %s\n' "$(date -u +%FT%TZ)"
export NEXT_PUBLIC_API_URL=/api
export RCM_BROWSER_PARITY_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json"
export MEDBAND_BROWSER_PARITY_RESULT="$RCM_BROWSER_PARITY_RESULT"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=$receipt_dir/ci-environment.mjs"
node "$receipt_dir/write-manifest.mjs"
cp "$receipt_dir/../../manifest-restructure-phase-6c-7a3-2026-10-25.json" "$receipt_dir/ci-source.json"
npm run ci -- --concurrency=3 --env-mode=loose > "$receipt_dir/ci.log" 2>&1
printf 'CI passed: %s\n' "$(date -u +%FT%TZ)"
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
npm run test:browser -w @pepbits/shell > "$receipt_dir/shell-browser.log" 2>&1
printf 'Shell browser passed: %s\n' "$(date -u +%FT%TZ)"
/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs > "$receipt_dir/docs.log" 2>&1
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/erp > "$receipt_dir/erp-build.log" 2>&1
export ERP_API_NODE="$HOME/.local/opt/node-v24.21.0-linux-x64/bin/node"
export ERP_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export ERP_IDENTITY="$receipt_dir/identity-final.json"
export ERP_RESULT="$receipt_dir/browser-final.json"
export ERP_RICH_SCREENSHOT_DIR="$receipt_dir"
unset ERP_VISUAL_SCREENSHOT_DIR
unset ERP_SCREENSHOT
export ERP_STOP_FILE=/tmp/erp7a3-stop-final
node "$receipt_dir/write-manifest.mjs"
cp "$receipt_dir/../../manifest-restructure-phase-6c-7a3-2026-10-25.json" "$receipt_dir/browser-source.json"
node tooling/scripts/run-demo-integration.mjs erp > "$receipt_dir/integration.log" 2>&1
printf 'Integration passed: %s\n' "$(date -u +%FT%TZ)"
