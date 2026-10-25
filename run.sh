#!/usr/bin/env bash
# Root workspace service controller. Node 24 is required by the mock API.
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tooling/scripts/run-services.mjs" "$@"
