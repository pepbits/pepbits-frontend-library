#!/usr/bin/env bash
set -euo pipefail
# Invoke from the worktree root through the shared heavy-check flock.
E=docs/releases/unreleased/evidence/restructure-phase-6e-3-2026-10-24
export NEXT_PUBLIC_API_URL=/api
export RCM_BROWSER_PARITY_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json"
export MEDBAND_BROWSER_PARITY_RESULT="$RCM_BROWSER_PARITY_RESULT"
node "$E/capture-source.mjs" > "$E/ci-source.json"
npm run ci -- --concurrency=1 --env-mode=loose
LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" npm run test:browser -w @pepbits/shell > "$E/shell-browser.log" 2>&1
bash "$E/run-browser.sh" > "$E/integration-final.log" 2>&1
