# Library restructure phase 4a — 22 October 2026

Status: mandatory subset implemented, locally verified, unreleased working tree; remaining patterns deferred. Date: 2026-10-22. Base: `3a34eb4c98dde468c7366f35faa1eaf9d48ff13d` on `main` (initial working tree clean). No commit, tag, push, publication or deployment. New package version: `0.0.0` (source workspace version). [Restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-4a-status); [testing guide 1.0.0](../../testing/v1.0.0/PRE-COMMIT.md).

Source identity: **8a8f1f9d7c53949887a10f1ddaa354799157d548d85a0c6dcd19acdf4d212c2e**, SHA-256 over sorted `path + NUL + file SHA-256 + LF` entries in the [235-file source manifest](manifest-restructure-phase-4a-2026-10-22.json). Scope includes root workspace configuration, all packages/tooling, the plan and delivery index. This record, manifest and evidence are excluded to avoid self-reference. Final CI covers these implementation bytes. After CI, only plan punctuation/mapping wording, package-index ordering, this record, manifest and evidence were finalized; documentation checks cover the final text. No implementation changed after final CI.

## Changes and user impact

Added **49 files** under `packages/patterns`: manifest, shared React TypeScript settings, jsdom Vitest configuration/setup, integration guide, area/root barrels, copied UI/configuration/CSS, test helpers and tests. Root lock metadata adds the workspace and its XLSX dependency. No other package implementation changes. Plan status/mappings, package index and delivery index are updated.

| Public area | Included |
| --- | --- |
| `@pepbits/patterns/lifecycle` | Full generic lifecycle page and panels, source registry/mapping UI, CSS module; configuration contracts/guards/model/HTTP factories/source helpers |
| `@pepbits/patterns/master-transfer` | `MasterTransferPanel`/port/preview/props types, `PricingExpressionInput`, CSV/XLSX parse/read/export helpers, limits and data type |
| `@pepbits/patterns/dcp-fields` | `DcpRuntimeFields`, `DcpSectionFields`, `DcpFieldRenderer`; DCP v1 wire types/guards and writable-patch helper |
| `@pepbits/patterns/screen-host` | Provider/hook, typed host/document/scope contracts and memoized `useFormatters` |
| Root barrel | Re-exports the four implemented areas; no empty exports for deferred workflows |

All three mandatory product-consumed areas are complete. The authorized smaller-package stopping point is used before priorities 2 and 3. There is no `page-engines` package; phase 4b remains separate. The [package guide](../../../packages/patterns/README.md) covers user flows, public APIs, integration, permissions/preferences, failures and every compatibility difference.

## Installation, host contract and decisions

Root `npm install` adds two packages and audits 168. Patterns uses the source manifest's exact XLSX specification, `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; installed version is 0.20.3. It is required by master transfer. No DnD dependencies are needed and XLSX is not added to another package. npm-distributed XLSX versions have known advisories; dependency/security review remains a follow-up. Install reports three audit findings (one moderate, two critical), unchanged in count from phase 3; no remediation or broader audit acceptance is claimed.

The package follows existing `0.0.0` ESM source-export, shared tsconfig, Vitest/jsdom and README conventions. CSS modules are preserved, listed as side effects and require host bundler support. Hosts load tokens CSS and scan patterns/ui/components sources with Tailwind. Root/subpath source exports are not a built library artifact.

`ScreenHost` supplies localized `notify(message, {tone})`, fail-closed `can(action, subject?)`, opaque optional module/branch scope and document identity/focus/transient state/write/dirty callbacks. Defaults are empty/null state, focused standalone document and safe no-op callbacks. Optional opaque `renderInlineAction` and `publishSources` slots remain absent by default; AI fills them after phase 5. The shell will implement document ownership in phase 5. No monitor/documentation/tour/dashboard slots are invented because these screens do not call them. Existing explicit lifecycle/transfer permissions remain their UI gates; no product action-name mapping is introduced. Servers authorize all requests independently.

Preferences use the existing `PreferenceHost` and its single update path. Lifecycle no longer accepts the old optional preference props (`preferences`, `preferencePolicy`, `preferencesAvailable`, `onPreferenceChange`). It reads effective preferences and honors managed/unavailable page-size settings over explicit list-size props; otherwise explicit props win, with effective page size as fallback (current default 20, previously 25). The standalone source hook retains its 25-row default. Lifecycle's explicit detailed notification/dirty callbacks retain precedence; when absent they forward to ScreenHost. The generic notification intentionally omits the operation name; hosts needing it retain the explicit lifecycle callback.

