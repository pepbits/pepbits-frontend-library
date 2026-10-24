#!/usr/bin/env bash
set -uo pipefail
folder=docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24
while [ ! -f "$folder/ci-exit.json" ]; do sleep 5; done
ci_status=$(node -e 'process.stdout.write(String(JSON.parse(require("node:fs").readFileSync(process.argv[1])).exitCode))' "$folder/ci-exit.json")
if [ "$ci_status" != 0 ]; then exit 1; fi
bash "$folder/run-browser.sh" > "$folder/integration-final.log" 2>&1
run_status=$?
RUN_STATUS="$run_status" node -e 'require("node:fs").writeFileSync("docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/integration-exit.json",JSON.stringify({exitCode:Number(process.env.RUN_STATUS)},null,2)+"\n")'
exit "$run_status"
