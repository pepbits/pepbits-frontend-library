#!/usr/bin/env bash
set -uo pipefail
export NEXT_PUBLIC_API_URL=/api
export RCM_BROWSER_PARITY_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json"
export MEDBAND_BROWSER_PARITY_RESULT="$RCM_BROWSER_PARITY_RESULT"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=$PWD/docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/ci-vitest-options.mjs"
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# The outer invocation owns the heavy lock for the complete sequence, including snapshots.
node docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/write-manifest.mjs docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/ci-source.json
npm run ci -- --concurrency=1 --env-mode=loose --continue=always
run_status=$?
RUN_STATUS="$run_status" node -e 'require("node:fs").writeFileSync("docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/ci-exit.json",JSON.stringify({command:"npm run ci -- --concurrency=1 --env-mode=loose --continue=always",exitCode:Number(process.env.RUN_STATUS)},null,2)+"\n")'
exit "$run_status"
