#!/usr/bin/env bash
set -euo pipefail
# Run from this worktree root. Builds the app and runs the real local HTTP integration under one hold of the shared heavy-check lock.
export LD_LIBRARY_PATH="$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu"
export TENANT_ADMIN_API_NODE="${TENANT_ADMIN_API_NODE:-/home/pepadmin/.local/opt/node24/bin/node}"
export TENANT_ADMIN_RUNTIME_ARTIFACTS="${TENANT_ADMIN_RUNTIME_ARTIFACTS:-/home/pepadmin/pb/repos/saas/lib/pepbits-frontend-library/dummy-api}"
OUT="${OUT:-$PWD/docs/releases/unreleased/evidence/restructure-phase-6e-2-2026-10-24}"
export TENANT_ADMIN_RESULT="$OUT/browser-final.json" TENANT_ADMIN_IDENTITY="$OUT/identity-final.json" TENANT_ADMIN_SCREENSHOTS_DIR="$OUT/screenshots"
export TENANT_ADMIN_STOP_FILE=/tmp/phase6e2-stop TENANT_ADMIN_TIMEOUT_MS=1200000
# Optional: TENANT_ADMIN_CAPTURE=demo-apps/tenant-admin/src/test/api.json refreshes the mocked-test fixtures before the workflows.
exec flock /home/pepadmin/.cache/pepbits-heavy.lock bash -c 'NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/tenant-admin && npm run test:integration -w @pepbits-demo/tenant-admin'
