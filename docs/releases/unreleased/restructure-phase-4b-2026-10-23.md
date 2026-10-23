# Library restructure phase 4b — 23 October 2026

Status: generic engines and phase 4a priority 2 implemented, locally verified, unreleased working tree; product pages and priority 3 patterns deferred. Work performed 22–23 October 2026. Base: `227173ba0fe84b61ad63a2096e18be41b834ffa7` on `main` (initial working tree clean). No commit, tag, push, publication or deployment. New package version: `0.0.0` (source workspace version). [Restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-4b-status); [testing guide 1.0.0](../../testing/v1.0.0/PRE-COMMIT.md).

Source identity: **5f0c27f5fe24dc289a6c6a78d5e90800a7b934f5771634b4de81b4270bedc40b**, SHA-256 over sorted `path + NUL + file SHA-256 + LF` entries in the [331-file source manifest](manifest-restructure-phase-4b-2026-10-23.json). Scope includes root workspace configuration, all packages/tooling, the plan and delivery index. This record, manifest and evidence are excluded to avoid self-reference. Final CI covers the implementation bytes; only package-guide/plan/index wording and this record/manifest/evidence were finalized afterward. Documentation checks cover final text. No implementation changed after successful CI.

## Changes and public API

Added **75 files** under `packages/page-engines`: manifest/configuration, guide, area/root exports, generic UI/configuration/CSS, fixtures and tests. Added **21 files** to patterns for priority 2 and shared testing helpers, and extended existing host/testing exports. Shared Pagination accepts allowed page sizes; icons exports 39 additional names through the existing icon package. Root lock metadata includes the new workspace. Package index, plan mappings/status and delivery index are updated. No shim, consumer migration, original catalog modification or generated example change.

| Area | Included public API |
| --- | --- |
| patterns `./approvals` | ApprovalWorkspace, RecordApproval, explicit adapter/role/actor configuration |
| patterns `./drafts` | DraftHost, useSharedDraft, DraftRecovery, DraftRecoveryCenter on data-layer drafts |
| patterns `./imports` | CsvImportDialog, structural definitions, CSV/workbook options/editor and worker |
| patterns `./screen-host`, `./testing` | Existing host/hooks extended below; shared TestHost/render and createTestDocument (testing export only) |
| page-engines `./record-page`, `./record-layout` | RecordPage, RecordIdentity, RecordNotice, RecordPageAction type, RecordActionBar; generic RecordSectionLayout/Card |
| `./types` | Page/column/filter/entity/form/template/engine/layout contracts, schema localization, form rules, filter partition/storage and explicit-metadata export policy |
| `./worklist` | WorklistPage, typed configuration/adapter, DataTable/CardGrid, column manager, filter bar, views/preview, column/filter hooks, search and exports |
| `./records`, `./forms` | Record host/editor/field/list hooks, save status and related panels; DynamicRecordForm and form navigation |
| `./templates`, `./template-state` | Configured and direct template workspaces, registry presentation, all generic engine/part/specialization/state helpers |
| `./renderer` | createPageRenderer, createEngineRenderers, typed context/registrations, UnsupportedPage and SkeletonFor |
| Root barrel | Re-exports included engine areas. No placeholder reports/dashboard/inbox exports. |

