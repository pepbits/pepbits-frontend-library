#!/usr/bin/env bash
set -euo pipefail
# Run from this worktree root, after the onboarding production build completes (NEXT_PUBLIC_API_URL=/api).
E=docs/releases/unreleased/evidence/restructure-phase-6e-3-2026-10-24
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ONBOARDING_API_NODE="${ONBOARDING_API_NODE:-/home/pepadmin/.local/opt/node24/bin/node}"
export ONBOARDING_RUNTIME_ARTIFACTS="${ONBOARDING_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}"
export ONBOARDING_IDENTITY="$PWD/$E/identity-final.json"
export ONBOARDING_RESULT="$PWD/$E/browser-final.json"
export ONBOARDING_SCREENSHOT="$PWD/$E/onboarding-final.png"
export ONBOARDING_STOP_FILE=/tmp/phase6e3-stop-final
node "$E/capture-source.mjs" > "$E/integration-source.json"
exec npm run test:integration -w @pepbits-demo/onboarding