Read-only DCP integer/decimal/date/date-time values now use effective formatters; editable values and native input wire contracts stay unchanged. Both lifecycle and DCP fields require `PreferenceHost`. Localization uses the existing i18n React provider and host catalogs. There is no second preference or localization store. All other retained APIs, markup/classes, CSS, ARIA, keyboard, comments, operation identity, recovery/conflict and row-authorization behavior are preserved except generalized product examples in comments and fixtures.

`LAYERS` is unchanged. The package imports only components, ui, i18n, preferences and data. No original-workspace, shell, AI or page-engine import is present. No shim, consumer migration or canonical catalog/example modification occurs. Generic English test messages are copied from canonical sources into a private test fixture (one product-specific example hint is omitted); no runtime product catalog is exported. No application page-guide impact receipt or regeneration is required because protected application pages are unchanged.

## Data, recovery and completion boundary

Hosts inject lifecycle requests and master-transfer ports. Lifecycle preserves expected revisions, operation fingerprints, change reasons, independent approval and explicit conflict/reload behavior. Master transfer retains file/reason validation, formula and expansion limits, pagination consistency checks and pending operation IDs across uncertain commit failures. Pricing expressions remain text for server preview, never browser scripts.

DCP fields require server-filtered views; masked fields and missing row authorization remain closed, including custom renderers. The shared runtime contract and patch helper are copied without product definitions. Document transient state and mounted editor values are not durable drafts. Lifecycle draft versions are business configuration versions. A future draft UI must use the existing data-layer draft service, retention and exclusion policies. No backend schema, storage or authorization implementation changes.

## Test port inventory and deferrals

**8 of 28 inspected test files ported; all 82 cases in those eight files retained.** No retained test is skipped or removed. **20 whole files are deferred**; their original suites were not executed and no aggregate unrun case count is invented. The [machine-readable inventory](evidence/restructure-phase-4a-2026-10-22/test-port-inventory.json) records every source/destination, count and reason.

| Original source relative to package `src` | Ported cases | Destination |
| --- | --- | --- |
| erp-screens `lifecycle/lifecycle.test.tsx` | 17 | patterns `lifecycle/lifecycle.test.tsx` |
| erp-screens `lifecycle/sources.test.tsx` | 11 | patterns `lifecycle/sources.test.tsx` |
| erp-screens `master-transfer/format.test.ts` | 8 | patterns same area/file |
| erp-screens `master-transfer/inflation.test.ts` | 2 | patterns same area/file |
| erp-screens `master-transfer/panel.test.tsx` | 3 | patterns same area/file |
| erp-screens `dcp-designer/runtime-fields.test.tsx` | 5 | patterns `dcp-fields/runtime-fields.test.tsx` |
| erp-config `lifecycle/lifecycle.test.ts` | 19 | patterns `lifecycle/config/lifecycle.test.ts` |
| erp-config `lifecycle/sources.test.ts` | 17 | patterns `lifecycle/config/sources.test.ts` |

Tests adapt imports/providers and neutralize synthetic fixture namespaces; behavioral assertions are retained. Source-registry render fixtures explicitly request the original 25-row size so their existing assertions remain valid despite the new effective default. Strict indexed-access annotations erase at runtime. No networks or real ports are contacted.

**8 added cases in 3 files:** screen-host defaults, partial providers, callback/extension forwarding, document isolation and effective formatter/update behavior (5); lifecycle host notifications/dirty state and live page-size/density policy (2); DCP read-only formatting under live locks with unchanged editable ISO values (1). Total patterns: **90 tests / 11 files**.

