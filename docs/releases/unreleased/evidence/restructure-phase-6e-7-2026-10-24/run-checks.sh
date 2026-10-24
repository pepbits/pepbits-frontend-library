#!/usr/bin/env bash
# Phase 6e-7 heavy checks, run once under the shared lock from the worktree root:
#   flock /home/pepadmin/.cache/pepbits-heavy.lock bash docs/releases/unreleased/evidence/restructure-phase-6e-7-2026-10-24/run-checks.sh <label>
# Order: desktop web build for integration -> real-HTTP integration -> shell Chromium -> forced root CI.
# Each step records its exit; failures stop this run. No native build is invoked.
set -uo pipefail
label="${1:-final}"
evidence="docs/releases/unreleased/evidence/restructure-phase-6e-7-2026-10-24"
work="$(mktemp -d /tmp/desktop-6e7-XXXXXX)"
trap 'rm -rf "$work"' EXIT
echo "Heavy lock acquired at $(date -u +%FT%TZ)"
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
status() { echo "{\"step\":\"$1\",\"exit\":$2,\"finished\":\"$(date -u +%FT%TZ)\"}" >> "$evidence/steps-$label.ndjson"; if [ "$2" != 0 ]; then exit "$2"; fi; }
node "$evidence/source-checkpoint.mjs" "$evidence/source-$label.json"
if [ "${SKIP_INTEGRATION:-}" != 1 ]; then
  VITE_API_URL=/api DESKTOP_BUILD_DIR="$work/dist" timeout 1800 npm run build -w @pepbits-demo/desktop > "$evidence/build-integration-$label.log" 2>&1; status build-integration $?
  echo "{\"unresolvedAssetWarnings\":$(grep -c "didn't resolve" "$evidence/build-integration-$label.log")}" > "$evidence/build-assets-$label.json"
  node --input-type=module - "$work/dist" "$evidence/build-identity-$label.json" <<'JS'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,relative} from 'node:path';
const [directory,output]=process.argv.slice(2),files=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else{const bytes=readFileSync(path);files.push({path:relative(directory,path),bytes:bytes.length,sha256:sha(bytes)});}}}
walk(directory);files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
writeFileSync(output,JSON.stringify({scope:'Local production web build served by vite preview; no native executable',apiBase:'/api',aiEnabled:false,fileCount:files.length,bytes:files.reduce((sum,file)=>sum+file.bytes,0),digest:sha(files.map(file=>file.path+'\0'+file.sha256+'\n').join('')),entryFiles:files.filter(file=>/\.(html|js|css)$/.test(file.path))},null,2)+'\n');
JS
  DESKTOP_BUILD_DIR="$work/dist" DESKTOP_API_NODE="$HOME/.local/opt/node24/bin/node" \
  DESKTOP_RUNTIME_ARTIFACTS="${DESKTOP_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}" \
  DESKTOP_RESULT="$PWD/$evidence/browser-$label.json" DESKTOP_IDENTITY="$PWD/$evidence/identity-$label.json" \
  DESKTOP_SCREENSHOT="$PWD/$evidence/desktop-$label.png" DESKTOP_STOP_FILE="$work/stop" DESKTOP_TIMEOUT_MS=1800000 \
    timeout 2100 npm run test:integration -w @pepbits-demo/desktop > "$evidence/integration-$label.log" 2>&1; status integration $?
fi
  timeout 1200 npm run test:browser -w @pepbits/shell > "$evidence/shell-browser-$label.log" 2>&1; status shell-browser $?
  RCM_BROWSER_PARITY_RESULT=$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json \
  MEDBAND_BROWSER_PARITY_RESULT=$PWD/docs/releases/unreleased/evidence/restructure-phase-6b-9-2026-10-23/browser-final.json \
  NEXT_PUBLIC_API_URL=/api VITE_API_URL=/api timeout 7200 npm run ci -- --concurrency=1 --env-mode=loose > "$evidence/ci-$label.log" 2>&1; status ci $?
# This process namespace contains every descendant started by this locked run.
# Retain names/PIDs only; command lines and environment values may contain secrets.
ps -eo pid,ppid,comm | awk 'NR==1 || $3 ~ /^(node|npm|chrome|chromium|vite|next-server|java|python)/' > "$evidence/processes-$label.txt"
