# Library restructure phase 5 foundation — 23 October 2026

**Continuation:** [Part 2](#part-2) completes priorities 4–6. The part 1 text and verification below are historical; all original evidence files are preserved byte-for-byte. Its manifest is preserved as a separate snapshot; the main manifest now identifies part 2.

Status: **priorities 1–3 implemented and locally verified; phase 5 remains incomplete**. Chrome, workspace UI and remaining layers are deferred under the owner's smaller-complete-increment allowance. Base: `aba0e4e43052454ecd545867a50016f4097d01f3` on `main`, initially clean. Unreleased working tree; no commit, tag, push, publication or deployment. New package version `0.0.0` is a source-workspace version. [Plan status](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-5-status); [testing guide 1.0.0](../../testing/v1.0.0/PRE-COMMIT.md); [host/user integration guide](../../../packages/shell/README.md).

Source identity: **4c129c90713dc992ca64fd5236543839fadde06f489c2177ddae42a5a961778c**, SHA-256 over sorted `path + NUL + file SHA-256 + LF` entries in the [373-file source manifest](evidence/restructure-phase-5-2026-10-23/part-2/part-1-manifest.json). Scope includes root configuration, all packages/tooling, the restructure plan and delivery index. This record, manifest and evidence are excluded to avoid self-reference. Final CI covers implementation bytes; only guide/plan/index wording and release evidence were finalized afterward. Documentation checks cover final text.

## Changes and public API

Added **42 files** under `packages/shell`: manifest/configuration, README, public area/root exports, workspace implementation, shell services, private fixtures and 14 test files. Icons additionally exports `AlertCircle` and `Info` through its existing package; no direct icon-vendor import enters shell. The root lock registers shell. Package index, plan mappings/status and delivery index are updated. No existing application, canonical catalog, generated example, schema or stored data changes.

| Area | Delivered surface |
| --- | --- |
| `./workspace` | Complete copied document manager/keys/policy, dirty guards, transient drafts, split/detach state, restoration/security metadata and React providers/hooks |
| `./navigation` | Generic module/menu/page/navigation types; page definitions reuse page-engines |
| `./products` | Explicit-catalog product definition/filtering, landing/membership/target helpers and fail-closed action grants |
| `./shortcuts` | Original generic registry, display/matching/capability helpers and search event |
| `./documentation`, `./tours` | Types only; host-authored guides/releases/tours remain outside library |
| `./layers` | ToastViewport only; remaining layers deferred |
| Root | Area exports plus ShellProvider/useShell, thin useERP adapter, ShellAppearance, ShellScreenHost/ShellDocumentProvider, SessionLock, SentinelBridge/Boundary and ErrorMonitor |

The host supplies navigation, product/access, branches, roles, brand, optional documentation/tours/time-zone/quick-page configuration, session and accepted preference/catalog state. The existing platform SessionProvider, preferences PreferenceHost and i18n LocalizationProvider remain authoritative. There is no second preference store or localization context. ShellAppearance applies effective theme, font, independent scales, density, radius, direction and reduced motion. UI layers/styles that have not been ported are not exported as placeholders.

ScreenHost notification adds a toast; capability checks call `canProductAction` with the host's access and session role, denying missing/unknown/inherited grants and expired/anonymous sessions. Scope uses the owner document's module/branch or current shell scope. Each document bridge binds identity, focus, transient state, dirty updates and explicit close subscription to its owner. Warm/suspended state is separate from closure. Actual page-engine form and patterns lifecycle screens are integration-tested inside these providers. No durable draft storage or server authorization is implied.

## Decisions and compatibility

This run stops after priority 3 as a complete tested foundation. The original chrome, workspace navigation and layer composition still rely on global registries/application loaders; porting only pieces of that UI would leave unverified behavior. Their implementation and source tests move together to phase 5 completion before phase 5b. AI remains a separate phase 5b run above the completed shell.

The [README differences section](../../../packages/shell/README.md#differences-from-erp-shell--workspace-core) lists all API differences. Principal decisions:

- Copy only; dependencies stay within existing layer rules. No shim or import back into protected sources.
- Host catalog required; no product/module/branch/role/time-zone/guide/tour data, utility-page injection, product alias or default product. Exact `enabledPages` selection replaces implicit utility/dashboard preservation. Shared utility pages without an explicit module retain the last module in memory.
- Optional workspace request/security fields become `subjectId`, `interactionId`, `contextId`; original domain fixtures and privacy assertions are converted consistently. Algorithms and core behavioral assertions remain unchanged, with strict indexed-access annotations where required by root TypeScript.
- `useERP` is a thin adapter. Preference HTTP loading, serialized writes, resets, catalog races, polling, boot hints and persistence belong to the consuming host. Accepted snapshots drive appearance; managed/unavailable changes stay guarded by PreferenceHost. This intentionally replaces the old optimistic-store tests rather than claiming they were retained.
- Platform session supplies session lock, retaining mounted work during expiry. Monitoring uses platform sanitization/queue plus injected authenticated transport, release ID and optional native acknowledgement. No Tauri import/probe/listener, hardcoded URL or token-store assumption. ErrorMonitor follows effective density/formatting; servers authorize diagnostic reads/writes. A polite live region is added to copied toast markup.
- Brand/quick-page/tour/role/time-zone/documentation context is available for host consumers; built-in consumers of those inputs remain deferred. The shell README includes complete provider wiring, Tailwind sources, tokens/font requirements and downstream CSS-module requirements. No shell CSS module is copied without its deferred frame.

Installation remains `npm install` at the independent root. Final install audited 172 packages and reported three inherited audit findings (one moderate, two critical); this task performs no dependency upgrade or remediation. Existing consumers continue using their original packages. No registry publication, endpoint, stored-data migration or production integration is claimed.

## Test port inventory

**199 shell tests in 14 files**, zero failed/skipped/todo in final CI. All **141 original workspace-core cases in seven files** are retained, plus the original Sentinel boundary case. Context ports **13 original toast/shortcut cases** directly and has **9 replacement/consolidated/additional host cases**. Product helper tests adapt **7 original scenarios** and add **3 cases**. Four new files contribute **25 cases** (ScreenHost 7, monitoring 6, session-lock 2, shortcuts 10). Counts overlap the full suite and are not added again.

The [24-file source inventory](evidence/restructure-phase-5-2026-10-23/test-port-inventory.json) identifies all original shell/core suites, product helper tests and optional page suites. It includes all 38 expanded original context cases with per-case disposition, including five load-failure expansions. [Parsed test counts](evidence/restructure-phase-5-2026-10-23/test-counts.json) come from retained CI stdout; they are not a second Vitest reporter run.

| Original package / file | Port and final cases |
| --- | --- |
| workspace-core `document-key.test.ts` | All 9; fictional subject/interaction types and separator/case assertions retained |
| workspace-core `document-manager.test.ts` | All 47; privacy/title/context assertions retained |
| workspace-core `policy.test.ts` | All 15 |
| workspace-core `split.test.ts` | All 26 |
| workspace-core `detach.test.ts` | All 14; metadata-only window-title assertions retained |
| workspace-core `lifecycle.test.ts` | All 11 |
| workspace-core `use-workspace.test.tsx` | All 19; external-store, focus, draft, dirty and closure behavior |
| erp-shell `sentinel.test.tsx` | All 1; safe reference, no private error text and navigation recovery |
| erp-shell `erp-context.test.tsx` | Partial: 38 original cases inspected; 13 direct ports plus 9 adapted/consolidated/additional cases = 22. HTTP/loading/write races/cache cases move to phase 6 host preference integration |
| erp-config `product.test.ts` | 7 fictional-host scenarios plus 3 new cases = 10. The implicit-dashboard assertion is explicitly replaced with the required exact page allowlist |

Additional coverage includes locks disabling a host control and guarding stale callbacks, controlled snapshot acknowledgement, allowed-value checks, actual listener removal on shortcut disablement, RTL document direction, reduced-motion attributes, absent capability denial, pane ownership/focus, transient state/dirty close guards, form save/lifecycle notification wiring, session expiry, identity reset, diagnostic transport sanitization/rejection/late-result isolation, and toast expiry/style/placement/dismissal. Tests reuse patterns `TestHost`; sessions/network/ports use controlled or in-memory fixtures. No real network or native service is used.

| Not ported source file | Reason and destination |
| --- | --- |
| erp-shell `chrome.test.tsx` | Clock/palette, boot-cache and routing helper UI remains deferred; generic chrome portions → phase 5 completion, boot hints → phase 6 host |
| erp-shell `diagnostic-sidebar.test.tsx` | Generic sidebar assertions must follow the actual sidebar port with fictional fixtures → phase 5 completion |
| erp-shell `product-context.test.tsx` | Sidebar/command composition absent; silent default-product assertion intentionally incompatible with required host configuration → adapted phase 5 completion |
| erp-shell `school-role-header.test.tsx` | Product-specific roles/catalog/header behavior excluded → product repository / phase 6 demo |
| erp-shell `workspace/mdi-frames.test.ts` | MDI UI helper deferred → phase 5 completion |
| erp-shell `workspace/mdi-taskbar.test.tsx` | Taskbar deferred → phase 5 completion |
| erp-shell `workspace/target-document.test.ts` | Catalog-dependent target bridge deferred → phase 5 completion |
| erp-shell `workspace/use-detached-windows.test.tsx` | Platform window adapter deferred → phase 5 completion; native wiring → phase 6 desktop |
| erp-shell `workspace/use-mdi-workspace.test.tsx` | MDI composition deferred → phase 5 completion |
| erp-shell `workspace/use-workspace-navigation.test.tsx` | Product-aware navigation/dirty confirmation UI deferred → phase 5 completion |
| erp-shell `workspace/workspace-canvas.test.tsx` | Canvas/split rendering deferred → phase 5 completion |
| erp-shell `workspace/workspace-tabs.test.tsx` | Tabs deferred → phase 5 completion |
| erp-screens `preferences/preferences.test.tsx` | Optional preferences page/policy controls/admin screens deferred → phase 5b shell follow-up |
| erp-screens `login/recovery.test.tsx` | Optional login page deferred → phase 5b shell/platform follow-up |

Not delivered: header, sidebar, footer, EnterpriseShell, workspace page, chrome palette/clock and CSS modules; tab/canvas/MDI/window/navigation UI; command palette; documentation article/center/drawer/launcher/notices/cache; non-AI help/tour UI. All belong to phase 5 completion before 5b. Physical sidebar RTL/hover/click/pin/focus tests have **not** run and are not substituted by the root-direction test. Preferences/login and AI remain phase 5b as above. Product catalogs/content and native wiring remain phase 6/product-owned. Phase 4a priority 3 patterns remain an independent deferred follow-up.

## Verification and retained evidence

Executed locally by Codex; no independent reviewer or hosted CI run. [Environment](evidence/restructure-phase-5-2026-10-23/environment.json): Node 22.22.1, npm 9.2.0 (root declares 11.13.0), Turbo 2.11.10, TypeScript 5.9.3, Vitest 3.2.7, React/React DOM 19.3.1, jsdom 25.0.1, Testing Library React 16.3.3. Commands below run from repository root; redirection retains output only.

| Exact command | Result and scope | Evidence |
| --- | --- | --- |
| `npm install --cache /tmp/pepbits-npm-cache` | Exit 0; final up to date, 172 audited, 3 audit findings. Initial successful install added the shell workspace; its stdout was not retained | [install](evidence/restructure-phase-5-2026-10-23/install.log) |
| `npm test -w @pepbits/shell -- --reporter=dot` (first retained attempt) | Exit 1; 187/191. Private test messages read the catalog envelope incorrectly; lifecycle success query matched both status and toast; shared-page module fallback exposed a real bug | [initial](evidence/restructure-phase-5-2026-10-23/shell-tests-initial.log) |
| Same command (second retained attempt) | Exit 1; 197/199 after adding monitoring/session cases. Two test queries still needed the toast viewport scope and required-label matching | [second](evidence/restructure-phase-5-2026-10-23/shell-tests-second.log) |
| Same command (incremental passing attempt) | Exit 0; 199/14. Later consistent fixture/privacy-assertion neutralization, generic context field naming, identity keys and inherited-action denial were covered by final CI below | [incremental](evidence/restructure-phase-5-2026-10-23/shell-tests-incremental.log) |
| `npm run ci` | Exit 0: **11 packages / 0 demos**, **19/19 tooling**, **11/11 typechecks** (5 cached), **1,107/1,107 tests / 100 files**, **11/11 test tasks** (5 cached), **0 build tasks** | [CI](evidence/restructure-phase-5-2026-10-23/ci.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` | Exit 0; **177 documentation files** | [documentation](evidence/restructure-phase-5-2026-10-23/docs-jiti.log) |
| `desktop-clients/node_modules/.bin/jiti docs/releases/unreleased/evidence/restructure-phase-5-2026-10-23/check-package-guides.mjs` | Exit 0; **3 package/index guides** | [guide links](evidence/restructure-phase-5-2026-10-23/package-guide-links.log) |
| `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --jsx react-jsx --module ESNext --moduleResolution bundler --target ES2022 --allowImportingTsExtensions --esModuleInterop /tmp/pepbits-shell-example/host.tsx` | Exit 0; README host example extracted verbatim to a temporary directory with root node_modules linked. Typecheck only, no runtime/service calls | [example typecheck](evidence/restructure-phase-5-2026-10-23/host-example-typecheck.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-5-2026-10-23/write-manifest.mjs` | 373 files and aggregate digest | [manifest receipt](evidence/restructure-phase-5-2026-10-23/manifest.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-5-2026-10-23/verify-port.mjs` | Exit 0; source hashes, retained counts, protected paths and exact scan | [source isolation](evidence/restructure-phase-5-2026-10-23/source-isolation.log) |
| `git diff --stat -- desktop-clients dummy-api Jenkinsfile deploy run.sh run_all.sh .github` | Exit 0; **0 output bytes** | [source isolation](evidence/restructure-phase-5-2026-10-23/source-isolation.log) |
| `git status --short desktop-clients` | Exit 0; **0 output bytes**, no untracked AGENTS.md | [source isolation](evidence/restructure-phase-5-2026-10-23/source-isolation.log) |
| `git diff --check` | Exit 0; no whitespace errors | [source isolation](evidence/restructure-phase-5-2026-10-23/source-isolation.log) |

Nonoverlapping package totals: tokens **3/1 file**, icons **19/1**, i18n **64/6**, preferences **33/3**, ui **120/12**, components **190/15**, data **35/6**, platform **66/5**, patterns **118/17**, page-engines **260/20**, shell **199/14** = **1,107/100**. The prior committed baseline has 908 tests, including the post-4b Pagination review test. Tooling's 19 tests are separate. The twelfth workspace is configuration-only.

Earlier incremental typechecks corrected strict indexed-access annotations, class overrides and the font fallback annotation; those temporary diagnostics were not all retained. The first 142-test core/Sentinel run passed but initially emitted React act-environment notices; the package test setup now explicitly enables that environment. No final CI stderr warnings or skipped tests were reported. No implementation changed after final CI.

Required source scan executed exactly:

```sh
grep -rniE "@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|lucide-react|@tauri-apps|localhost|AED|nexora|ledger|patient|clinic|school|invoice|dubai|sharjah|kochi" packages/shell/src
```

**Zero matching lines**, grep exit 1 (no matches). The [raw scan](evidence/restructure-phase-5-2026-10-23/required-scan.log) is empty; the [scan receipt](evidence/restructure-phase-5-2026-10-23/required-scan-justifications.json) lists zero matches, so no exceptions require justification. The boundary check also passes. [Evidence checksums](evidence/restructure-phase-5-2026-10-23/checksums.sha256) cover retained artifacts; fixtures are fictional and no credentials are retained.

Not run: deferred suites; original-workspace install/typecheck/tests/Turbo; API/backend, registry/deployment or `verify:*` gates; browser journeys, compiled host CSS or desktop/web application builds; native executables/windows/devices, live services/identity providers; screen-reader/axe/native-speaker review; hosted GitHub Actions/Jenkins. Plain Node documentation execution was not repeated because the existing TypeScript imports use the requested jiti runner. No catalog/example regeneration, dependency remediation, production backend, AI, full shell UI, consumer migration, publication, commit, push or deployment. A successful zero-task root build is not an application/native build.

## Upgrade and rollback

New consumers opt into public source imports and explicit provider/service configuration. Existing applications remain unchanged. Hosts recreate workspace identity, validate resume permission, supply actual adapters and render the deferred chrome/confirmation/layer UI themselves until phase 5 completion. Session-only state is not durable recovery. Rollback removes the independent shell package, lock registration and additive icon exports; no protected consumer or stored-data rollback is required.


## Part 2

Status: **priorities 4–6 complete; phase 5 priorities 1–6 locally verified**, 23 October 2026. Base: committed part 1 `6c73e50e85280a86d359ab5473a0b346dfe0ed64` on `main`, initially clean. All changes remain uncommitted and unpublished. Preferences/login and AI remain separate phase 5b work; no placeholder pages are exported. Package version remains `0.0.0`.

Source identity: **86fa410baa7e6fd58138a82e070f011c4476d12b2834f048e3419e40bea59aaa**, **416 files**, with the same sorted-path/NUL/file-hash/LF algorithm as part 1. The current [source manifest](manifest-restructure-phase-5-2026-10-23.json) identifies this base plus working-tree hashes. The [manifest receipt](evidence/restructure-phase-5-2026-10-23/part-2/manifest.log) records the exact file count/digest; [source isolation](evidence/restructure-phase-5-2026-10-23/part-2/source-isolation.log) verifies every file and the aggregate. Only README/plan/index/release/evidence wording was finalized after implementation checks; documentation validation covers the final text. [Preserved part 1 hashes](evidence/restructure-phase-5-2026-10-23/part-2/preserved-part-1.json) separately verify every historical evidence artifact against the starting commit. Part 1 results are not relabeled as current.

### Added and changed

Added **43 shell files** (including 15 test files), extended the existing exports/test messages/provider module type, and added 23 icon exports. Existing workspace-core implementations and all part 1 test cases remain.

| Area | Completed public API and behavior |
| --- | --- |
| Chrome/root | Header, HeaderClock/useClock, Sidebar, Footer, EnterpriseShell, WorkspacePage and chromePalette. Host branch zones, quick pages, brand/role labels, profile preferences/logout and optional inbox/status props; two byte-identical CSS modules/declarations. Actual sidebar controls consume PreferenceHost locks/allowed values. |
| Workspace | All eight original UI modules plus tests: target-document, workspace-navigation, tabs, canvas/split, MDI geometry/hook/taskbar and detached-window reconciliation. Additive WorkspaceShell wires them to the full frame, unsaved-change confirmation and platform windows. Canvas wraps every screen in the existing ShellDocumentProvider. |
| Layers | ShellLayers, command palette, documentation drawer and non-AI HelpAssistant. Frame mounts layers once; helper uses host page/kind tours or service steps, filters absent anchors and honors reduced motion. |
| Documentation | Existing types plus article, center, launcher, notices and request cache through `./documentation`. Explicit host transport/release/center/notice targets; search/paging, release/patch views, acknowledgment/dismissal/read actions, loading/retry/offline states. |
| Shared support | 23 additional primitive icon exports; existing providers, shared UI, patterns TestHost and part 1 workspace/test helpers reused. No new runtime dependency, package, preference store or localization provider. |

Host contract and integration: [shell README](../../../packages/shell/README.md) contains the complete SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider example, workspace policy and window wiring, user flows, API differences and styling sources. Workspace navigation receives an explicit role-filtered product before ShellProvider; target-document conversion receives page metadata. Effective `openRecordsInTabs` is resolved into host workspace policy; effective `floatingWindows` drives the provided composition without recreating the store. Hosts retain authenticated routing, resume validation, data adapters and all product content. Server authorization remains independent of UI controls.

ScreenHost contracts are unchanged. Per-document identity/focus, scope, transient draft/dirty state and close subscriptions now run in actual warm/split/MDI canvas trees. Full-frame tests render a real DynamicRecordForm and LifecycleConfigurationPage and exercise edits, save, close guards and toast delivery. No durable recovery or live backend is implied.

Compatibility decisions: hardcoded inbox fixtures/profile/settings/support destinations are omitted in favor of host slots and destinations; no implicit product, branch or documentation release is introduced. MDI storage and documentation/tour event names use generic namespaces. Documentation's persistent sessionStorage fallback becomes a bounded per-hook session-memory cache, isolated by tenant/user/role/branch/product and transport; aborts, HTTP denial and writes cannot use offline fallback. A reading-state write uses its change's release/revision. Platform windows replace native imports; the host must supply child-window bootstrapping and state/data synchronization in phase 6. Clock/palette/sidebar markup and CSS classes are preserved. Click-mode search now reliably expands with focus expansion disabled; helper closing restores trigger focus. See the README's complete differences list.

### Test port inventory

**384 shell tests in 29 files**, zero failed/skipped/todo in the final run: the prior 199 plus **185 part 2 cases**. The [new inventory](evidence/restructure-phase-5-2026-10-23/part-2/test-port-inventory.json) covers every original file and preserves context-case dispositions by reference. [Parsed CI totals](evidence/restructure-phase-5-2026-10-23/part-2/test-counts.json) and [verbose shell cases](evidence/restructure-phase-5-2026-10-23/part-2/shell-tests-incremental.log) distinguish totals from overlapping coverage.

| Original erp-shell file | Part 2 disposition / final cases |
| --- | --- |
| `chrome.test.tsx` | 14 palette/clock cases retained. Six routing/default assertions replaced by part 1 explicit-catalog helpers/host tests; three pre-provider skeleton-hint cases remain phase 6 host-owned. |
| `diagnostic-sidebar.test.tsx` | All 25 expanded cases with four fictional generic modules, real ShellProvider/PreferenceHost and web hrefs; no assertion removed. |
| `product-context.test.tsx` | 3 adapted cases: host branding, unavailable module filtering, required host configuration replacing the incompatible silent default product. |
| `workspace/mdi-frames.test.ts` | All 20 |
| `workspace/mdi-taskbar.test.tsx` | All 7 |
| `workspace/target-document.test.ts` | All 10; product-role fixture replaced by generic host view identity with all round-trip assertions |
| `workspace/use-detached-windows.test.tsx` | All 13; fake platform port, sanitized OS titles, failures, late completion and Strict Mode ordering |
| `workspace/use-mdi-workspace.test.tsx` | All 7 |
| `workspace/use-workspace-navigation.test.tsx` | All 18; explicit product input and generic module/view transition fixture |
| `workspace/workspace-canvas.test.tsx` | All 29; shared host wrapper and document ScreenHost bridge |
| `workspace/workspace-tabs.test.tsx` | All 15 |

All **119 original workspace UI cases** are retained, including the two structurally generic view-identity scenarios formerly using a product catalog. New files add **24 cases**: chrome integration 11, documentation 8, full-frame page-engine/patterns integration 2 and WorkspaceShell composition 3. Real pin controls disable on policy updates and excluded values; shortcut disabling removes the full-frame dispatcher; both physical sidebar placements respect Arabic/English direction; reduced-motion tours scroll without animation. Documentation tests cover retry, denied/aborted/offline requests, identity isolation, host targets, disabled services and reading-state failures. Ports and network are mocked; no live service is contacted.

Not ported: `school-role-header.test.tsx` remains product-specific (phase 6 product demo/repository); preferences and login suites remain phase 5b. Original preference HTTP/load/write/language races and boot caches remain phase 6 host integration, as detailed in part 1. Nothing in priorities 4–6 remains deferred. Native runtime wiring and browser/assistive-technology acceptance are separate from delivery of the generic source UI.

### Verification and retained evidence

Executed locally by Codex, not hosted CI or independent review. [Environment](evidence/restructure-phase-5-2026-10-23/part-2/environment.json) records versions. Commands below run from repository root; stdout/stderr redirection only retains output. The root build still executes zero build tasks.

| Exact command | Result and scope | Evidence |
| --- | --- | --- |
| `npm install --cache /tmp/pepbits-npm-cache` | Exit 0; up to date, 172 audited; inherited one moderate/two critical findings, no dependency remediation | [install](evidence/restructure-phase-5-2026-10-23/part-2/install.log) |
| `npm test -w @pepbits/shell -- --reporter=dot` (initial) | Exit 0; 332 tests / 23 files before added composition/host cases | [initial](evidence/restructure-phase-5-2026-10-23/part-2/shell-tests-initial.log) |
| Same command (second) | Exit 1; 358/373. Ported link tests initially used the desktop `#` port, and three new queries assumed visible text rather than accessible names | [second](evidence/restructure-phase-5-2026-10-23/part-2/shell-tests-second.log) |
| Same command (third) | Exit 1; 383/384. Drawer placement assertion targeted overlay instead of its inner panel | [third](evidence/restructure-phase-5-2026-10-23/part-2/shell-tests-third.log) |
| `npm run typecheck -w @pepbits/shell` | Exit 0 | [shell typecheck](evidence/restructure-phase-5-2026-10-23/part-2/shell-typecheck.log) |
| `npm test -w @pepbits/shell -- --reporter=verbose` | Exit 0; **384/384 in 29 files** | [incremental](evidence/restructure-phase-5-2026-10-23/part-2/shell-tests-incremental.log) |
| `npm run ci` (first attempt) | Exit 1; existing page-engine template preference test exceeded its 15-second limit under parallel load, 259/260 engine cases passed; Turbo reported 9/11 successful test tasks and stopped before all tasks completed. No assertions/timeouts changed | [initial CI](evidence/restructure-phase-5-2026-10-23/part-2/ci-initial.log) |
| `npm run ci` (retry) | Exit 0; boundaries **11 packages / 0 demos**, **19 tooling**, **11 typechecks (11 cached)**, **1,292 tests / 115 files**, **11 test tasks (9 cached)**, **0 build tasks** | [CI](evidence/restructure-phase-5-2026-10-23/part-2/ci.log) |
| `node docs/tools/check-docs.mjs` | Exit 1; existing `.ts` import rejected by plain Node, no content error established | [plain Node](evidence/restructure-phase-5-2026-10-23/part-2/docs-node.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` | Exit 0; **177 documentation files** | [documentation](evidence/restructure-phase-5-2026-10-23/part-2/docs-jiti.log) |
| `desktop-clients/node_modules/.bin/jiti docs/releases/unreleased/evidence/restructure-phase-5-2026-10-23/check-package-guides.mjs` | Exit 0; **3 package/index guides** | [guide links](evidence/restructure-phase-5-2026-10-23/part-2/package-guide-links.log) |
| `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --jsx react-jsx --module ESNext --moduleResolution bundler --target ES2022 --allowImportingTsExtensions --esModuleInterop /tmp/pepbits-shell-part2-example/host.tsx` | Exit 0; exact README example, root node_modules linked; typecheck only | [example](evidence/restructure-phase-5-2026-10-23/part-2/host-example-typecheck.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-5-2026-10-23/write-manifest.mjs` | Regenerates current source identity using the record's unchanged writer | [manifest](evidence/restructure-phase-5-2026-10-23/part-2/manifest.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-5-2026-10-23/part-2/verify-part-2.mjs` | Updates manifest part/limits metadata, verifies hashes/counts, old evidence, CSS identity, exact scan and protected paths | [source isolation](evidence/restructure-phase-5-2026-10-23/part-2/source-isolation.log) |
| `git diff --stat -- desktop-clients dummy-api Jenkinsfile deploy run.sh run_all.sh .github` and `git status --short desktop-clients` | Exit 0; **zero output bytes** | [source isolation](evidence/restructure-phase-5-2026-10-23/part-2/source-isolation.log) |
| `git diff --check` | Exit 0 | [source isolation](evidence/restructure-phase-5-2026-10-23/part-2/source-isolation.log) |

Nonoverlapping package totals: tokens 3/1 file, icons 19/1, i18n 64/6, preferences 33/3, ui 120/12, components 190/15, data 35/6, platform 66/5, patterns 118/17, page-engines 260/20, shell 384/29 = **1,292/115**. Tooling's 19 cases are separate. Earlier strict-type diagnostics while adapting imports, fixtures and indexed access were corrected before these passing checks; temporary diagnostics are not all retained.

The exact required source grep from part 1 is rerun by the verifier: **zero matching lines**, exit 1 for no matches. [Raw output](evidence/restructure-phase-5-2026-10-23/part-2/required-scan.log) and [receipt](evidence/restructure-phase-5-2026-10-23/part-2/required-scan-justifications.json) contain no exceptions. [Part 2 checksums](evidence/restructure-phase-5-2026-10-23/part-2/checksums.sha256) cover retained artifacts. No credentials are retained.

Not run: original-workspace install/typecheck/tests/Turbo; backend/API or `verify:*` gates; browser journeys, compiled application CSS/builds, physical layout/hit testing, native executables/child windows/devices, live identity/providers, screen-reader/axe/native-speaker review or hosted CI. No canonical catalog/generated example regeneration, preferences/login/AI implementation, dependency remediation, consumer migration, publication, commit, push or deployment. Local jsdom and an empty source build do not establish native or deployed acceptance.

Upgrade/rollback: hosts opt into the public frame or WorkspaceShell composition and explicit metadata/ports. Existing consumers remain unchanged. No stored-data migration is needed; removing part 2 restores the part 1 source API. New generic geometry/event names have no automatic legacy migration. Part 1 evidence and its original completion boundary remain historical.