| Deferred source test file(s) | Reason; all listed files have 0 ported cases |
| --- | --- |
| erp-screens `approvals/approval-workspace.test.tsx` | Product roles, customer-page restriction and product service contexts require explicit generic configuration/ports. |
| erp-screens `drafts/draft-center.test.tsx`, `drafts/use-shared-draft.test.tsx` | Product/session/token/page-registry coupling and import/approval dialogs; defer the complete workflow. |
| erp-screens `imports/csv-import-dialog.test.tsx`, `imports/csv-options.test.ts`, `imports/workbook-options.test.ts` | Import dialog uses the product import-definition registry/entity types; defer options/worker with that area. |
| erp-screens `spreadsheet/model.test.ts` | Priority 3 lies beyond the completed mandatory subset. |
| erp-screens `dcp-designer/catalog-manager.test.tsx`, `dependencies.test.tsx`, `host-runtime.test.tsx`, `sections.test.tsx`, `workspace.test.tsx` | Remaining authoring/host runtime depends on page-template types and document/shell/AI integration; no upward imports or partial designer export. |
| erp-screens `label-printing/workspace.test.tsx` | Product category/page maps and data adapter need generic extraction. |
| erp-screens `identity-devices/workspace.test.tsx` | Subject-specific identity contracts and capture adapter remain product-owned. |
| erp-screens `device-integrations/workspace.test.tsx` | Product adapter and station/policy ownership need host integration. |
| erp-config `dcp-designer-metadata.test.ts`, `dcp-repeating.test.ts` | Authoring/catalog/rules/repeating configuration is not needed by DCP v1 fields and waits with the designer. |
| erp-config `form-rules.test.ts` | Generic schema validation is unused by the included subset; defer with schema/import work. |
| erp-config `export-policy.test.ts`, `data-classification.test.ts` | Export decisions depend on a product field-classification registry that must not enter the library. |

Inspected configuration exclusions: `dcp-designer*`, `dcp-rules`, `dcp-lifecycle`, `dcp-catalog` and repeating helpers (currently in `dcp-designer.ts`) are generic but unused here; designer field/section types extend page templates. `imports.ts` contains a customer-only definition lookup. `inbox.ts` mixes generic types with product notifications/currencies. Label configuration includes product page/category maps; identity configuration names a product subject; generic device configuration is deferred with its screen. No unused configuration, product catalogs, fixtures or runtime registries are added. There is no original `erp-config` DCP-runtime test file. Developer-Library `library-page.tsx` files are excluded for phase 6 showcase ownership.

## Verification and limits

Executed locally by Codex. No independent reviewer or hosted CI run is claimed. [Environment](evidence/restructure-phase-4a-2026-10-22/environment.json): Node 22.22.1, npm 9.2.0 (root declares 11.13.0), Turbo 2.11.10, TypeScript 5.9.3, Vitest 3.2.7, React/React DOM 19.3.1, jsdom 25.0.1, Testing Library React 16.3.3, XLSX 0.20.3. Commands below run from the repository root; output redirection does not change their scope.

