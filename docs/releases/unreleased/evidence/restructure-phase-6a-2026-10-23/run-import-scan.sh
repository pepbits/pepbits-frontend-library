#!/usr/bin/env bash
# Exact requested scan, run from the worktree root; matching paths need review.
grep -rniE "@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-client|ai-config|ai-ui|reference-)|desktop-clients|/src/|localhost:[0-9]+/api|password\s*[:=]\s*['\"][^'\"]{4,}" demo-apps/showcase --include=*.ts --include=*.tsx --include=*.mjs --include=*.json -l | grep -v node_modules
