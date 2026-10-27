#!/usr/bin/env bash
set -euo pipefail
date -u '+Lock acquired %FT%TZ'
receipt_dir="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-7c-2026-10-25"
export npm_config_script_shell="$receipt_dir/ci-shell.sh"
export NEXT_PUBLIC_API_URL=/api
export RCM_BROWSER_PARITY_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json"
export MEDBAND_BROWSER_PARITY_RESULT="$RCM_BROWSER_PARITY_RESULT"
node "$receipt_dir/write-manifest.mjs"
cp "${receipt_dir%/evidence/*}/manifest-restructure-phase-6c-7c-2026-10-25.json" "$receipt_dir/ci-source.json"
npm run ci -- --concurrency=3 --env-mode=loose
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
npm run test:browser -w @pepbits/shell > "$receipt_dir/shell-browser.log" 2>&1