| Exact command | Result and scope | Retained evidence |
| --- | --- | --- |
| `npm install --cache /tmp/pepbits-phase-4a-npm-cache` | Exit 0; 2 added, 168 audited; 3 findings (1 moderate, 2 critical) | [install](evidence/restructure-phase-4a-2026-10-22/install.log) |
| `npm run typecheck -w @pepbits/patterns` (incremental diagnostics) | Initial imported UI symbol routing and strict indexed access errors; later test-only missing assertions and invalid preference fixture corrected | [initial](evidence/restructure-phase-4a-2026-10-22/typecheck-initial.log), [indexed](evidence/restructure-phase-4a-2026-10-22/typecheck-indexed.log), [incremental](evidence/restructure-phase-4a-2026-10-22/typecheck-incremental.log), [host tests](evidence/restructure-phase-4a-2026-10-22/typecheck-with-host-tests.log) |
| `npm test -w @pepbits/patterns -- --reporter=json --outputFile=/tmp/pepbits-patterns-tests-initial.json` | Exit 1; 79/82 passed. Missing shared-dialog translations and original 25-row test setting corrected in fixtures | [log](evidence/restructure-phase-4a-2026-10-22/tests-initial.log), [retained diagnostic summary](evidence/restructure-phase-4a-2026-10-22/tests-initial-summary.json) |
| `npm test -w @pepbits/patterns -- --reporter=json --outputFile=/tmp/pepbits-patterns-tests-host.json` | Exit 1; 87/89 passed. Invalid 25-row preference fixture replaced with explicit list prop; new test's source-registry button name corrected | [log](evidence/restructure-phase-4a-2026-10-22/tests-with-host.log), [retained diagnostic summary](evidence/restructure-phase-4a-2026-10-22/tests-with-host-summary.json) |
| `npm run ci` (initial and corrected attempts) | Exit 1 in patterns typecheck; nine-package boundaries and 19 tooling cases passed. Remaining test-only destructuring assertions/date-format fixture corrected | [initial](evidence/restructure-phase-4a-2026-10-22/ci-initial.log), [corrected](evidence/restructure-phase-4a-2026-10-22/ci-corrected.log) |
| `npm run typecheck -w @pepbits/patterns` | Exit 0 after corrections | [ready](evidence/restructure-phase-4a-2026-10-22/typecheck-ready.log) |
| `npm test -w @pepbits/patterns -- --reporter=json --outputFile=../../docs/releases/unreleased/evidence/restructure-phase-4a-2026-10-22/tests.json` | Exit 0; **90/90 tests, 11/11 files**. Output path resolves from the workspace package | [log](evidence/restructure-phase-4a-2026-10-22/tests-ready.log), [JSON](evidence/restructure-phase-4a-2026-10-22/tests.json) |
| `npm run ci` (final) | Exit 0: **9 packages / 0 demos**, **19/19 tooling**, **9/9 typechecks** (8 cached), **619/619 tests in 60/60 files**, **9/9 test tasks** (8 cached), **0 build tasks** | [final CI](evidence/restructure-phase-4a-2026-10-22/ci-final.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` (initial) | Exit 1 while the record linked not-yet-written guide/parity/checksum artifacts; artifacts completed before rerun | [initial documentation](evidence/restructure-phase-4a-2026-10-22/docs-initial.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` (final) | Exit 0; **175 documentation files** | [documentation](evidence/restructure-phase-4a-2026-10-22/docs-jiti.log) |
| `desktop-clients/node_modules/.bin/jiti docs/releases/unreleased/evidence/restructure-phase-4a-2026-10-22/check-package-guides.mjs` | Exit 0; **2 package/index guides** | [guide links](evidence/restructure-phase-4a-2026-10-22/package-guide-links.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-4a-2026-10-22/verify-port.mjs` | Exit 0; **31 emitted-body comparisons** (includes all 8 original test suites), byte-identical CSS/declarations, exact XLSX spec, **235 source hashes**, isolation and scan | [parity/isolation](evidence/restructure-phase-4a-2026-10-22/source-isolation.log) |
| `git diff --stat -- desktop-clients dummy-api Jenkinsfile deploy run.sh run_all.sh .github` | Exit 0, **0 output bytes** | [isolation](evidence/restructure-phase-4a-2026-10-22/source-isolation.log) |
| `git status --short desktop-clients` | Exit 0, **0 output bytes**; no generated AGENTS.md | [isolation](evidence/restructure-phase-4a-2026-10-22/source-isolation.log) |
| `grep -rnE "@pepbits/(erp-\|ops-ui\|auth\|platform-ports\|workspace-core\|ai-\|reference-)\|desktop-clients\|lucide-react\|localhost\|AED\|patient\|clinic\|school" packages/patterns/src` | Exit 1, **0 matches**, 0 output bytes; no exceptions. Backslashes escape Markdown table pipes only | [scan](evidence/restructure-phase-4a-2026-10-22/source-isolation.log) |
| `git diff --check` | Exit 0; no whitespace errors | [isolation](evidence/restructure-phase-4a-2026-10-22/source-isolation.log) |

Nonoverlapping package totals: tokens **3/1 file**, icons **19/1**, i18n **64/6**, preferences **33/3**, ui **120/12**, components **189/15**, data **35/6**, platform **66/5**, patterns **90/11** = **619/60**, zero failed/skipped. Node tooling's **19 tests** are separate. The tenth workspace is configuration-only. Source bodies are compared after removing imports, documented fixture/provider changes and DCP formatting; lifecycle's new provider bridge is covered by the added tests while its entire controller is compared. No raw full original suites were executed. Evidence file hashes are in [checksums.sha256](evidence/restructure-phase-4a-2026-10-22/checksums.sha256).

Not run: original-workspace install/typecheck/tests/Turbo; API/backend, registry/deployment/`verify:*` suites; browser journeys, web/desktop builds, compiled host CSS, native executables/devices, real services/identity providers, axe/screen-reader or native-speaker review; GitHub Actions/Jenkins. Plain Node documentation execution was not repeated because its existing TypeScript imports need the requested jiti runner. No canonical localization/example regeneration, dependency remediation, durable-draft implementation, remaining-pattern or engine port, shell/AI implementation, publication, commit or push. Root build is a successful zero-task command, not a built application or native test.

## Upgrade, rollback and publication

Existing consumers remain on their current packages. New consumers opt into source exports, supply catalogs/effective preferences/ScreenHost and verified data ports, and configure CSS modules/Tailwind. No deployed schema or stored-data migration occurs. Rollback removes this independent root-workspace increment. All changes remain uncommitted; no consumer, backend or deployment path was modified.
