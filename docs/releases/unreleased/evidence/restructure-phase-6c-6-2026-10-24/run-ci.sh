#!/usr/bin/env bash
set -uo pipefail
# Serialize this task's focused unit checks with CI if the heavy lock becomes available.
exec 9>/tmp/erp-phase6c6-unit.lock
flock 9
export NEXT_PUBLIC_API_URL=/api
export RCM_BROWSER_PARITY_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json"
export MEDBAND_BROWSER_PARITY_RESULT="$RCM_BROWSER_PARITY_RESULT"
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import=$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/ci-environment.mjs"
node docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/write-manifest.mjs
cp docs/releases/unreleased/manifest-restructure-phase-6c-6-2026-10-24.json docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/ci-source.json
npm run ci -- --concurrency=1 --env-mode=loose
run_status=$?
RUN_STATUS="$run_status" node -e 'require("node:fs").writeFileSync("docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/ci-exit.json",JSON.stringify({command:"flock /home/pepadmin/.cache/pepbits-heavy.lock bash run-ci.sh",exitCode:Number(process.env.RUN_STATUS)},null,2)+"\n")'
if [ "$run_status" -ne 0 ]; then exit "$run_status"; fi
# Keep the same acquired heavy-work lock for the two sequential browser checks.
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
npm run test:browser -w @pepbits/shell > docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/shell-browser.log 2>&1
shell_status=$?
cp docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/ci-source.json docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/browser-source.json
bash docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/run-browser.sh > docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/integration-final.log 2>&1
browser_status=$?
SHELL_STATUS="$shell_status" BROWSER_STATUS="$browser_status" node -e 'require("node:fs").writeFileSync("docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/browser-exit.json",JSON.stringify({shellExit:Number(process.env.SHELL_STATUS),integrationExit:Number(process.env.BROWSER_STATUS)},null,2)+"\n")'
if [ "$shell_status" -ne 0 ]; then exit "$shell_status"; fi
exit "$browser_status"
