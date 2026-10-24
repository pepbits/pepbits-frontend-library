#!/usr/bin/env bash
set -euo pipefail
# From this worktree root, after its successful production build. The entire session holds the lock.
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export SETTLE_API_NODE="${SETTLE_API_NODE:-/home/pepadmin/.local/opt/node24/bin/node}"
export SETTLE_RUNTIME_ARTIFACTS="${SETTLE_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}"
export SETTLE_IDENTITY="${SETTLE_IDENTITY:-/tmp/settle-resume-verification/identity.json}"
export SETTLE_RESULT="${SETTLE_RESULT:-/tmp/settle-resume-verification/browser.json}"
export SETTLE_SCREENSHOT="${SETTLE_SCREENSHOT:-/tmp/settle-resume-verification/settle-bill.png}"
export SETTLE_STOP_FILE="${SETTLE_STOP_FILE:-/tmp/settle-resume-verification/stop-browser}"
exec flock -w 1800 /home/pepadmin/.cache/pepbits-heavy.lock npm run test:integration -w @pepbits-demo/settle
