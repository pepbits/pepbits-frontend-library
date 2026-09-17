# Main integration verification — 17 September 2026

This record covers reusable host session/shell composition, authorized branch presentation,
preference policy options, DCP host controls and patient record layout exports.
No package publication, native application acceptance or live deployment is implied.

Source before this evidence/index addition: base `2f8c5b42bd33c609d344c9ea410c2d29503ce40e`,
38 changed/new files. SHA-256 of sorted relative paths and contents separated by NUL bytes:
`3a0cdf61063a652f732c39771c0f956a15bc74700e5c7b5e56c58d3058e1d2b8`.

## Local verification

Node 24; commands below run in `desktop-clients` unless noted otherwise.

- `npm run typecheck`: passed all configured packages/apps.
- `npx vitest run --maxWorkers=1`: 1,580 tests across 131 files passed.
- `npm run test:api`: 104 demo API and 33 clinical API cases passed.
- `npm run test:e2e-registry`: 2 passed.
- `npm run test:deployment`: 14 passed.
- `npm run build`: production web and browser-rendered desktop builds passed after
  the final CSS correction. This is not a native desktop executable test.
- `npm run verify`: component/localization/docs/example/preference checks passed.
  The final generated bundles are checked again before commit.

The initial concurrent test runs hit timing limits (one case in the first run, four
in a subsequent run). The complete single-worker run passed without changing timeouts
or assertions. Initial API tests could not start because the separate demo API package
had not had its locked dependencies installed; `npm ci` in `dummy-api` resolved this.

Verification identified a fixed 12px mobile record-rail heading. It now consumes
`--fs-scale`, preserving the form-size preference on narrow screens. The existing
preference-token gate remains unchanged. Fourteen missing host-integration impact
receipts were reviewed and recorded with specific documentation references; historical
in-app guides remain immutable and the standalone demo contracts retain their defaults.

Healthcare consumer production-build browser checks passed separately: 41 Tenant Admin
and 16 healthcare workspace scenarios. Those checks use pinned package archives and
synthetic BFF fixtures; they are not proof of live APIs or of newly publishing these
library sources. Full library browser/native matrices and production services were not
rerun. The documented authoring/native-language review backlog remains open.
