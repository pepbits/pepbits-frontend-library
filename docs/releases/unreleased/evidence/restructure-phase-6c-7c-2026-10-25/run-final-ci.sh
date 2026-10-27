#!/usr/bin/env bash
set -euo pipefail
node --input-type=module - <<'NODE'
import {readFileSync} from 'node:fs';
const folder='docs/releases/unreleased/evidence/restructure-phase-6c-7c-2026-10-25/';
const browser=JSON.parse(readFileSync(folder+'browser-final.json','utf8'));
const identity=JSON.parse(readFileSync(folder+'identity-final.json','utf8'));
if(browser.errors.length||browser.consoleErrors.length||browser.httpErrors.length||browser.checks.length!==114||browser.visualChecks.length!==45||[...browser.checks,...browser.panelChecks].some(check=>check.violations.length)||identity.integrationExit!==0||identity.cleanup.some(service=>service.groupAlive))throw Error('Complete the ERP browser check before final CI');
NODE
bash docs/releases/unreleased/evidence/restructure-phase-6c-7c-2026-10-25/run-ci.sh
