#!/usr/bin/env bash
# Exact phase 6e-2 verification sequence, run from the worktree root. Heavy steps hold the shared lock one at a time.
set -euo pipefail
E=docs/releases/unreleased/evidence/restructure-phase-6e-2-2026-10-24
LOCK=/home/pepadmin/.cache/pepbits-heavy.lock
npm install --no-audit --no-fund
node "$E/source-checkpoint.mjs" "$E/ci-source.json"
flock "$LOCK" env NEXT_PUBLIC_API_URL=/api \
  RCM_BROWSER_PARITY_RESULT=$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json \
  MEDBAND_BROWSER_PARITY_RESULT=$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json \
  npm run ci -- --concurrency=1 --env-mode=loose > "$E/ci-final.log" 2>&1
flock "$LOCK" env LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu" npm run test:browser -w @pepbits/shell > "$E/shell-browser.log" 2>&1
node "$E/source-checkpoint.mjs" "$E/verification-source.json"
"$E/run-browser.sh" > "$E/integration-final.log" 2>&1
/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs > "$E/docs-final.log" 2>&1
node "$E/check-boundaries.mjs"
node "$E/write-manifest.mjs"
