# School role header evidence — 28 September 2026

Implementation source: `9c3cea72e624dccb454cfd60fd2d0a34b774a69b`; base: `6f470dc81f4a52557ca4010e715af9b8f020cc25`.

The [local validation summary](local-validation.json) identifies the final unit/API/typecheck/build/rule results. `local-browser/` contains the 28 authenticated local Chromium checks and seven screenshots. Retained logs are from the final passing runs; focused suites overlap the full suites and their counts are not summed.

The [registered role browser script](../../../../../desktop-clients/e2e/school-role-header.mjs) checks six role views, restricted access, route/refresh/new-tab behavior and representative existing modules. [public-reference-regression.mjs](public-reference-regression.mjs) additionally checks the original 152 static reference destinations, six dynamic destinations and four representative pages against the public HTTPS site. Set `E2E_BASE` and `E2E_API` explicitly. TLS certificate validation remains enabled.

API accounts, School identities and records are synthetic demo fixtures. No session tokens, private deployment credentials or TLS keys are retained here. Native executable acceptance, real School identity/provider integration and native-speaker review are separate from these results.

See the [release record](../../school-role-header-2026-09-28.md) for activation and rollback identities. `ARTIFACTS.json` records the size and SHA-256 digest of each evidence file after final collection.

The public role run passed 28 checks, with zero page errors and seven screenshots. The separate public reference run passed 162 records (152 static, six dynamic, four representative), with zero page errors. Both used normal DNS and HTTPS certificate validation. See [public validation](public-validation.json), [role results](public-browser/results.json), [reference results](public-reference/results.json) and [runtime receipts](runtime/README.md). These counts describe overlapping test scopes and are not added into one coverage total.
