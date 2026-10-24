#!/usr/bin/env bash
set -euo pipefail
# Run from this worktree root, after the ERP production build completes.
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ERP_API_NODE="${ERP_API_NODE:-/home/pepadmin/.local/opt/node24/bin/node}"
export ERP_RUNTIME_ARTIFACTS="${ERP_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}"
export ERP_IDENTITY="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-4-2026-10-24/identity-final.json"
export ERP_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-4-2026-10-24/browser-final.json"
export ERP_SCREENSHOT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-4-2026-10-24/erp-final.png"
export ERP_STOP_FILE=/tmp/phase6c4-stop-final
set +e
npm run test:integration -w @pepbits-demo/erp
run_status=$?
set -e
RUN_STATUS="$run_status" node -e 'require("node:fs").writeFileSync(process.env.ERP_IDENTITY.replace("identity-final.json","launcher-exit.json"),JSON.stringify({command:"npm run test:integration -w @pepbits-demo/erp",exitCode:Number(process.env.RUN_STATUS)},null,2)+"\n")'
exit "$run_status"
