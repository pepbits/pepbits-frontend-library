#!/usr/bin/env bash
set -euo pipefail
# Run from this worktree root, after the ERP production build completes.
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ERP_API_NODE="${ERP_API_NODE:-/home/pepadmin/.local/opt/node24/bin/node}"
export ERP_RUNTIME_ARTIFACTS="${ERP_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}"
export ERP_IDENTITY="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-3-2026-10-24/identity-final.json"
export ERP_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-3-2026-10-24/browser-final.json"
export ERP_SCREENSHOT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-3-2026-10-24/erp-final.png"
export ERP_STOP_FILE=/tmp/phase6c3-stop-final
exec npm run test:integration -w @pepbits-demo/erp
