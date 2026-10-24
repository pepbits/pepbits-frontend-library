#!/usr/bin/env bash
set -uo pipefail
export NEXT_PUBLIC_API_URL=/api
export RCM_BROWSER_PARITY_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json"
export MEDBAND_BROWSER_PARITY_RESULT="$RCM_BROWSER_PARITY_RESULT"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-4-2026-10-24/ci-vitest-timeout.mjs"
npm run ci -- --concurrency=1 --env-mode=loose
run_status=$?
RUN_STATUS="$run_status" node -e 'require("node:fs").writeFileSync("docs/releases/unreleased/evidence/restructure-phase-6c-4-2026-10-24/ci-exit.json",JSON.stringify({command:"npm run ci -- --concurrency=1 --env-mode=loose",exitCode:Number(process.env.RUN_STATUS)},null,2)+"\n")'
exit "$run_status"
