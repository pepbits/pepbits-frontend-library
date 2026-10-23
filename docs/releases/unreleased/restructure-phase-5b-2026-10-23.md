# Library restructure phase 5b — 23 October 2026

Status: **AI, preferences/login and the Arabic physical-sidebar regression implemented and locally verified; unpublished working tree**. Base: `a5f49fba4f1089b1086d0dfd8643ffcbb67a2cbd` on `main`, initially clean. Package versions remain `0.0.0`. No commit, tag, push, publication or deployment. Executor: Codex; no independent reviewer or hosted CI run. [Plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-5b-status), [feature/user guide LIB-5B](../../features/library-ai.md), [testing guide 1.0.0](../../testing/v1.0.0/PRE-COMMIT.md).

Source identity: **d42c6946d2215ddc75ff3cef94e341f680ce26835e520dfa9d7f01866c0d9a60**, **496 files**, SHA-256 over sorted `path + NUL + file SHA-256 + LF` entries in the [manifest](manifest-restructure-phase-5b-2026-10-23.json). It covers root configuration, all packages/tooling, plan, delivery index and feature guide/index. This record, manifest and evidence are excluded to avoid self-reference. The [writer](evidence/restructure-phase-5b-2026-10-23/write-manifest.mjs) and [receipt](evidence/restructure-phase-5b-2026-10-23/manifest.log) reproduce that identity. CI covers final implementation; only guide/record/evidence finalization followed. Final documentation checks cover that text. Phase 5's record, manifest and evidence remain unchanged.

## Changes, APIs and host integration

Added **58 files in `packages/ai`** and **20 in `packages/shell`**, including source exports, tests, private fixtures, a local browser host and package documentation/configuration. Shell adds optional pages and extension composition; preferences exposes existing policy/availability metadata; icons adds 17 named exports. The lockfile adds the AI workspace and browser-test dependencies. Plan, package index, feature guide/index and release index are updated. All original applications/backend/deployment sources remain untouched.

| Public subpath | Delivered contract |
| --- | --- |
| `@pepbits/ai/config` | Ordered gate resolver, page-policy narrowing, context/admin types, host-defined validated `createAiCatalogue` |
| `@pepbits/ai/client` | `createAiClient` / `createAiClientWithRequest`, admin/policy/transport factories, assembly/redaction/guard functions, source provider/hooks |
| `@pepbits/ai/ui` | `AiProvider`, `AiShellExtension`, assistant panel, inline action, terminal, transparency, administration and shared `useAssistant` |
| `@pepbits/ai` | Root barrel for all three subpaths |
| `@pepbits/shell/preferences-page` | `PreferencesPage`, `PreferencePageServices`; existing PreferenceHost's effective state, locks, allowed values and one update path |
| `@pepbits/shell/login` | `LoginScreen`, `SessionSplash`, `ShellSkeleton`; host branding and platform session login |
| Shell root | Additive page exports and generic `ShellExtensionsProvider`, `useShellExtensions`, `ShellExtensions` |

The host mounts platform SessionProvider, PreferenceHost and LocalizationProvider, then wraps ShellProvider with AiShellExtension. It supplies the client, classifier, use-case catalogue, page/build gates and optional management/user capabilities. The adapter fills each root/document ScreenHost's `renderInlineAction` and `publishSources` slots and ShellLayers' help-assistant slot. Publication ownership follows documents; removing a screen retracts its fields. An actual DynamicRecordForm test proves edited displayed values reach context assembly. Shell without AI retains its existing behavior. AI is above shell; **LAYERS is unchanged**, and shell has no AI import. Client source ownership legitimately depends on shell while pure config does not.

