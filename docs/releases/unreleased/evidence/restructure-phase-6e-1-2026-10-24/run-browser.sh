#!/usr/bin/env bash
set -euo pipefail
# Run from this worktree root after the reports production build (NEXT_PUBLIC_API_URL=/api) completes.
# Wrap with: flock /home/pepadmin/.cache/pepbits-heavy.lock bash <this file> <label>
label="${1:-final}"
evidence="$PWD/docs/releases/unreleased/evidence/restructure-phase-6e-1-2026-10-24"
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export REPORTS_API_NODE="${REPORTS_API_NODE:-/home/pepadmin/.local/opt/node24/bin/node}"
# Generated API runtimes are reused read-only from the source-matched checkout after a tracked-file hash comparison.
export REPORTS_RUNTIME_ARTIFACTS="${REPORTS_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}"
export REPORTS_IDENTITY="$evidence/identity-$label.json"
export REPORTS_RESULT="$evidence/browser-$label.json"
export REPORTS_SCREENSHOT="$evidence/reports-$label.png"
export REPORTS_STOP_FILE=/tmp/phase6e1-stop-$label
exec npm run test:integration -w @pepbits-demo/reports
