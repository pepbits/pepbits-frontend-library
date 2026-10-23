#!/usr/bin/env bash
# Run from the worktree root. Reuse existing tools; do not install desktop dependencies.
set -euo pipefail
export SHOWCASE_BASE='http://127.0.0.1:3304'
export LD_LIBRARY_PATH='/home/pepadmin/codex-tmp/claude-1000/-home-pepadmin-pb-repos-saas-pepbits-healthcare-enterprise/d88db08b-bd37-434b-8cb2-fb7f6e3812cb/scratchpad/libroot/usr/lib/x86_64-linux-gnu'
export SHOWCASE_PLAYWRIGHT_PATH='/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/desktop-clients/node_modules/playwright'
export SHOWCASE_CHROMIUM='/home/pepadmin/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'
node demo-apps/showcase/scripts/smoke.mjs
