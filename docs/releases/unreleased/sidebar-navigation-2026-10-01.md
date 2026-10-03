# Shared sidebar navigation correction — 1 October 2026

Status: fixed, deployed and verified on the isolated frontend test site as `20261001-sidebar-04`. Local and authenticated public browser acceptance passed.

The LIS1/LIS2/RIS1 rail previously ignored the effective hover setting, latched open, and covered the header module selector. Earlier route checks loaded destinations directly; they did not prove that every sidebar link worked or that module selection remained clickable while the rail was expanded. A real deployed browser probe reproduced the overlay defect in all three modules.

## Corrected behavior

All modules now use the common sidebar implementation and effective hover/click/focus preferences. The toggle remains available in either mode. An unpinned rail closes after selecting a menu destination or clicking outside; Escape within the rail closes it when the menu search is empty and restores toggle focus. A manual collapse suppresses immediate reopening under the same pointer until a fresh entry.

The floating rail sits below the header, keeping its module/branch controls and dropdowns accessible. Its pin control sits below the header strip; pinned rails retain their reserved layout width. Managed pinning remains enforced on the toggle and both pin controls. The toggle retains the collapsed strip width on either physical side, so Arabic text direction cannot move it beneath the header. Imported clinical page layouts and API business contracts are unchanged.

A new help snapshot, `2026-10-01-sidebar-navigation-fix`, adds common navigation instructions without editing older release snapshots. Claude Code Sonnet supplied Arabic, Hindi and Malayalam draft translations; human native/domain review remains pending.

## Verification boundary

The initial complete unit run passed 1,962 tests across 168 files before final pin-control and toggle-strip placement. The final focused shell suite covers those changes and passed 52 tests across four files, including hover/click, outside/navigation dismissal, keyboard, managed pinning, pin-control position and RTL placement. Final shell TypeScript, both production builds and release gates passed. Both build API stamps were checked as `/api`.

The strengthened diagnostic browser suite navigates all 55 destinations by clicking their real sidebar links and checks header accessibility, hover, outside dismissal and keyboard behavior. It uses authenticated synthetic HTTP and does not intercept business responses. Healthcare, School and multilingual suites remain separate regression scopes. Native executable, clinical/provider and human language acceptance are not established by these tests.

## Deployment identity

Target: the isolated [frontend test site](https://frontend.test.pepbits.com), active release `20261001-sidebar-04`. Prior release `20261001-diagnostics-01` remains the rollback target. Only the three frontend-test shell/API units and four documentation configuration files are in scope; provider simulators and Healthcare Enterprise/ERP/School deployments are unchanged.

The package and source overlay are staged against the exact selected baseline with verified archive hashes and preserved native dependencies. There is no dependency download or database migration in this correction. Activation retains matching previous source/configuration/release and a guarded synthetic-data backup, checks readiness, and preserves existing clinical/financial data fingerprints. Ordinary rollback preserves data written after cutover.

Source identity is base `1eba17bdd3584fcfbef722da317ceb353286b5a8` plus the [306-file source snapshot](sidebar-navigation-source-2026-10-01.json). This is a working-tree snapshot, not a claim of a new Git push or package publication. The [initial diagnostic delivery](diagnostic-reference-2026-10-01.md) and its evidence retain their original source identity and acceptance scope.


## Retained evidence

The [activation receipt](evidence/sidebar-navigation-2026-10-01/activation.json) records readiness and three preserved clinical/financial files. The [staging receipt](evidence/sidebar-navigation-2026-10-01/stage-result.json), [runtime preflight](evidence/sidebar-navigation-2026-10-01/runtime-preflight.json) and [archive hashes](evidence/sidebar-navigation-2026-10-01/archives.json) identify the accepted package. The frozen source digest is `d8fe45cd2ffe563069f5aebd3db5a608d41d75e51f089e4161a08a574011590c`.

[Local diagnostic acceptance](evidence/sidebar-navigation-2026-10-01/local-diagnostic-results.json) passed 80 checks. [Local multilingual acceptance](evidence/sidebar-navigation-2026-10-01/local-multilingual-results.json) passed 183 results, including both physical sidebar placements in Arabic, Hindi and Malayalam. Browser errors were empty. The test driver now resolves the Collapse button after its accessible name changes; its failed initial lookup and earlier genuine RTL failures are retained rather than counted as passes.


## Public acceptance

The deployed HTTPS site passed [80 diagnostic navigation checks](evidence/sidebar-navigation-2026-10-01/public-diagnostic-reference-results.json), [49 original Healthcare Suite checks](evidence/sidebar-navigation-2026-10-01/public-healthcare-suite-results.json) and [28 School checks](evidence/sidebar-navigation-2026-10-01/public-school-role-header-results.json). All three reported zero page errors; diagnostics and Healthcare Suite also reported zero console errors. School does not capture console errors. Diagnostic navigation retained eight aborted prefetch requests; Healthcare retained none. Aborts remain evidence and are not counted as successful responses.

The [validation receipt](evidence/sidebar-navigation-2026-10-01/validation.json) distinguishes the full-unit run before final placement changes, the final focused suite, local multilingual checks, public regressions, preserved data and remaining human/provider review. All 306 frozen source files remained unchanged after acceptance. Refresh an existing browser tab to load the corrected package. API restart resets active demo sessions, so sign in again if needed.
