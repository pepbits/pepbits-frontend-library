#!/usr/bin/env bash
# Keep Turbo concurrency 3 while allowing only one Vitest tree and one build.
set -euo pipefail
if [[ "${1:-}" == '-c' && "${2:-}" == *'vitest run'* ]]; then
  script=${2/vitest run/vitest run --maxWorkers=2 --testTimeout=120000}
  exec flock /tmp/erp-phase6c7c-unit.lock /bin/bash -c "$script"
elif [[ "${1:-}" == '-c' && ( "${2:-}" == *'next build'* || "${2:-}" == *'vite build'* ) ]]; then
  exec flock /tmp/erp-phase6c7c-build.lock /bin/bash "$@"
fi
exec /bin/bash "$@"
