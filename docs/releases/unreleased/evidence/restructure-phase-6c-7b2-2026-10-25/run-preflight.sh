#!/usr/bin/env bash
# Queued before the shared lock became available. Run the frozen complete checks.
set -euo pipefail
exec bash docs/releases/unreleased/evidence/restructure-phase-6c-7b2-2026-10-25/run-verification.sh
