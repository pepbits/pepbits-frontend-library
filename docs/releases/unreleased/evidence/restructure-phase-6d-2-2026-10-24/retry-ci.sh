#!/usr/bin/env bash
set -euo pipefail
folder=docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24
# Invoked under the shared lock, so the preceding CI has finished and closed its log.
node -e 'const result=require("./"+process.argv[1]);if(result.exitCode!==1)throw new Error("Expected preceding CI diagnostic exit 1")' "$folder/ci-exit.json"
mv "$folder/ci-final.log" "$folder/ci-shell-diagnostic.log"
mv "$folder/ci-source.json" "$folder/ci-shell-source.json"
mv "$folder/ci-exit.json" "$folder/ci-shell-exit.json"
exec bash "$folder/run-ci.sh" > "$folder/ci-final.log" 2>&1
