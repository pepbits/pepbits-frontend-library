#!/usr/bin/env bash
set -euo pipefail
date -u '+Lock acquired %FT%TZ'
receipt_dir="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-7c-2026-10-25"
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ERP_API_NODE="$HOME/.local/opt/node-v24.21.0-linux-x64/bin/node"
export ERP_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export ERP_RESULT="$receipt_dir/browser-final.json"
export ERP_IDENTITY="$receipt_dir/identity-final.json"
export ERP_WORKSPACE_CAPTURE_DIR="$receipt_dir"
export ERP_STOP_FILE=/tmp/erp-phase6c7c-integration-stop
node "$receipt_dir/write-manifest.mjs"
cp "${receipt_dir%/evidence/*}/manifest-restructure-phase-6c-7c-2026-10-25.json" "$receipt_dir/browser-source.json"
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/erp
node tooling/scripts/run-demo-integration.mjs erp
