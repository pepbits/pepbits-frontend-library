#!/usr/bin/env bash
# Local production server must already be running on port 3318. No desktop install.
set -euo pipefail
export SHOWCASE_BASE='http://127.0.0.1:3318'
export SHOWCASE_EVIDENCE='docs/releases/unreleased/evidence/restructure-phase-6a-2026-10-23/follow-up'
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
export SHOWCASE_PLAYWRIGHT_PATH="$PWD/desktop-clients/node_modules/playwright"
export SHOWCASE_CHROMIUM="$HOME/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell"
node demo-apps/showcase/scripts/smoke.mjs
