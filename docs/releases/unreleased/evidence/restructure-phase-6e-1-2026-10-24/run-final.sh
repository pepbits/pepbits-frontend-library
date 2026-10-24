#!/usr/bin/env bash
# Final sequence in one heavy-lock hold, from the worktree root:
#   flock /home/pepadmin/.cache/pepbits-heavy.lock bash <this file>
set -uo pipefail
evidence="$PWD/docs/releases/unreleased/evidence/restructure-phase-6e-1-2026-10-24"
node "$evidence/source-digest.mjs" "$evidence/ci-source.json" ci
NEXT_PUBLIC_API_URL=/api TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=4096 \
 RCM_BROWSER_PARITY_RESULT=$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json \
 MEDBAND_BROWSER_PARITY_RESULT=$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json \
 timeout 7200 npm run ci -- --concurrency=1 --env-mode=loose </dev/null > "$evidence/ci-final.log" 2>&1
echo "ci exit $?" >> "$evidence/ci-final.log"
LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu" timeout 1800 npm run test:browser -w @pepbits/shell </dev/null > "$evidence/shell-browser.log" 2>&1
echo "browser exit $?" >> "$evidence/shell-browser.log"
node "$evidence/source-digest.mjs" "$evidence/verification-source.json" integration
timeout 2400 bash "$evidence/run-browser.sh" final </dev/null > "$evidence/integration-final.log" 2>&1
echo "integration exit $?" >> "$evidence/integration-final.log"
