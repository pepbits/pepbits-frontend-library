# Diagnostic reference import — 1 October 2026

Status: deployed to [frontend.test.pepbits.com](https://frontend.test.pepbits.com) on release `20261001-diagnostics-01`. Automated release gates, local multilingual validation and public browser acceptance passed. Human and detailed clinical workflow acceptance remain pending.

LIS1, LIS2 and RIS1 are separate header modules with 19, 22 and 14 menu destinations. Their source detail/viewer/print routes use the shared host transport, actor and branch context. All three use an explicit sidebar toggle; default collapsed state and managed pinning are retained. Imported styles are compiled into validated module scopes so their resets and utilities do not change the existing host design.

The single demo API delegates to private source service workers with persistent branch-isolated databases. Original standalone logins and browser role switching are blocked. Business seeds and integration samples remain server-side; external provider delivery is disabled in this reference runtime.

See the [feature guide](../../features/diagnostic-reference/README.md), [source provenance](../../reference-import/DIAGNOSTICS-SOURCE.json), [working-tree source manifest](diagnostic-reference-source-2026-10-01.json) and [validation evidence](evidence/diagnostic-reference-2026-10-01/validation.json).

## Verified results

- Session npm access: PONG in 271 ms. npm log-directory create/delete probe passed; no server DNS changes.
- Node v24.21.0/npm 11.19.0 dependencies and locks installed. Native better-sqlite3 installation is explicitly allowed by its runtime manifest.
- All frontend packages and three backend source TypeScript checks passed.
- Actual diagnostic policy/service suite: 8 passed, including writes, branch isolation, denied read-only writes and restart persistence. Its 5 policy cases also appear in the API regression run; do not add overlapping counts.
- API regression: 312 passed, zero failed/skipped. Deployment and E2E registry tests: 16 passed.
- Full frontend unit regression: 1,952 passed across 168 files. This run preceded the final diagnostic toggle fix; all 5 focused sidebar tests and the browser suites passed after that fix.
- Both production builds passed with browser API `/api`. Scoped-style parity, shared components, form controls, component example consistency and bundle budgets passed.
- Actual Chromium/browser API validation: diagnostic import 71 checks, Healthcare Suite 49 checks and School role/header 28 checks, all with zero page errors. Diagnostics and Healthcare also recorded zero console errors.
- All 55 diagnostic menu destinations were navigated and captured. Each module passed header selection, sidebar toggle, authenticated actor, actual API patient write, branch isolation and rendering its saved record. Navigation/screenshots do not establish every clinical workflow, detail/print route or visual comparison to the source.
- Documentation lifecycle/registration and local link checks passed; prior released documentation was preserved. All 55 diagnostic guides have complete Arabic, Hindi and Malayalam translations with 165 synchronized revisions; native review remains pending.
- Canonical UI copy, new API errors and dashboard captions were translated with Claude Code Sonnet. Technical identifiers, placeholders and API option values are preserved.
- All automated release gates passed with all four diagnostic packages included in copy scanning.
- Multilingual browser acceptance passed nine module/language dashboards, Arabic direction, sidebar toggles, stable RIS status-filter values and 165 complete guides. No browser page or console errors occurred.
- RCM local regression passed 46 checks; three provider flows were explicitly not run in the unconfigured local environment.

The browser used the existing private Chromium support libraries and font configuration. Its first launch failed for missing shared libraries, and a subsequent crash exposed the missing font configuration. Those were local browser-runtime issues, separate from npm registry access.

## Deployment and remaining acceptance

The immutable public test package is `20261001-diagnostics-01`. Both packaged shells passed isolated HTML/asset smoke checks. The release archive and source archives were uploaded to the existing test host, installed in a private stage, checked against their SHA256 manifests and verified with native SQLite before activation. Existing test-site data, provider configuration and the previous matching source/config/release are retained for rollback. Healthcare Enterprise, ERP and School deployment services are outside this update.

Activation passed; the selected release pointer and all three isolated frontend/API services were verified. Public HTTPS certificate validation, release identity and `/api/health` passed. Three existing clinical/financial data files retained their pre-activation hashes. The previous release `20260929122358894-3da821b0` and its matching source/configuration/data backup remain available for rollback. Other applications and the provider simulator services were not changed.

Public browser acceptance passed 71/71 diagnostic checks, original Healthcare Suite regression 49/49 and School role/header regression 28/28. All reported zero page errors; Diagnostics and Healthcare also reported zero console errors. Diagnostic HTTP failures and request aborts were both zero. Healthcare retained one navigation-abort record. These checks use synthetic demo data and actual authenticated HTTP, not intercepted business responses.

The first School run stopped after six checks because the test captured the old dashboard URL before client navigation to Fees completed. An explicit destination URL wait corrected the test, and the full rerun passed. The [post-deployment test overlay](evidence/diagnostic-reference-2026-10-01/post-deployment-test-overlay.json) identifies that test-only change; the deployed runtime was unchanged. Both the failed attempt and successful rerun are retained in the validation evidence.

The release archive SHA256 is `14e4ef20663a2f195ece5ba85e0ee4c201e8472f44102351af0970ed20244ecf`. Archive identities, the [activation receipt](evidence/diagnostic-reference-2026-10-01/activation-receipt.json), local results, public results and screenshots are indexed in the [validation receipt](evidence/diagnostic-reference-2026-10-01/validation.json). The activation receipt's pending public-acceptance field reflects its earlier timestamp; the later validation receipt records completed acceptance.

Native-speaker/domain approval, complete source-image comparison and all detailed clinical/viewer/print workflows remain pending. Automated checks do not confer those approvals. The current local RCM provider skips remain explicit; this import does not claim a new licensed grouper or live bank/payer/analyzer/DICOM acceptance.

The base commit is `1eba17bdd3584fcfbef722da317ceb353286b5a8`. The frozen deployed source has 304 listed runtime/test files and SHA256 `438df6de7324800d3077774019a8b4e35ae9387544093e57548974b17f731d97`; all 304 remained unchanged after public acceptance. This is a working-tree source snapshot, not a claim that a new commit was pushed. Operational documentation/evidence and the separately identified School test overlay are later changes, outside that deployment snapshot.
