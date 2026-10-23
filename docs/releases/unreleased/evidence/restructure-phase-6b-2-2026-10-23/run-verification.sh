#!/usr/bin/env bash
set -euo pipefail
# Worktree root only. One Turbo task / Vitest process tree at a time.
export npm_config_cache=/tmp/phase6b-npm-cache
export TURBO_ENV_MODE=loose
export TURBO_CONCURRENCY=1
export NEXT_PUBLIC_API_URL=/api
export HEALTHCARE_BUILD_DIR=.next-phase6b2
export NODE_OPTIONS=--max-old-space-size=4096
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
npm install
npm run ci -- --concurrency=1
npm run test:browser -w @pepbits/shell
/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs
