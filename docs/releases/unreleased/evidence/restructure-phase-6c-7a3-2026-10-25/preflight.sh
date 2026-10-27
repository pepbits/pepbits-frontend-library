#!/usr/bin/env bash
set -euo pipefail
receipt_dir="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-7a3-2026-10-25"
printf 'Acquired %s\n' "$(date -u +%FT%TZ)"
node "$receipt_dir/write-manifest.mjs"
cp "$receipt_dir/../../manifest-restructure-phase-6c-7a3-2026-10-25.json" "$receipt_dir/preflight-source.json"
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/erp > "$receipt_dir/preflight-build.log" 2>&1
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
export ERP_API_NODE="$HOME/.local/opt/node-v24.21.0-linux-x64/bin/node"
export ERP_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export ERP_RESULT="$receipt_dir/preflight-browser.json"
export ERP_IDENTITY="$receipt_dir/preflight-identity.json"
export ERP_RICH_SCREENSHOT_DIR="$receipt_dir"
node tooling/scripts/run-demo-integration.mjs erp > "$receipt_dir/preflight-integration.log" 2>&1
printf 'Preflight passed: %s\n' "$(date -u +%FT%TZ)"
bash "$receipt_dir/verify.sh"
