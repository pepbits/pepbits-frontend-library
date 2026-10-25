#!/usr/bin/env bash
# Run from the repository root after the production build. Fixture credentials are read by the driver.
set -euo pipefail
caregrid_evidence="$PWD/docs/releases/unreleased/evidence/restructure-phase-6e-5-2026-10-24"
export CAREGRID_API_NODE=/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin/node
export CAREGRID_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
export CAREGRID_RESULT="$caregrid_evidence/browser-final.json"
export CAREGRID_IDENTITY="$caregrid_evidence/identity-final.json"
export CAREGRID_SCHEDULING_IDENTITY="$caregrid_evidence/scheduling-identity.json"
export CAREGRID_SCREENSHOT="$caregrid_evidence/schedule.png"
export CAREGRID_STOP_FILE=/tmp/caregrid-resume-stop
export CAREGRID_TIMEOUT_MS=900000
flock -w 1800 -E 75 /home/pepadmin/.cache/pepbits-heavy.lock npm run test:integration -w @pepbits-demo/caregrid
