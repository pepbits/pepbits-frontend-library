#!/usr/bin/env bash
# Run from any directory with Node 24 and npm on PATH. Does not deploy or change live databases.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
node -e 'if(Number(process.versions.node.split(".")[0])<24)throw Error("Node 24+ is required")'
cd "$repo_root/desktop-clients"
# The initial integration adds workspace dependencies; commit the resulting reviewed locks.
npm install --no-audit --no-fund
npm install --prefix ../dummy-api/diagnostics-runtime --no-audit --no-fund
for variant in lis1 lis2 ris1; do
  node node_modules/typescript/bin/tsc -p "../dummy-api/diagnostics-runtime/tsconfig.$variant.json"
done
node scripts/diagnostics/build-backends.mjs
node node_modules/typescript/bin/tsc -p packages/reference-lis1/tsconfig.json
node node_modules/typescript/bin/tsc -p packages/reference-lis2/tsconfig.json
node node_modules/typescript/bin/tsc -p packages/reference-ris1/tsconfig.json
node --test --test-isolation=none ../dummy-api/diagnostics-policy.test.mjs ../dummy-api/diagnostics-runtime/integration.test.mjs
node node_modules/vitest/vitest.mjs run packages/reference-diagnostics/src/client.test.tsx packages/erp-shell/src/diagnostic-sidebar.test.tsx packages/erp-shell/src/school-role-header.test.tsx packages/erp-config/src/reference-modules.test.ts packages/reference-host/src/transport.test.ts
npm run build
