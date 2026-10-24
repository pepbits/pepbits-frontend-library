#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export SCHOOL_API_NODE="${SCHOOL_API_NODE:-/home/pepadmin/.local/opt/node24/bin/node}"
export SCHOOL_RUNTIME_ARTIFACTS="${SCHOOL_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}"
export SCHOOL_IDENTITY="$PWD/docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/identity-final.json"
export SCHOOL_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/browser-final.json"
export SCHOOL_SCREENSHOT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/live-final.png"
export SCHOOL_STOP_FILE=/tmp/school-phase6d2-stop
exec flock /home/pepadmin/.cache/pepbits-heavy.lock bash -c 'node docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/build-identity.mjs && npm run test:integration -w @pepbits-demo/school'
