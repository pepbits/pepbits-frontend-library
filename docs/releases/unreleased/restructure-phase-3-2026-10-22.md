# Library restructure phase 3 — 22 October 2026

Status: implemented, locally verified, unreleased working tree. Date: 2026-10-22. Base: `e18c01d5800e75859c4fa097e6ad02b521f2b1bd` on `main` (initial working tree clean). No commit, tag, push, registry publication or deployment. New package versions are `0.0.0` (source workspace versions). [Restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-3-status); [testing guide 1.0.0](../../testing/v1.0.0/PRE-COMMIT.md).

Source identity: **2be60c7351984020e500f224d6c2189b86adfaf8d353be2796ac814a3495963f**, SHA-256 over the sorted `path + NUL + file SHA-256 + LF` entries in the [186-file source manifest](manifest-restructure-phase-3-2026-10-22.json). Scope includes root workspace configuration, all packages/tooling, the plan and delivery index; receipt/evidence files are excluded to avoid self-reference. Final checks match these bytes. Only this record, manifest and evidence were finalized after final CI.

## Changes and user impact

Added two independent packages with manifests, source barrels, shared TypeScript settings, Vitest configuration, integration guides and ported tests. Platform uses per-package jsdom/Testing Library setup; data uses Node unit tests. Existing consumers remain on their original workspace.

| Package and guide | Public API |
| --- | --- |
| [data](../../../packages/data/README.md) | Record/draft snapshots, record HTTP transport and editor; additive volatile memory transport; draft policy/filter/merge/retention contracts, shared drafts and draft center; CSV/import transport, approvals, record panels and structured failures |
| [platform](../../../packages/platform/README.md) | Session and host session providers/hooks, configured authenticated fetch, recovery, Sentinel; generic device connector and navigation/window ports; root plus `./auth`, `./monitoring`, `./devices`, `./navigation`, `./windows` exports |

The boundary table, diagram, executable rules and tests now allow platform → i18n/preferences/data. Data remains limited to i18n/preferences. AI moves above shell, adding patterns/page-engines/shell to its allowed imports; testing remains able to import every layer. No AI code is copied. Phase 5 ports AI after shell because client sources use workspace-core and the assistant panel uses erp-shell. Package and release indexes and plan mappings/status/order are updated.

## Installation, compatibility and decisions

Run root `npm install` with a writable cache if needed. These are ESM TypeScript source exports, not built or published artifacts. Platform peers on React `>=19` and depends on data `0.0.0`; data has no runtime package dependencies or React requirement. Root tooling dependencies remain unchanged; installation adds two workspace links and updates lock metadata.

Generic data HTTP factories already take request functions; their signatures, relative routes, response validation and failure semantics are preserved. Hosts supply base URL/authentication in the callback. Draft policy is copied from shared configuration into data. Recovery's `RequestFailure` is extracted unchanged into data and re-exported from platform with the same class identity. Existing data-specific failure classes remain distinct. The components error mapper is a display mapper and remains untouched; no new large client is invented.

Session configuration replaces environment reads and the module-level host with required `apiBaseUrl` and optional `fetch` (global fetch by default). An explicitly empty URL uses same-origin paths. The old standalone authenticated fetch becomes `createAuthedFetch(options)`, returning the same request-shaped callback. Validation/login timeouts, token handling, best-effort logout, retained-workspace recovery, identity checks, stale-response protection, cancellation and monitoring recursion semantics are preserved. Provider configuration changes revalidate and invalidate old validation generations.

Product-branded browser keys/events become generic `pepbits-*` identifiers; the guide lists all four old/new names. No old token migration occurs, so adopters sign in again and update host monitoring event listeners. Transport configuration remains per client/provider, while the original origin-wide bearer-store ownership is retained. Cookie/BFF hosts use `HostSessionProvider` and their own request callback. No tokens or credentials are logged.

No exported in-memory record adapter existed in the original frontend; only controller test mocks did. The requested `createMemoryRecordAdapter` is an additive, empty, per-scope volatile transport. It implements generic revision conflicts, stable successful-operation replay, draft filtering/expiry and isolated cloned snapshots. Read-only inspection of the generic backend record-store contract informed these behaviors; no backend file is modified or imported. It does not copy filesystem persistence, tenant/user multiplexing or product schema validation. Its direct malformed-command errors differ from HTTP service messages and are documented. It is not durable storage or proof of backend equivalence.

Generic approvals and record panels are included in full. `report-data.ts` is excluded because it is only hardcoded branch metrics. `mock.ts` and fixtures generate product datasets, not reusable transports. Care, clinical, billing, consultation, registration, label printing, identity/device product adapters and every `dcp-*` remain outside this phase. The patient-specific identity-capture half of devices is excluded; generic job ticket/status transport remains. Demo accounts and School application routing tests are excluded. Wire kind `dcp` and CSV error key `designer.datasetLimit` remain unchanged for compatibility, with no DCP product implementation.

