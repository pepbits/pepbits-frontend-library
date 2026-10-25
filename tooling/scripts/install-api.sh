#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
for runtime in mock-api mock-api/access-runtime mock-api/diagnostics-runtime mock-api/quality-source mock-api/quality-runtime mock-api/pharmacy-runtime; do
  npm ci --no-audit --no-fund --prefix "$runtime"
done
