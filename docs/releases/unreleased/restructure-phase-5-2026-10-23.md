# Library restructure phase 5 foundation — 23 October 2026

Status: **priorities 1–3 implemented and locally verified; phase 5 remains incomplete**. Chrome, workspace UI and remaining layers are deferred under the owner's smaller-complete-increment allowance. Base: `aba0e4e43052454ecd545867a50016f4097d01f3` on `main`, initially clean. Unreleased working tree; no commit, tag, push, publication or deployment. New package version `0.0.0` is a source-workspace version. [Plan status](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-5-status); [testing guide 1.0.0](../../testing/v1.0.0/PRE-COMMIT.md); [host/user integration guide](../../../packages/shell/README.md).

Source identity: **4c129c90713dc992ca64fd5236543839fadde06f489c2177ddae42a5a961778c**, SHA-256 over sorted `path + NUL + file SHA-256 + LF` entries in the [373-file source manifest](manifest-restructure-phase-5-2026-10-23.json). Scope includes root configuration, all packages/tooling, the restructure plan and delivery index. This record, manifest and evidence are excluded to avoid self-reference. Final CI covers implementation bytes; only guide/plan/index wording and release evidence were finalized afterward. Documentation checks cover final text.

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
