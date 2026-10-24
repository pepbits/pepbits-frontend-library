#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ERP_API_NODE=/home/pepadmin/.local/opt/node24/bin/node
export ERP_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export ERP_IDENTITY="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-5-2026-10-24/identity-${ERP_RUN:-final}.json"
export ERP_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-5-2026-10-24/browser-${ERP_RUN:-final}.json"
export ERP_SCREENSHOT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-5-2026-10-24/erp-${ERP_RUN:-final}.png"
export ERP_STOP_FILE="/tmp/phase6c5-stop-${ERP_RUN:-final}"
exec npm run test:integration -w @pepbits-demo/erp
