#!/usr/bin/env bash
# Shared Jenkins/GitHub contract. Run from a clean checkout under Node 24.
set -euo pipefail
cd "$(dirname "$0")/../.."
export NEXT_PUBLIC_API_URL=/api VITE_API_URL=/api NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_SETTLE_API_URL=/settle-api NEXT_PUBLIC_CAREGRID_API_URL=/caregrid-api NEXT_PUBLIC_ALLYVORA_API_URL=/allyvora-api
npm run ci
npm run stamp:builds
npm run docs:check
node --test docs/tools/*.test.mjs
node docs/tools/documentation-lifecycle.mjs check
npm run build --prefix mock-api
npm run typecheck --prefix mock-api
npm run test:api
npm run test:clinical-api
npm run test:deployment