All API differences and host wiring are recorded under “Differences from the original” in each package guide. The retained [parity script](evidence/restructure-phase-3-2026-10-22/verify-port.mjs) compares emitted JavaScript for 12 modules after the documented imports, failure extraction, namespace and identity exclusions, then separately compares session after the explicit host-configuration/factory/account transform. The new memory adapter is tested as an addition and is not claimed as a verbatim port.

## Preferences, data, errors and accessibility

These packages introduce no product UI, local formatting or preference store. Host controls use effective preferences/locks, canonical catalogs and shared components. Draft policy is mandatory tenant policy, including sensitive-field exclusions and 1–30-day retention. The original seven-day fallback remains. HTTP backends must enforce filtering/expiry and trusted identity; client scope strings and capabilities do not authorize access. Memory policy is reapplied on key access and is not durable recovery.

Record errors retain edits, retry the same operation ID, require review for conflicts and allow corrected submissions after definitive rejection. Monitoring accepts only safe allowlisted metadata; no raw exception bodies, values or credentials are included. Navigation/window/device contracts remain host-injected; no direct Tauri import or native execution. Localization/recovery keys and comments are retained, with host wording replacing product-role/branch catalog references. Protected canonical catalogs and existing generated examples/help/routes do not change, so no regeneration or application page-guide receipt is needed; package guides cover the new integration flow.

## Test port inventory and adaptations

**9 of 15 inspected source test files ported, retaining 81 original expanded cases.** Six entire source files are excluded; three product-specific cases are also removed from retained files. The mock suite depends on registry expansion, which was not executed: no aggregate original-case count is claimed. The [machine-readable inventory](evidence/restructure-phase-3-2026-10-22/test-port-inventory.json) lists every source, destination, count and reason. No retained tests are skipped.

| Original test file | Original cases | Ported cases and destination / reason |
| --- | --- | --- |
| erp-data `records.test.ts` | 11 | data 11; all controller cases |
| erp-data `csv-import.test.ts` | 5 | data 4; customer schema/conditional validation excluded |
| erp-data `draft-center.test.ts` | 2 | data 2 |
| erp-config `draft-policy.test.ts` | 2 | data 2 |
| erp-data `mock.test.ts` | Registry-expanded; not evaluated | Excluded product datasets, page registry and field classification |
| erp-data `dcp-host.test.ts` | 2 | Excluded DCP adapter, explicitly outside task scope |
| erp-data `dcp-runtime.test.ts` | 4 | Excluded DCP runtime and engine fixtures |
| auth `session.test.tsx` | 32 | platform 30; two demo-account cases excluded |
| auth `recovery.test.ts` | 9 | platform 9, including five parameterized HTTP statuses |
| auth `sentinel.test.ts` | 5 | platform 5 |
| platform-ports `devices.test.ts` | 1 | platform 1 |
| platform-ports `ports.test.tsx` | 17 | platform 17; generic navigation and windows |
| platform-ports `identity-devices.test.ts` | 2 | Excluded patient-specific identity capture contract |
| platform-ports `school-landing.test.tsx` | 3 | Excluded product LandingRedirect/catalog routes |
| platform-ports `school-web-navigation.test.tsx` | 4 | Excluded Next.js/School catalog and URL routing |

Source test adaptations preserve behavior assertions: session uses explicit host configuration, generic browser keys and fictional identity/routes; strict indexed mock accesses get type-only non-null annotations. React `act` uses Testing Library's environment wrapper. Recovery drains the early Sentinel queue after each test so a prior timeout does not contaminate the next subscriber. All fetch paths are mocked/injected; no tests contact a network service.

**20 additional cases**: data HTTP adapters 11 (encoded keys, request envelopes, response validation and safe failure metadata); memory records 5 (replay/conflict/create/scope, returned-value isolation, policy/expiry and controller integration); platform session 3 (host fetch, explicit same-origin and independent client configuration, stale validation on host change); recovery 1 (shared data error identity and monitoring bypass).

Nonoverlapping package totals: tokens **3 / 1 file**, icons **19 / 1**, i18n **64 / 6**, preferences **33 / 3**, ui **120 / 12**, components **189 / 15**, data **35 / 6**, platform **66 / 5** = **529 tests / 49 files**, zero failed/skipped. This is 428 existing + 81 ported + 20 added cases. The **19 Node tooling tests** are separate (16 existing + 3 layer-rule cases).

## Verification and limits

Executed locally by Codex; no independent human review or hosted CI run is claimed. Environment: Node `v22.22.1`, npm `9.2.0`, Turborepo `2.11.10`, Vitest `3.2.7`, React/React DOM `19.3.1`, jsdom `25.0.1`, Testing Library React `16.3.3`. Root still declares npm `11.13.0`. Commands run from the repository root; outputs redirected to the linked files.

