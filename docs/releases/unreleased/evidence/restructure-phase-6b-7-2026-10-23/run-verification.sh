#!/usr/bin/env bash
set -euo pipefail
# Run from the repository root after the full HTTP launcher has stopped its services.
evidence_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export npm_config_cache=/tmp/phase6b7-npm-cache
export TURBO_ENV_MODE=loose
export TURBO_CONCURRENCY=1
export NEXT_PUBLIC_API_URL=/api
export HEALTHCARE_BUILD_DIR=.next
export NODE_OPTIONS=--max-old-space-size=4096
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
export RCM_BROWSER_PARITY_RESULT="$evidence_dir/browser-final.json"
npm run ci -- --concurrency=1 > "$evidence_dir/ci-final.log" 2>&1
tail -8 "$evidence_dir/ci-final.log"
npm run test:browser -w @pepbits/shell > "$evidence_dir/shell-browser.log" 2>&1
tail -8 "$evidence_dir/shell-browser.log"
/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs > "$evidence_dir/docs-final.log" 2>&1
cat "$evidence_dir/docs-final.log"
