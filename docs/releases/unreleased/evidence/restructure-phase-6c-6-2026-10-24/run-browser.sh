#!/usr/bin/env bash
set -euo pipefail
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ERP_API_NODE=/home/pepadmin/.local/opt/node24/bin/node
export ERP_RUNTIME_ARTIFACTS=/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api
export ERP_IDENTITY="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/identity-final.json"
export ERP_RESULT="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24/browser-final.json"
export ERP_VISUAL_SCREENSHOT_DIR="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24"
export ERP_STOP_FILE=/tmp/phase6c6-stop-final
unset ERP_SCREENSHOT
# Keep the acquired heavy lock during a bounded driver correction, with no stdin wait.
# Each failed launcher has already stopped its service groups before this loop resumes.
receipt_dir="$PWD/docs/releases/unreleased/evidence/restructure-phase-6c-6-2026-10-24"
retry_file=/tmp/phase6c6-browser-retry
rm -f "$retry_file"
for attempt in 4 5 6; do
  if [ -e "$ERP_STOP_FILE" ]; then exit 1; fi
  node "$receipt_dir/write-manifest.mjs"
  cp "${receipt_dir%/evidence/*}/manifest-restructure-phase-6c-6-2026-10-24.json" "$receipt_dir/browser-source.json"
  if npm run test:integration -w @pepbits-demo/erp; then browser_status=0; else browser_status=$?; fi
  BROWSER_STATUS="$browser_status" RECEIPT_DIR="$receipt_dir" node -e 'const fs=require("node:fs"),p=process.env.RECEIPT_DIR;const shell=JSON.parse(fs.readFileSync(p+"/attempt-1-browser-exit.json")).shellExit;fs.writeFileSync(p+"/browser-exit.json",JSON.stringify({shellExit:shell,integrationExit:Number(process.env.BROWSER_STATUS)},null,2)+"\n")'
  if [ "$browser_status" -eq 0 ]; then exit 0; fi
  for artifact in browser-final.json identity-final.json browser-source.json browser-exit.json erp1-booking.png erp2-booking.png erp2-report-columns.png; do
    if [ -f "$receipt_dir/$artifact" ]; then mv "$receipt_dir/$artifact" "$receipt_dir/attempt-$attempt-$artifact"; fi
  done
  if [ "$attempt" -eq 6 ]; then exit "$browser_status"; fi
  printf 'Integration attempt %s failed and services stopped; awaiting driver correction for at most 5 minutes.\n' "$attempt"
  ready=false
  for tick in $(seq 1 300); do
    if [ -e "$ERP_STOP_FILE" ]; then exit "$browser_status"; fi
    if [ -e "$retry_file" ]; then rm -f "$retry_file"; ready=true; break; fi
    sleep 1
  done
  if [ "$ready" != true ]; then exit "$browser_status"; fi
done
