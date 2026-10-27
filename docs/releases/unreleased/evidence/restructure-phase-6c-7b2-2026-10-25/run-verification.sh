#!/usr/bin/env bash
set -euo pipefail
receipt_dir="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-7b2-2026-10-25"
while [[ -e "$receipt_dir/source-editing.flag" ]]; do sleep 1; done
export NEXT_PUBLIC_API_URL=/api
export RCM_BROWSER_PARITY_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json"
export MEDBAND_BROWSER_PARITY_RESULT="$RCM_BROWSER_PARITY_RESULT"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=$receipt_dir/ci-environment.mjs"
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
date -u +%FT%TZ > "$receipt_dir/lock-acquired.txt"
node "$receipt_dir/write-manifest.mjs" > "$receipt_dir/manifest.log"
cp "${receipt_dir%/evidence/*}/manifest-restructure-phase-6c-7b2-2026-10-25.json" "$receipt_dir/ci-source.json"
# Check browser geometry first so any fix precedes the full forced CI.
# The later CI also builds ERP with the same NEXT_PUBLIC_API_URL=/api.
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/erp > "$receipt_dir/erp-build.log" 2>&1
export ERP_API_NODE="$HOME/.local/opt/node-v24.21.0-linux-x64/bin/node"
export ERP_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export ERP_RESULT="$receipt_dir/browser-final.json"
export ERP_IDENTITY="$receipt_dir/identity-final.json"
export ERP_SCREENSHOT=/tmp/erp7b2-final.png
export ERP_DEFERRED_SCREENSHOT_DIR="$receipt_dir"
node tooling/scripts/run-demo-integration.mjs erp > "$receipt_dir/integration.log" 2>&1
npm run ci -- --concurrency=3 --env-mode=loose > "$receipt_dir/ci.log" 2>&1
npm run test:browser -w @pepbits/shell > "$receipt_dir/shell-browser.log" 2>&1
date -u +%FT%TZ > "$receipt_dir/verification-finished.txt"
