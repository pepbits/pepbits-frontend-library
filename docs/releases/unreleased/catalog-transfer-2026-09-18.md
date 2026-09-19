# Catalogue transfer increment — 18 September 2026

Status: local source implementation; not published or deployed.

Added reusable CSV/XLSX master import/export panel, bounded spreadsheet decoder, formula protection and pricing expression input templates. Preview and commit use host-supplied authenticated ports. Commit retries retain operation identity; changing file/reason invalidates validation. Changed library exports only; no demo service or production tenant was modified.

Validation: focused master-transfer Vitest suite passed 13 tests using synthetic files and in-memory ports. Full library typecheck passed all packages. Healthcare consumer typecheck, 69 tests, 12-package provenance check and production build passed; the synthetic Chromium catalogue browser journey passed (advanced tools, expression templates, create import and optimistic UPSERT). Browser required local Playwright libraries and a temporary fontconfig pointing at local DejaVu fonts. This result is local source evidence, not API/database or browser acceptance. Source baseline: frontend commit 8c8e0bf8e94a6bd22172b6f77c3d4942da218c7a plus working-tree master-transfer additions. Consumer retains the additive patch SHA-256 in frontend.lock.json.

See [feature guide](../../features/master-transfer.md) for permissions, preferences and delivery limitations.

## 19 September pre-commit follow-up

The full repository gate exposed missing canonical translations in the transfer and expression
controls. Static labels/help now use the existing localization hook with English, Arabic, Hindi and
Malayalam catalog entries; fallbacks were regenerated from the canonical catalogs. Native-speaker
review remains pending. Existing raw server/decoder error messages and dynamic explanatory text
are not claimed as complete localized error contracts. No healthcare vendor archive was replaced.

An initial broad test run timed out in the existing page-template case while the backend build ran
concurrently (1,666 passed, one timeout). Its isolated eight-test file passed unchanged, and the next
full run passed all 1,667 tests before exposing the localization gate issue. Final verification is
recorded in the separate commit evidence; no test assertions or timeouts were relaxed.