The [engine guide](../../../packages/page-engines/README.md) contains every API difference, a fictional Item definition + adapter + renderer example, provider wiring, user flows and styling requirements. The [patterns guide](../../../packages/patterns/README.md#phase-4b-workflow-wiring-and-compatibility) documents completed priority 2, recovery/session identity, service limits and differences. The historical [4a record](restructure-phase-4a-2026-10-22.md) and its evidence remain unchanged; its deferrals are updated in the plan and this record.

## Registry, layering and host decisions

The renderer snapshots host-supplied kind and template-ID maps. A registered template ID takes precedence over kind; absent/inherited names render the shared EmptyState. Built-in registration factories include only configured worklist, form and template engines. A worklist target with a mode can use the supplied form registration. Hosts own route access checks and can register additional page kinds. No product, showcase, preferences, shell or AI screen is imported.

ScreenHost adds only optional `document.subscribeClose(listener)` with an absent default, distinguishing explicit closure from suspension. `useScreenDraftState` reuses its existing transient dictionary/write callback and provides standalone local state. It resets on document/key changes. Document-owned record editors survive suspension and close through the data editor on explicit host closure; standalone unmount saves a draft and stops timers. Hosts close/dispose documents on sign-out. Shared testing helpers reuse phase 4a providers/hooks rather than simulating a second workspace implementation. AI uses only existing opaque inline-action/source-publication slots, including cleanup; no AI dependency.

Adapters replace implicit authenticated requests, product/session/workspace contexts and product registries. Worklist adds config + identity/request/application adapter, optional import/approval configuration, and navigation callbacks. Records require an explicit RecordHostValue; forms require schema and optional initial values. Configured templates take verified identity, adapter and definitions. Templates receive resources, slots/end times/availability, schedule labels/capacity and roles from typed host configuration. Runtime sample generators, product catalogs, entity instances, seeded notifications/currencies and module/navigation trees are omitted. The record layout is generic despite its original clinical folder; all three CSS modules and declarations are byte-identical.

Effective PreferenceHost values drive density, page size, stripes, sticky headers, wrapping, result view, filters memory, column storage scope, form navigation and formatting. Locked/unavailable updates stay guarded by the central provider. Shared Pagination omits unavailable sizes and guards its callback; result-view segments honor allowed choices. Alt+S respects the shortcut preference and document focus. Record/template preference props are removed in favor of the controlled provider; unlocked explicit template layout still works. Draft center retains the data service's fixed 25-row protocol limit; CSV-options review retains bounded 50-row staging. Neither becomes an unbounded page-size override.

Account column caches are scoped to identity and transport, including late-response isolation. Browser layout/filter/pending-view namespaces change from `nexora-*` to `pepbits-*`; no migration is implied. Filter allowlists still protect URLs/storage and free-text remains excluded. Export classification comes from explicit column metadata; missing classification is withheld. Original formula defenses, XLSX strings, value-free audits, print attribution, retry operation IDs, conflict review, draft retention/exclusions and server permission metadata remain. Servers must independently authorize reads/writes. UI locks and ScreenHost capabilities are not server authorization evidence.

Hosts load tokens, scan ui/components/patterns/page-engines in Tailwind and support CSS modules/TypeScript source. They supply canonical localization catalogs. Private test messages are not runtime fallbacks. Compatibility section attributes and localization keys remain unchanged; no canonical fallback/example regeneration is needed because protected sources are unchanged.

Dependencies use existing package conventions and the original XLSX tarball specification: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. No DnD dependency is needed. Initial install added one package; final install was up to date and audited 170. Three audit findings remain (one moderate, two critical). The inherited XLSX advisory history and dependency review remain follow-up work; no upgrade or audit acceptance is claimed.

## Test port inventory

**23 source files ported**, comprising **191 original expanded cases**: **189 source cases retained**, with **two explicitly replaced cases** described below. Replacements contribute **86 executed cases**. There are **13 additional cases** (three ScreenHost, one account-cache isolation, two worklist preferences, one schema localization and six renderer). Together these add **288 cases** to the phase 4a baseline of 619, for **907 tests in 86 files**. No retained suite is skipped. The [per-file machine inventory](evidence/restructure-phase-4b-2026-10-23/test-port-inventory.json) records counts, source/destination, fixture changes, replacements and all 21 deferred files.

Paths below are relative to original package `src`; destination areas match unless shown. Final counts include additions/replacements; they are not extra tests on top of the full-suite total.

| Original package / file | Original cases | Final destination cases |
| --- | --- | --- |
| erp-screens `approvals/approval-workspace.test.tsx` | 7 | patterns approvals: 7 |
| erp-screens `drafts/draft-center.test.tsx` | 3 | patterns drafts: 3 |
| erp-screens `drafts/use-shared-draft.test.tsx` | 4 | patterns drafts: 4 |
| erp-screens `imports/csv-import-dialog.test.tsx` | 6 | patterns imports: 6 |
| erp-screens `imports/csv-options.test.ts` | 3 | patterns imports: 3 |
| erp-screens `imports/workbook-options.test.ts` | 2 | patterns imports: 2 |
| erp-screens `record-page/record-page.test.tsx` | 2 | engines record-page: 2 |
| erp-screens `clinical-templates/record-layout.test.tsx` | 2 | engines record-layout: 2 |
| erp-config `filter-policy.test.ts` | 15 | engines types: 15 |
| erp-config `form-rules.test.ts` | 3 | engines types: 3 |
| erp-config `export-policy.test.ts` | 13 | engines types: 13 |
| erp-screens `worklist/export-rows.test.ts` | 26 | engines worklist: 26 |
| erp-screens `worklist/search-request.test.ts` | 10 | engines worklist: 10 |
| erp-screens `worklist/saved-view.test.tsx` | 11 | engines worklist: 11 |
| erp-screens `worklist/filter-bar.test.tsx` | 24 | engines worklist: 24 |
| erp-screens `worklist/use-column-layout.test.tsx` | 22 | engines worklist: 23 |
| erp-screens `worklist/use-filter-sync.test.tsx` | 9 | engines worklist: 9 |
| erp-screens `records/record-panels.test.tsx` | 4 | engines records: 4 |
| erp-screens `forms/dynamic-record-form.test.tsx` | 7 | engines forms: 7 |
| erp-screens `templates/page-template.test.tsx` | 8 | engines templates: 92 |
| erp-screens `templates/configured-template-page.test.tsx` | 3 | engines templates: 3 |
| erp-screens `templates/registry-template.test.tsx` | 3 | engines templates: 3 |
| erp-screens `templates/preference-compliance.test.tsx` | 4 | engines templates: 4 |

Fixture changes use fictional Item/Record A/Detail/Owner/schema/role data. Explicit synthetic column classifications replace product name-based lookup. Record-layout labels become Notes/Record. Draft/import/approval tests inject their ports; forms use the shared in-memory document helper for dirty guard, suspension and focused-pane behavior. Network/ports are mocked. No real service is contacted.

Two replacements: the page-template case that iterated the original 102 product definitions now has one coverage-integrity case plus **84 individually reported generic definitions** (12 engines × 6 views + five registry + seven specialization fixtures). Each retains validation, rendered-template and section-heading assertions. The template preference case that expected a local optimistic preference store now checks host acknowledgement/update semantics. That old assertion is incompatible with the required single controlled PreferenceHost; it is not claimed retained. All other original cases in the table retain their behavioral assertions with imports/providers/fictional inputs adapted.

Additional tests are in `patterns/src/screen-host.test.tsx` (three), engines `worklist/use-column-layout.test.tsx` (one), `worklist/preference-compliance.test.tsx` (two), `types/entity-schemas.test.ts` (one), and `renderer/renderer.test.tsx` (six). Final patterns: **118/17 files**; engines: **260/20 files**. Machine-readable [patterns results](evidence/restructure-phase-4b-2026-10-23/patterns-tests.json) and [engine results](evidence/restructure-phase-4b-2026-10-23/engines-tests.json) identify every executed case.

## Deferrals and destinations

| Excluded area/test files | Reason and destination |
| --- | --- |
| Standalone `reports/`, `dashboard/`, `inbox/`, `billing/billing-page.tsx` | Embed product worklist data, notification/line/currency fixtures or module navigation. Matching reports/ERP/healthcare demo apps, phase 6. Generic template report/dashboard engines are included. No original dedicated suites exist in these standalone folders. |
| `records/specialized-editors.test.tsx` (2 cases) | Tests excluded billing/consultation implementations and product fields/seeded lines, not a generic records component. ERP/healthcare demos and Healthcare repository. |
| `library/preference-compliance.test.tsx` (4 cases), `library/`, `page-library/`, template-library/template-demo/generated example | Showcase routes/demos; phase 6 showcase. Template preference-compliance is ported and worklist policy coverage is added. |
| `application-config.test.ts`, `data-classification.test.ts` | Product page/navigation/template/field registries belong to demo definitions or shell routing. Isolated schema localization and explicit-metadata export behavior are tested here. |
| Six other `clinical-templates` test files | record-age, query-search, library-page, clinical-templates, overview-data and query target excluded clinical models/pages. Healthcare repository / healthcare demo; library-page → showcase. Generic record-layout is ported. |
| Preferences, login, reference-module wrappers | Preferences → shell phase 5; login → shell/platform phase 5; wrappers replaced by demo routing phase 6. |
| consultation, op-consultation, op-registration, clinical-*, comprehensive-consultation, clinic-billing, care-pages | Healthcare repository / healthcare demo phase 6, excluding the generic record-layout copied here. |
| Spreadsheet, remaining DCP designer/catalog/rules/repeating authoring, label printing, identity/devices | Priority 3 patterns follow-up. Eleven source suites remain deferred: spreadsheet model; five designer suites; label, identity and device workspaces; two designer metadata/repeating config suites. Product mappings/subjects remain host-owned. |

Phase 4a's six priority 2 suites plus form-rules/export-policy are now ported. Its product data-classification suite remains excluded, along with the eleven priority 3 suites. All **21 deferred files** are listed individually in the inventory; their suites were not run and no aggregate unrun case count is invented. Earlier foundation/data/i18n/preference work remains in prior phase records.

## Verification and retained evidence

Executed locally by Codex; no independent reviewer or hosted CI run is claimed. [Environment](evidence/restructure-phase-4b-2026-10-23/environment.json): Node 22.22.1, npm 9.2.0 (root declares 11.13.0), Turbo 2.11.10, TypeScript 5.9.3, Vitest 3.2.7, React/React DOM 19.3.1, jsdom 25.0.1, Testing Library React 16.3.3, XLSX 0.20.3. Commands run from the repository root; workspace test output paths resolve from the package. Redirection only retains output.

| Exact command | Result and scope | Evidence |
| --- | --- | --- |
| `npm install --cache /tmp/pepbits-npm-cache` | Exit 0; initial 1 package added, final up to date, 170 audited; 3 audit findings | [initial](evidence/restructure-phase-4b-2026-10-23/install-initial.log), [final](evidence/restructure-phase-4b-2026-10-23/install.log) |
| `npm test -w @pepbits/page-engines -- src/worklist/preference-compliance.test.tsx` | Exit 0; 2 cases, included again in final suite | [focused preferences](evidence/restructure-phase-4b-2026-10-23/preference-focused.log) |
| `npm run ci` (first full attempt) | Exit 1; one combined 84-definition test exceeded 5 seconds under parallel load; 175/176 engine cases passed. Split into independently reported cases with unchanged per-definition assertions | [initial CI](evidence/restructure-phase-4b-2026-10-23/ci-initial.log) |
| `npm run ci` (final) | Exit 0: **10 packages / 0 demos**, **19/19 tooling**, **10/10 typechecks** (8 cached), **907/907 tests / 86 files**, **10/10 test tasks** (8 cached), **0 build tasks** | [final CI](evidence/restructure-phase-4b-2026-10-23/ci.log) |
| `npm test -w @pepbits/patterns -- --reporter=json --outputFile=../../docs/releases/unreleased/evidence/restructure-phase-4b-2026-10-23/patterns-tests.json` | Exit 0; **118 tests / 17 files**, zero failed/skipped/todo; machine receipt after CI | [log](evidence/restructure-phase-4b-2026-10-23/patterns-tests.log), [JSON](evidence/restructure-phase-4b-2026-10-23/patterns-tests.json) |
| `npm test -w @pepbits/page-engines -- --reporter=json --outputFile=../../docs/releases/unreleased/evidence/restructure-phase-4b-2026-10-23/engines-tests.json` | Exit 0; **260 tests / 20 files**, zero failed/skipped/todo; machine receipt after CI | [log](evidence/restructure-phase-4b-2026-10-23/engines-tests.log), [JSON](evidence/restructure-phase-4b-2026-10-23/engines-tests.json) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` | Exit 0; **176 documentation files**, final record/manifest/links and historical receipts | [documentation](evidence/restructure-phase-4b-2026-10-23/docs-jiti.log) |
| `desktop-clients/node_modules/.bin/jiti docs/releases/unreleased/evidence/restructure-phase-4b-2026-10-23/check-package-guides.mjs` (initial) | Exit 1; two guide links retained the previous date after the work crossed midnight; corrected to the 23 October record | [initial guide links](evidence/restructure-phase-4b-2026-10-23/package-guide-links-initial.log) |
| `desktop-clients/node_modules/.bin/jiti docs/releases/unreleased/evidence/restructure-phase-4b-2026-10-23/check-package-guides.mjs` | Exit 0; **5 package/index guides** | [guide links](evidence/restructure-phase-4b-2026-10-23/package-guide-links.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-4b-2026-10-23/write-manifest.mjs` | 331 source files and aggregate digest | [manifest](manifest-restructure-phase-4b-2026-10-23.json) |
| `node docs/releases/unreleased/evidence/restructure-phase-4b-2026-10-23/verify-port.mjs` | Exit 0; 331 source hashes, 3 byte-identical CSS/declaration pairs, exact XLSX spec, test receipts, protected paths and scan | [source isolation](evidence/restructure-phase-4b-2026-10-23/source-isolation.log) |
| `git diff --stat -- desktop-clients dummy-api Jenkinsfile deploy run.sh run_all.sh .github` | Exit 0, **0 output bytes** | [source isolation](evidence/restructure-phase-4b-2026-10-23/source-isolation.log) |
| `git status --short desktop-clients` | Exit 0, **0 output bytes**; no generated AGENTS.md | [source isolation](evidence/restructure-phase-4b-2026-10-23/source-isolation.log) |
| `git diff --check` | Exit 0, no whitespace errors | [source isolation](evidence/restructure-phase-4b-2026-10-23/source-isolation.log) |

Nonoverlapping package totals: tokens **3/1 file**, icons **19/1**, i18n **64/6**, preferences **33/3**, ui **120/12**, components **189/15**, data **35/6**, platform **66/5**, patterns **118/17**, engines **260/20** = **907/86**. Node tooling's 19 tests are separate; the eleventh workspace is configuration-only. JSON receipts repeat two suites to record per-file results and are not added to those totals.

Earlier incremental typecheck/test diagnostics corrected import routing, strict indexed access, test messages, explicit host wiring and preference fixtures. The new allowed-size check exposed that the shared Select does not consume per-option disabled flags; Pagination now filters unavailable sizes and guards its callback. Its corrected [focused log](evidence/restructure-phase-4b-2026-10-23/preference-focused.log) reports two passed cases. These overlap the final engine suite. Incremental temporary diagnostics were not all retained; this record claims final verification only for the identified source.

Required scan executed exactly:

```sh
grep -rniE "@pepbits/(erp-|ops-ui|auth|platform-ports|workspace-core|ai-|reference-)|desktop-clients|lucide-react|localhost|AED|patient|clinic|school|invoice|nexora" packages/page-engines/src
```

Exit 0 because **27 matching lines remain**, all matching the `clinic` substring in preserved `clinical` identifiers/comments. The [raw scan](evidence/restructure-phase-4b-2026-10-23/required-scan.log) reports every match, and [per-line justifications](evidence/restructure-phase-4b-2026-10-23/required-scan-justifications.json) give file, line, full text and reason. They are unchanged generic section DOM/localization identifiers, private test messages, or sensitive-data classification vocabulary/export safety comments/tests. No prohibited imports, old workspace paths, direct Lucide imports, local endpoints, currency/product fixtures or old storage namespace remain in engine source. The boundary checker also passes.

Change after the run (review, 23 October 2026): the additive `allowedPageSizes` prop on `@pepbits/components` `Pagination` had no test. The review added "offers only the page sizes a policy allows" to `packages/components/src/pagination.test.tsx` (file now 10/10), reran `npm run ci` and the documentation check, and regenerated the manifest with `write-manifest.mjs` (331 files, digest `77a6794eaf161550…`). The retained CI logs predate this test; the review's own run is reported in the commit message.

Evidence hashes are in [checksums.sha256](evidence/restructure-phase-4b-2026-10-23/checksums.sha256). Evidence contains synthetic fixtures and package/source metadata, no credentials.

Not run: original-workspace install/typecheck/tests/Turbo; original unmodified suites; backend/API, registry/deployment or `verify:*` gates; web/desktop application builds, browser journeys, compiled host CSS, real workers/downloads/print dialogs, native executables/devices, live services/identity providers, axe/screen-reader or native-speaker review; GitHub Actions/Jenkins. Plain Node documentation execution was not repeated because existing TypeScript imports require the requested jiti runner. No catalog/example regeneration, dependency remediation, new durability/auth backend, priority 3/product page/shell/AI implementation, publication, commit or push. Root build is a successful zero-task command, not an application/native build.

## Upgrade, limitations and rollback

Existing consumers keep their original packages. New consumers opt into source exports and explicit providers/configuration/adapters. Worklist wire paths and template row/line conventions remain compatible, but hosts must map them to verified services. The legacy dynamic form duplicate/audit entries remain presentation controls and its approval menu only emits its original notification; actual approval workflows use patterns adapters. Template document/import parts stage metadata/rows, not real uploads or production imports. No deployed schema or stored-data migration occurs. Rollback removes this independent workspace increment; protected consumers and data remain unchanged.
