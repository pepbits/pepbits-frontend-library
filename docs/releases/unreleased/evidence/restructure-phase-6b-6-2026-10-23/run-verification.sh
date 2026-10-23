#!/usr/bin/env bash
set -euo pipefail
export npm_config_cache=/tmp/phase6b6-npm-cache
export TURBO_ENV_MODE=loose
export TURBO_CONCURRENCY=1
export NEXT_PUBLIC_API_URL=/api
export HEALTHCARE_BUILD_DIR=.next
export NODE_OPTIONS=--max-old-space-size=4096
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
# Optional original browser wrapper asserts the separately retained real Chromium receipt.
# Set RCM_BROWSER_PARITY_RESULT to the successful pre-CI receipt.
npm run ci -- --concurrency=1
npm run test:browser -w @pepbits/shell
/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs
