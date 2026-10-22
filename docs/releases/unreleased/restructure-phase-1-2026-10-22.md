# Library restructure phase 1 — 22 October 2026

Status: implemented, locally verified, unreleased working tree. Date: 2026-10-22. Base: `21a3f0f65ea278989784d838508373861021fd94` on `main`. No commit, tag, push, registry publication or deployment. All four new package versions are `0.0.0` (source workspace versions). [Restructure plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-1-status); [testing guide 1.0.0](../../testing/v1.0.0/PRE-COMMIT.md).

Source identity: **`db127bcd3b17eade0559dd778ec77dd73c3267a67ee33c25b245337ee8d4a126`**, SHA-256 over the sorted `path + NUL + file SHA-256 + LF` entries in the [69-file source manifest](manifest-restructure-phase-1-2026-10-22.json). Scope includes root workspace configuration, packages/tooling, the plan and delivery index; receipt/evidence files are excluded to avoid self-reference. Final checks match these bytes. Only this delivery record and evidence were finalized after the final CI run.

## Changes and user impact

Added four independent packages under the root workspace. Each has a manifest with public source exports, shared TypeScript configuration, `typecheck`/`test` scripts, a README integration guide and tests:

| Package and guide | Added public API |
| --- | --- |
| [tokens](../../../packages/tokens/README.md) | Unchanged CSS/font assets, licenses and provenance; 46 `TOKEN_NAMES`, `TokenName`, `tokenVar`; existing CSS and WOFF2 export paths |
| [icons](../../../packages/icons/README.md) | 16 primitive Lucide exports, `IconComponent`, `IconProps`, accessible `Icon` wrapper |
| [i18n](../../../packages/i18n/README.md) | Language metadata/direction, 18 core messages per language, host-owned translator/catalog store, four localization helpers, formatter types and factory |
| [preferences](../../../packages/preferences/README.md) | Preference types/defaults/validation, policies/locks/effective overrides, themes, formatter-option mapping; React provider and two hooks via `./react` |

The boundary checker now allows preferences to import tokens and i18n; two regression tests cover the new edge, its forbidden reverse and the remaining restrictions. Root test dependencies and lockfile are updated, along with the package index and plan. Existing application behavior and deployment configuration are unchanged. No existing export is deprecated or removed in this increment.

## Installation, compatibility and decisions

Run `npm install` from the repository root, then use the public exports in [the package guides](../../../packages/README.md). These packages expose TypeScript source; there are no build scripts or published artifacts yet. React packages peer-depend on `react >=19`; icons retain `lucide-react ^0.468.0`. Root Vitest is `^3.2.7` (installed 3.2.7).

This increment **copies** original sources, as explicitly directed by the owner. New code has no imports into the old workspace. CSS remains hand-written. The 13 token/font/license/provenance files are byte-identical to their sources. The four 18-key core dictionaries and language options are verbatim; policy implementation is also byte-identical. Formatter logic and localization-helper behavior remain compatible, with independent types and non-null assertions needed by the strict root TypeScript settings.

Translation factories replace the old global product-catalog singleton. Loaders are registered by each host and support immediate English, lazy English or other languages, deduplicated requests and retry after failure. React locale bindings are deferred to phase 2. `PreferenceHost` retains the generic `preferences`, `preferencePolicy` and `preferencesAvailable` property names, and uses a required `update(patch)` in place of the optional `onPreferenceChange(key, value)`. It waits for host snapshots, respects live policy/allowed values and owns no optimistic state or persistence (PREF-03).

No product catalogs, branch lists, branch time zones, navigation imports, module IDs or product icon maps were copied. Generic preference keys remain compatible, including empty `defaultModule` and the host-interpreted branch clock choice. Theme IDs and swatches remain; default `nexora` is a CSS selector, while its display name becomes `Blue` to remove the product name. Shortcuts are excluded because the source registry prescribes dashboard, record-tab and shell actions; their ownership belongs to the later shell phase.

## Data, errors and accessibility

No data migration, API schema or host persistence changes. Hosts own canonical product catalogs, transport, settings storage, authorization and error UI. Invalid policy input throws; invalid storage values are sanitized as before. React updates discard locked/disallowed/invalid entries and return the host's result/error; failed saves do not create local preference changes. Catalog-load failures reject and can be retried; untranslated keys and unknown service details preserve their fallback behavior. Calendar strings retain timezone-independent parsing; numeric locale remains independent of language. Icons are decorative by default and accept localized accessible labels. These unit checks do not establish native-speaker, screen-reader or server-authorization acceptance.

## Verification and limits

Executed locally by Codex; no independent human review or hosted CI run is claimed. Environment: Node `v22.22.1`, npm `9.2.0`, Turborepo `2.11.10`, Vitest `3.2.7`. The root still declares npm `11.13.0`, inherited from phase 0. Commands below run from the repository root.

| Exact command | Result and scope | Retained output |
| --- | --- | --- |
| `npm install` | Exit 226: default npm cache is read-only (`EROFS`); no dependency code failure | [initial install](evidence/restructure-phase-1-2026-10-22/install-initial.log) |
| `npm_config_cache=/tmp/pepbits-phase-1-npm-cache npm install` | Exit 0: 117 packages added, 127 audited; npm reported 3 vulnerabilities (1 moderate, 2 critical); no audit fix/upgrade applied | [install](evidence/restructure-phase-1-2026-10-22/install.log) |
| `npm run ci` (initial) | Exit 1: boundaries and 16 tooling tests passed; React export-map typechecking required explicit `rootDir` (TS2209) | [initial CI](evidence/restructure-phase-1-2026-10-22/ci-initial.log) |
| `npm run ci` (after config correction) | Exit 0: boundaries 4 packages / 0 demos; tooling 16/16; typecheck 4/4 tasks; Vitest 111/111 tests in 9/9 files; build 0 tasks | [corrected CI](evidence/restructure-phase-1-2026-10-22/ci-retry.log) |
| `npm run ci` (final) | Exit 0: boundaries 4 packages / 0 demos; tooling 16/16; typecheck 4/4 tasks, 0 cached; Vitest 111/111 tests in 9/9 files, 4/4 tasks, 0 cached; build 0 tasks | [final CI](evidence/restructure-phase-1-2026-10-22/ci-final.log) |
| `node docs/tools/check-docs.mjs` | Exit 1: Node cannot import the existing `library-pages.ts` (`ERR_UNKNOWN_FILE_EXTENSION`) | [plain Node output](evidence/restructure-phase-1-2026-10-22/docs-node.log) |
| `desktop-clients/node_modules/.bin/jiti docs/tools/check-docs.mjs` | Exit 0: **PASS 172 documentation files** | [documentation output](evidence/restructure-phase-1-2026-10-22/docs-jiti.log) |
| `git diff --stat -- desktop-clients dummy-api Jenkinsfile deploy run.sh run_all.sh .github` | Exit 0, 0 output bytes; all protected tracked paths unchanged | [source/isolation output](evidence/restructure-phase-1-2026-10-22/source-isolation.log) |
| `git status --short desktop-clients` | Exit 0, 0 output bytes; no untracked `desktop-clients/AGENTS.md` | [source/isolation output](evidence/restructure-phase-1-2026-10-22/source-isolation.log) |
| `python3 docs/releases/unreleased/evidence/restructure-phase-1-2026-10-22/verify-port.py` | Exit 0: 13 assets byte-identical; core dictionaries/language options and policy parity; 69 source hashes match; all protected-path status checks empty | [script](evidence/restructure-phase-1-2026-10-22/verify-port.py), [output](evidence/restructure-phase-1-2026-10-22/source-isolation.log) |
| `git diff --check` | Exit 0, no whitespace errors | Local source check |

Package counts are separate and nonoverlapping: tokens **3 tests / 1 file**, icons **19 / 1**, i18n **56 / 4**, preferences **33 / 3**; total **111 / 9**, zero skipped or failed. The **16 Node tooling tests** are separate from the Vitest count. All four typecheck tasks run; the fifth workspace is configuration-only. `turbo run build` has zero executable build tasks and is not evidence of a built library, application, native executable or deployed release. Retained evidence bytes are listed in [checksums.sha256](evidence/restructure-phase-1-2026-10-22/checksums.sha256).

The adapted tests preserve the relevant original i18n, localization-formatting, preference-defaults and generic live-policy locking cases. Added cases pin lookup precedence, interpolation, lazy catalog isolation/retries, accounting/date/time edges, preference validation/policy restrictions and icon accessibility. Browser/template/product assertions from old workspace suites were not copied into these foundations.

Not run: old-workspace install/typecheck/Vitest/Turbo, API/registry/deployment tests, `verify:*` gates, web/desktop builds, browser journeys, live integrations, native execution, native-speaker/accessibility review, GitHub Actions or Jenkins. Protected sources are unchanged; root hosted CI wiring remains outside scope. No localization fallback/example regeneration is needed because canonical product catalogs and existing consumers are untouched. No dependency audit remediation was attempted within this pinned foundation port.

## Upgrade, rollback and publication

Existing consumers continue using the original independent workspace. Future consumers opt into these source exports and provide their own catalogs/preferences/update callbacks; no automatic switch or shim is installed. Rollback removes/reverts this root-workspace increment without changing running sites or persisted data. No commit or push was made; all changes remain in the working tree.
