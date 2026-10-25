#!/usr/bin/env bash
# Delegating entry point; the service table lives in tooling/services.mjs.
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run.sh" "$@"
