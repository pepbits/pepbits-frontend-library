#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
receipt_dir="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24"
printf 'Contrast verification lock acquired at %s\n' "$(date -u +%FT%TZ)"
node "$receipt_dir/write-manifest.mjs"
cp "${receipt_dir%/evidence/*}/manifest-restructure-phase-6c-6-2026-10-24.json" "$receipt_dir/contrast-browser-source.json"
npm run test:browser -w @pepbits/shell > "$receipt_dir/contrast-preflight.log" 2>&1
bash "$receipt_dir/run-ci.sh" > "$receipt_dir/ci-verified.log" 2>&1
