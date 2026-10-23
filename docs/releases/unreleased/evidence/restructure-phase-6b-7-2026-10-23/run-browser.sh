#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
export HEALTHCARE_BUILD_DIR=.next
export HEALTHCARE_API_NODE=/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin/node
export HEALTHCARE_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export HEALTHCARE_RESULT="${HEALTHCARE_RESULT:-/tmp/phase6b7-browser.json}"
export HEALTHCARE_IDENTITY="${HEALTHCARE_IDENTITY:-/tmp/phase6b7-identity.json}"
export HEALTHCARE_SCREENSHOTS_DIR="${HEALTHCARE_SCREENSHOTS_DIR:-/tmp/phase6b7-screenshots}"
export HEALTHCARE_STOP_FILE="${HEALTHCARE_STOP_FILE:-/tmp/phase6b7-stop}"
exec node demo-apps/healthcare/scripts/integration.mjs
