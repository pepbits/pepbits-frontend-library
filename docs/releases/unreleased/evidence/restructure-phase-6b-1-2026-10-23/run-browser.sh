#!/usr/bin/env bash
set -euo pipefail
# Run from the worktree root, after the matching production build. Local fixtures only.
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
export HEALTHCARE_BUILD_DIR=.next-final-build
export HEALTHCARE_API_NODE=/home/pepadmin/.local/opt/node-v24.21.0-linux-x64/bin/node
export HEALTHCARE_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export HEALTHCARE_RESULT=/tmp/phase6b-browser-final.json
export HEALTHCARE_IDENTITY=/tmp/phase6b-integration-final-identity.json
export HEALTHCARE_SCREENSHOTS_DIR=/tmp/phase6b-final-screenshots
node demo-apps/healthcare/scripts/integration.mjs