| Exact command | Result and scope | Retained output |
| --- | --- | --- |
| `npm install --cache /tmp/pepbits-phase-3-npm-cache` | Exit 0: 2 packages added, 165 audited; 3 audit findings (1 moderate, 2 critical); no dependency remediation | [install](evidence/restructure-phase-3-2026-10-22/install.log) |
| `npm run ci` (initial) | Exit 1: boundaries 8/0 and tooling 19/19 passed; copied indexed accesses failed strict typecheck, corrected with type-only assertions | [initial CI](evidence/restructure-phase-3-2026-10-22/ci-initial.log) |
| `npm run typecheck -w @pepbits/platform` | Exit 0; standalone diagnostic check after indexed annotations, before additional host tests | [platform typecheck](evidence/restructure-phase-3-2026-10-22/typecheck-platform.log) |
| `npm run ci` (corrected) | Exit 1: eight typechecks and data 35/35 passed; new monitoring test received a previous test's buffered Sentinel event; fixed test cleanup and act wrapper | [corrected CI](evidence/restructure-phase-3-2026-10-22/ci-corrected.log) |
| `npm run ci` (retry) | Exit 0: 529/529 tests, 19/19 tooling, eight typechecks, boundary 8/0, zero build tasks; preceded final documentation and session closure formatting | [retry](evidence/restructure-phase-3-2026-10-22/ci-retry.log) |
| `npm run ci` (final) | Exit 0: boundaries **8 packages / 0 demos**, tooling **19/19**, typechecks **8/8** (7 cached), Vitest **529/529 in 49/49 files**, test tasks **8/8** (7 cached), build **0 tasks** | [final CI](evidence/restructure-phase-3-2026-10-22/ci-final.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` | Exit 0: **PASS 174 documentation files** | [documentation](evidence/restructure-phase-3-2026-10-22/docs-jiti.log) |
| `desktop-clients/node_modules/.bin/jiti docs/releases/unreleased/evidence/restructure-phase-3-2026-10-22/check-package-guides.mjs` | Exit 0: **3 package/index guide links checked** | [guide links](evidence/restructure-phase-3-2026-10-22/package-guide-links.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-3-2026-10-22/verify-port.mjs` | Exit 0: 12 module comparisons + session transform parity, 186 source hashes, product exclusions and protected/forbidden-text checks | [parity/isolation](evidence/restructure-phase-3-2026-10-22/source-isolation.log) |
| `git diff --stat -- desktop-clients dummy-api Jenkinsfile deploy run.sh run_all.sh .github` | Exit 0, 0 output bytes | [isolation output](evidence/restructure-phase-3-2026-10-22/source-isolation.log) |
| `git status --short desktop-clients` | Exit 0, 0 output bytes; no generated AGENTS.md | [isolation output](evidence/restructure-phase-3-2026-10-22/source-isolation.log) |
| `grep -rnE "@pepbits/(erp-\|ops-ui\|auth\|platform-ports\|workspace-core\|ai-\|reference-)\|desktop-clients\|localhost\|AED" packages/data/src packages/platform/src` | Exit 1, 0 matches/output; no intentional exceptions (table backslashes escape Markdown pipes only) | [scan output](evidence/restructure-phase-3-2026-10-22/source-isolation.log) |
| `git diff --check` | Exit 0, no whitespace errors | [isolation output](evidence/restructure-phase-3-2026-10-22/source-isolation.log) |

The ninth workspace is configuration-only. Build succeeds with zero executable tasks; this is not a built library/application or native executable. Cached tasks are explicitly counted in the final result and refer to matching source hashes. Retained artifacts are listed in [checksums.sha256](evidence/restructure-phase-3-2026-10-22/checksums.sha256).

Not run: original-workspace install/typecheck/Vitest/Turbo; API/backend, registry, deployment or `verify:*` suites; browser/web/desktop builds or journeys; native executables, real services/devices, identity providers, axe-core/screen-reader/native-speaker review; GitHub Actions or Jenkins. Plain Node documentation validation was not repeated because the existing checker imports TypeScript; the requested jiti runner was used. No canonical localization/example regeneration, shim, consumer migration, AI implementation, dependency audit remediation, publication, commit or push. Later restructure phases remain future work.

## Upgrade, rollback and publication

Existing consumers continue using original packages. New consumers opt into source exports, supply their URL/fetch/ports and catalogs/effective preferences, and sign in under the generic browser namespace (or supply a verified host session). No deployed data schema changes or persisted backend migration. Rollback removes/reverts this root-workspace increment and uses the existing consumer packages. All changes remain uncommitted in the working tree.