Installation uses the independent root workspace, not a published registry distribution. Complete wiring and API differences are in the [AI guide](../../../packages/ai/README.md) and [shell guide](../../../packages/shell/README.md#phase-5b-preferences-and-login). The AI README example is extracted verbatim and typechecked. Hosts supply canonical messages and Tailwind/token styling. No canonical localization source changed, so no fallback or generated-example regeneration was required. No schema, stored-record or backend migration is applicable: all new integration is opt-in and existing consumers remain unchanged.

## Behavior, policy and compatibility decisions

- Copy only. Global product use cases, pages, classifications and grants become host metadata. No product/branch fixtures, built-in endpoint, provider setting or real credential ships in runtime code. Synthetic tests use fictional catalogues and `.invalid` transport hosts. The `clinical` wire category, acknowledgment, classification and sensitive-name masks remain because they enforce the original security contract.
- AI gate order/deny-wins behavior, modes, named-field assembly, masking, egress guard, credential routes and refusal/echo behavior remain. Shared factories replace module-global transports/cache; required classification is bound once per client. Catalogue construction additionally rejects duplicate IDs. Policy invalidation fences late responses; source state resets across tenant/user/role/branch identities.
- `canManageAi` replaces a fixed role name and defaults false; active, unexpired session checks also guard writes. `userEnabled` replaces the original constant true hook input. Administration numbers/dates use existing effective formatters. Existing markup/classes/ARIA/keyboard paths remain; host data/service ownership and these documented guards are deliberate API differences.
- Preferences uses existing effective values and guarded updates for ordinary changes, import, section reset and full reset (PREF-02/03). Live locks/availability apply to retained handlers. Boolean allowed values support inverse animation/reduced-motion controls. Policy value edits retain allowed-value constraints. Currency remains hidden by default with explicit host opt-in. No preference store/persistence queue is copied.
- Tenant policy administration requires host capability **and** request transport **and** active session, failing closed. Capability removal hides administration. The scoped service retains session fencing, recovery and localized errors. A revision conflict disables save until reload; failures retain edits. Export includes editable overrides only. Product fallback labels are removed; downloads/events use the generic namespace.
- Login requires host brand and defaults to platform session login, with optional submission override. Product marketing, demo accounts and password autofill are omitted. Failure preserves inputs and permits retry; busy submissions are deduplicated. Routing, skeleton boot-cache integration and successful-login unmount remain host responsibilities.
- **UI gates/locks are not authorization (PREF-08).** Server authority, provider allowlists, encrypted credential custody/rotation/expiry, durable audit, context/request/token/per-user limits, server redaction and restricted-provider policy remain server responsibilities. No client test certifies them. HTTP refusals including 429 remain refusals. Policy fetch failure and 409/unreachable echo behavior preserve the original semantics. Historical echo copy saying nothing left the browser is not evidence of zero egress: a configured application-server request was attempted.

## Gate-script mapping and explicit exclusions

All eight requested script names map to Vitest files under `packages/ai/src/gates`, run by root CI. **199 cases total**: **186 original checks retained/adapted** and **13 additional bounded client checks**. Counts are test cases, including expansions; they are already included in the AI total below.

| Original `desktop-clients/scripts/` script | New test file | Final cases | Coverage and difference |
| --- | --- | ---: | --- |
| `verify-ai-gates.mjs` | `verify-ai-gates.test.mjs` | 20 | All 20 ordered resolver/narrowing checks; new config modules |
| `verify-ai-modes.mjs` | `verify-ai-modes.test.tsx` | 26 | All 14 shared-engine behavior/structure checks; one mount + 11 per-use-case reachability checks now render the actual ScreenHost inline slot using a fictional catalogue, replacing product source grep |
| `verify-ai-context.mjs` | `verify-ai-context.test.mjs` | 18 | All 18 context/prompt-ID/allowlist/masking checks with new modules and generic fixtures |
| `verify-ai-egress.mjs` | `verify-ai-egress.test.mjs` | 121 | All 121 expanded classification/category/masking/guard checks; host classifier/catalogue fixtures replace product registries |
| `verify-ai-limits.mjs` | `verify-ai-limits.test.ts` | 5 | New client tests: three 429 dispatch refusals, verification refusal and server effective-limit metadata. **None of the original six server checks is claimed ported** |
| `verify-ai-credential.mjs` | `verify-ai-credential.test.ts` | 3 | New dedicated-write/read/patch client checks with synthetic memory-only bytes. **None of the original eleven server canary checks is claimed ported** |
| `verify-ai-hardening.mjs` | `verify-ai-hardening.test.ts` | 5 | Original D5 client prompt-ID/no-prompt-text check, plus three empty/wildcard field declarations and duplicate-ID validation. **Other 17 original checks not ported** |
| `check-ai-limits-isolated.mjs` | `check-ai-limits-isolated.test.ts` | 1 | New client-instance isolation test only. Original backend child-process launcher not ported/run |

The limits script authenticates to and mutates the backend, checking zero/negative default limits, real admission counts, 429 totals, Retry-After and shared verification budget. The credential script writes/replaces a canary, inspects five server responses, other files and logs, verifies its one stored location/mode and two derived-status properties, and removes it. These require the protected backend/data paths; importing their launcher or replacing their implementation with a mock would not exercise the new library. Their exact six and eleven assertions remain outside this run. No provider secret or bearer value was captured.

Hardening's 17 excluded checks cover two original documentation files, server prompt storage, credential mode/gitignore, server-derived tenant, encrypted store, expiry, durable audit, server redaction/restricted egress, provider allowlist/redirect refusal, explicit origins, per-user limiter, three external-dependency dispositions and the original production-boundary heading. Its mode/no-file branch is one assertion. Those files/server controls are outside the new package; their existence is not replaced by this record. The isolated launcher starts the original API, logs in, writes a credential and invokes those real limits checks; it cannot be imported by new library tests under the source-isolation rule. These exclusions are explicit acceptance gaps for host integration, not skipped Vitest cases. The independent client/UI suites still cover every generic original security algorithm and its refused paths.

## Source-test inventory and Arabic regression

All **13 generic AI source suites / 378 original cases** are retained. Client policy adds two race cases; shell-extension integration adds four; gate files add 199. Thus **378 + 2 + 4 + 199 = 583 cases / 22 files**. The [inventory](evidence/restructure-phase-5b-2026-10-23/test-port-inventory.json) records original file hashes, destination names and final counts.

| Original area | Destination suites and original counts |
| --- | --- |
| ai-config | gates 22; policy 13 |
| ai-client | admin 11; assemble 19; guard 9; policy 9 (11 final); redact 157; sources 10; transport 22 |
| ai-ui | administration 20; modes 34; transparency 28; use-assistant 24 |

Shell adds **21 cases / 9 files** to phase 5's 384/29, totaling **405/38**:

| Source / new suite | Cases | Disposition |
| --- | ---: | --- |
| preferences `preferences.test.tsx` | 4 | Generic controls, central updates, live policy/availability and allowed values ported |
| `preference-preview.test.tsx` | 1 | Generic live density/layout test against existing page-engines preview; implementation already ported |
| `product-services.test.tsx` | 2 | Generic session-fenced request and localized error assertions target the new preference service |
| `product-access.test.tsx` | 2 | Generic action/page grants adapted to actual form disabled save and shell filtered catalogue; application route-denial rendering remains phase 6 |
| login `recovery.test.tsx` | 1 | Original submit/retry/recovery behavior ported |
| New preferences `host.test.tsx` | 4 | Management capability/revocation, reset with live lock, inverse boolean allowed values, guarded import |
| New login `login.test.tsx` | 3 | Host brand/session submission, localized errors and duplicate prevention |
| New `sidebar-rtl.test.tsx` | 2 | Actual Arabic document direction and physical frame classes with focus/Escape/outside behavior, left and right |
| New `sidebar-rtl.browser.test.ts` | 2 | Real Chromium bounding boxes/main-content reservation, focus expansion, Escape and Enter for physical left/right under `dir=rtl`, `lang=ar` |

The sidebar gap from [the original behavior record](sidebar-navigation-2026-10-01.md) and phase 5 part 2 is closed by the two Chromium cases. The fixture renders EnterpriseShell with real shell/token styles and compiled Tailwind at a 1280×800 viewport. It verifies that the selected physical edge and reserved content width do not reverse under Arabic RTL, and that expansion remains attached to that edge. This is local headless Chromium web rendering, **not** a native executable, deployed shell or full Arabic translation review.

## Verification and retained evidence

Commands run from repository root. Environment: Node 22.22.1, npm 9.2.0, Turbo 2.11.10, TypeScript 5.9.3, Vitest 3.2.7, React/DOM 19.3.1, Playwright 1.64.0 Chromium build 1248. [Environment receipt](evidence/restructure-phase-5b-2026-10-23/environment.json) records temporary OS-library hashes. Chromium was already installed; four missing OS libraries were supplied from an existing temporary cache into `/tmp/pepbits-5b-chromium-libs`, without application code or system-directory changes. Fresh machines can install Chromium/OS dependencies through `npx playwright install --with-deps chromium`. CI here uses `export LD_LIBRARY_PATH=/tmp/pepbits-5b-chromium-libs` before the root command.

| Exact command | Result / scope | Evidence |
| --- | --- | --- |
| `npm install --cache /tmp/pepbits-npm-cache` | Exit 0; final 195 audited; inherited audit findings recorded below | [install](evidence/restructure-phase-5b-2026-10-23/install.log) |
| `npm run ci` (with loader environment above) | Exit 0; boundaries **12 packages / 0 demos**, tooling **19/19**, **12/12 typecheck tasks** (10 cached), **1,896/1,896 package tests / 146 files**, **12/12 test tasks** (10 cached), **0 executable build tasks** | [final CI](evidence/restructure-phase-5b-2026-10-23/ci.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` | Exit 0; 179 documentation files | [documentation](evidence/restructure-phase-5b-2026-10-23/docs-jiti.log) |
| `desktop-clients/node_modules/.bin/jiti docs/releases/unreleased/evidence/restructure-phase-5b-2026-10-23/check-package-guides.mjs` | Exit 0; 3 package/index guides | [guide links](evidence/restructure-phase-5b-2026-10-23/package-guide-links.log) |
| `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --jsx react-jsx --module ESNext --moduleResolution bundler --target ES2022 --allowImportingTsExtensions --esModuleInterop /tmp/pepbits-ai-example/host.tsx` | Exit 0; verbatim AI README example, temporary root node_modules symlink; compile only | [example](evidence/restructure-phase-5b-2026-10-23/host-example-typecheck.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-5b-2026-10-23/write-manifest.mjs` | 496 files and aggregate digest | [manifest receipt](evidence/restructure-phase-5b-2026-10-23/manifest.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-5b-2026-10-23/verify-port.mjs` | Exit 0; source hashes, counts, exact scans, historical evidence and isolation | [source isolation](evidence/restructure-phase-5b-2026-10-23/source-isolation.log) |
| `git diff --stat -- desktop-clients dummy-api Jenkinsfile deploy run.sh run_all.sh .github` | Exit 0; **0 output bytes** | [source isolation](evidence/restructure-phase-5b-2026-10-23/source-isolation.log) |
| `git status --short desktop-clients` | Exit 0; **0 output bytes**; no untracked AGENTS.md | [source isolation](evidence/restructure-phase-5b-2026-10-23/source-isolation.log) |
| `git diff --check` | Exit 0; no whitespace errors | [source isolation](evidence/restructure-phase-5b-2026-10-23/source-isolation.log) |

[Parsed nonoverlapping counts](evidence/restructure-phase-5b-2026-10-23/test-counts.json): tokens 3/1 file, icons 19/1, i18n 64/6, preferences 33/3, ui 120/12, components 190/15, data 35/6, platform 66/5, patterns 118/17, page-engines 260/20, shell 405/38, AI 583/22 = **1,896/146**. Tooling's 19 are separate. The thirteenth workspace is configuration-only. No failed/skipped/todo cases in final CI. Source exports have no executable build tasks; this is not an application/native build. Final CI has no React act warnings.

Retained earlier attempts (their cases overlap the final counts):

| Command | Earlier result and correction |
| --- | --- |
| `npm test -w @pepbits/ai` | [Initial](evidence/restructure-phase-5b-2026-10-23/ai-initial.log): 358/378, 20 administration failures from missing explicit host/session grant in the test wrapper. [Second](evidence/restructure-phase-5b-2026-10-23/ai-second.log): 536/537 executed, two suites failed; renamed classification fixture and Node source URL setup corrected. [Third](evidence/restructure-phase-5b-2026-10-23/ai-third.log): 559/560 executed, three suites failed; node environment setup and renamed provider expectation corrected. [Fourth](evidence/restructure-phase-5b-2026-10-23/ai-fourth.log): 583/22 passed. Subsequent act wrapper and session/formatting refinements covered by root CI. |
| `npm test -w @pepbits/shell` | [Initial](evidence/restructure-phase-5b-2026-10-23/shell-initial.log): 388/389, one preferences query timeout; scoped label query replaced an expensive full role traversal. |
| `npm test -w @pepbits/shell -- src/preferences-page src/login src/sidebar-rtl.test.tsx` | [First focused](evidence/restructure-phase-5b-2026-10-23/shell-focused.log): 10/5; [second](evidence/restructure-phase-5b-2026-10-23/shell-focused2.log) and [third](evidence/restructure-phase-5b-2026-10-23/shell-focused3.log): 17/8 each. Later two host cases and two browser cases covered by final CI. |
| `npm test -w @pepbits/shell -- src/sidebar-rtl.browser.test.ts` | [Initial](evidence/restructure-phase-5b-2026-10-23/browser-initial.log): suite initialization failed on jsdom/esbuild cross-realm typed arrays; test now runs in Node. [Second](evidence/restructure-phase-5b-2026-10-23/browser-second.log): missing OS library, two cases did not run. [Third](evidence/restructure-phase-5b-2026-10-23/browser-third.log), with loader environment: 2/1 passed. |
| `npm run ci` | [Initial](evidence/restructure-phase-5b-2026-10-23/ci-initial.log): boundary check caught undeclared token CSS dependency in browser fixture; declared it. [Second](evidence/restructure-phase-5b-2026-10-23/ci-second.log): unchanged page-engines template preference test timed out at 15 seconds under parallel load. [Third](evidence/restructure-phase-5b-2026-10-23/ci-third.log): 1,896/146 passed with unchanged test/timeouts. Final CI reran after the browser-test PostCSS update. |

Incremental typechecks and the initial successful workspace install preceded retained logs; not every temporary diagnostic was retained. The earlier browser dependency installation [output](evidence/restructure-phase-5b-2026-10-23/browser-install.log) is retained; its complete command arguments were not captured. Final manifests/lock identify the installed versions. Root [pre-update install](evidence/restructure-phase-5b-2026-10-23/install-before-postcss.log) and [audit](evidence/restructure-phase-5b-2026-10-23/audit-before-postcss.json) reported four findings, including a new PostCSS high severity issue. `npm install --workspace @pepbits/shell --save-dev postcss@8.5.31 --cache /tmp/pepbits-npm-cache` removed that finding ([output](evidence/restructure-phase-5b-2026-10-23/install-postcss.log)); final root `npm audit --cache /tmp/pepbits-npm-cache --json` ([receipt](evidence/restructure-phase-5b-2026-10-23/audit.json), exit 1) retains the existing one moderate/two critical Vitest dependency findings. The first audit without writable-cache selection failed EROFS; no audit result was inferred from it. No major Vitest upgrade is included.

Required source scan executed with the exact expression/paths (also stored as argv in the receipt):

```sh
grep -rniE "@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|lucide-react|@tauri-apps|localhost|api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]|sk-[A-Za-z0-9]{10}|Bearer [A-Za-z0-9]{10}|nexora|ledger|patient|clinic|school" packages/ai/src packages/shell/src
```

**88 matching lines**, grep exit 0. [Every exact match and individual justification](evidence/restructure-phase-5b-2026-10-23/required-scan-justifications.json); [raw output](evidence/restructure-phase-5b-2026-10-23/required-scan.log). All are retained clinical security categories/classifications/acknowledgment copy or fictional fixtures, the unchanged sensitive-name `patient` mask, or the existing `template.clinical.inline` localization key. No forbidden import, product name/registry, hardcoded transport/credential or real sensitive fixture remains. Removing the redaction/category terms would weaken security or break canonical localization.

`grep -rniE "sk-[A-Za-z0-9]{10}|Bearer [A-Za-z0-9]{10}|api[_-]?key\s*[:=]" docs/releases/unreleased/evidence/restructure-phase-5b-*` returns **no matches**, exit 1; [empty output](evidence/restructure-phase-5b-2026-10-23/credential-scan.log). No credential values are logged/persisted. [Evidence checksums](evidence/restructure-phase-5b-2026-10-23/checksums.sha256) cover all retained artifacts except the checksum file itself.

## Deferrals, rollback and publication boundary

Not run: original-workspace install/typecheck/test/Turbo or original verification scripts; protected backend/API/server-only checks listed above; live providers/identity services; production authorization/security acceptance; native binaries/windows/devices; full browser journeys beyond the two sidebar regressions; screen-reader/axe/native-speaker review; hosted Actions/Jenkins; registry/artifact publication or deployment. Plain Node documentation execution was not repeated because existing TypeScript imports use the requested jiti runner. No prompt/product catalogue migration, canonical-catalog regeneration or consumer migration was performed.

Phase 6 owns demonstration apps (showcase first), product content/catalogues, mock API migration, host preference HTTP/race/cache acceptance, boot/routing and native window/bootstrap wiring. Phase 4a priority 3 patterns remain separate. Managed vault/restricted-provider contracts and production identity/authorization remain host obligations. These are not established by the library's green tests.

Upgrade is opt-in through explicit providers/subpaths. Rollback removes AI/extension/page usage and the additive workspace exports/dependencies; original applications and stored data require no rollback or migration. Existing phase 5 evidence is preserved. Nothing was committed, pushed, published or deployed.
