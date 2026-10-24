#!/usr/bin/env bash
# Run from this worktree root:
# flock /home/pepadmin/.cache/pepbits-heavy.lock bash docs/releases/unreleased/evidence/restructure-phase-6e-6-2026-10-24/run-final.sh
# Root CI is serial and forced. This script stops on failure and runs no service groups concurrently.
set -euo pipefail
E=docs/releases/unreleased/evidence/restructure-phase-6e-6-2026-10-24
export NEXT_TELEMETRY_DISABLED=1
export npm_config_cache=/tmp/allyvora-npm-cache
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
node "$E/checkpoint.mjs" "$E/ci-source.json"
date -u +%FT%TZ > "$E/started-at.txt"
printf '%s\n' 'Heavy lock acquired; forced CI starting.'
NEXT_PUBLIC_API_URL=/api NEXT_PUBLIC_ALLYVORA_API_URL=/allyvora-api RCM_BROWSER_PARITY_RESULT=$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json MEDBAND_BROWSER_PARITY_RESULT=$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json \
  npm run ci -- --concurrency=1 --env-mode=loose > "$E/ci-final.log" 2>&1 < /dev/null
printf '%s\n' 'CI passed; real HTTP integration starting.'
node "$E/checkpoint.mjs" "$E/integration-source.json"
ALLYVORA_HOST_API_NODE=/home/pepadmin/.local/opt/node24/bin/node ALLYVORA_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api \
ALLYVORA_IDENTITY="$PWD/$E/identity-final.json" ALLYVORA_RESULT="$PWD/$E/browser-final.json" ALLYVORA_SCREENSHOT="$PWD/$E/allyvora-final.png" \
  timeout 1800 npm run test:integration -w @pepbits-demo/allyvora-patients > "$E/integration-final.log" 2>&1 < /dev/null
printf '%s\n' 'HTTP integration passed; shell Chromium starting.'
timeout 900 npm run test:browser -w @pepbits/shell > "$E/shell-browser.log" 2>&1 < /dev/null
node "$E/checkpoint.mjs" "$E/verified-source.json"
date -u +%FT%TZ > "$E/completed-at.txt"
printf '%s\n' 'All heavy checks passed and returned.'
