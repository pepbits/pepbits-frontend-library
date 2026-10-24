#!/usr/bin/env bash
# From the worktree root:
# flock /home/pepadmin/.cache/pepbits-heavy.lock bash docs/releases/unreleased/evidence/restructure-phase-6e-4-2026-10-24/run-verification.sh
# One Vitest tree at a time; the integration launcher owns and stops both APIs, Next and Chromium.
set -euo pipefail
run="${SETTLE_RUN_DIR:-/tmp/settle-resume-verification}"
mkdir -p "$run"
date -u +%FT%TZ > "$run/heavy-started.txt"
export NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_SETTLE_API_URL=/settle-api
export RCM_BROWSER_PARITY_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json"
export MEDBAND_BROWSER_PARITY_RESULT="$RCM_BROWSER_PARITY_RESULT"
node docs/releases/unreleased/evidence/restructure-phase-6e-4-2026-10-24/write-manifest.mjs
cp docs/releases/unreleased/manifest-restructure-phase-6e-4-2026-10-24.json "$run/source-before-ci.json"
set +e
npm run ci -- --concurrency=1 --env-mode=loose > "$run/ci.log" 2>&1
result=$?
set -e
printf '\nci exit %s\n' "$result" >> "$run/ci.log"
tail -14 "$run/ci.log"
if [ "$result" != 0 ]; then exit "$result"; fi
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
set +e
npm run test:browser -w @pepbits/shell > "$run/shell-browser.log" 2>&1
result=$?
set -e
tail -14 "$run/shell-browser.log"
if [ "$result" != 0 ]; then exit "$result"; fi
export SETTLE_API_NODE="${SETTLE_API_NODE:-/home/pepadmin/.local/opt/node24/bin/node}"
export SETTLE_RUNTIME_ARTIFACTS="${SETTLE_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}"
export SETTLE_IDENTITY="$run/identity.json" SETTLE_RESULT="$run/browser.json" SETTLE_SCREENSHOT="$run/settle-bill.png" SETTLE_STOP_FILE="$run/stop-browser"
set +e
npm run test:integration -w @pepbits-demo/settle > "$run/integration.log" 2>&1
result=$?
set -e
tail -24 "$run/integration.log"
date -u +%FT%TZ > "$run/heavy-ended.txt"
exit "$result"
