#!/usr/bin/env bash
set -euo pipefail
# Run from the worktree root. Never runs Turbo in the original desktop workspace.
export npm_config_cache=/tmp/phase6b-npm-cache
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
export TURBO_ENV_MODE=loose
export TURBO_CONCURRENCY=2
export NEXT_PUBLIC_API_URL=/api
export HEALTHCARE_BUILD_DIR=.next-final-build
npm install
npm run ci
/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs
