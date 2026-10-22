# Library restructure phase 2 — 22 October 2026

Status: implemented, locally verified, unreleased working tree. Date: 2026-10-22. Base: `d8ddf361b0143d71cbd9d1e2ec4cdb54e3fbc804` on `main` (initial working tree clean). No commit, tag, push, registry publication or deployment. New package versions are `0.0.0` (source workspace versions). [Restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-2-status); [testing guide 1.0.0](../../testing/v1.0.0/PRE-COMMIT.md).

Source identity: **`283b339ce2d3ebf526d1e70edc7fd0e40e871533f0071e25c24bc79afa350b3b`**, SHA-256 over the sorted `path + NUL + file SHA-256 + LF` entries in the [148-file source manifest](manifest-restructure-phase-2-2026-10-22.json). Scope includes root workspace configuration, packages/tooling, the plan and delivery index; receipt/evidence files are excluded to avoid self-reference. Final checks match these bytes. Only this record, manifest and evidence were finalized after final CI.

## Changes and user impact

Added two independent packages, copied from ops-ui, and the React localization subpath. Each new package has a manifest, a single public source barrel, React library TypeScript configuration, per-package jsdom/Vitest setup, a README and ported tests.

| Package and guide | Public API |
| --- | --- |
| [ui](../../../packages/ui/README.md) | `cn`, `formatCompact`; buttons/form and choice controls; native temporal, quantity/unit and scanner inputs; option filtering, search/segmented selection; badges, avatars, skeletons and navigation link (14 source groups) |
| [components](../../../packages/components/README.md) | Cards/statistics, tabs/dropdowns, overlays, table/pagination/calendar, presentation provider/hook/types and new `presentationFromPreferences`; value/description and inline editing; reference data, form errors, print portal, recovery and error descriptors (17 source groups) |
| [i18n/react](../../../packages/i18n/README.md#react-localization-and-differences-from-ops-ui) | `Localization`, `MessageValues`, `LocalizationProvider`, `useLocalization`, `LocalizedText`, `LocalizationAliasProvider` |

Root test dependencies/lockfile now use the original workspace's jsdom and Testing Library ranges. The package index, plan and delivery index are updated. All required icons were already exported by `@pepbits/icons` and covered by its 19 cases, so no icon additions or bypass imports were needed. The boundary rules are unchanged. Existing consumers and deployments are untouched.

## Installation, compatibility and decisions

Run `npm install` at the root (use a writable temporary `--cache` if needed), then import public package names. These packages expose TypeScript source, not built or published artifacts. Both new packages are ESM, `sideEffects: false`, and peer-depend on `react >=19`; components also peers on `react-dom >=19` for its print portal. i18n now peers on React for its opt-in `./react` entry; the root entry remains free of React runtime imports.

Hosts import `@pepbits/tokens/tokens.css` and add both new `src` directories to Tailwind content/`@source`. The package guides include complete public-import examples composing localization, effective preferences and presentation. No CSS compilation is claimed by root CI. Existing utility/token classes and print styling remain unchanged, including compatibility class names.

Implementation split: exactly the requested 14 primitive and 17 composite groups; no upward imports or assignment changes. `option-filter` is in ui so composites can consume it. The mixed `shared-components` tests (including date, table and calendar cases) stay together in components. Localization-only tests move to i18n; UI-control integration remains in ui and mixed page-copy cases in components to keep dependencies downward. There was no standalone ops-ui `table.test.tsx`; its table case is in the ported `shared-components.test.tsx`, with managed behavior covered by the added presentation tests.

API differences are listed in both package guides: split imports; localization from `i18n/react`; removal of `formatCurrency`; no source-parity controls/dialog; additive presentation mapping. No retained component prop/signature changes. The new default translator uses English `CORE_CATALOG.en`, then literal message text, with the original placeholder substitution. Default date-time formatting stays `new Date(value).toLocaleString('en-US')`. Generated `messages.en.ts` is not copied: unchanged generic UI/recovery keys must be supplied by the host and otherwise display literally. `formatCompact` retains its original English-only compatibility behavior; hosts use `createFormatters` with effective settings for regional amounts/numbers.

`source-controls.tsx` and `source-dialog.tsx` are intentionally excluded. Read-only consumer inspection found imported reference-design screens/components, plus `erp-screens/src/library/demos.tsx` and `catalog.ts` entries that demonstrate those exact parity controls. They do not establish a separate generic consumer. Their 3 and 2 tests are the only unported cases.

`error-mapper.ts` is a pure mapping from `FailureInput` (status/network/detail/reference) to a display descriptor, with safe-detail filtering; it does not parse HTTP responses or envelopes. `failureFromError` reads status/name/reference from an error shape. Both stay with recovery in components; transport remains phase 3 work. Strict root index checking required type-only non-null assertions at existing bounds/lookup checks. A product/branch-specific dropdown comment and product-specific test fixtures/comments were generalized. The retained evidence script confirms emitted JavaScript parity for all **32 copied implementation modules**, after only the documented imports, currency removal, core-catalog substitution and additive helper exclusion.

## Preferences, data, errors and accessibility

`presentationFromPreferences` projects density, stripes, sticky header, wrapping and page size from an already effective `UserPreferences`. It has no policy resolver or persistence. `Table` still reads `PresentationProvider`; managed values win over local props, including while mounted. `Pagination` still takes controlled props: the host feeds effective page size into both pagination and its data controller, disables locked/unavailable choices and guards changes through `PreferenceHost.update`. Tests exercise the mapping, every managed table property, live changes, disabled/guarded page-size edits and standalone fallback.

No application data, persistence, API schema or authentication change. Hosts own catalogs/formatters, authorization, transport and retries. Inline editors retain failed-save values; recovery actions stay host-owned and preserve operation identity. UI policy is not server authorization, and in-memory form retention is not durable storage. Keyboard, ARIA, focus, RTL and reduced-motion implementation remain unchanged. Existing ops-ui unit tests had no axe-core checks; no automated axe or screen-reader certification is claimed. Synthetic four-language catalog tests verify wiring and stable values, not actual product translations or native-speaker approval.

## Test port inventory and adaptations

**26 of 28 source test files, 311 of 316 expanded cases ported.** Two files / five cases are intentionally not ported: `source-controls.test.tsx` (3) and `source-dialog.test.tsx` (2), because their source-parity implementations are excluded. No retained tests are skipped. The [machine-readable inventory](evidence/restructure-phase-2-2026-10-22/test-port-inventory.json) records each destination, count and adaptation; counts include parameterized cases and do not imply an old-workspace run.

| Original ops-ui test file | Original cases | Destination and retained cases |
| --- | --- | --- |
| `avatar.test.tsx` | 10 | ui 10 |
| `badge.test.tsx` | 12 | ui 12 |
| `button.test.tsx` | 5 | ui 5 |
| `card.test.tsx` | 6 | components 6 |
| `cn.test.ts` | 9 | ui 9 |
| `dropdown.test.tsx` | 11 | components 11 |
| `error-mapper.test.ts` | 32 | components 32 |
| `form-controls.test.tsx` | 30 | ui 30 |
| `inline-edit-typed.test.tsx` | 19 | components 19 |
| `inline-edit.test.tsx` | 15 | components 15 |
| `localization.test.tsx` | 4 | ui 3; i18n 1 |
| `option-filter.test.tsx` | 13 | ui 13 |
| `overlay.test.tsx` | 23 | components 23 |
| `page-copy-localization.test.tsx` | 9 | components 5; i18n 4 |
| `pagination.test.tsx` | 9 | components 9 |
| `quantity-unit-field.test.tsx` | 9 | ui 9 |
| `recovery-notice.test.tsx` | 5 | components 5 |
| `reference-data.test.tsx` | 17 | components 17 |
| `scanner-input.test.tsx` | 2 | ui 2 |
| `search-select.test.tsx` | 14 | ui 14 |
| `segmented.test.tsx` | 9 | ui 9 |
| `shared-components.test.tsx` | 11 | components 11 |
| `skeleton.test.tsx` | 4 | ui 4 |
| `source-controls.test.tsx` | 3 | Not ported |
| `source-dialog.test.tsx` | 2 | Not ported |
| `stat-card.test.tsx` | 6 | components 6 |
| `states.test.tsx` | 24 | components 24 |
| `tabs.test.tsx` | 3 | components 3 |

Assertions retain the original interaction/accessibility intent. Necessary fixture changes:

- Tests use a host `LocalizationProvider` render wrapper with small generic test catalogs; no application catalog is loaded or exported. Page-copy and recovery tests use synthetic locale-specific host catalogs in all four languages. Pure page-copy helper cases and the alias fallback are in i18n; the former generated invoice fallback assertion now checks the generic English core `save` → `Save` default.
- The five `cn` currency cases now call a host-selected `createFormatters` configuration (currency, locale, decimal and sign style explicit). They retain grouping, rounding, sign, zero and alternate-currency assertions without recreating the removed API. Inline edit, typed edit, stat-card and page-copy displays also use an explicit host formatter. Test-visible nonbreaking spaces are normalized for ICU/Testing Library matching. Option fixtures use another currency code without imposing a formatting default.
- Module IDs/options, the named branch and insurance-provider examples become generic priorities, choices and categories; case-insensitive filtering, description matching, highlight, selection and failure assertions remain. Product-specific explanatory test comments become generic.
- Three new i18n cases cover core/literal placeholders, provider/default date-time behavior and scoped aliases; three new presentation cases cover mapping, live managed integration and standalone behavior. Original default-context/alias behavior remains covered without importing a higher layer.

Final package totals are nonoverlapping: tokens **3 / 1 file**, icons **19 / 1**, i18n **64 / 6**, preferences **33 / 3**, ui **120 / 12**, components **189 / 15** = **428 tests / 38 files**, zero failed/skipped. This is the existing 111 foundation cases + 311 ported cases + 6 added cases. The 16 Node tooling tests are separate. Test-file totals grow because two suites are split across layers and presentation adds a file.

## Verification and limits

Executed locally by Codex; no independent human review or hosted CI run is claimed. Environment: Node `v22.22.1`, npm `9.2.0`, Turborepo `2.11.10`, Vitest `3.2.7`, React/React DOM `19.3.1`, jsdom `25.0.1`, Testing Library React `16.3.3`, jest-dom `6.9.1`, user-event `14.6.8`. Root still declares npm `11.13.0`. Commands run from the repository root.

| Exact command | Result and scope | Retained output |
| --- | --- | --- |
| `npm install --cache /tmp/pepbits-phase-2-npm-cache` | Exit 0: 32 packages added, 1 changed, 161 audited; 3 audit findings (1 moderate, 2 critical), no dependency remediation | [install](evidence/restructure-phase-2-2026-10-22/install.log) |
| `npm run ci` (initial) | Exit 1: boundaries 6/0 and tooling 16/16 passed; ui strict index type errors | [initial CI](evidence/restructure-phase-2-2026-10-22/ci-initial.log) |
| `npm run typecheck` | Exit 1: one remaining indexed mock-call assertion | [typecheck diagnostic](evidence/restructure-phase-2-2026-10-22/typecheck-initial.log) |
| `npm run typecheck -w @pepbits/components` | Exit 1: two bounded overlay indices needed type-only annotations | [component diagnostic](evidence/restructure-phase-2-2026-10-22/typecheck-components.log) |
| `npm test` (initial) | Exit 1: two newly added localization test fixtures joined adjacent text nodes, so exact text queries failed; corrected the fixtures with spans | [initial tests](evidence/restructure-phase-2-2026-10-22/tests-initial.log) |
| `npm run ci` (retry) | Exit 1: typechecks passed; nine formatted-display assertions in components failed on nonbreaking-space matching; fixed only test formatter normalization | [retry](evidence/restructure-phase-2-2026-10-22/ci-retry.log) |
| `npm run ci` (corrected) | Exit 0: all 428 tests, six typechecks, tooling and boundaries passed; preceded final generic option-fixture cleanup | [corrected](evidence/restructure-phase-2-2026-10-22/ci-corrected.log) |
| `npm run ci` (final) | Exit 0: boundaries **6 packages / 0 demos**, tooling **16/16**, typechecks **6/6** (4 cached), Vitest **428/428 in 38/38 files**, test tasks **6/6** (4 cached), build **0 tasks** | [final CI](evidence/restructure-phase-2-2026-10-22/ci-final.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` (initial) | Exit 1: evidence checksums file had not yet been created; added before final validation | [initial documentation](evidence/restructure-phase-2-2026-10-22/docs-jiti-initial.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` | Exit 0: **PASS 173 documentation files** | [documentation](evidence/restructure-phase-2-2026-10-22/docs-jiti.log) |
| `desktop-clients/node_modules/.bin/jiti docs/releases/unreleased/evidence/restructure-phase-2-2026-10-22/check-package-guides.mjs` | Exit 0: **4 package/index guide links checked** | [guide links](evidence/restructure-phase-2-2026-10-22/package-guide-links.log) |
| `node docs/releases/unreleased/evidence/restructure-phase-2-2026-10-22/verify-port.mjs` | Exit 0: 32 implementation-module parity checks, 148 source hashes, absent product catalog/source controls, protected checks and forbidden-text scan | [script](evidence/restructure-phase-2-2026-10-22/verify-port.mjs), [output](evidence/restructure-phase-2-2026-10-22/source-isolation.log) |
| `git diff --stat -- desktop-clients dummy-api Jenkinsfile deploy run.sh run_all.sh .github` | Exit 0, 0 output bytes | [isolation output](evidence/restructure-phase-2-2026-10-22/source-isolation.log) |
| `git status --short desktop-clients` | Exit 0, 0 output bytes; no generated `desktop-clients/AGENTS.md` | [isolation output](evidence/restructure-phase-2-2026-10-22/source-isolation.log) |
| `grep -rn "AED\|lucide-react\|@pepbits/ops-ui\|desktop-clients" packages/ui/src packages/components/src` | Exit 1, 0 matches/output; **no intentional exceptions** | [scan output](evidence/restructure-phase-2-2026-10-22/source-isolation.log) |
| `git diff --check` | Exit 0, no whitespace errors | [isolation output](evidence/restructure-phase-2-2026-10-22/source-isolation.log) |

The seventh workspace is configuration-only. Root `build` has zero executable tasks and is not evidence of a built library/application, native executable or deployment. Cached tasks above are explicitly counted; they refer to the unchanged source hashes from earlier successful runs. Retained artifacts are listed in [checksums.sha256](evidence/restructure-phase-2-2026-10-22/checksums.sha256). An initial parity-script check completed the 32 comparisons before the manifest existed; the final full check includes the completed manifest.

Not run: old-workspace install/typecheck/Vitest/Turbo; API, registry, deployment or `verify:*` suites; web/desktop builds; browser journeys or compiled Tailwind layout checks; axe-core, screen-reader, native-speaker review; native executables, real services, GitHub Actions or Jenkins. Plain Node documentation validation was not repeated because its existing `.ts` import limitation is known; the requested jiti runner was used. No catalog/example regeneration is needed because protected canonical sources and existing consumers are unchanged. No publication, shim, consumer migration, commit or push; all remaining restructure phases stay future work.

## Upgrade, rollback and publication

Existing consumers continue using the original workspace. New consumers opt into source exports, supply host catalogs/effective formatters and connect central preferences and Tailwind as shown in the guides. Rollback reverts/removes this root-workspace increment without changing deployed sites or stored data. All changes remain uncommitted in the working tree.
