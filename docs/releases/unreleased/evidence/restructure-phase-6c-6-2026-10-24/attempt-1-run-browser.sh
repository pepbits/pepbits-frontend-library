#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ERP_API_NODE=/home/pepadmin/.local/opt/node24/bin/node
export ERP_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export ERP_IDENTITY="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/identity-final.json"
export ERP_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/browser-final.json"
export ERP_VISUAL_SCREENSHOT_DIR="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24"
export ERP_STOP_FILE=/tmp/phase6c6-stop-final
unset ERP_SCREENSHOT
npm run test:integration -w @pepbits-demo/erp
